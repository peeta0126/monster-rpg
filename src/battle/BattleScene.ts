import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { getBattleInitData } from "./battleInitStore";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { PIXEL_FONT, textResolution, redrawTextOnFontLoad } from "../shared/phaser/text";
import { PALETTE, HEX, hpToken } from "../shared/palette";
import type { StatusEffect } from "../shared/game";
import type { BattleResultPayload, BattlePlayerSwitchPayload, BattleHitPayload } from "../shared/phaser/events";

export interface BattleSceneUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  playerStatus: StatusEffect;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatus: StatusEffect;
}

// ─── 캔버스 / 레이아웃 상수 ────────────────────────────────────────────────────

const W = 960;
const H = 540;
const BATTLE_H = H;     // 전투 무대는 캔버스 전체를 쓴다.
                        // 예전엔 400까지만 그리고 400~540을 로그 칸으로 비워 뒀는데,
                        // 로그가 React 쪽 고정 줄로 옮겨가면서 그 띠가 빈 공간으로 남았다.
const LOG_Y = 400;      // 하단 로그 패널 시작
const FLOOR_Y = 318;    // 탑 바닥면

// 적은 좌상단, 아군은 우하단 — 대각선 배치로 시선이 흐르게 한다 (ART_DIRECTION 3-2).
// 예전엔 같은 Y선에 좌우로 마주 보게 두어 원근이 없었다.
const ENEMY_X  = 300;
const ENEMY_Y  = 206;
const PLAYER_X = 664;
const PLAYER_Y = 268;
const MONSTER_SIZE = 140;
const FINAL_BOSS_SIZE = 210;

// HP 패널 (몬스터 바로 위)
// 몬스터 top = MONSTER_Y - MONSTER_SIZE/2 = 162
// 패널 bottom = 158 (4px 여유)
const PANEL_W = 210;
const PANEL_H = 62;
// HP 패널은 각자 몬스터 위에 붙는다
const E_PANEL_CY = 108;
const P_PANEL_CY = 396;

// HP 바: 패널 안 하단
const BAR_H = 10;
// 패널 내부 바 좌표 (공통)
const BAR_X_INNER = 10;        // 패널 내 왼쪽 여백
const BAR_Y_IN_PANEL = PANEL_H - 22; // 패널 상단으로부터의 Y = 40
const BAR_W_INNER = PANEL_W - 20;    // = 190
// 절대 좌표 캐시
const E_BAR_X = ENEMY_X - PANEL_W / 2 + BAR_X_INNER;
const E_BAR_Y = E_PANEL_CY - PANEL_H / 2 + BAR_Y_IN_PANEL;
const P_BAR_X = PLAYER_X - PANEL_W / 2 + BAR_X_INNER;
const P_BAR_Y = P_PANEL_CY - PANEL_H / 2 + BAR_Y_IN_PANEL;

// ─── 층별 횃불 색 ──────────────────────────────────────────────────────────────

function torchPalette(floor: number, isBoss: boolean) {
  if (isBoss) return { base: HEX.mist500, mid: HEX.mist300, tip: HEX.cream100, glow: HEX.mist500 };
  if (floor <= 10)  return { base: HEX.ember600, mid: HEX.ember500, tip: HEX.cream100, glow: HEX.ember500 };
  if (floor <= 20)  return { base: HEX.ember700, mid: HEX.ember600, tip: HEX.ember500, glow: HEX.ember600 };
  return { base: HEX.ember700, mid: HEX.ember700, tip: HEX.ember600, glow: HEX.ember700 };
}

// ─── Scene ────────────────────────────────────────────────────────────────────

/** idle: 기술 선택 대기 | showing: 로그 표시 중 (Q 대기) | result: 결과 오버레이 표시 */
type LogState = "idle" | "showing" | "result";

export default class BattleScene extends Phaser.Scene {
  // ── 스프라이트 ──
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  // ── HP 바 ──
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpText!: Phaser.GameObjects.Text;
  private playerHpText!: Phaser.GameObjects.Text;
  private enemyNameText!: Phaser.GameObjects.Text;
  private playerNameText!: Phaser.GameObjects.Text;
  private enemyStatusBadge!: Phaser.GameObjects.Text;
  private playerStatusBadge!: Phaser.GameObjects.Text;

  // ── 로그 알림 ──
  private logState: LogState = "idle";

  private notifBox!: Phaser.GameObjects.Graphics;
  private notifText!: Phaser.GameObjects.Text;
  private notifHint!: Phaser.GameObjects.Text;
  private idleText!: Phaser.GameObjects.Text;

  // ── 결과 오버레이 ──
  private resultVeil!: Phaser.GameObjects.Graphics;
  private resultTitle!: Phaser.GameObjects.Text;

  // ── HP 변화 추적 (shake 판정) ──
  private prevPlayerHp = -1;
  private prevEnemyHp  = -1;

  // ── HP 바 애니메이션 ──
  // cur 은 실제 값을 빠르게 따라가고, ghost 는 뒤에서 천천히 쫓아온다.
  // 둘의 간격이 "방금 얼마나 깎였는지"를 보여준다 (JRPG/격겜 관례).
  private hpAnim = {
    enemy:  { cur: 1, ghost: 1 },
    player: { cur: 1, ghost: 1 },
  };

  /** 스킵 대상 연출 트윈. 무한 반복(둥실거림)은 여기 넣지 않는다. */
  private fxTweens = new Set<Phaser.Tweens.Tween>();
  private reduceMotion = false;

  // ── 생존 플래그: false이면 모든 gameEvents 핸들러를 무시 ──
  private _isActive = false;

  // ── 예외를 잡아 reportSceneError로 보내는 핸들러. on/off에서 동일 참조를 써야
  //    리스너가 정확히 해제되므로 인스턴스 필드에 보관한다 ──
  private safeOnStateUpdate!: (p: BattleSceneUpdatePayload) => void;
  private safeOnBattleLog!: (message: string) => void;
  private safeOnBattleResult!: (payload: BattleResultPayload) => void;
  private safeOnBattleEnd!: () => void;
  private safeOnPlayerSwitch!: (payload: BattlePlayerSwitchPayload) => void;
  private safeOnHit!: (payload: BattleHitPayload) => void;
  private safeOnAutoAdvance!: () => void;
  private safeOnSparkle!: (target: "enemy" | "player") => void;

  constructor() {
    super("BattleScene");
  }

  // ─────────────────────────────────────────────────────────────────────────────

  preload() {
    const d = getBattleInitData();
    if (!d) return;
    this.load.image("enemy-mon", d.enemyImageUrl);
    // 파티 전체 이미지를 party-mon-{i} 키로 미리 로드 (교체 즉시 텍스처 전환 가능)
    (d.partyImageUrls ?? [d.playerImageUrl]).forEach((url, i) => {
      if (url) this.load.image(`party-mon-${i}`, url);
    });
  }

  create() {
    try {
      this.createImpl();
    } catch (error) {
      reportSceneError(this, error);
    }
  }

  private createImpl() {
    this._isActive = true;

    // scene이 destroy될 때 gameEvents 리스너를 반드시 정리
    this.events.once(Phaser.Scenes.Events.DESTROY,  this._removeGameListeners, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this._removeGameListeners, this);

    const d = getBattleInitData();
    const floor = d?.floor ?? 1;
    const isBoss = d?.isBoss ?? false;

    this.buildBackground(floor, isBoss);
    this.buildMonsterSprites();
    this.buildHudPanels();
    this.buildLogArea();
    this.buildResultOverlay();
    this.registerInput();

    // 이름/레벨 초기 표시
    if (d) {
      this.updateNames(d.playerName, d.playerLevel, d.enemyName, d.enemyLevel);
    }

    // 보스층 뱃지
    if (isBoss) {
      const bossBg = this.add.graphics().setDepth(20);
      bossBg.fillStyle(HEX.mist500, 0.85);
      bossBg.fillRoundedRect(ENEMY_X - 36, E_PANEL_CY - PANEL_H / 2 - 22, 72, 18, 5);
      this.add.text(ENEMY_X, E_PANEL_CY - PANEL_H / 2 - 13, "★  BOSS  ★", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.mist300, fontStyle: "bold",
      }).setOrigin(0.5, 0.5).setDepth(21);
    }

    this.safeOnStateUpdate  = safeHandler(this, this.onStateUpdate.bind(this));
    this.safeOnBattleLog    = safeHandler(this, this.onBattleLog.bind(this));
    this.safeOnBattleResult = safeHandler(this, this.onBattleResult.bind(this));
    this.safeOnBattleEnd    = safeHandler(this, this.onBattleEnd.bind(this));
    this.safeOnPlayerSwitch = safeHandler(this, this.onPlayerSwitch.bind(this));

    gameEvents.on(GAME_EVENT.BATTLE_STATE_UPDATE,  this.safeOnStateUpdate);
    gameEvents.on(GAME_EVENT.BATTLE_LOG,           this.safeOnBattleLog);
    gameEvents.on(GAME_EVENT.BATTLE_RESULT,        this.safeOnBattleResult);
    gameEvents.on(GAME_EVENT.BATTLE_END,           this.safeOnBattleEnd);
    gameEvents.on(GAME_EVENT.BATTLE_PLAYER_SWITCH, this.safeOnPlayerSwitch);
    this.safeOnHit     = safeHandler(this, this.onHit.bind(this));
    this.safeOnSparkle = safeHandler(this, this.onSparkle.bind(this));
    gameEvents.on(GAME_EVENT.BATTLE_HIT,     this.safeOnHit);
    // 자동 진행 타이머도 Q 와 같은 경로를 탄다 — 로그 처리 경로를 둘로 만들지 않는다
    this.safeOnAutoAdvance = safeHandler(this, this.onAdvance.bind(this));
    gameEvents.on(GAME_EVENT.BATTLE_LOG_ADVANCE, this.safeOnAutoAdvance);
    gameEvents.on(GAME_EVENT.BATTLE_SPARKLE, this.safeOnSparkle);

    this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    this.registerFxSkip();

    this.cameras.main.fadeIn(500, 0, 0, 0);

    gameEvents.emit(GAME_EVENT.BATTLE_READY);

    redrawTextOnFontLoad(this);
    markSceneReady(this);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 배경: 따뜻한 모험의 탑 내부
  // ─────────────────────────────────────────────────────────────────────────────

  private buildBackground(floor: number, isBoss = false) {
    const palette = torchPalette(floor, isBoss);

    // ── 벽 기반색 (보스층: 어두운 보라, 일반: 따뜻한 갈색) ──
    const wall = this.add.graphics().setDepth(0);
    wall.fillStyle(isBoss ? HEX.shadow800 : HEX.stone600, 1);
    wall.fillRect(0, 0, W, BATTLE_H);

    // ── 돌 블록 그리드 ──
    const bw = 44, bh = 28;
    const rows = Math.ceil(FLOOR_Y / bh);
    for (let row = 0; row < rows; row++) {
      const y0 = row * bh;
      const y1 = Math.min(y0 + bh, FLOOR_Y);
      const offset = row % 2 === 0 ? 0 : bw / 2;

      // 블록 내부 (약간 다른 명도 — 홀수 행 살짝 밝게)
      if (row % 3 === 1) {
        const hi = this.add.graphics().setDepth(0);
        hi.fillStyle(HEX.earth500, 0.4);
        hi.fillRect(0, y0, W, y1 - y0);
      }

      // 세로 조인트
      const joints = this.add.graphics().setDepth(1);
      joints.lineStyle(1, HEX.shadow900, 1);
      for (let x = offset; x <= W; x += bw) {
        joints.beginPath();
        joints.moveTo(x, y0);
        joints.lineTo(x, y1);
        joints.strokePath();
      }
      // 가로 조인트
      joints.beginPath();
      joints.moveTo(0, y0);
      joints.lineTo(W, y0);
      joints.strokePath();
    }

    // ── 천장 (어두운 석조 아치 암시) ──
    const ceiling = this.add.graphics().setDepth(2);
    ceiling.fillStyle(HEX.shadow900, 1);
    ceiling.fillRect(0, 0, W, 28);
    ceiling.fillStyle(HEX.shadow800, 1);
    ceiling.fillRect(0, 28, W, 12);

    // ── 배경 중앙 아치/통로 (픽셀아트: 계단형 아치) ──
    const arch = this.add.graphics().setDepth(1);
    arch.fillStyle(HEX.shadow900, 1);
    // 픽셀아트 계단형 아치 - 각 단계가 4px 블록 단위
    arch.fillRect(W / 2 - 56, 40, 112, 260);  // 내부 통로
    arch.fillRect(W / 2 - 72, 56, 144, 244);
    arch.fillRect(W / 2 - 88, 72, 176, 228);
    arch.fillRect(W / 2 - 76, 44, 152, 12);   // 아치 상단 가로
    // 아치 내부 원근감 (더 밝은 원거리)
    arch.fillStyle(HEX.shadow900, 1);
    arch.fillRect(W / 2 - 80, 76, 160, 224);
    // 아치 테두리 픽셀 강조
    arch.lineStyle(3, HEX.earth400, 1);
    arch.strokeRect(W / 2 - 56, 40, 112, 260);
    arch.lineStyle(2, HEX.earth500, 0.7);
    arch.strokeRect(W / 2 - 72, 56, 144, 244);

    // ── 횃불 앰비언트 빛 (벽에 퍼지는 따뜻한 빛) ──
    const ambLeft = this.add.graphics().setDepth(1);
    ambLeft.fillStyle(palette.glow, 0.1);
    ambLeft.fillCircle(115, FLOOR_Y - 50, 120);
    ambLeft.fillStyle(palette.glow, 0.07);
    ambLeft.fillCircle(115, FLOOR_Y - 50, 200);

    const ambRight = this.add.graphics().setDepth(1);
    ambRight.fillStyle(palette.glow, 0.1);
    ambRight.fillCircle(845, FLOOR_Y - 50, 120);
    ambRight.fillStyle(palette.glow, 0.07);
    ambRight.fillCircle(845, FLOOR_Y - 50, 200);

    // 앰비언트 빛도 깜빡임
    this.tweens.add({ targets: ambLeft, alpha: { from: 0.75, to: 1 }, duration: 600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    this.tweens.add({ targets: ambRight, alpha: { from: 0.75, to: 1 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 200 });

    // ── 바닥 ──
    const floorBg = this.add.graphics().setDepth(2);
    floorBg.fillStyle(HEX.stone600, 1);
    floorBg.fillRect(0, FLOOR_Y, W, BATTLE_H - FLOOR_Y);
    // 바닥 타일 라인
    floorBg.lineStyle(1, HEX.shadow900, 1);
    for (let y = FLOOR_Y + 16; y < BATTLE_H; y += 16) {
      floorBg.beginPath(); floorBg.moveTo(0, y); floorBg.lineTo(W, y); floorBg.strokePath();
    }
    for (let x = 0; x < W; x += 36) {
      floorBg.beginPath(); floorBg.moveTo(x, FLOOR_Y); floorBg.lineTo(x, BATTLE_H); floorBg.strokePath();
    }
    // 바닥 경계선 강조
    floorBg.lineStyle(2, HEX.earth400, 0.5);
    floorBg.beginPath(); floorBg.moveTo(0, FLOOR_Y); floorBg.lineTo(W, FLOOR_Y); floorBg.strokePath();

    // ── 양쪽 기둥 (픽셀아트 블록) ──
    const pillar = this.add.graphics().setDepth(2);
    // 좌기둥
    pillar.fillStyle(HEX.shadow900, 1);
    pillar.fillRect(0, 0, 24, BATTLE_H);
    pillar.fillStyle(HEX.stone600, 1);
    pillar.fillRect(0, 0, 8, BATTLE_H);
    pillar.fillStyle(HEX.shadow900, 1);
    pillar.fillRect(16, 0, 8, BATTLE_H);
    // 우기둥
    pillar.fillStyle(HEX.shadow900, 1);
    pillar.fillRect(W - 24, 0, 24, BATTLE_H);
    pillar.fillStyle(HEX.stone600, 1);
    pillar.fillRect(W - 8, 0, 8, BATTLE_H);
    pillar.fillStyle(HEX.shadow900, 1);
    pillar.fillRect(W - 24, 0, 8, BATTLE_H);
    // 기둥 경계선
    pillar.lineStyle(2, HEX.earth500, 0.8);
    pillar.strokeRect(0, 0, 24, BATTLE_H);
    pillar.strokeRect(W - 24, 0, 24, BATTLE_H);
    // 픽셀 블록 구분선 (수평)
    pillar.lineStyle(1, HEX.shadow800, 0.5);
    for (let y = 28; y < BATTLE_H; y += 28) {
      pillar.beginPath(); pillar.moveTo(0, y); pillar.lineTo(24, y); pillar.strokePath();
      pillar.beginPath(); pillar.moveTo(W - 24, y); pillar.lineTo(W, y); pillar.strokePath();
    }

    // ── 발판 그림자 (픽셀아트: 사각형) ──
    const shadow = this.add.graphics().setDepth(3);
    shadow.fillStyle(HEX.shadow900, 0.55);
    shadow.fillRect(ENEMY_X - 58, ENEMY_Y + MONSTER_SIZE / 2 - 10, 116, 13);
    shadow.fillRect(PLAYER_X - 58, PLAYER_Y + MONSTER_SIZE / 2 - 10, 116, 13);

    // ── 횃불 ──
    this.buildTorch(115, FLOOR_Y - 52, palette);
    this.buildTorch(845, FLOOR_Y - 52, palette);

    // ── 층 번호 ──
    this.add.text(W - 30, 36, `${floor}F`, {
      fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand300,
    }).setOrigin(1, 0.5).setDepth(10).setAlpha(0.9);

    // ── 로그 패널 배경 ──
    // 예전엔 여기에 불투명한 로그 패널을 깔아 캔버스 아래 1/4을 덮었다. 로그가 React 쪽
    // 고정 줄로 옮겨간 지금은 바닥이 그대로 보이는 게 맞다. 대신 아래로 갈수록 어두워지는
    // 그라디언트만 남겨 하단 UI와 자연스럽게 이어붙인다.
    const floorFade = this.add.graphics().setDepth(10);
    for (let i = 0; i < 24; i++) {
      floorFade.fillStyle(HEX.shadow900, (i / 24) * 0.85);
      floorFade.fillRect(0, LOG_Y + i * ((H - LOG_Y) / 24), W, (H - LOG_Y) / 24 + 1);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 횃불 (3레이어 자연스러운 불꽃)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildTorch(
    x: number, y: number,
    palette: { base: number; mid: number; tip: number; glow: number }
  ) {
    // 받침대
    const holder = this.add.graphics().setDepth(4);
    holder.fillStyle(HEX.earth500, 1);
    holder.fillRect(x - 3, y + 12, 6, 20);
    holder.fillRect(x - 9, y + 6, 18, 8);
    holder.fillStyle(HEX.shadow800, 1);
    holder.fillRect(x - 5, y - 2, 10, 14);

    // 글로우 (배경 빛 — 크게)
    const glow = this.add.graphics().setDepth(3);
    glow.fillStyle(palette.glow, 0.14);
    glow.fillCircle(x, y, 52);
    glow.fillStyle(palette.glow, 0.22);
    glow.fillCircle(x, y, 26);
    this.tweens.add({
      targets: glow, alpha: { from: 0.6, to: 1.0 },
      duration: 380 + Math.random() * 160, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });

    // ── 불꽃 레이어 1: 베이스 (넓고 짧음, 좌우 진동) ──
    const base = this.add.graphics().setDepth(5);
    base.setPosition(x, y - 4);
    base.fillStyle(palette.base, 1);
    base.fillRect(-6, -6, 12, 10);
    base.fillStyle(palette.mid, 1);
    base.fillTriangle(-6, -4, 6, -4, 0, -14);
    this.tweens.add({
      targets: base,
      x: { from: x - 1.5, to: x + 1.5 },
      scaleX: { from: 0.88, to: 1.18 },
      scaleY: { from: 0.92, to: 1.06 },
      duration: 140 + Math.random() * 60,
      yoyo: true, repeat: -1, ease: "Sine.InOut",
    });

    // ── 불꽃 레이어 2: 중간 (중간 높이, 반대 방향 진동) ──
    const mid = this.add.graphics().setDepth(6);
    mid.setPosition(x, y - 4);
    mid.fillStyle(palette.mid, 1);
    mid.fillTriangle(-4, -8, 4, -8, 0, -20);
    mid.fillStyle(palette.tip, 0.85);
    mid.fillTriangle(-2, -14, 2, -14, 0, -22);
    this.tweens.add({
      targets: mid,
      x: { from: x + 2, to: x - 2 },
      y: { from: y - 4, to: y - 7 },
      scaleX: { from: 0.9, to: 1.2 },
      duration: 190 + Math.random() * 80,
      yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 50,
    });

    // ── 불꽃 레이어 3: 끝 (가장 불규칙) ──
    const tip = this.add.graphics().setDepth(7);
    tip.setPosition(x, y - 4);
    tip.fillStyle(palette.tip, 1);
    tip.fillTriangle(-2, -18, 2, -18, 0, -28);
    tip.fillStyle(HEX.cream100, 0.65);
    tip.fillRect(-1, -28, 2, 5);
    this.tweens.add({
      targets: tip,
      x: { from: x - 2.5, to: x + 2.5 },
      y: { from: y - 6, to: y - 2 },
      scaleX: { from: 0.7, to: 1.3 },
      scaleY: { from: 0.85, to: 1.15 },
      duration: 160 + Math.random() * 70,
      yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 90,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 몬스터 스프라이트 (같은 Y, 마주 보기)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildMonsterSprites() {
    // 몬스터 PNG는 픽셀아트가 아니라 매끄러운 일러스트다. 게임 전역 pixelArt:true가
    // NEAREST를 걸어 축소 시 계단이 생기므로 이 텍스처들만 LINEAR로 되돌린다 (ART_DIRECTION 3-4).
    this.smoothTexture("enemy-mon");
    for (let i = 0; i < 6; i++) this.smoothTexture(`party-mon-${i}`);

    const battleData = getBattleInitData();
    const isOrmrFinalBoss = battleData?.floor === 50
      && battleData.enemyImageUrl.endsWith("/dragon.webp");
    const enemySize = isOrmrFinalBoss ? FINAL_BOSS_SIZE : MONSTER_SIZE;

    // 적 (우, flipX)
    if (this.textures.exists("enemy-mon")) {
      this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, "enemy-mon")
        .setDisplaySize(enemySize, enemySize).setDepth(6);
    } else {
      this.enemySprite = this.makeFallback(ENEMY_X, ENEMY_Y, HEX.ember700, enemySize);
    }

    // 플레이어 — 파티 0번 슬롯 이미지 사용 (party-mon-0)
    if (this.textures.exists("party-mon-0")) {
      this.playerSprite = this.add.image(PLAYER_X, PLAYER_Y, "party-mon-0")
        // 아군이 우측으로 옮겨갔으니 좌측의 적을 바라보게 뒤집는다
        .setDisplaySize(MONSTER_SIZE, MONSTER_SIZE).setFlipX(true).setDepth(6);
    } else {
      this.playerSprite = this.makeFallback(PLAYER_X, PLAYER_Y, HEX.mist500, MONSTER_SIZE);
    }

    // 등장 애니메이션
    this.enemySprite.setAlpha(0).setY(ENEMY_Y + 20);
    this.playerSprite.setAlpha(0).setY(PLAYER_Y + 20);
    this.tweens.add({ targets: this.enemySprite, alpha: 1, y: ENEMY_Y, duration: 500, delay: 200, ease: "Back.Out" });
    this.tweens.add({ targets: this.playerSprite, alpha: 1, y: PLAYER_Y, duration: 500, delay: 420, ease: "Back.Out" });
    this.time.delayedCall(930, () => {
      this.addFloat(this.enemySprite, ENEMY_Y, 6, 1750);
      this.addFloat(this.playerSprite, PLAYER_Y, 5, 1950);
    });
  }

  private smoothTexture(key: string) {
    if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.LINEAR);
  }

  private makeFallback(x: number, y: number, color: number, size: number): Phaser.GameObjects.Image {
    const key = `fb-${color}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({});
      g.fillStyle(color, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 4);
      g.generateTexture(key, size, size);
      g.destroy();
    }
    return this.add.image(x, y, key).setDepth(6);
  }

  private addFloat(t: Phaser.GameObjects.Image, baseY: number, amp: number, dur: number) {
    this.tweens.add({ targets: t, y: baseY - amp, duration: dur, ease: "Sine.InOut", yoyo: true, repeat: -1 });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HP 패널 (몬스터 바로 위, 각각 중앙 정렬)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildHudPanels() {
    this.buildOneHudPanel(
      ENEMY_X, E_PANEL_CY, PANEL_W, PANEL_H, true,
    );
    this.buildOneHudPanel(
      PLAYER_X, P_PANEL_CY, PANEL_W, PANEL_H, false,
    );
  }

  private buildOneHudPanel(cx: number, cy: number, pw: number, ph: number, isEnemy: boolean) {
    const px = cx - pw / 2;
    const py = cy - ph / 2;

    // 패널 배경 (픽셀아트: sharp corner)
    const bg = this.add.graphics().setDepth(8);
    bg.fillStyle(HEX.shadow900, 0.88);
    bg.fillRect(px, py, pw, ph);
    bg.lineStyle(2, isEnemy ? HEX.ember700 : HEX.mist500, 1);
    bg.strokeRect(px, py, pw, ph);

    // 이름 + 레벨 텍스트
    if (isEnemy) {
      this.enemyNameText = this.add.text(px + 10, py + 7, "적 몬스터 Lv.-", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand200,
      }).setDepth(9);

      this.enemyStatusBadge = this.add.text(px + pw - 8, py + 7, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.ember500,
        backgroundColor: PALETTE.shadow900, padding: { x: 2, y: 1 },
      }).setOrigin(1, 0).setDepth(9);

      // HP 바 레이아웃
      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 13, "HP", { fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand300 }).setDepth(9);
      this.enemyHpBar = this.add.graphics().setDepth(9);
      this.drawBar(this.enemyHpBar, barX, barY, barW, BAR_H, 1);
      // HP 수치는 "몇 대 더 때려야 하나"를 판단하는 핵심 정보라 캔버스가 축소돼도 읽히도록
      // 크기와 대비를 올린다(9px/어두운 갈색 → 13px/밝은 색 + 검은 외곽선).
      this.enemyHpText = this.add.text(barX + barW, barY - 2, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand200,
        stroke: PALETTE.shadow900, strokeThickness: 3,
      }).setOrigin(1, 1).setDepth(10);
    } else {
      this.playerNameText = this.add.text(px + 10, py + 7, "내 몬스터 Lv.-", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.mist300,
      }).setDepth(9);

      this.playerStatusBadge = this.add.text(px + pw - 8, py + 7, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.ember500,
        backgroundColor: PALETTE.shadow800, padding: { x: 2, y: 1 },
      }).setOrigin(1, 0).setDepth(9);

      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 13, "HP", { fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.mist300 }).setDepth(9);
      this.playerHpBar = this.add.graphics().setDepth(9);
      this.drawBar(this.playerHpBar, barX, barY, barW, BAR_H, 1);
      this.playerHpText = this.add.text(barX + barW, barY - 2, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.mist300,
        stroke: PALETTE.shadow900, strokeThickness: 3,
      }).setOrigin(1, 1).setDepth(10);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 로그 알림 영역
  // ─────────────────────────────────────────────────────────────────────────────

  private buildLogArea() {
    // 알림 박스 (기본 숨김)
    this.notifBox = this.add.graphics().setDepth(20);
    this.notifBox.fillStyle(HEX.shadow800, 0.96);
    this.notifBox.fillRect(20, LOG_Y + 14, W - 40, 104);
    this.notifBox.lineStyle(2, HEX.earth500, 0.9);
    this.notifBox.strokeRect(20, LOG_Y + 14, W - 40, 104);
    this.notifBox.setVisible(false);

    this.notifText = this.add.text(48, LOG_Y + 34, "", {
      fontSize: "16px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.cream100,
      wordWrap: { width: W - 110 },
    }).setDepth(21).setVisible(false);

    this.notifHint = this.add.text(W - 44, LOG_Y + 100, "Q ▶", {
      fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand300,
    }).setOrigin(1, 1).setDepth(21).setVisible(false);

    // 아이들 (기술 선택 안내)
    this.idleText = this.add.text(W / 2, LOG_Y + 60, "기술을 선택하세요", {
      fontSize: "16px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.earth400,
    }).setOrigin(0.5, 0.5).setDepth(11);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 결과 오버레이 (전투 영역 전체)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildResultOverlay() {
    this.resultVeil = this.add.graphics().setDepth(30);
    this.resultVeil.fillStyle(HEX.shadow900, 0.62);
    this.resultVeil.fillRect(0, 0, W, BATTLE_H);
    this.resultVeil.setVisible(false);

    this.resultTitle = this.add.text(W / 2, ENEMY_Y - 10, "", {
      fontSize: "36px", fontFamily: PIXEL_FONT, resolution: textResolution(), fontStyle: "bold",
      stroke: PALETTE.shadow900, strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setDepth(31).setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 입력 등록 (Q / 스페이스 / 하단 클릭)
  // ─────────────────────────────────────────────────────────────────────────────

  private registerInput() {
    const safeOnAdvance = safeHandler(this, this.onAdvance.bind(this));
    this.input.keyboard!.on("keydown-Q", safeOnAdvance);
    this.input.keyboard!.on("keydown-SPACE", safeOnAdvance);
    // 로그 박스 영역(하단) 클릭 또는 "showing" 상태면 어디 클릭해도 진행
    this.input.on("pointerdown", safeHandler(this, (p: Phaser.Input.Pointer) => {
      if (p.y > LOG_Y || this.logState === "showing") this.onAdvance();
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 로그 상태 머신
  // ─────────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────────
  // 로그 표시: BattlePage가 1개씩 보내고 Q ack를 기다린다
  // ─────────────────────────────────────────────────────────────────────────────

  private onBattleLog(message: string) {
    if (!this._isActive) return;
    this.logState = "showing";
    this.idleText.setVisible(false);
    this.notifBox.setVisible(true);
    this.notifText.setText(message).setVisible(true);
    this.notifHint.setVisible(true);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 결과 오버레이: BattlePage가 BATTLE_RESULT 이벤트를 보내면 즉시 표시
  // 이후 네비게이션은 React(BattlePage) 버튼이 담당
  // ─────────────────────────────────────────────────────────────────────────────

  private onBattleResult(payload: BattleResultPayload) {
    if (!this._isActive) return;
    this.logState = "result";
    this.notifBox.setVisible(false);
    this.notifText.setVisible(false);
    this.notifHint.setVisible(false);
    this.idleText.setVisible(false);

    this.resultVeil.setVisible(true);
    if (payload.outcome === "win") {
      this.resultTitle.setText("승리!").setColor(PALETTE.moss500).setVisible(true);
    } else {
      this.resultTitle.setText("패배...").setColor(PALETTE.ember600).setVisible(true);
    }
    this.resultTitle.setScale(0);
    this.tweens.add({ targets: this.resultTitle, scale: 1, duration: 400, ease: "Back.Out" });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Q / 클릭 처리: "showing" 상태에서만 ACK를 발행한다
  // ─────────────────────────────────────────────────────────────────────────────

  private onAdvance() {
    if (!this._isActive || this.logState !== "showing") return;

    // 로그 박스 숨기고 idle로 복귀
    this.logState = "idle";
    this.notifBox.setVisible(false);
    this.notifText.setVisible(false);
    this.notifHint.setVisible(false);
    this.idleText.setVisible(true);

    // BattlePage의 sendLogAndWait 프로미스를 해제
    gameEvents.emit(GAME_EVENT.BATTLE_LOG_ACK);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 이벤트 핸들러
  // ─────────────────────────────────────────────────────────────────────────────

  private onStateUpdate(p: BattleSceneUpdatePayload) {
    if (!this._isActive) return;
    this.animateBar("enemy",  p.enemyHp / p.enemyMaxHp);
    this.enemyHpText.setText(`${p.enemyHp}/${p.enemyMaxHp}`);

    this.animateBar("player", p.playerHp / p.playerMaxHp);
    this.playerHpText.setText(`${p.playerHp}/${p.playerMaxHp}`);

    this.enemyStatusBadge.setText(this.statusLabel(p.enemyStatus));
    this.playerStatusBadge.setText(this.statusLabel(p.playerStatus));
    if (p.enemyStatus) this.enemyStatusBadge.setColor(this.statusColor(p.enemyStatus));
    if (p.playerStatus) this.playerStatusBadge.setColor(this.statusColor(p.playerStatus));

    // 흔들림·플래시는 BATTLE_HIT 이 담당한다(데미지 크기와 치명타 여부를 알아야 해서).
    // 여기서는 쓰러짐만 본다.
    if (this.prevEnemyHp  > 0 && p.enemyHp  <= 0) this.playFaint("enemy");
    if (this.prevPlayerHp > 0 && p.playerHp <= 0) this.playFaint("player");
    this.prevEnemyHp  = p.enemyHp;
    this.prevPlayerHp = p.playerHp;
  }

  private onBattleEnd() {
    if (!this._isActive) return;
    this._removeGameListeners(); // 먼저 리스너 제거
    this.cameras.main.fadeOut(300, 0, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // gameEvents 리스너 일괄 제거 (shutdown/destroy/battleEnd 시 호출)
  // ─────────────────────────────────────────────────────────────────────────────

  private _removeGameListeners() {
    if (!this._isActive) return;
    this._isActive = false;
    gameEvents.off(GAME_EVENT.BATTLE_STATE_UPDATE,  this.safeOnStateUpdate);
    gameEvents.off(GAME_EVENT.BATTLE_LOG,           this.safeOnBattleLog);
    gameEvents.off(GAME_EVENT.BATTLE_RESULT,        this.safeOnBattleResult);
    gameEvents.off(GAME_EVENT.BATTLE_END,           this.safeOnBattleEnd);
    gameEvents.off(GAME_EVENT.BATTLE_PLAYER_SWITCH, this.safeOnPlayerSwitch);
    gameEvents.off(GAME_EVENT.BATTLE_HIT,           this.safeOnHit);
    gameEvents.off(GAME_EVENT.BATTLE_LOG_ADVANCE,   this.safeOnAutoAdvance);
    gameEvents.off(GAME_EVENT.BATTLE_SPARKLE,       this.safeOnSparkle);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 플레이어 몬스터 교체: 페이드 아웃 → 텍스처 변경 → 페이드 인
  // ─────────────────────────────────────────────────────────────────────────────

  private onPlayerSwitch(payload: BattlePlayerSwitchPayload) {
    if (!this._isActive) return;

    const key = `party-mon-${payload.partyIndex}`;
    this.tweens.killTweensOf(this.playerSprite);

    // ── 페이드 아웃 → 텍스처 교체 → 페이드 인 (scale 건드리지 않음) ──
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 0,
      duration: 150,
      ease: "Power2.In",
      onComplete: () => {
        if (this.textures.exists(key)) {
          this.playerSprite.setTexture(key);
        }
        // setTexture 후 반드시 origin + displaySize 재설정
        // (Phaser가 새 텍스처의 natural size로 리셋하기 때문)
        this.playerSprite.setOrigin(0.5, 0.5);
        this.playerSprite.setDisplaySize(MONSTER_SIZE, MONSTER_SIZE);
        this.playerSprite.setY(PLAYER_Y);

        this.tweens.add({
          targets: this.playerSprite,
          alpha: 1,
          duration: 220,
          ease: "Power2.Out",
          onComplete: () => {
            // fade-in 완료 후에도 한 번 더 고정 (tween이 scale 건드릴 경우 대비)
            this.playerSprite.setDisplaySize(MONSTER_SIZE, MONSTER_SIZE);
            this.addFloat(this.playerSprite, PLAYER_Y, 5, 1950);
          },
        });
      },
    });

    // HUD 이름/레벨 즉시 업데이트
    this.playerNameText?.setText(`${payload.name}  Lv.${payload.level}`);
    this.prevPlayerHp = -1;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 이름/레벨 업데이트
  // ─────────────────────────────────────────────────────────────────────────────

  updateNames(playerName: string, playerLv: number, enemyName: string, enemyLv: number) {
    this.playerNameText?.setText(`${playerName}  Lv.${playerLv}`);
    this.enemyNameText?.setText(`${enemyName}  Lv.${enemyLv}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 그리기 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────

  private drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    ratio: number, ghostRatio = ratio,
  ) {
    g.clear();
    const r = Math.max(0, Math.min(1, ratio));
    const ghost = Math.max(r, Math.min(1, ghostRatio));

    g.fillStyle(HEX.shadow900, 1);
    g.fillRect(x, y, w, h);
    // 잔상 — 방금 깎인 만큼이 회색으로 남았다가 뒤늦게 줄어든다
    if (ghost > r) {
      g.fillStyle(HEX.stone600, 1);
      g.fillRect(x, y, Math.floor(w * ghost), h);
    }
    if (r > 0) {
      g.fillStyle(HEX[hpToken(r * 100)], 1);
      g.fillRect(x, y, Math.floor(w * r), h);
    }
    g.lineStyle(1, HEX.earth500, 0.8);
    g.strokeRect(x, y, w, h);
  }

  private statusLabel(s: StatusEffect): string {
    if (!s) return "";
    return { paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상" }[s] ?? s;
  }

  private statusColor(s: NonNullable<StatusEffect>): string {
    return { paralysis: PALETTE.ember500, poison: PALETTE.earth500, freeze: PALETTE.mist300, burn: PALETTE.ember600 }[s] ?? PALETTE.cream100;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 타격 연출
  //
  // 전투 계산에는 손대지 않는다. BattlePage 가 이미 계산해 놓은 결과를 받아 그리기만 한다.
  // 전부 합쳐 1초를 넘기지 않고, 클릭/스페이스로 즉시 건너뛸 수 있다.
  // ─────────────────────────────────────────────────────────────────────────────

  /** 스킵 가능한 연출 트윈으로 등록. 무한 반복(둥실거림)은 넣지 않는다. */
  private fx(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.tweens.add(config);
    this.fxTweens.add(t);
    t.once("complete", () => this.fxTweens.delete(t));
    return t;
  }

  private registerFxSkip() {
    const skip = () => this.skipFx();
    this.input.on("pointerdown", skip);
    this.input.keyboard?.on("keydown-SPACE", skip);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off("pointerdown", skip);
      this.input.keyboard?.off("keydown-SPACE", skip);
    });
  }

  /** 진행 중인 연출을 끝 상태로 즉시 밀어붙인다. 반복 플레이에서 필수. */
  private skipFx() {
    for (const t of [...this.fxTweens]) {
      if (t.isPlaying() || t.isPaused()) t.complete();
    }
    this.fxTweens.clear();
    this.enemySprite?.clearTint();
    this.playerSprite?.clearTint();
    this.enemySprite?.setX(ENEMY_X);
    this.playerSprite?.setX(PLAYER_X);
    // 남은 데미지 숫자는 즉시 정리
    for (const obj of this.children.list.slice()) {
      if (obj.getData?.("fxText")) obj.destroy();
    }
    // HP 바도 목표값으로 스냅
    for (const side of ["enemy", "player"] as const) {
      this.hpAnim[side].ghost = this.hpAnim[side].cur;
    }
    this.redrawBars();
  }

  private onHit(p: BattleHitPayload) {
    if (!this._isActive) return;
    const victim   = p.target === "enemy" ? this.enemySprite : this.playerSprite;
    const attacker = p.target === "enemy" ? this.playerSprite : this.enemySprite;
    if (!victim || !attacker) return;

    // 공격 모션 — 물리는 대상 쪽으로 파고들고, 특수는 뒤로 당겼다 앞으로
    const towardVictim = Math.sign(victim.x - attacker.x) || 1;
    const lunge = p.category === "special" ? -14 : 22;
    const ax = p.target === "enemy" ? PLAYER_X : ENEMY_X;
    this.fx({
      targets: attacker, x: ax + towardVictim * lunge,
      duration: 90, yoyo: true, ease: "Quad.Out",
      onComplete: () => attacker.setX(ax),
    });

    if (!p.isHit) {
      this.floatText(victim.x, victim.y - 40, "MISS", PALETTE.sand300, 16);
      return;
    }

    this.time.delayedCall(90, () => {
      if (!this._isActive) return;

      // 흰 플래시 — 맞은 순간을 프레임 단위로 알린다
      victim.setTintFill(HEX.cream100);
      this.time.delayedCall(80, () => victim.clearTint());

      const vx = p.target === "enemy" ? ENEMY_X : PLAYER_X;
      if (!this.reduceMotion) {
        this.fx({
          targets: victim, x: vx + 6,
          duration: 40, yoyo: true, repeat: 3, ease: "Linear",
          onComplete: () => victim.setX(vx),
        });
        // 카메라 셰이크는 데미지에 비례하되 상한을 둔다. 넘기면 화면이 멀미난다.
        const ratio = Math.min(1, p.damage / 60);
        this.cameras.main.shake(150, 0.002 + ratio * 0.006);
      }

      if (p.damage > 0) {
        const crit = p.isCrit;
        const weak = p.multiplier >= 2;
        const size  = crit ? 32 : weak ? 24 : 16;
        const color = crit ? PALETTE.cream100 : weak ? PALETTE.ember500 : PALETTE.sand200;
        const label = crit ? `${p.damage}!` : String(p.damage);
        this.floatText(victim.x, victim.y - 40, label, color, size);
      }
    });
  }

  /** 위로 떠오르며 사라지는 텍스트 (데미지·MISS) */
  private floatText(x: number, y: number, text: string, color: string, size: number) {
    const t = this.add.text(x, y, text, {
      fontSize: `${size}px`, fontFamily: PIXEL_FONT, resolution: textResolution(),
      color, stroke: PALETTE.shadow900, strokeThickness: 4, fontStyle: "bold",
    }).setOrigin(0.5, 0.5).setDepth(60);
    t.setData("fxText", true);
    this.fx({
      targets: t, y: y - 46, alpha: { from: 1, to: 0 },
      duration: 620, ease: "Quad.Out",
      onComplete: () => t.destroy(),
    });
  }

  private onSparkle(target: "enemy" | "player") {
    if (!this._isActive) return;
    const sprite = target === "enemy" ? this.enemySprite : this.playerSprite;
    if (!sprite) return;
    sprite.setTintFill(HEX.cream100);
    this.fx({
      targets: sprite, alpha: { from: 1, to: 0.4 },
      duration: 110, yoyo: true, repeat: 2,
      onComplete: () => { sprite.clearTint(); sprite.setAlpha(1); },
    });
  }

  /** 쓰러짐 — 페이드아웃 + 살짝 가라앉기 */
  private playFaint(target: "enemy" | "player") {
    const sprite = target === "enemy" ? this.enemySprite : this.playerSprite;
    const baseY  = target === "enemy" ? ENEMY_Y : PLAYER_Y;
    if (!sprite) return;
    this.fx({
      targets: sprite, alpha: 0, y: baseY + 18,
      duration: 420, ease: "Quad.In",
    });
  }

  private redrawBars() {
    this.drawBar(this.enemyHpBar,  E_BAR_X, E_BAR_Y, BAR_W_INNER, BAR_H,
      this.hpAnim.enemy.cur, this.hpAnim.enemy.ghost);
    this.drawBar(this.playerHpBar, P_BAR_X, P_BAR_Y, BAR_W_INNER, BAR_H,
      this.hpAnim.player.cur, this.hpAnim.player.ghost);
  }

  /** HP 바를 목표값으로 애니메이션. cur 는 빠르게, ghost 는 뒤늦게 따라온다. */
  private animateBar(side: "enemy" | "player", ratio: number) {
    const st = this.hpAnim[side];
    this.fx({ targets: st, cur: ratio, duration: 260, ease: "Quad.Out",
      onUpdate: () => this.redrawBars() });
    this.fx({ targets: st, ghost: ratio, duration: 420, delay: 260, ease: "Quad.Out",
      onUpdate: () => this.redrawBars() });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  shutdown() {
    this._removeGameListeners();
  }
}

