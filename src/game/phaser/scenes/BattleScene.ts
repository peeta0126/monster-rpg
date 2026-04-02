import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getBattleInitData } from "../battleInitStore";
import type { StatusEffect } from "../../../types/game";

// ─── 이벤트 페이로드 ─────────────────────────────────────────────────────────────

export interface BattleSceneUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  playerStatus: StatusEffect;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatus: StatusEffect;
}

// ─── 레이아웃 상수 ───────────────────────────────────────────────────────────────

const W = 960;
const H = 400;

const GROUND_Y = 260; // 하늘/지면 경계

// 몬스터 중심 좌표
const ENEMY_X = 680;
const ENEMY_Y = 135;
const PLAYER_X = 215;
const PLAYER_Y = 255;

// 몬스터 표시 크기
const ENEMY_SIZE = 130;
const PLAYER_SIZE = 160;

// 적 HP 바 영역 (좌상단 HUD)
const E_BAR = { x: 32, y: 68, w: 200, h: 10 };
// 플레이어 HP 바 영역 (우하단 HUD)
const P_BAR = { x: 530, y: 302, w: 280, h: 12 };

// ─── BattleScene ─────────────────────────────────────────────────────────────────

export default class BattleScene extends Phaser.Scene {
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private enemyStatusBadge!: Phaser.GameObjects.Text;
  private playerStatusBadge!: Phaser.GameObjects.Text;

  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;

  constructor() {
    super("BattleScene");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 이미지 사전 로드
  // ─────────────────────────────────────────────────────────────────────────────

  preload() {
    const data = getBattleInitData();
    if (!data) return;
    this.load.image("battle-bg", data.bgImageUrl);
    this.load.image("player-mon", data.playerImageUrl);
    this.load.image("enemy-mon", data.enemyImageUrl);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 씬 생성
  // ─────────────────────────────────────────────────────────────────────────────

  create() {
    this.buildBackground();
    this.buildPlatforms();
    this.buildMonsterSprites();
    this.buildEnemyHud();
    this.buildPlayerHud();

    gameEvents.on(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.on(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 배경
  // ─────────────────────────────────────────────────────────────────────────────

  private buildBackground() {
    // 배경 이미지가 있으면 사용
    if (this.textures.exists("battle-bg")) {
      this.add.image(W / 2, H / 2, "battle-bg")
        .setDisplaySize(W, H)
        .setDepth(0);
      // 가독성을 위한 약한 오버레이
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.18).setDepth(1);
      return;
    }

    // ── 폴백: Graphics로 배경 직접 생성 ──

    // 하늘 (어두운 블루 그라데이션)
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x070d1f, 0x070d1f, 0x1a3356, 0x1a3356, 1);
    sky.fillRect(0, 0, W, GROUND_Y);

    // 원거리 산 실루엣
    const mountains = this.add.graphics().setDepth(0);
    mountains.fillStyle(0x0f1f38, 1);
    mountains.fillTriangle(100, GROUND_Y, 280, GROUND_Y - 90, 460, GROUND_Y);
    mountains.fillTriangle(350, GROUND_Y, 550, GROUND_Y - 110, 740, GROUND_Y);
    mountains.fillTriangle(650, GROUND_Y, 820, GROUND_Y - 75, 960, GROUND_Y);

    // 지면 (초록 계열 두 레이어)
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x1e4a12, 1);
    ground.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ground.fillStyle(0x266016, 1);
    ground.fillRect(0, GROUND_Y, W, 14);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 발판 (그림자 타원)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildPlatforms() {
    const g = this.add.graphics().setDepth(3);

    // 적 발판 (작고 멀리 있는 느낌)
    g.fillStyle(0x2a5218, 0.85);
    g.fillEllipse(ENEMY_X, ENEMY_Y + 72, 155, 26);
    g.fillStyle(0x1e3c10, 0.55);
    g.fillEllipse(ENEMY_X, ENEMY_Y + 78, 155, 17);

    // 플레이어 발판 (크고 가까운 느낌)
    g.fillStyle(0x2a5218, 0.85);
    g.fillEllipse(PLAYER_X, PLAYER_Y + 72, 195, 34);
    g.fillStyle(0x1e3c10, 0.55);
    g.fillEllipse(PLAYER_X, PLAYER_Y + 79, 195, 22);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 몬스터 스프라이트
  // ─────────────────────────────────────────────────────────────────────────────

  private buildMonsterSprites() {
    // ── 적 몬스터 (우측 상단, 플레이어를 향함 → flipX) ──
    if (this.textures.exists("enemy-mon")) {
      this.enemySprite = this.add.image(ENEMY_X, ENEMY_Y, "enemy-mon")
        .setDisplaySize(ENEMY_SIZE, ENEMY_SIZE)
        .setFlipX(true)
        .setDepth(5);
    } else {
      this.enemySprite = this.buildFallbackSprite(ENEMY_X, ENEMY_Y, 0xCC4444, ENEMY_SIZE);
    }

    // ── 플레이어 몬스터 (좌측 하단, 적을 향함 → 기본 방향) ──
    if (this.textures.exists("player-mon")) {
      this.playerSprite = this.add.image(PLAYER_X, PLAYER_Y, "player-mon")
        .setDisplaySize(PLAYER_SIZE, PLAYER_SIZE)
        .setFlipX(false)
        .setDepth(5);
    } else {
      this.playerSprite = this.buildFallbackSprite(PLAYER_X, PLAYER_Y, 0x4466CC, PLAYER_SIZE);
    }

    // 등장 애니메이션 (투명에서 페이드인 + 아래서 위로 슬라이드)
    this.enemySprite.setAlpha(0).setY(ENEMY_Y + 20);
    this.playerSprite.setAlpha(0).setY(PLAYER_Y + 20);

    this.tweens.add({
      targets: this.enemySprite,
      alpha: 1,
      y: ENEMY_Y,
      duration: 500,
      delay: 200,
      ease: "Back.Out",
    });
    this.tweens.add({
      targets: this.playerSprite,
      alpha: 1,
      y: PLAYER_Y,
      duration: 500,
      delay: 450,
      ease: "Back.Out",
    });

    // 상하 플로팅 루프
    this.time.delayedCall(900, () => {
      this.addFloatTween(this.enemySprite, ENEMY_Y, 6, 1700);
      this.addFloatTween(this.playerSprite, PLAYER_Y, 5, 1900);
    });
  }

  /** Graphics로 간단한 원형 폴백 스프라이트 생성 후 Image처럼 사용 */
  private buildFallbackSprite(
    x: number, y: number, color: number, size: number
  ): Phaser.GameObjects.Image {
    const key = `fallback-${color}`;
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ add: false });
      g.fillStyle(color, 1);
      g.fillCircle(size / 2, size / 2, size / 2 - 4);
      g.generateTexture(key, size, size);
      g.destroy();
    }
    return this.add.image(x, y, key).setDepth(5);
  }

  private addFloatTween(
    target: Phaser.GameObjects.Image,
    baseY: number,
    amp: number,
    duration: number
  ) {
    this.tweens.add({
      targets: target,
      y: baseY - amp,
      duration,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HUD: 적 (좌상단)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildEnemyHud() {
    const { x, y, w, h } = E_BAR;
    const panelX = x - 10;
    const panelY = y - 42;
    const panelW = w + 20;
    const panelH = 62;

    const bg = this.add.graphics().setDepth(8);
    this.drawHudPanel(bg, panelX, panelY, panelW, panelH);

    this.add.text(panelX + 10, panelY + 8, "적 몬스터", {
      fontSize: "12px", fontFamily: "monospace", color: "#cccccc",
    }).setDepth(9);

    this.add.text(x, y - 16, "HP", {
      fontSize: "10px", fontFamily: "monospace", color: "#888888",
    }).setDepth(9);

    this.enemyHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.enemyHpBar, x, y, w, h, 1);

    this.enemyStatusBadge = this.add.text(x + w - 52, panelY + 7, "", {
      fontSize: "10px", fontFamily: "monospace",
      backgroundColor: "#000000",
      padding: { x: 3, y: 1 },
    }).setDepth(9);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HUD: 플레이어 (우하단)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildPlayerHud() {
    const { x, y, w, h } = P_BAR;
    const panelX = x - 10;
    const panelY = y - 18;
    const panelW = w + 20;
    const panelH = 50;

    const bg = this.add.graphics().setDepth(8);
    this.drawHudPanel(bg, panelX, panelY, panelW, panelH);

    this.add.text(panelX + 10, panelY + 6, "내 몬스터", {
      fontSize: "12px", fontFamily: "monospace", color: "#cccccc",
    }).setDepth(9);

    this.add.text(x, y - 8, "HP", {
      fontSize: "10px", fontFamily: "monospace", color: "#888888",
    }).setDepth(9);

    this.playerHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.playerHpBar, x, y, w, h, 1);

    this.playerStatusBadge = this.add.text(x + w - 52, panelY + 5, "", {
      fontSize: "10px", fontFamily: "monospace",
      backgroundColor: "#000000",
      padding: { x: 3, y: 1 },
    }).setDepth(9);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 그리기 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────

  private drawHudPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.clear();
    g.fillStyle(0x000000, 0.68);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0x334466, 0.75);
    g.strokeRoundedRect(x, y, w, h, 8);
  }

  private drawHpBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
    ratio: number
  ) {
    g.clear();
    const r = Math.max(0, Math.min(1, ratio));
    const color = r > 0.5 ? 0x44ee66 : r > 0.2 ? 0xeecc22 : 0xff4444;

    // 배경
    g.fillStyle(0x1a1a1a, 1);
    g.fillRoundedRect(x, y, w, h, 3);

    // HP 채움
    if (r > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(x, y, Math.floor(w * r), h, 3);
    }

    // 테두리
    g.lineStyle(1, 0x445566, 0.5);
    g.strokeRoundedRect(x, y, w, h, 3);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 이벤트 핸들러
  // ─────────────────────────────────────────────────────────────────────────────

  private onStateUpdate(payload: BattleSceneUpdatePayload) {
    this.drawHpBar(
      this.enemyHpBar,
      E_BAR.x, E_BAR.y, E_BAR.w, E_BAR.h,
      payload.enemyHp / payload.enemyMaxHp
    );
    this.drawHpBar(
      this.playerHpBar,
      P_BAR.x, P_BAR.y, P_BAR.w, P_BAR.h,
      payload.playerHp / payload.playerMaxHp
    );

    this.enemyStatusBadge.setText(this.statusLabel(payload.enemyStatus));
    this.playerStatusBadge.setText(this.statusLabel(payload.playerStatus));
    if (payload.enemyStatus) this.enemyStatusBadge.setColor(this.statusColor(payload.enemyStatus));
    if (payload.playerStatus) this.playerStatusBadge.setColor(this.statusColor(payload.playerStatus));

    // HP가 줄었을 때 피격 흔들림
    if (payload.enemyHp < payload.enemyMaxHp) this.shakeSprite(this.enemySprite);
    if (payload.playerHp < payload.playerMaxHp) this.shakeSprite(this.playerSprite);
  }

  private onBattleEnd() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
  }

  private statusLabel(s: StatusEffect): string {
    if (!s) return "";
    const m: Record<string, string> = {
      paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상",
    };
    return m[s] ?? s;
  }

  private statusColor(s: NonNullable<StatusEffect>): string {
    const m: Record<string, string> = {
      paralysis: "#ffee00", poison: "#cc66ff", freeze: "#88ccff", burn: "#ff8844",
    };
    return m[s] ?? "#ffffff";
  }

  private shakeSprite(sprite: Phaser.GameObjects.Image) {
    const origX = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: origX + 7,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: "Linear",
      onComplete: () => { sprite.x = origX; },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 씬 종료
  // ─────────────────────────────────────────────────────────────────────────────

  shutdown() {
    gameEvents.off(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.off(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);
  }
}
