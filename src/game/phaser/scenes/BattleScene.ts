import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getBattleInitData } from "../battleInitStore";
import type { StatusEffect } from "../../../types/game";
import type { BattleResultPayload, BattlePlayerSwitchPayload } from "../events";

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
const BATTLE_H = 400;   // 전투 비주얼 영역
const LOG_Y = 400;      // 하단 로그 패널 시작
const FLOOR_Y = 318;    // 탑 바닥면

// 몬스터: 같은 Y선에 마주보게
const MONSTER_Y = 232;
const ENEMY_X = 670;
const PLAYER_X = 290;
const MONSTER_SIZE = 140;

// HP 패널 (몬스터 바로 위)
// 몬스터 top = MONSTER_Y - MONSTER_SIZE/2 = 162
// 패널 bottom = 158 (4px 여유)
const PANEL_W = 210;
const PANEL_H = 62;
const PANEL_CY = 127;   // 패널 세로 중심 → top=96, bottom=158

// HP 바: 패널 안 하단
const BAR_H = 10;
// 패널 내부 바 좌표 (공통)
const BAR_X_INNER = 10;        // 패널 내 왼쪽 여백
const BAR_Y_IN_PANEL = PANEL_H - 22; // 패널 상단으로부터의 Y = 40
const BAR_W_INNER = PANEL_W - 20;    // = 190
// 절대 좌표 캐시
const E_BAR_X = ENEMY_X - PANEL_W / 2 + BAR_X_INNER;   // 670-105+10 = 575
const E_BAR_Y = PANEL_CY - PANEL_H / 2 + BAR_Y_IN_PANEL; // 127-31+40 = 136
const P_BAR_X = PLAYER_X - PANEL_W / 2 + BAR_X_INNER;  // 290-105+10 = 195
const P_BAR_Y = E_BAR_Y;

// ─── 층별 횃불 색 ──────────────────────────────────────────────────────────────

function torchPalette(floor: number, isBoss: boolean) {
  if (isBoss) return { base: 0x8800cc, mid: 0xcc33ff, tip: 0xee99ff, glow: 0x660099 };
  if (floor <= 10)  return { base: 0xff3300, mid: 0xff8820, tip: 0xffdd44, glow: 0xff6610 };
  if (floor <= 20)  return { base: 0xcc2200, mid: 0xff5500, tip: 0xffaa22, glow: 0xaa3300 };
  return { base: 0x991100, mid: 0xdd3300, tip: 0xff7711, glow: 0x770011 };
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

  // ── 생존 플래그: false이면 모든 gameEvents 핸들러를 무시 ──
  private _isActive = false;

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
      bossBg.fillStyle(0x660099, 0.85);
      bossBg.fillRoundedRect(ENEMY_X - 36, PANEL_CY - PANEL_H / 2 - 22, 72, 18, 5);
      this.add.text(ENEMY_X, PANEL_CY - PANEL_H / 2 - 13, "★  BOSS  ★", {
        fontSize: "11px", fontFamily: "monospace", color: "#ee99ff", fontStyle: "bold",
      }).setOrigin(0.5, 0.5).setDepth(21);
    }

    gameEvents.on(GAME_EVENT.BATTLE_STATE_UPDATE,  this.onStateUpdate,   this);
    gameEvents.on(GAME_EVENT.BATTLE_LOG,           this.onBattleLog,     this);
    gameEvents.on(GAME_EVENT.BATTLE_RESULT,        this.onBattleResult,  this);
    gameEvents.on(GAME_EVENT.BATTLE_END,           this.onBattleEnd,     this);
    gameEvents.on(GAME_EVENT.BATTLE_PLAYER_SWITCH, this.onPlayerSwitch,  this);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 배경: 따뜻한 모험의 탑 내부
  // ─────────────────────────────────────────────────────────────────────────────

  private buildBackground(floor: number, isBoss = false) {
    const palette = torchPalette(floor, isBoss);

    // ── 벽 기반색 (보스층: 어두운 보라, 일반: 따뜻한 갈색) ──
    const wall = this.add.graphics().setDepth(0);
    wall.fillStyle(isBoss ? 0x1e1030 : 0x3e2e1a, 1);
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
        hi.fillStyle(0x4a3820, 0.4);
        hi.fillRect(0, y0, W, y1 - y0);
      }

      // 세로 조인트
      const joints = this.add.graphics().setDepth(1);
      joints.lineStyle(1, 0x261a0c, 1);
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
    ceiling.fillStyle(0x1e1308, 1);
    ceiling.fillRect(0, 0, W, 28);
    ceiling.fillStyle(0x281a0c, 1);
    ceiling.fillRect(0, 28, W, 12);

    // ── 배경 중앙 아치/통로 (픽셀아트: 계단형 아치) ──
    const arch = this.add.graphics().setDepth(1);
    arch.fillStyle(0x1a1008, 1);
    // 계단형 아치 (픽셀아트 스타일)
    arch.fillRect(W / 2 - 70, 40, 140, 270);
    arch.fillRect(W / 2 - 90, 60, 180, 250);
    arch.fillRect(W / 2 - 80, 48, 160, 8);
    // 아치 테두리
    arch.lineStyle(2, 0x5a4028, 0.8);
    arch.strokeRect(W / 2 - 70, 40, 140, 270);

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
    floorBg.fillStyle(0x2a1e0c, 1);
    floorBg.fillRect(0, FLOOR_Y, W, BATTLE_H - FLOOR_Y);
    // 바닥 타일 라인
    floorBg.lineStyle(1, 0x1c1408, 1);
    for (let y = FLOOR_Y + 16; y < BATTLE_H; y += 16) {
      floorBg.beginPath(); floorBg.moveTo(0, y); floorBg.lineTo(W, y); floorBg.strokePath();
    }
    for (let x = 0; x < W; x += 36) {
      floorBg.beginPath(); floorBg.moveTo(x, FLOOR_Y); floorBg.lineTo(x, BATTLE_H); floorBg.strokePath();
    }
    // 바닥 경계선 강조
    floorBg.lineStyle(2, 0x7a5a30, 0.5);
    floorBg.beginPath(); floorBg.moveTo(0, FLOOR_Y); floorBg.lineTo(W, FLOOR_Y); floorBg.strokePath();

    // ── 양쪽 기둥 ──
    const pillar = this.add.graphics().setDepth(2);
    pillar.fillStyle(0x1e1408, 1);
    pillar.fillRect(0, 0, 18, BATTLE_H);
    pillar.fillRect(W - 18, 0, 18, BATTLE_H);
    pillar.lineStyle(1, 0x4a3418, 0.6);
    pillar.strokeRect(0, 0, 18, BATTLE_H);
    pillar.strokeRect(W - 18, 0, 18, BATTLE_H);

    // ── 발판 그림자 (픽셀아트: 사각형) ──
    const shadow = this.add.graphics().setDepth(3);
    shadow.fillStyle(0x0a0804, 0.55);
    shadow.fillRect(ENEMY_X - 65, FLOOR_Y + 2, 130, 14);
    shadow.fillRect(PLAYER_X - 65, FLOOR_Y + 2, 130, 14);

    // ── 횃불 ──
    this.buildTorch(115, FLOOR_Y - 52, palette);
    this.buildTorch(845, FLOOR_Y - 52, palette);

    // ── 층 번호 ──
    this.add.text(W - 30, 36, `${floor}F`, {
      fontSize: "13px", fontFamily: "monospace", color: "#c8943a",
    }).setOrigin(1, 0.5).setDepth(10).setAlpha(0.9);

    // ── 로그 패널 배경 ──
    const logPanel = this.add.graphics().setDepth(10);
    logPanel.fillStyle(0x100c06, 1);
    logPanel.fillRect(0, LOG_Y, W, H - LOG_Y);
    logPanel.lineStyle(1, 0x4a3418, 0.6);
    logPanel.beginPath(); logPanel.moveTo(0, LOG_Y); logPanel.lineTo(W, LOG_Y); logPanel.strokePath();
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
    holder.fillStyle(0x4a3012, 1);
    holder.fillRect(x - 3, y + 12, 6, 20);
    holder.fillRect(x - 9, y + 6, 18, 8);
    holder.fillStyle(0x2e1c08, 1);
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
    tip.fillStyle(0xffffff, 0.65);
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
    // 적 (우, flipX)
    if (this.textures.exists("enemy-mon")) {
      this.enemySprite = this.add.image(ENEMY_X, MONSTER_Y, "enemy-mon")
        .setDisplaySize(MONSTER_SIZE, MONSTER_SIZE).setFlipX(true).setDepth(6);
    } else {
      this.enemySprite = this.makeFallback(ENEMY_X, MONSTER_Y, 0xcc3333, MONSTER_SIZE);
    }

    // 플레이어 — 파티 0번 슬롯 이미지 사용 (party-mon-0)
    if (this.textures.exists("party-mon-0")) {
      this.playerSprite = this.add.image(PLAYER_X, MONSTER_Y, "party-mon-0")
        .setDisplaySize(MONSTER_SIZE, MONSTER_SIZE).setDepth(6);
    } else {
      this.playerSprite = this.makeFallback(PLAYER_X, MONSTER_Y, 0x3366cc, MONSTER_SIZE);
    }

    // 등장 애니메이션
    this.enemySprite.setAlpha(0).setY(MONSTER_Y + 20);
    this.playerSprite.setAlpha(0).setY(MONSTER_Y + 20);
    this.tweens.add({ targets: this.enemySprite, alpha: 1, y: MONSTER_Y, duration: 500, delay: 200, ease: "Back.Out" });
    this.tweens.add({ targets: this.playerSprite, alpha: 1, y: MONSTER_Y, duration: 500, delay: 420, ease: "Back.Out" });
    this.time.delayedCall(930, () => {
      this.addFloat(this.enemySprite, MONSTER_Y, 6, 1750);
      this.addFloat(this.playerSprite, MONSTER_Y, 5, 1950);
    });
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
      ENEMY_X, PANEL_CY, PANEL_W, PANEL_H, true,
    );
    this.buildOneHudPanel(
      PLAYER_X, PANEL_CY, PANEL_W, PANEL_H, false,
    );
  }

  private buildOneHudPanel(cx: number, cy: number, pw: number, ph: number, isEnemy: boolean) {
    const px = cx - pw / 2;
    const py = cy - ph / 2;

    // 패널 배경 (픽셀아트: sharp corner)
    const bg = this.add.graphics().setDepth(8);
    bg.fillStyle(0x0a0804, 0.88);
    bg.fillRect(px, py, pw, ph);
    bg.lineStyle(2, isEnemy ? 0x7a3020 : 0x2a5a7a, 1);
    bg.strokeRect(px, py, pw, ph);

    // 이름 + 레벨 텍스트
    if (isEnemy) {
      this.enemyNameText = this.add.text(px + 10, py + 7, "적 몬스터 Lv.-", {
        fontSize: "11px", fontFamily: "monospace", color: "#e8c89a",
      }).setDepth(9);

      this.enemyStatusBadge = this.add.text(px + pw - 8, py + 7, "", {
        fontSize: "10px", fontFamily: "monospace", color: "#ffee44",
        backgroundColor: "#1a0808", padding: { x: 2, y: 1 },
      }).setOrigin(1, 0).setDepth(9);

      // HP 바 레이아웃
      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 12, "HP", { fontSize: "9px", fontFamily: "monospace", color: "#7a6040" }).setDepth(9);
      this.enemyHpBar = this.add.graphics().setDepth(9);
      this.drawBar(this.enemyHpBar, barX, barY, barW, BAR_H, 1, true);
      this.enemyHpText = this.add.text(barX + barW - 2, barY - 1, "", {
        fontSize: "9px", fontFamily: "monospace", color: "#aa8860",
      }).setOrigin(1, 0).setDepth(9);
    } else {
      this.playerNameText = this.add.text(px + 10, py + 7, "내 몬스터 Lv.-", {
        fontSize: "11px", fontFamily: "monospace", color: "#9ac8e8",
      }).setDepth(9);

      this.playerStatusBadge = this.add.text(px + pw - 8, py + 7, "", {
        fontSize: "10px", fontFamily: "monospace", color: "#ffee44",
        backgroundColor: "#08181a", padding: { x: 2, y: 1 },
      }).setOrigin(1, 0).setDepth(9);

      const barX = px + 10;
      const barY = py + ph - 22;
      const barW = pw - 20;
      this.add.text(barX, barY - 12, "HP", { fontSize: "9px", fontFamily: "monospace", color: "#406080" }).setDepth(9);
      this.playerHpBar = this.add.graphics().setDepth(9);
      this.drawBar(this.playerHpBar, barX, barY, barW, BAR_H, 1, false);
      this.playerHpText = this.add.text(barX + barW - 2, barY - 1, "", {
        fontSize: "9px", fontFamily: "monospace", color: "#608aaa",
      }).setOrigin(1, 0).setDepth(9);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 로그 알림 영역
  // ─────────────────────────────────────────────────────────────────────────────

  private buildLogArea() {
    // 알림 박스 (기본 숨김)
    this.notifBox = this.add.graphics().setDepth(20);
    this.notifBox.fillStyle(0x1e1610, 0.96);
    this.notifBox.fillRect(20, LOG_Y + 14, W - 40, 104);
    this.notifBox.lineStyle(2, 0x6a4e28, 0.9);
    this.notifBox.strokeRect(20, LOG_Y + 14, W - 40, 104);
    this.notifBox.setVisible(false);

    this.notifText = this.add.text(48, LOG_Y + 34, "", {
      fontSize: "18px", fontFamily: "monospace", color: "#f0e0c8",
      wordWrap: { width: W - 110 },
    }).setDepth(21).setVisible(false);

    this.notifHint = this.add.text(W - 44, LOG_Y + 100, "Q ▶", {
      fontSize: "11px", fontFamily: "monospace", color: "#7a5a38",
    }).setOrigin(1, 1).setDepth(21).setVisible(false);

    // 아이들 (기술 선택 안내)
    this.idleText = this.add.text(W / 2, LOG_Y + 60, "기술을 선택하세요", {
      fontSize: "15px", fontFamily: "monospace", color: "#4a3820",
    }).setOrigin(0.5, 0.5).setDepth(11);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 결과 오버레이 (전투 영역 전체)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildResultOverlay() {
    this.resultVeil = this.add.graphics().setDepth(30);
    this.resultVeil.fillStyle(0x000000, 0.62);
    this.resultVeil.fillRect(0, 0, W, BATTLE_H);
    this.resultVeil.setVisible(false);

    this.resultTitle = this.add.text(W / 2, BATTLE_H / 2 - 10, "", {
      fontSize: "72px", fontFamily: "monospace", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setDepth(31).setVisible(false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 입력 등록 (Q / 스페이스 / 하단 클릭)
  // ─────────────────────────────────────────────────────────────────────────────

  private registerInput() {
    this.input.keyboard!.on("keydown-Q", this.onAdvance, this);
    this.input.keyboard!.on("keydown-SPACE", this.onAdvance, this);
    // 로그 박스 영역(하단) 클릭 또는 "showing" 상태면 어디 클릭해도 진행
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y > LOG_Y || this.logState === "showing") this.onAdvance();
    });
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
      this.resultTitle.setText("승리!").setColor("#66ffaa").setVisible(true);
    } else {
      this.resultTitle.setText("패배...").setColor("#ff6666").setVisible(true);
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
    this.drawBar(this.enemyHpBar, E_BAR_X, E_BAR_Y, BAR_W_INNER, BAR_H, p.enemyHp / p.enemyMaxHp, true);
    this.enemyHpText.setText(`${p.enemyHp}/${p.enemyMaxHp}`);

    this.drawBar(this.playerHpBar, P_BAR_X, P_BAR_Y, BAR_W_INNER, BAR_H, p.playerHp / p.playerMaxHp, false);
    this.playerHpText.setText(`${p.playerHp}/${p.playerMaxHp}`);

    this.enemyStatusBadge.setText(this.statusLabel(p.enemyStatus));
    this.playerStatusBadge.setText(this.statusLabel(p.playerStatus));
    if (p.enemyStatus) this.enemyStatusBadge.setColor(this.statusColor(p.enemyStatus));
    if (p.playerStatus) this.playerStatusBadge.setColor(this.statusColor(p.playerStatus));

    // HP 감소 시에만 쉐이크 (prevHP < 0 이면 초기화 직후이므로 스킵)
    if (this.prevEnemyHp  >= 0 && p.enemyHp  < this.prevEnemyHp)  this.shake(this.enemySprite);
    if (this.prevPlayerHp >= 0 && p.playerHp < this.prevPlayerHp) this.shake(this.playerSprite);
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
    gameEvents.off(GAME_EVENT.BATTLE_STATE_UPDATE,  this.onStateUpdate,  this);
    gameEvents.off(GAME_EVENT.BATTLE_LOG,           this.onBattleLog,    this);
    gameEvents.off(GAME_EVENT.BATTLE_RESULT,        this.onBattleResult, this);
    gameEvents.off(GAME_EVENT.BATTLE_END,           this.onBattleEnd,    this);
    gameEvents.off(GAME_EVENT.BATTLE_PLAYER_SWITCH, this.onPlayerSwitch, this);
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
        this.playerSprite.setY(MONSTER_Y);

        this.tweens.add({
          targets: this.playerSprite,
          alpha: 1,
          duration: 220,
          ease: "Power2.Out",
          onComplete: () => {
            // fade-in 완료 후에도 한 번 더 고정 (tween이 scale 건드릴 경우 대비)
            this.playerSprite.setDisplaySize(MONSTER_SIZE, MONSTER_SIZE);
            this.addFloat(this.playerSprite, MONSTER_Y, 5, 1950);
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

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number, _isEnemy: boolean) {
    g.clear();
    const r = Math.max(0, Math.min(1, ratio));
    const col = r > 0.5 ? 0x44ee66 : r > 0.2 ? 0xeecc22 : 0xff4444;
    // 픽셀아트: sharp rect
    g.fillStyle(0x1a1408, 1);
    g.fillRect(x, y, w, h);
    if (r > 0) {
      g.fillStyle(col, 1);
      g.fillRect(x, y, Math.floor(w * r), h);
    }
    g.lineStyle(1, 0x3a2818, 0.8);
    g.strokeRect(x, y, w, h);
  }

  private statusLabel(s: StatusEffect): string {
    if (!s) return "";
    return { paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상" }[s] ?? s;
  }

  private statusColor(s: NonNullable<StatusEffect>): string {
    return { paralysis: "#ffee00", poison: "#cc66ff", freeze: "#88ccff", burn: "#ff8844" }[s] ?? "#ffffff";
  }

  private shake(sprite: Phaser.GameObjects.Image) {
    const ox = sprite.x;
    this.tweens.add({ targets: sprite, x: ox + 8, duration: 42, yoyo: true, repeat: 3, ease: "Linear", onComplete: () => { sprite.x = ox; } });
  }

  // ─────────────────────────────────────────────────────────────────────────────

  shutdown() {
    this._removeGameListeners();
  }
}

