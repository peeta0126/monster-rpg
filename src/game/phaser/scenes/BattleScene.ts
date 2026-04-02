import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getBattleInitData } from "../battleInitStore";
import type { StatusEffect } from "../../../types/game";

export interface BattleSceneUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  playerStatus: StatusEffect;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatus: StatusEffect;
}

// ─── 캔버스 크기 ─────────────────────────────────────────────────────────────────

const W = 960;
const H = 540;

// 전투 영역 / 로그 영역 경계
const BATTLE_H = 400;
const FLOOR_Y = 330; // 탑 내 바닥 시작

// 몬스터 중심 좌표
const ENEMY_X = 650;
const ENEMY_Y = 190;
const PLAYER_X = 255;
const PLAYER_Y = 305;

const ENEMY_SIZE = 130;
const PLAYER_SIZE = 160;

// HUD 바 위치
const E_BAR = { x: 28, y: 44, w: 210, h: 10 };
const P_BAR = { x: 620, y: 260, w: 270, h: 12 };

// 로그 박스
const LOG_Y = 410;
// const LOG_H = 120; // 추후 사용 예약

// ─── 층별 횃불 색상 ───────────────────────────────────────────────────────────────

function getTorchColors(floor: number): { flame: number; glow: number } {
  // 1~10층: 주황
  // 추후 층 구간 확장 시 여기에 추가
  if (floor <= 10) return { flame: 0xff8820, glow: 0xff4400 };
  return { flame: 0xff8820, glow: 0xff4400 };
}

// ─── BattleScene ─────────────────────────────────────────────────────────────────

export default class BattleScene extends Phaser.Scene {
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyStatusBadge!: Phaser.GameObjects.Text;
  private playerStatusBadge!: Phaser.GameObjects.Text;

  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  // 로그 알림
  private logQueue: string[] = [];
  private isShowingLog = false;
  private notifBg!: Phaser.GameObjects.Graphics;
  private notifText!: Phaser.GameObjects.Text;
  private notifHint!: Phaser.GameObjects.Text;
  private notifIdle!: Phaser.GameObjects.Text;

  constructor() {
    super("BattleScene");
  }

  preload() {
    const data = getBattleInitData();
    if (!data) return;
    this.load.image("player-mon", data.playerImageUrl);
    this.load.image("enemy-mon", data.enemyImageUrl);
  }

  create() {
    const data = getBattleInitData();
    const floor = data?.floor ?? 1;

    this.buildTowerBackground(floor);
    this.buildMonsterSprites();
    this.buildEnemyHud();
    this.buildPlayerHud();
    this.buildLogArea(floor);

    gameEvents.on(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.on(GAME_EVENT.BATTLE_LOG, this.onBattleLog, this);
    gameEvents.on(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ─── 탑 내부 배경 ──────────────────────────────────────────────────────────────

  private buildTowerBackground(floor: number) {
    const { flame, glow } = getTorchColors(floor);

    // ── 돌벽 배경 ──
    const wall = this.add.graphics().setDepth(0);
    wall.fillStyle(0x1c1c2a, 1);
    wall.fillRect(0, 0, W, BATTLE_H);

    // 돌 블록 그리드
    const bw = 48;
    const bh = 32;
    const grid = this.add.graphics().setDepth(1);
    grid.lineStyle(1, 0x0e0e1a, 1);

    for (let y = 0; y <= FLOOR_Y; y += bh) {
      grid.beginPath();
      grid.moveTo(0, y);
      grid.lineTo(W, y);
      grid.strokePath();
    }
    const rowCount = Math.ceil(FLOOR_Y / bh);
    for (let row = 0; row < rowCount; row++) {
      const offset = (row % 2 === 0) ? 0 : bw / 2;
      for (let x = offset; x <= W; x += bw) {
        grid.beginPath();
        grid.moveTo(x, row * bh);
        grid.lineTo(x, Math.min((row + 1) * bh, FLOOR_Y));
        grid.strokePath();
      }
    }

    // 천장 어두운 띠
    const ceiling = this.add.graphics().setDepth(2);
    ceiling.fillStyle(0x0a0a14, 1);
    ceiling.fillRect(0, 0, W, 24);
    ceiling.fillStyle(0x12121e, 1);
    ceiling.fillRect(0, 24, W, 10);

    // 바닥 돌판
    const floor_ = this.add.graphics().setDepth(2);
    floor_.fillStyle(0x161620, 1);
    floor_.fillRect(0, FLOOR_Y, W, BATTLE_H - FLOOR_Y);
    floor_.lineStyle(1, 0x0c0c18, 1);
    for (let y = FLOOR_Y; y <= BATTLE_H; y += 20) {
      floor_.beginPath();
      floor_.moveTo(0, y);
      floor_.lineTo(W, y);
      floor_.strokePath();
    }
    for (let x = 0; x <= W; x += 40) {
      floor_.beginPath();
      floor_.moveTo(x, FLOOR_Y);
      floor_.lineTo(x, BATTLE_H);
      floor_.strokePath();
    }
    // 바닥 경계선 강조
    floor_.lineStyle(2, 0x2a2a3e, 1);
    floor_.beginPath();
    floor_.moveTo(0, FLOOR_Y);
    floor_.lineTo(W, FLOOR_Y);
    floor_.strokePath();

    // 양쪽 벽 기둥 힌트
    const pillar = this.add.graphics().setDepth(2);
    pillar.fillStyle(0x141420, 1);
    pillar.fillRect(0, 0, 22, BATTLE_H);
    pillar.fillRect(W - 22, 0, 22, BATTLE_H);
    pillar.lineStyle(1, 0x222232, 1);
    pillar.strokeRect(0, 0, 22, BATTLE_H);
    pillar.strokeRect(W - 22, 0, 22, BATTLE_H);

    // 횃불
    this.buildTorch(110, FLOOR_Y - 55, flame, glow);
    this.buildTorch(850, FLOOR_Y - 55, flame, glow);

    // 층 번호 표시 (우상단)
    this.add.text(W - 36, 30, `${floor}F`, {
      fontSize: "14px",
      fontFamily: "monospace",
      color: "#888899",
    }).setOrigin(1, 0.5).setDepth(10);
  }

  private buildTorch(x: number, y: number, flameColor: number, _glowColor: number) {
    // 횃불 받침대
    const holder = this.add.graphics().setDepth(4);
    holder.fillStyle(0x4a3010, 1);
    holder.fillRect(x - 3, y + 10, 6, 20);   // 자루
    holder.fillRect(x - 8, y + 4, 16, 8);    // 꺾쇠
    holder.fillStyle(0x302008, 1);
    holder.fillRect(x - 5, y - 2, 10, 12);   // 불꽃 헤드

    // 글로우 (배경 빛)
    const glow = this.add.graphics().setDepth(3);
    glow.fillStyle(flameColor, 0.07);
    glow.fillCircle(x, y, 55);
    glow.fillStyle(flameColor, 0.12);
    glow.fillCircle(x, y, 28);
    this.tweens.add({
      targets: glow,
      alpha: 0.45,
      duration: 350 + Math.random() * 200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    // 불꽃 픽셀
    const flame = this.add.graphics().setDepth(5);
    this.drawFlamePixels(flame, x, y, flameColor);
    this.tweens.add({
      targets: flame,
      scaleY: 0.82,
      scaleX: 1.12,
      y: flame.y - 2,
      duration: 130 + Math.random() * 90,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  private drawFlamePixels(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    g.clear();
    // 아래 (넓음)
    g.fillStyle(color, 1);
    g.fillRect(x - 5, y - 8, 10, 8);
    // 중간
    g.fillStyle(0xffcc00, 1);
    g.fillRect(x - 3, y - 15, 6, 8);
    // 끝 (흰색)
    g.fillStyle(0xffffff, 0.85);
    g.fillRect(x - 1, y - 20, 2, 6);
  }

  // ─── 몬스터 스프라이트 ──────────────────────────────────────────────────────────

  private buildMonsterSprites() {
    if (this.textures.exists("enemy-mon")) {
      this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, "enemy-mon")
        .setDisplaySize(ENEMY_SIZE, ENEMY_SIZE)
        .setFlipX(true)
        .setDepth(6);
    } else {
      this.enemySprite = this.buildFallbackSprite(ENEMY_X, ENEMY_Y, 0xcc4444, ENEMY_SIZE);
    }

    if (this.textures.exists("player-mon")) {
      this.playerSprite = this.add.image(PLAYER_X, PLAYER_Y, "player-mon")
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
        .setDepth(6);
    } else {
      this.playerSprite = this.buildFallbackSprite(PLAYER_X, PLAYER_Y, 0x4466cc, PLAYER_SIZE);
    }

    this.enemySprite.setAlpha(0).setY(ENEMY_Y + 20);
    this.playerSprite.setAlpha(0).setY(PLAYER_Y + 20);

    this.tweens.add({ targets: this.enemySprite, alpha: 1, y: ENEMY_Y, duration: 500, delay: 200, ease: "Back.Out" });
    this.tweens.add({ targets: this.playerSprite, alpha: 1, y: PLAYER_Y, duration: 500, delay: 450, ease: "Back.Out" });

    this.time.delayedCall(950, () => {
      this.addFloatTween(this.enemySprite, ENEMY_Y, 6, 1700);
      this.addFloatTween(this.playerSprite, PLAYER_Y, 5, 1900);
    });
  }

  private buildFallbackSprite(x: number, y: number, color: number, size: number): Phaser.GameObjects.Image {
    const key = `fallback-${color}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({});
      g.fillStyle(color, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 4);
      g.generateTexture(key, size, size);
      g.destroy();
    }
    return this.add.image(x, y, key).setDepth(6);
  }

  private addFloatTween(target: Phaser.GameObjects.Image, baseY: number, amp: number, dur: number) {
    this.tweens.add({ targets: target, y: baseY - amp, duration: dur, ease: "Sine.InOut", yoyo: true, repeat: -1 });
  }

  // ─── HUD: 적 (좌상단) ──────────────────────────────────────────────────────────

  private buildEnemyHud() {
    const { x, y, w, h } = E_BAR;
    const px = x - 8, py = y - 36, pw = w + 16, ph = 56;

    const bg = this.add.graphics().setDepth(8);
    this.drawHudPanel(bg, px, py, pw, ph);

    this.add.text(px + 10, py + 7, "적 몬스터", { fontSize: "11px", fontFamily: "monospace", color: "#aaaacc" }).setDepth(9);
    this.add.text(x, y - 14, "HP", { fontSize: "10px", fontFamily: "monospace", color: "#666688" }).setDepth(9);

    this.enemyHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.enemyHpBar, x, y, w, h, 1);

    this.enemyStatusBadge = this.add.text(px + pw - 58, py + 6, "", {
      fontSize: "10px", fontFamily: "monospace", backgroundColor: "#000000", padding: { x: 3, y: 1 },
    }).setDepth(9);
  }

  // ─── HUD: 플레이어 (우중하) ────────────────────────────────────────────────────

  private buildPlayerHud() {
    const { x, y, w, h } = P_BAR;
    const px = x - 8, py = y - 16, pw = w + 16, ph = 48;

    const bg = this.add.graphics().setDepth(8);
    this.drawHudPanel(bg, px, py, pw, ph);

    this.add.text(px + 10, py + 5, "내 몬스터", { fontSize: "11px", fontFamily: "monospace", color: "#aaaacc" }).setDepth(9);
    this.add.text(x, y - 7, "HP", { fontSize: "10px", fontFamily: "monospace", color: "#666688" }).setDepth(9);

    this.playerHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.playerHpBar, x, y, w, h, 1);

    this.playerStatusBadge = this.add.text(px + pw - 58, py + 4, "", {
      fontSize: "10px", fontFamily: "monospace", backgroundColor: "#000000", padding: { x: 3, y: 1 },
    }).setDepth(9);
  }

  // ─── 로그 알림 영역 (하단 패널) ────────────────────────────────────────────────

  private buildLogArea(floor: number) {
    // 구분선
    const sep = this.add.graphics().setDepth(10);
    sep.lineStyle(1, 0x2a2a3e, 1);
    sep.beginPath();
    sep.moveTo(0, LOG_Y - 8);
    sep.lineTo(W, LOG_Y - 8);
    sep.strokePath();

    // 로그 패널 배경
    const logBg = this.add.graphics().setDepth(10);
    logBg.fillStyle(0x08080f, 1);
    logBg.fillRect(0, LOG_Y - 8, W, H - LOG_Y + 8);

    // 층 진입 문구
    const { flame } = getTorchColors(floor);
    const floorHex = "#" + flame.toString(16).padStart(6, "0");
    this.add.text(W / 2, LOG_Y + 8, `무한의 탑 ${floor}층`, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: floorHex,
    }).setOrigin(0.5, 0).setDepth(11).setAlpha(0.7);

    // 알림 박스 (기본 숨김)
    this.notifBg = this.add.graphics().setDepth(20);
    this.notifBg.fillStyle(0x111122, 0.95);
    this.notifBg.fillRoundedRect(24, LOG_Y + 28, W - 48, 88, 6);
    this.notifBg.lineStyle(1, 0x3a3a5e, 1);
    this.notifBg.strokeRoundedRect(24, LOG_Y + 28, W - 48, 88, 6);
    this.notifBg.setVisible(false);

    this.notifText = this.add.text(50, LOG_Y + 46, "", {
      fontSize: "17px",
      fontFamily: "monospace",
      color: "#e8e8ff",
      wordWrap: { width: W - 130 },
    }).setDepth(21).setVisible(false);

    this.notifHint = this.add.text(W - 44, LOG_Y + 94, "Q ▶", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#555577",
    }).setOrigin(1, 1).setDepth(21).setVisible(false);

    // 아이들 상태 문구
    this.notifIdle = this.add.text(W / 2, LOG_Y + 56, "기술을 선택하세요", {
      fontSize: "15px",
      fontFamily: "monospace",
      color: "#44445a",
    }).setOrigin(0.5, 0).setDepth(11);

    // 입력 등록
    this.input.keyboard!.on("keydown-Q", this.advanceLog, this);
    this.input.keyboard!.on("keydown-SPACE", this.advanceLog, this);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.y > LOG_Y) this.advanceLog();
    });
  }

  // ─── 로그 큐 제어 ──────────────────────────────────────────────────────────────

  private onBattleLog(message: string) {
    this.logQueue.push(message);
    if (!this.isShowingLog) this.showNextLog();
  }

  private showNextLog() {
    if (this.logQueue.length === 0) {
      this.isShowingLog = false;
      this.notifBg.setVisible(false);
      this.notifText.setVisible(false);
      this.notifHint.setVisible(false);
      this.notifIdle.setVisible(true);
      return;
    }
    this.isShowingLog = true;
    const msg = this.logQueue.shift()!;
    this.notifIdle.setVisible(false);
    this.notifBg.setVisible(true);
    this.notifText.setText(msg).setVisible(true);
    this.notifHint.setVisible(this.logQueue.length > 0);
  }

  private advanceLog() {
    if (!this.isShowingLog) return;
    this.showNextLog();
  }

  // ─── 그리기 헬퍼 ───────────────────────────────────────────────────────────────

  private drawHudPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.clear();
    g.fillStyle(0x000000, 0.72);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, 0x2e3050, 0.8);
    g.strokeRoundedRect(x, y, w, h, 7);
  }

  private drawHpBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, ratio: number) {
    g.clear();
    const r = Math.max(0, Math.min(1, ratio));
    const color = r > 0.5 ? 0x44ee66 : r > 0.2 ? 0xeecc22 : 0xff4444;
    g.fillStyle(0x1a1a1a, 1);
    g.fillRoundedRect(x, y, w, h, 3);
    if (r > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, y, Math.floor(w * r), h, 3);
    }
    g.lineStyle(1, 0x333355, 0.5);
    g.strokeRoundedRect(x, y, w, h, 3);
  }

  // ─── 이벤트 핸들러 ─────────────────────────────────────────────────────────────

  private onStateUpdate(payload: BattleSceneUpdatePayload) {
    this.drawHpBar(this.enemyHpBar, E_BAR.x, E_BAR.y, E_BAR.w, E_BAR.h, payload.enemyHp / payload.enemyMaxHp);
    this.drawHpBar(this.playerHpBar, P_BAR.x, P_BAR.y, P_BAR.w, P_BAR.h, payload.playerHp / payload.playerMaxHp);

    this.enemyStatusBadge.setText(this.statusLabel(payload.enemyStatus));
    this.playerStatusBadge.setText(this.statusLabel(payload.playerStatus));
    if (payload.enemyStatus) this.enemyStatusBadge.setColor(this.statusColor(payload.enemyStatus));
    if (payload.playerStatus) this.playerStatusBadge.setColor(this.statusColor(payload.playerStatus));

    if (payload.enemyHp < payload.enemyMaxHp) this.shakeSprite(this.enemySprite);
    if (payload.playerHp < payload.playerMaxHp) this.shakeSprite(this.playerSprite);
  }

  private onBattleEnd() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
  }

  private statusLabel(s: StatusEffect): string {
    if (!s) return "";
    const m: Record<string, string> = { paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상" };
    return m[s] ?? s;
  }

  private statusColor(s: NonNullable<StatusEffect>): string {
    const m: Record<string, string> = { paralysis: "#ffee00", poison: "#cc66ff", freeze: "#88ccff", burn: "#ff8844" };
    return m[s] ?? "#ffffff";
  }

  private shakeSprite(sprite: Phaser.GameObjects.Image) {
    const origX = sprite.x;
    this.tweens.add({
      targets: sprite, x: origX + 7, duration: 45, yoyo: true, repeat: 3, ease: "Linear",
      onComplete: () => { sprite.x = origX; },
    });
  }

  shutdown() {
    gameEvents.off(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.off(GAME_EVENT.BATTLE_LOG, this.onBattleLog, this);
    gameEvents.off(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);
  }
}
