import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../shared/phaser/events";
import { reportSceneError, safeHandler } from "../shared/phaser/sceneErrorHandler";
import { getBattleInitData } from "./battleInitStore";
import { markSceneReady } from "../shared/phaser/sceneReady";
import { PIXEL_FONT, textResolution, redrawTextOnFontLoad } from "../shared/phaser/text";
import { PALETTE, HEX, hpToken, isHpDanger, elementChip } from "../shared/palette";
import { STATUS_META, statusBadge } from "./statusInfo";
import { towerBattleBg } from "../shared/assetPaths";
import { getTowerZone } from "../shared/floorTable";
import type { ElementType, StatusEffect } from "../shared/game";
import type { BattleResultPayload, BattlePlayerSwitchPayload, BattleHitPayload } from "../shared/phaser/events";

export interface BattleSceneUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  playerStatus: StatusEffect;
  /** 상태이상이 몇 턴 남았는가. 배지에 그대로 적힌다 */
  playerStatusTurns?: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatus: StatusEffect;
  enemyStatusTurns?: number;
}

// ─── 캔버스 / 레이아웃 상수 ────────────────────────────────────────────────────
// 숫자는 battleLayout.ts 한 벌뿐이다. 겹침 테스트가 같은 표를 읽는다.

import {
  W, H, FLOOR_TOP,
  PLAYER_X, PLAYER_CY, PLAYER_SIZE, PLAYER_FEET,
  PANEL_W, PANEL_H, P_PANEL_CX, P_PANEL_CY,
  BAR_H, BAR_W_INNER, P_BAR_X, P_BAR_Y,
  LOG_BOX, LOG_PAD_X, LOG_PAD_Y,
  getEnemyLayout, shouldFlipX, type EnemyLayout,
} from "./battleLayout";

/** 이 전투에서 쓰는 배경 텍스처 키. 전투마다 게임이 새로 만들어지므로 한 벌이면 된다. */
const BG_KEY = "tower-bg";

// 로그 넘기기 키. 누르고 있으면 이 간격으로 계속 넘어간다. 연타보다 빠르면서
// 무슨 일이 있었는지는 읽히는 속도로 잡았다.
const ADVANCE_KEYS = ["Q", "SPACE"] as const;
const HOLD_ADVANCE_MS = 110;

// ─── Scene ────────────────────────────────────────────────────────────────────

/** idle: 기술 선택 대기 | showing: 로그 표시 중 (Q 대기) | result: 결과 오버레이 표시 */
type LogState = "idle" | "showing" | "result";

export default class BattleScene extends Phaser.Scene {
  /** 이 층의 적 배치(자리·크기·패널). 50층 오름만 다른 값이 온다. */
  private enemy!: EnemyLayout;
  /** 우상단에 적는 층 표시. 화면에서 층을 말하는 자리는 여기뿐이다 */
  private floorLabel = "1층";

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

  // ── 위험(HP 25% 이하) 경고 ──
  // 바 테두리와 몬스터 뒤 아우라가 같은 순간에 같은 박자로 뛴다. 숫자만 빨개지면 안 본다.
  private dangerFrame = {} as Record<"enemy" | "player", Phaser.GameObjects.Graphics>;
  private dangerAura  = {} as Record<"enemy" | "player", Phaser.GameObjects.Graphics>;
  private dangerTween = {} as Record<"enemy" | "player", Phaser.Tweens.Tween | undefined>;
  private dangerOn    = { enemy: false, player: false };

  // ── 로그 알림 ──
  private logState: LogState = "idle";
  /** 지금 눌려 있는 넘기기 키. 비어 있지 않으면 로그가 계속 흐른다. */
  private heldKeys = new Set<string>();

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
    // 이 전투에 쓸 배경 한 장만 받는다(약 38KB). 35장을 다 받으면 1.32MB 다.
    // preload 에 두는 게 핵심이다. create() 는 로딩이 끝난 뒤에 도니까
    // 텍스처가 아직 없어서 한 프레임 검게 뜨는 구간이 아예 안 생긴다.
    this.load.image(BG_KEY, towerBattleBg(getTowerZone(d.floor), d.enemyType ?? "normal"));
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
    this.floorLabel = d?.floorLabel ?? `${floor}층`;
    // 배경·그림자·패널·트윈이 전부 이걸 본다. 무엇보다 먼저 정한다.
    this.enemy = getEnemyLayout(floor);

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

    // 보스층 뱃지. 적 패널 바로 위, 발끝(ENEMY_FEET)과 패널 사이 띠에 앉힌다
    if (isBoss) {
      const badgeY = this.enemy.panelCy - PANEL_H / 2 - 18;
      const bossBg = this.add.graphics().setDepth(20);
      bossBg.fillStyle(HEX.mist500, 0.85);
      bossBg.fillRoundedRect(this.enemy.panelCx - 36, badgeY, 72, 16, 5);
      this.add.text(this.enemy.panelCx, badgeY + 8, "★  BOSS  ★", {
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
    // 자동 진행 타이머도 Q 와 같은 경로를 탄다. 로그 처리 경로를 둘로 만들지 않는다
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
  // 배경: 층 구간 × 적 속성으로 고른 방 한 장
  //
  // 예전엔 벽돌·바닥 격자·원형 조명 2개·횃불 2개·하단 그라디언트를 Graphics 로 그렸다.
  // 이제 그 전부가 이미지에 구워져 들어온다(안개·비네트·먼지·켜진 창·바닥에 떨어지는 빛까지).
// 위에 아무것도 덧대지 않는다. 비네트가 두 겹 되면 그냥 탁해진다.
  // ─────────────────────────────────────────────────────────────────────────────

  private buildBackground(floor: number, isBoss = false) {
    if (this.textures.exists(BG_KEY)) {
      // 배경은 픽셀아트가 아니라 부드러운 일러스트다. 게임 전역 pixelArt:true 의
      // NEAREST 를 이 텍스처만 되돌린다 (ART_DIRECTION 3-4).
      this.smoothTexture(BG_KEY);
      this.add.image(0, 0, BG_KEY).setOrigin(0, 0).setDisplaySize(W, H).setDepth(0);
      // 보스층은 같은 방을 눌러 깐다(10·20·30·40층). 50층은 예외인데, z50 은 처음부터
      // 최종 보스방으로 어둡게 완성된 전용 그림이라 위에 또 덮으면 아무것도 안 보인다.
      //
      // setTint 는 안 쓴다. 이 게임은 WebGL 컨텍스트 소진을 피하려고 CANVAS 렌더러로
      // 고정돼 있고(phaserConfig), Canvas 렌더러는 이미지 틴트를 안 그린다. 실제로
      // 재 보니 보스층이랑 일반층 벽 밝기가 30,33,40 대 29,31,38 로 사실상 같았다.
      // 그래서 어둠을 한 겹 덮는다. 비네트를 덧대는 게 아니라 방 전체를 고르게 누른다.
      if (isBoss && getTowerZone(floor) !== "z50") {
        const dim = this.add.graphics().setDepth(1);
        dim.fillStyle(HEX.shadow900, 0.4);
        dim.fillRect(0, 0, W, H);
      }
    } else {
      // 파일을 못 받았을 때. 방이 없어도 전투는 굴러가야 한다.
      const fallback = this.add.graphics().setDepth(0);
      fallback.fillStyle(HEX.shadow900, 1);
      fallback.fillRect(0, 0, W, H);
      fallback.fillStyle(HEX.shadow800, 1);
      fallback.fillRect(0, FLOOR_TOP, W, H - FLOOR_TOP);
    }

    // ── 층 표시 ──
    // 화면에서 층을 적는 자리는 여기 하나뿐이다. 원래는 캔버스·하단 칩·상대 카드
    // 세 곳에 같은 숫자가 있었다. 무대 위가 지금 어디 서 있는지를 말하는 자리다.
    this.add.text(W - 30, 36, this.floorLabel, {
      fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(),
      color: PALETTE.cream100, stroke: PALETTE.shadow900, strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(10);

    this.buildFloorShadows();
  }

  /**
   * 발밑 그림자. 바닥이 평행사변형이라 예전의 딱딱한 직사각형은 어디에도 안 맞았다.
   * 타원 세 겹을 조금씩 키우며 겹쳐 가장자리를 흐린다(Graphics 에 블러가 없다).
   * 뒤에 선 적이 더 옅다. 멀수록 그림자가 약해 보이는 게 원근을 거든다.
   */
  private buildFloorShadows() {
    const g = this.add.graphics().setDepth(3);
    for (const [x, feet, size, alpha] of [
      [this.enemy.x, this.enemy.feet, this.enemy.size, 0.36],
      [PLAYER_X, PLAYER_FEET, PLAYER_SIZE, 0.44],
    ] as const) {
      const w = size * 0.52;
      const h = w * 0.19;
      for (const [scale, share] of [[1.34, 0.34], [1.16, 0.42], [1, 0.5]] as const) {
        g.fillStyle(HEX.shadow900, alpha * share);
        g.fillEllipse(x, feet, w * scale, h * scale);
      }
    }
  }


  private buildMonsterSprites() {
    // 몬스터 PNG는 픽셀아트가 아니라 매끄러운 일러스트다. 게임 전역 pixelArt:true가
    // NEAREST를 걸어 축소 시 계단이 생기므로 이 텍스처들만 LINEAR로 되돌린다 (ART_DIRECTION 3-4).
    this.smoothTexture("enemy-mon");
    for (let i = 0; i < 6; i++) this.smoothTexture(`party-mon-${i}`);

    // 적 — 뒤(오른쪽·위·작게)
    if (this.textures.exists("enemy-mon")) {
      this.enemySprite = this.add.image(this.enemy.x, this.enemy.cy, "enemy-mon")
        .setDisplaySize(this.enemy.size, this.enemy.size).setDepth(6);
    } else {
      this.enemySprite = this.makeFallback(this.enemy.x, this.enemy.cy, HEX.ember700, this.enemy.size);
    }

    // 아군 — 앞(왼쪽·아래·크게). 파티 0번 슬롯 이미지 사용 (party-mon-0)
    if (this.textures.exists("party-mon-0")) {
      this.playerSprite = this.add.image(PLAYER_X, PLAYER_CY, "party-mon-0")
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE).setDepth(6);
    } else {
      this.playerSprite = this.makeFallback(PLAYER_X, PLAYER_CY, HEX.mist500, PLAYER_SIZE);
    }

    this.faceEachOther();

    // 등장 애니메이션
    this.enemySprite.setAlpha(0).setY(this.enemy.cy + 20);
    this.playerSprite.setAlpha(0).setY(PLAYER_CY + 20);
    this.tweens.add({ targets: this.enemySprite, alpha: 1, y: this.enemy.cy, duration: 500, delay: 200, ease: "Back.Out" });
    this.tweens.add({ targets: this.playerSprite, alpha: 1, y: PLAYER_CY, duration: 500, delay: 420, ease: "Back.Out" });
    this.time.delayedCall(930, () => {
      this.addFloat(this.enemySprite, this.enemy.cy, 6, 1750);
      this.addFloat(this.playerSprite, PLAYER_CY, 5, 1950);
    });
  }

  /**
   * 둘이 서로를 보게 뒤집는다. 판정은 집 좌표로 한다. 공격 모션이 x 를 흔들었다가
   * 되돌리는데 그 중간 프레임으로 방향을 정하면, 파고드는 동안 몸이 홱 돌아 버린다.
   * 텍스처를 갈아끼운 뒤에도(파티 교체) 다시 불러야 한다. flipX 를 setTexture 가
   * 건드리진 않지만, 방향을 한 곳에서만 정해야 나중에 배치를 바꿔도 안전하다.
   */
  private faceEachOther() {
    this.playerSprite?.setFlipX(shouldFlipX(PLAYER_X, this.enemy.x));
    this.enemySprite?.setFlipX(shouldFlipX(this.enemy.x, PLAYER_X));
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
  // HP 패널 (각자 발밑)
  //
  // ⚠️ 패널 X 를 몬스터 X 에서 뽑아내지 않는다. 그렇게 뒀다가 패널이 몬스터를 따라다니며
  // 겹쳤다. 배치를 바꿀 때마다 겹침이 되살아난 원인이 이거였다.
  // ─────────────────────────────────────────────────────────────────────────────

  private buildHudPanels() {
    this.buildOneHudPanel(
      this.enemy.panelCx, this.enemy.panelCy, PANEL_W, PANEL_H, true,
    );
    this.buildOneHudPanel(
      P_PANEL_CX, P_PANEL_CY, PANEL_W, PANEL_H, false,
    );
    this.buildDangerCues();
  }

  /**
   * 속성 칩. 상대가 무엇인지 모르면 교체를 판단할 수 없는데, 지금까지는 기술 셀의
   * 배율에서 거꾸로 추측해야 했다.
   *
   * 이름 반대쪽(오른쪽 끝)에 붙인다. "고대의 프리로 Lv.31" 처럼 이름이 긴 적이 있어서,
   * 이름 뒤에 이어 붙이면 언젠가 겹친다.
   * 생김새는 React 쪽 ELEMENT_CHIP_CLASS 와 같게 맞춘다(속성색 28% 바탕 + 테두리).
   */
  private buildTypeChip(rightX: number, topY: number, type: ElementType | null) {
    const { label, color: token, ink } = elementChip(type);

    const text = this.add.text(rightX - 5, topY + 2, label, {
      fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE[ink],
    }).setOrigin(1, 0).setDepth(10);

    const w = text.width + 10;
    const h = text.height + 4;
    const box = this.add.graphics().setDepth(9);
    box.fillStyle(HEX[token], 0.28);
    box.fillRect(rightX - w, topY, w, h);
    box.lineStyle(1, HEX[token], 1);
    box.strokeRect(rightX - w, topY, w, h);
  }

  private buildDangerCues() {
    for (const side of ["enemy", "player"] as const) {
      const barX = side === "enemy" ? this.enemy.barX : P_BAR_X;
      const barY = side === "enemy" ? this.enemy.barY : P_BAR_Y;
      const frame = this.add.graphics().setDepth(11).setVisible(false);
      frame.lineStyle(2, HEX.ember700, 1);
      frame.strokeRect(barX - 3, barY - 3, BAR_W_INNER + 6, BAR_H + 6);

      const sx   = side === "enemy" ? this.enemy.x  : PLAYER_X;
      const sy   = side === "enemy" ? this.enemy.cy : PLAYER_CY;
      const size = side === "enemy" ? this.enemy.size : PLAYER_SIZE;
      // 일러스트를 틴트로 물들이면 그림이 상한다. 뒤에 아우라를 깔아 몬스터째로 위험해 보이게 한다.
      // 번짐만 깔았더니 횃불 불빛이랑 구별이 안 됐다. 테두리 원을 하나 둘러 형태를 준다.
      const aura = this.add.graphics().setDepth(5).setVisible(false);
      aura.fillStyle(HEX.ember700, 0.5);
      aura.fillCircle(sx, sy, size * 0.42);
      aura.fillStyle(HEX.ember700, 0.28);
      aura.fillCircle(sx, sy, size * 0.62);
      aura.lineStyle(3, HEX.ember700, 0.9);
      aura.strokeCircle(sx, sy, size * 0.62);

      this.dangerFrame[side] = frame;
      this.dangerAura[side]  = aura;
    }
  }

  /** 위험 구간 진입/이탈. 같은 상태면 아무것도 하지 않는다(매 갱신마다 트윈이 쌓이면 안 된다) */
  private setDanger(side: "enemy" | "player", on: boolean) {
    if (this.dangerOn[side] === on) return;
    this.dangerOn[side] = on;

    const targets = [this.dangerFrame[side], this.dangerAura[side]];
    this.dangerTween[side]?.remove();
    this.dangerTween[side] = undefined;
    for (const t of targets) t.setVisible(on).setAlpha(1);
    if (!on) return;

    // 움직임을 줄여 달라고 한 사람에겐 맥박 없이 켜 둔 채로 둔다. 경고 자체를 지우진 않는다
    if (this.reduceMotion) {
      for (const t of targets) t.setAlpha(0.8);
      return;
    }
    this.dangerTween[side] = this.tweens.add({
      targets, alpha: { from: 0.35, to: 1 },
      duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut",
    });
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

      this.buildTypeChip(px + pw - 8, py + 5, getBattleInitData()?.enemyType ?? null);

      // HP 바 레이아웃
      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 13, "HP", { fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand300 }).setDepth(9);
      // 상태이상은 HP 줄 가운데로 내렸다. 이름 줄은 속성 칩이 쓴다.
      this.enemyStatusBadge = this.add.text(barX + 26, barY - 14, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.ember500,
        backgroundColor: PALETTE.shadow900, padding: { x: 2, y: 1 },
      }).setOrigin(0, 0).setDepth(10);
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

      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 13, "HP", { fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.mist300 }).setDepth(9);
      // 적 패널과 같은 자리에 둔다. 눈이 두 패널을 오갈 때 같은 게 같은 곳에 있어야 한다
      this.playerStatusBadge = this.add.text(barX + 26, barY - 14, "", {
        fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.ember500,
        backgroundColor: PALETTE.shadow800, padding: { x: 2, y: 1 },
      }).setOrigin(0, 0).setDepth(10);
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
    this.notifBox.fillRect(LOG_BOX.x, LOG_BOX.y, LOG_BOX.w, LOG_BOX.h);
    this.notifBox.lineStyle(2, HEX.earth500, 0.9);
    this.notifBox.strokeRect(LOG_BOX.x, LOG_BOX.y, LOG_BOX.w, LOG_BOX.h);
    this.notifBox.setVisible(false);

    this.notifText = this.add.text(LOG_BOX.x + LOG_PAD_X, LOG_BOX.y + LOG_PAD_Y, "", {
      fontSize: "16px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.cream100,
      wordWrap: { width: LOG_BOX.w - LOG_PAD_X * 2 },
    }).setDepth(21).setVisible(false);

    this.notifHint = this.add.text(LOG_BOX.x + LOG_BOX.w - 14, LOG_BOX.y + LOG_BOX.h - 8, "Q ▶", {
      fontSize: "12px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.sand300,
    }).setOrigin(1, 1).setDepth(21).setVisible(false);

    // 아이들 (기술 선택 안내)
    this.idleText = this.add.text(LOG_BOX.x + LOG_BOX.w / 2, LOG_BOX.y + LOG_BOX.h / 2, "기술을 선택하세요", {
      fontSize: "16px", fontFamily: PIXEL_FONT, resolution: textResolution(), color: PALETTE.earth400,
    }).setOrigin(0.5, 0.5).setDepth(11);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 결과 오버레이 (전투 영역 전체)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildResultOverlay() {
    this.resultVeil = this.add.graphics().setDepth(30);
    this.resultVeil.fillStyle(HEX.shadow900, 0.62);
    this.resultVeil.fillRect(0, 0, W, H);
    this.resultVeil.setVisible(false);

    // 화면 한가운데. 예전엔 적 스프라이트 Y 를 참조해서 배치를 옮길 때마다 같이 흔들렸다.
    this.resultTitle = this.add.text(W / 2, 250, "", {
      fontSize: "36px", fontFamily: PIXEL_FONT, resolution: textResolution(), fontStyle: "bold",
      stroke: PALETTE.shadow900, strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setDepth(31).setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 입력 등록 (Q / 스페이스 / 하단 클릭)
  // ─────────────────────────────────────────────────────────────────────────────

  private registerInput() {
    const safeOnAdvance = safeHandler(this, this.onAdvance.bind(this));

    // 누르면 그 자리에서 넘어간다. 자동 진행이 켜져 있어도 타이머를 안 기다려도 된다.
    // 기다리는 것도 넘기는 것도 둘 다 돼야 하니까.
    for (const key of ADVANCE_KEYS) {
      this.input.keyboard!.on(`keydown-${key}`, () => { this.heldKeys.add(key); safeOnAdvance(); });
      this.input.keyboard!.on(`keyup-${key}`,   () => this.heldKeys.delete(key));
    }
    // 누르고 있으면 계속 흐른다. OS 키 반복에 맡기면 첫 반복까지 0.5초를 멈춰 있어
    // 홀드가 연타보다 느리게 느껴진다.
    this.time.addEvent({
      delay: HOLD_ADVANCE_MS, loop: true,
      callback: () => { if (this.heldKeys.size > 0) safeOnAdvance(); },
    });
    // 창을 벗어나면 keyup 이 안 온다. 그대로 두면 돌아왔을 때 로그가 혼자 흘러간다.
    const clearHeld = () => this.heldKeys.clear();
    this.game.events.on(Phaser.Core.Events.BLUR, clearHeld);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.BLUR, clearHeld));

    // 로그 박스 영역(하단) 클릭 또는 "showing" 상태면 어디 클릭해도 진행
    this.input.on("pointerdown", safeHandler(this, (p: Phaser.Input.Pointer) => {
      // 로그 상자 안이거나, 로그가 떠 있으면 어디를 눌러도 넘어간다
      const inLogBox = p.x >= LOG_BOX.x && p.y >= LOG_BOX.y;
      if (inLogBox || this.logState === "showing") this.onAdvance();
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

    this.setDanger("enemy",  isHpDanger((p.enemyHp  / p.enemyMaxHp)  * 100));
    this.setDanger("player", isHpDanger((p.playerHp / p.playerMaxHp) * 100));

    this.enemyStatusBadge.setText(statusBadge(p.enemyStatus, p.enemyStatusTurns));
    this.playerStatusBadge.setText(statusBadge(p.playerStatus, p.playerStatusTurns));
    if (p.enemyStatus) this.enemyStatusBadge.setColor(PALETTE[STATUS_META[p.enemyStatus].color]);
    if (p.playerStatus) this.playerStatusBadge.setColor(PALETTE[STATUS_META[p.playerStatus].color]);

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
        this.playerSprite.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE);
        this.playerSprite.setY(PLAYER_CY);
        this.faceEachOther();

        this.tweens.add({
          targets: this.playerSprite,
          alpha: 1,
          duration: 220,
          ease: "Power2.Out",
          onComplete: () => {
            // fade-in 완료 후에도 한 번 더 고정 (tween이 scale 건드릴 경우 대비)
            this.playerSprite.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE);
            this.addFloat(this.playerSprite, PLAYER_CY, 5, 1950);
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
    // 잔상. 방금 깎인 만큼이 회색으로 남았다가 뒤늦게 줄어든다
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
    this.enemySprite?.setX(this.enemy.x);
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

    // 공격 모션. 물리는 대상 쪽으로 파고들고, 특수는 뒤로 당겼다 앞으로
    const towardVictim = Math.sign(victim.x - attacker.x) || 1;
    const lunge = p.category === "special" ? -14 : 22;
    const ax = p.target === "enemy" ? PLAYER_X : this.enemy.x;
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

      // 흰 플래시. 맞은 순간을 프레임 단위로 알린다
      victim.setTintFill(HEX.cream100);
      this.time.delayedCall(80, () => victim.clearTint());

      const vx = p.target === "enemy" ? this.enemy.x : PLAYER_X;
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

  /** 쓰러짐. 페이드아웃 + 살짝 가라앉기 */
  private playFaint(target: "enemy" | "player") {
    const sprite = target === "enemy" ? this.enemySprite : this.playerSprite;
    const baseY  = target === "enemy" ? this.enemy.cy : PLAYER_CY;
    if (!sprite) return;
    this.fx({
      targets: sprite, alpha: 0, y: baseY + 18,
      duration: 420, ease: "Quad.In",
    });
  }

  private redrawBars() {
    this.drawBar(this.enemyHpBar,  this.enemy.barX, this.enemy.barY, BAR_W_INNER, BAR_H,
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

