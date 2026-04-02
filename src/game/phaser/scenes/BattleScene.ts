import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getBattleInitData } from "../battleInitStore";
import type { ExtendedMonster, Move, StatusEffect } from "../../../types/game";
import {
  createBattleMonster,
  calculateDamage,
  applyDamage,
  applyStatusEffect,
  checkStatusEffects,
  checkCatchCondition,
  getAIAction,
  gainExp,
  isFainted,
  getTypeMultiplier,
  type BattleMonster,
} from "../../../utils/battle";
import { monsterDrawFns } from "../sprites/monsterDesigns";

// ─── 상수 ────────────────────────────────────────────────────────────────────────

const W = 960;
const H = 540;

// UI 패널 경계
const UI_Y = 360;
const UI_H = H - UI_Y;

// 몬스터 배치 위치
const ENEMY_X = 650;
const ENEMY_Y = 155;
const PLAYER_X = 240;
const PLAYER_Y = 295;

// 속성별 테마 색상
const TYPE_COLORS: Record<string, number> = {
  fire: 0xFF5533,
  water: 0x3388FF,
  grass: 0x44BB44,
  electric: 0xFFDD00,
  ice: 0x88DDFF,
  normal: 0xBBBBBB,
};

// 상태이상 색상
const STATUS_COLORS: Record<string, number> = {
  paralysis: 0xFFEE00,
  poison: 0xBB44EE,
  freeze: 0x88CCFF,
  burn: 0xFF6622,
};

// 상태이상 한글 이름
const STATUS_NAMES: Record<string, string> = {
  paralysis: "마비",
  poison: "독",
  freeze: "빙결",
  burn: "화상",
};

// ─── 씬 상태 타입 ────────────────────────────────────────────────────────────────

type SceneState =
  | "intro"
  | "action_menu"
  | "move_menu"
  | "animating"
  | "message"
  | "catch_result"
  | "game_over"
  | "victory"
  | "evolution";

// ─── BattleScene ─────────────────────────────────────────────────────────────────

/**
 * 포켓몬스터 스타일 1:1 전투 씬
 * 모든 전투 로직과 비주얼을 Phaser 안에서 처리한다
 */
export default class BattleScene extends Phaser.Scene {
  // ─ 전투 데이터 ─────────────────────────────────────────────────────────────────
  private playerMon!: BattleMonster;
  private enemyMon!: BattleMonster;
  private isCatchZone = false;
  private sceneState: SceneState = "intro";
  private pendingCallback: (() => void) | null = null;

  // ─ 시각 오브젝트 ────────────────────────────────────────────────────────────────
  private playerSprite!: Phaser.GameObjects.Container;
  private enemySprite!: Phaser.GameObjects.Container;

  // 플레이어 HUD (우하단)
  private playerHudBg!: Phaser.GameObjects.Graphics;
  private playerNameText!: Phaser.GameObjects.Text;
  private playerLvText!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private playerExpBar!: Phaser.GameObjects.Graphics;
  private playerStatusBadge!: Phaser.GameObjects.Text;

  // 적 HUD (좌상단)
  private enemyHudBg!: Phaser.GameObjects.Graphics;
  private enemyNameText!: Phaser.GameObjects.Text;
  private enemyLvText!: Phaser.GameObjects.Text;
  private enemyHpBar!: Phaser.GameObjects.Graphics;
  private enemyHpText!: Phaser.GameObjects.Text;
  private enemyStatusBadge!: Phaser.GameObjects.Text;

  // UI 패널
  private uiPanel!: Phaser.GameObjects.Graphics;
  private msgText!: Phaser.GameObjects.Text;
  private actionButtons: Phaser.GameObjects.Container[] = [];
  private moveButtons: Phaser.GameObjects.Container[] = [];

  // 이펙트 레이어
  private effectLayer!: Phaser.GameObjects.Container;

  // 타이핑 효과용
  private typingTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super("BattleScene");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 라이프사이클
  // ─────────────────────────────────────────────────────────────────────────────

  preload() {
    // 이미지는 동적으로 생성하므로 preload에서는 아무것도 로드하지 않음
  }

  create() {
    const initData = getBattleInitData();
    if (!initData) {
      console.error("BattleScene: initData 없음");
      return;
    }

    const playerSource = initData.playerMonster as ExtendedMonster;
    const enemySource = initData.enemyMonster as ExtendedMonster;
    this.isCatchZone = initData.isCatchZone ?? false;

    this.playerMon = createBattleMonster(playerSource);
    this.enemyMon = createBattleMonster(enemySource);

    // 레이어 순서: 배경 → 플랫폼 → HUD → 스프라이트 → UI 패널 → 이펙트
    this.buildBackground();
    this.buildPlatforms();
    this.buildMonsterSprites();
    this.buildHuds();
    this.buildUiPanel();
    this.effectLayer = this.add.container(0, 0).setDepth(50);

    // 인트로 애니메이션
    this.playIntro();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 배경
  // ─────────────────────────────────────────────────────────────────────────────

  private buildBackground() {
    // 하늘 그라데이션 (사각형 레이어로 흉내)
    const sky = this.add.graphics().setDepth(0);
    sky.fillGradientStyle(0x1a1a3e, 0x1a1a3e, 0x2d4a6e, 0x2d4a6e, 1);
    sky.fillRect(0, 0, W, UI_Y);

    // 지면
    const ground = this.add.graphics().setDepth(0);
    ground.fillStyle(0x3a6e2a, 1);
    ground.fillRect(0, UI_Y - 60, W, 60);
    // 지면 하이라이트 라인
    ground.fillStyle(0x4a8e36, 1);
    ground.fillRect(0, UI_Y - 60, W, 8);

    // 적 쪽 먼 지면 (색이 다름)
    ground.fillStyle(0x4a7e36, 1);
    ground.fillRect(0, 0, W, 10);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 플랫폼 (발판)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildPlatforms() {
    const g = this.add.graphics().setDepth(2);

    // 적 플랫폼 (타원형)
    g.fillStyle(0x55883a, 1);
    g.fillEllipse(ENEMY_X, ENEMY_Y + 60, 180, 35);
    g.fillStyle(0x446a2d, 1);
    g.fillEllipse(ENEMY_X, ENEMY_Y + 65, 180, 28);

    // 플레이어 플랫폼
    g.fillStyle(0x55883a, 1);
    g.fillEllipse(PLAYER_X, PLAYER_Y + 60, 200, 40);
    g.fillStyle(0x446a2d, 1);
    g.fillEllipse(PLAYER_X, PLAYER_Y + 66, 200, 30);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 몬스터 스프라이트 생성 (픽셀 아트 → RenderTexture)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildMonsterSprites() {
    const ps = 4; // 픽셀 단위 크기 (20×20 grid × 4 = 80×80)

    // ── 적 스프라이트 ──
    const enemyKey = `mon-${this.enemyMon.id}`;
    this.generateMonsterTexture(enemyKey, this.enemyMon.id, ps);
    const enemyImg = this.add.image(0, 0, enemyKey).setOrigin(0.5, 0.5).setScale(1.5);
    this.enemySprite = this.add.container(ENEMY_X, ENEMY_Y).setDepth(5);
    this.enemySprite.add(enemyImg);

    // ── 플레이어 스프라이트 ──
    const playerKey = `mon-${this.playerMon.id}`;
    this.generateMonsterTexture(playerKey, this.playerMon.id, ps);
    const playerImg = this.add.image(0, 0, playerKey).setOrigin(0.5, 0.5).setScale(1.8).setFlipX(true);
    this.playerSprite = this.add.container(PLAYER_X, PLAYER_Y).setDepth(5);
    this.playerSprite.add(playerImg);

    // 플로팅 애니메이션
    this.floatSprite(this.enemySprite, 8, 1600);
    this.floatSprite(this.playerSprite, 6, 1800);
  }

  /** 몬스터 ID → Graphics.generateTexture() → TextureManager에 등록 */
  private generateMonsterTexture(key: string, id: string, ps: number) {
    // 같은 씬 재시작 시 중복 생성 방지
    if (this.textures.exists(key)) return;

    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const drawFn = monsterDrawFns[id];
    if (drawFn) {
      drawFn(g, ps);
    } else {
      // 폴백: 속성별 색상 원
      const type = (id in TYPE_COLORS) ? id : "normal";
      g.fillStyle(TYPE_COLORS[type] ?? 0xAAAAAA, 1);
      g.fillCircle(ps * 10, ps * 10, ps * 8);
    }
    g.generateTexture(key, ps * 20, ps * 20);
    g.destroy();
  }

  /** 상하 플로팅 루프 트윈 */
  private floatSprite(container: Phaser.GameObjects.Container, amp: number, duration: number) {
    this.tweens.add({
      targets: container,
      y: container.y - amp,
      duration,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HUD (체력바, 이름, 레벨)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildHuds() {
    this.buildEnemyHud();
    this.buildPlayerHud();
  }

  private buildEnemyHud() {
    const x = 28, y = 28, bw = 250, bh = 80;

    this.enemyHudBg = this.add.graphics().setDepth(8);
    this.drawHudBg(this.enemyHudBg, x, y, bw, bh);

    this.enemyNameText = this.add.text(x + 12, y + 10, this.enemyMon.name, {
      fontSize: "16px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setDepth(9);

    this.enemyLvText = this.add.text(x + bw - 50, y + 10, `Lv.${this.enemyMon.level}`, {
      fontSize: "13px", fontFamily: "monospace", color: "#ccddff",
    }).setDepth(9);

    this.add.text(x + 12, y + 36, "HP", {
      fontSize: "11px", fontFamily: "monospace", color: "#aaaaaa",
    }).setDepth(9);

    this.enemyHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.enemyHpBar, x + 30, y + 36, 195, 12, this.enemyMon.currentHp, this.enemyMon.maxHp);

    this.enemyHpText = this.add.text(x + 12, y + 54, "", {
      fontSize: "11px", fontFamily: "monospace", color: "#888888",
    }).setDepth(9);

    this.enemyStatusBadge = this.add.text(x + bw - 70, y + 54, "", {
      fontSize: "11px", fontFamily: "monospace",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 },
    }).setDepth(9);
  }

  private buildPlayerHud() {
    const x = 520, y = 295, bw = 410, bh = 95;

    this.playerHudBg = this.add.graphics().setDepth(8);
    this.drawHudBg(this.playerHudBg, x, y, bw, bh);

    this.playerNameText = this.add.text(x + 12, y + 8, this.playerMon.name, {
      fontSize: "16px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setDepth(9);

    this.playerLvText = this.add.text(x + bw - 55, y + 8, `Lv.${this.playerMon.level}`, {
      fontSize: "13px", fontFamily: "monospace", color: "#ccddff",
    }).setDepth(9);

    this.add.text(x + 12, y + 32, "HP", {
      fontSize: "11px", fontFamily: "monospace", color: "#aaaaaa",
    }).setDepth(9);

    this.playerHpBar = this.add.graphics().setDepth(9);
    this.drawHpBar(this.playerHpBar, x + 30, y + 32, 360, 14, this.playerMon.currentHp, this.playerMon.maxHp);

    this.playerHpText = this.add.text(x + bw - 110, y + 50, `${this.playerMon.currentHp}/${this.playerMon.maxHp}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#cccccc",
    }).setDepth(9);

    this.add.text(x + 12, y + 62, "EXP", {
      fontSize: "11px", fontFamily: "monospace", color: "#aaaaaa",
    }).setDepth(9);

    this.playerExpBar = this.add.graphics().setDepth(9);
    this.drawExpBar(this.playerExpBar, x + 40, y + 62, 350, 10, this.playerMon.exp, this.playerMon.expToNextLevel);

    this.playerStatusBadge = this.add.text(x + 12, y + 74, "", {
      fontSize: "11px", fontFamily: "monospace",
      backgroundColor: "#000000",
      padding: { x: 4, y: 2 },
    }).setDepth(9);
  }

  private drawHudBg(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    g.clear();
    g.fillStyle(0x000000, 0.65);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1.5, 0x445566, 0.8);
    g.strokeRoundedRect(x, y, w, h, 10);
  }

  private drawHpBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, bw: number, bh: number,
    current: number, max: number
  ) {
    g.clear();
    const ratio = Math.max(0, Math.min(1, current / max));
    const col = ratio > 0.5 ? 0x44EE66 : ratio > 0.2 ? 0xEECC22 : 0xFF4444;

    g.fillStyle(0x222222, 0.9);
    g.fillRoundedRect(x, y, bw, bh, 4);
    if (ratio > 0) {
      g.fillStyle(col, 1);
      g.fillRoundedRect(x, y, Math.floor(bw * ratio), bh, 4);
    }
    g.lineStyle(1, 0x444444, 0.6);
    g.strokeRoundedRect(x, y, bw, bh, 4);
  }

  private drawExpBar(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, bw: number, bh: number,
    current: number, max: number
  ) {
    g.clear();
    const ratio = Math.max(0, Math.min(1, current / max));
    g.fillStyle(0x222222, 0.9);
    g.fillRoundedRect(x, y, bw, bh, 3);
    if (ratio > 0) {
      g.fillStyle(0x4488FF, 1);
      g.fillRoundedRect(x, y, Math.floor(bw * ratio), bh, 3);
    }
  }

  /** HUD 전체 갱신 */
  private refreshHuds() {
    // 적
    this.drawHpBar(this.enemyHpBar, 58, 64, 195, 12, this.enemyMon.currentHp, this.enemyMon.maxHp);
    this.enemyHpText.setText(`${this.enemyMon.currentHp}/${this.enemyMon.maxHp}`);
    this.enemyLvText.setText(`Lv.${this.enemyMon.level}`);
    this.enemyStatusBadge.setText(this.statusBadge(this.enemyMon.status));
    if (this.enemyMon.status) this.enemyStatusBadge.setColor(this.statusColor(this.enemyMon.status));

    // 플레이어
    this.drawHpBar(this.playerHpBar, 550, 327, 360, 14, this.playerMon.currentHp, this.playerMon.maxHp);
    this.playerHpText.setText(`${this.playerMon.currentHp}/${this.playerMon.maxHp}`);
    this.playerLvText.setText(`Lv.${this.playerMon.level}`);
    this.drawExpBar(this.playerExpBar, 560, 357, 350, 10, this.playerMon.exp, this.playerMon.expToNextLevel);
    this.playerStatusBadge.setText(this.statusBadge(this.playerMon.status));
    if (this.playerMon.status) this.playerStatusBadge.setColor(this.statusColor(this.playerMon.status));
  }

  private statusBadge(s: StatusEffect): string {
    if (!s) return "";
    const map: Record<string, string> = { paralysis: "⚡마비", poison: "☠독", freeze: "❄빙결", burn: "🔥화상" };
    return map[s] ?? s;
  }

  private statusColor(s: NonNullable<StatusEffect>): string {
    const map: Record<string, string> = { paralysis: "#FFEE00", poison: "#CC66FF", freeze: "#88DDFF", burn: "#FF8844" };
    return map[s] ?? "#FFFFFF";
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UI 패널 (하단)
  // ─────────────────────────────────────────────────────────────────────────────

  private buildUiPanel() {
    this.uiPanel = this.add.graphics().setDepth(10);
    this.uiPanel.fillStyle(0x111122, 0.95);
    this.uiPanel.fillRect(0, UI_Y, W, UI_H);
    this.uiPanel.lineStyle(2, 0x334466, 1);
    this.uiPanel.lineBetween(0, UI_Y, W, UI_Y);

    // 메시지 텍스트
    this.msgText = this.add.text(28, UI_Y + 22, "", {
      fontSize: "15px",
      fontFamily: "monospace",
      color: "#ffffff",
      wordWrap: { width: 560 },
      lineSpacing: 6,
    }).setDepth(11);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 버튼 생성 헬퍼
  // ─────────────────────────────────────────────────────────────────────────────

  private makeButton(
    x: number, y: number, w: number, h: number,
    label: string, subLabel: string,
    bgColor: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(12);

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.85);
    bg.fillRoundedRect(0, 0, w, h, 8);
    bg.lineStyle(1.5, 0xffffff, 0.25);
    bg.strokeRoundedRect(0, 0, w, h, 8);

    const mainTxt = this.add.text(w / 2, h * 0.35, label, {
      fontSize: "14px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);

    const subTxt = this.add.text(w / 2, h * 0.72, subLabel, {
      fontSize: "10px", fontFamily: "monospace", color: "#aaaacc",
    }).setOrigin(0.5, 0.5);

    container.add([bg, mainTxt, subTxt]);

    // 히트 영역
    const zone = this.add.zone(0, 0, w, h).setOrigin(0);
    zone.setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => { bg.clear(); bg.fillStyle(bgColor + 0x111111, 1); bg.fillRoundedRect(0, 0, w, h, 8); bg.lineStyle(2, 0xffffff, 0.5); bg.strokeRoundedRect(0, 0, w, h, 8); });
    zone.on("pointerout", () => { bg.clear(); bg.fillStyle(bgColor, 0.85); bg.fillRoundedRect(0, 0, w, h, 8); bg.lineStyle(1.5, 0xffffff, 0.25); bg.strokeRoundedRect(0, 0, w, h, 8); });
    zone.on("pointerdown", () => {
      if (this.sceneState !== "action_menu" && this.sceneState !== "move_menu") return;
      onClick();
    });
    container.add(zone);

    return container;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 액션 메뉴 표시 (싸우기 / 포획 / 도망)
  // ─────────────────────────────────────────────────────────────────────────────

  private showActionMenu() {
    this.clearButtons();
    this.sceneState = "action_menu";
    this.showMessage(`어떻게 할까?`);

    const bx = 610, by = UI_Y + 12, bw = 160, bh = 60, gap = 12;

    // 싸우기
    const fightBtn = this.makeButton(bx, by, bw, bh, "싸우기", "기술 선택", 0x223355, () => this.showMoveMenu());
    this.actionButtons.push(fightBtn);

    // 포획 (catchZone 이고 적 HP 30% 이하)
    const canCatch = this.isCatchZone && this.enemyMon.currentHp / this.enemyMon.maxHp <= 0.3;
    const catchColor = canCatch ? 0x225533 : 0x1a2a1a;
    const catchBtn = this.makeButton(bx + bw + gap, by, bw, bh, "포획", canCatch ? "시도 가능!" : "HP 부족", catchColor, () => {
      if (canCatch) this.handleCatch();
    });
    this.actionButtons.push(catchBtn);

    // 도망
    const runBtn = this.makeButton(bx, by + bh + gap, bw, bh, "도망", "전투 종료", 0x332222, () => this.handleFlee());
    this.actionButtons.push(runBtn);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 기술 메뉴 표시
  // ─────────────────────────────────────────────────────────────────────────────

  private showMoveMenu() {
    this.clearButtons();
    this.sceneState = "move_menu";
    this.showMessage("기술을 선택하세요:");

    const bx = 600, by = UI_Y + 10, bw = 170, bh = 65, gap = 8;

    this.playerMon.moves.forEach((move, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const mx = bx + col * (bw + gap);
      const my = by + row * (bh + gap);

      const mult = getTypeMultiplier(move.type, this.enemyMon.type);
      const typeCol = TYPE_COLORS[move.type] ?? 0x555555;

      let effLabel = "";
      if (mult >= 2) effLabel = "▲효과적!";
      else if (mult <= 0.5) effLabel = "▼효과없음";
      else effLabel = `${move.type} Pw:${move.power}`;

      const btn = this.makeButton(mx, my, bw, bh, move.name, effLabel, typeCol * 0.3 + 0x111111, () => {
        this.handlePlayerMove(move);
      });
      this.moveButtons.push(btn);
    });

    // 뒤로가기
    const backBtn = this.makeButton(bx + (bw + gap) * 2 + 10, by + bh + gap, 90, bh, "←", "뒤로", 0x333344, () => this.showActionMenu());
    this.moveButtons.push(backBtn);
  }

  private clearButtons() {
    this.actionButtons.forEach(b => b.destroy());
    this.moveButtons.forEach(b => b.destroy());
    this.actionButtons = [];
    this.moveButtons = [];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 메시지 표시 (타이핑 효과)
  // ─────────────────────────────────────────────────────────────────────────────

  private showMessage(text: string, onDone?: () => void) {
    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }
    this.msgText.setText("");
    let i = 0;
    this.typingTimer = this.time.addEvent({
      delay: 22,
      repeat: text.length - 1,
      callback: () => {
        this.msgText.setText(text.slice(0, ++i));
        if (i >= text.length && onDone) {
          this.time.delayedCall(300, onDone);
        }
      },
    });
  }

  /** 메시지를 보여주고 클릭/딜레이 후 콜백 실행 */
  private showMessageThenDo(text: string, delay: number, cb: () => void) {
    this.sceneState = "message";
    this.showMessage(text, () => {
      this.time.delayedCall(delay, cb);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 인트로 애니메이션
  // ─────────────────────────────────────────────────────────────────────────────

  private playIntro() {
    this.sceneState = "animating";

    // 화면을 어둡게 시작 후 페이드 인
    this.cameras.main.fadeIn(800, 0, 0, 0);

    this.enemySprite.setAlpha(0);
    this.playerSprite.setAlpha(0);

    this.time.delayedCall(500, () => {
      this.tweens.add({ targets: this.enemySprite, alpha: 1, duration: 400, ease: "Power2" });
    });
    this.time.delayedCall(900, () => {
      this.tweens.add({ targets: this.playerSprite, alpha: 1, duration: 400, ease: "Power2" });
    });

    const msg = `야생의 ${this.enemyMon.name}이(가) 나타났다!`;
    this.time.delayedCall(1200, () => {
      this.showMessageThenDo(msg, 800, () => this.showActionMenu());
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 전투 흐름: 플레이어 기술 사용
  // ─────────────────────────────────────────────────────────────────────────────

  private handlePlayerMove(move: Move) {
    this.clearButtons();
    this.sceneState = "animating";

    // AI가 이번 턴에 사용할 기술 미리 결정
    const enemyMove = getAIAction(this.enemyMon, this.playerMon);
    const playerFirst = this.playerMon.speed >= this.enemyMon.speed;

    if (playerFirst) {
      this.doPlayerAttack(move, () => {
        if (isFainted(this.enemyMon)) { this.handleVictory(); return; }
        this.time.delayedCall(400, () => this.doEnemyAttack(enemyMove, () => {
          if (isFainted(this.playerMon)) { this.handleDefeat(); return; }
          this.showActionMenu();
        }));
      });
    } else {
      this.doEnemyAttack(enemyMove, () => {
        if (isFainted(this.playerMon)) { this.handleDefeat(); return; }
        this.time.delayedCall(400, () => this.doPlayerAttack(move, () => {
          if (isFainted(this.enemyMon)) { this.handleVictory(); return; }
          this.showActionMenu();
        }));
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 공격 실행
  // ─────────────────────────────────────────────────────────────────────────────

  private doPlayerAttack(move: Move, onDone: () => void) {
    // 상태이상 체크
    const statusResult = checkStatusEffects(this.playerMon);
    this.playerMon = statusResult.monster;
    this.refreshHuds();

    if (statusResult.logs.length) {
      this.showMessageThenDo(statusResult.logs.join("\n"), 600, () => {
        if (statusResult.skipTurn) {
          onDone();
        } else {
          this.executeAttack(this.playerSprite, this.enemySprite, this.playerMon, this.enemyMon, move, true, onDone);
        }
      });
    } else {
      this.executeAttack(this.playerSprite, this.enemySprite, this.playerMon, this.enemyMon, move, true, onDone);
    }
  }

  private doEnemyAttack(move: Move, onDone: () => void) {
    const statusResult = checkStatusEffects(this.enemyMon);
    this.enemyMon = statusResult.monster;
    this.refreshHuds();

    if (statusResult.logs.length) {
      this.showMessageThenDo(statusResult.logs.join("\n"), 600, () => {
        if (statusResult.skipTurn) {
          onDone();
        } else {
          this.executeAttack(this.enemySprite, this.playerSprite, this.enemyMon, this.playerMon, move, false, onDone);
        }
      });
    } else {
      this.executeAttack(this.enemySprite, this.playerSprite, this.enemyMon, this.playerMon, move, false, onDone);
    }
  }

  /**
   * 공격 애니메이션 + 데미지 처리 + 상태이상 적용
   */
  private executeAttack(
    attackerSprite: Phaser.GameObjects.Container,
    defenderSprite: Phaser.GameObjects.Container,
    attacker: BattleMonster,
    defender: BattleMonster,
    move: Move,
    isPlayer: boolean,
    onDone: () => void
  ) {
    const atkResult = calculateDamage(attacker, defender, move);
    const effLabel = atkResult.multiplier >= 2 ? "\n효과가 굉장했다!" : atkResult.multiplier <= 0.5 ? "\n효과가 별로인 듯하다..." : "";

    this.showMessage(`${attacker.name}의 ${move.name}!`);

    if (!atkResult.isHit) {
      this.time.delayedCall(600, () => {
        this.showMessageThenDo("공격이 빗나갔다!", 600, onDone);
      });
      return;
    }

    // 공격 애니메이션 실행
    this.playAttackAnim(attackerSprite, defenderSprite, move, isPlayer, () => {
      // 데미지 적용
      if (isPlayer) {
        this.enemyMon = applyDamage(this.enemyMon, atkResult.damage);
        if (atkResult.damage > 0) this.flashHurt(defenderSprite);
        // 상태이상 발동
        if (move.statusEffect && (move.statusChance ?? 0) > 0 && Math.random() * 100 <= (move.statusChance ?? 0)) {
          this.enemyMon = applyStatusEffect(this.enemyMon, move.statusEffect);
        }
      } else {
        this.playerMon = applyDamage(this.playerMon, atkResult.damage);
        if (atkResult.damage > 0) this.flashHurt(defenderSprite);
        if (move.statusEffect && (move.statusChance ?? 0) > 0 && Math.random() * 100 <= (move.statusChance ?? 0)) {
          this.playerMon = applyStatusEffect(this.playerMon, move.statusEffect);
        }
      }
      this.refreshHuds();

      const dmgText = atkResult.damage > 0 ? `${atkResult.damage}의 피해!` : "";
      const fullMsg = [dmgText, effLabel].filter(Boolean).join("") || `${move.name}!`;

      this.showMessageThenDo(fullMsg, 700, onDone);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 애니메이션 이펙트
  // ─────────────────────────────────────────────────────────────────────────────

  /** 공격 애니메이션: 공격자가 방어자 쪽으로 돌진 후 복귀 + 타입별 이펙트 */
  private playAttackAnim(
    attackerSprite: Phaser.GameObjects.Container,
    defenderSprite: Phaser.GameObjects.Container,
    move: Move,
    isPlayer: boolean,
    onDone: () => void
  ) {
    const origX = attackerSprite.x;
    const targetX = isPlayer ? origX + 120 : origX - 120;
    const typeCol = TYPE_COLORS[move.type] ?? 0xFFFFFF;

    // 돌진
    this.tweens.add({
      targets: attackerSprite,
      x: targetX,
      duration: 180,
      ease: "Power2",
      onComplete: () => {
        // 이펙트 (특수기: 투사체 / 물리기: 충격파)
        if (move.category === "special") {
          this.spawnProjectile(attackerSprite.x, attackerSprite.y, defenderSprite.x, defenderSprite.y, typeCol, onImpact);
        } else {
          this.spawnImpact(defenderSprite.x, defenderSprite.y, typeCol);
          onImpact();
        }
        // 복귀
        this.tweens.add({ targets: attackerSprite, x: origX, duration: 220, ease: "Power1", delay: 100 });
      },
    });

    const onImpact = () => {
      this.time.delayedCall(300, onDone);
    };
  }

  /** 투사체 이펙트 (특수기) */
  private spawnProjectile(
    sx: number, sy: number,
    tx: number, ty: number,
    color: number,
    onHit: () => void
  ) {
    const g = this.add.graphics().setDepth(40);
    g.fillStyle(color, 1);
    g.fillCircle(0, 0, 12);
    g.lineStyle(3, 0xFFFFFF, 0.5);
    g.strokeCircle(0, 0, 12);
    this.effectLayer.add(g);
    g.x = sx; g.y = sy;

    this.tweens.add({
      targets: g,
      x: tx, y: ty,
      duration: 280,
      ease: "Power1",
      onComplete: () => {
        this.spawnImpact(tx, ty, color);
        g.destroy();
        onHit();
      },
    });
  }

  /** 충격파 이펙트 (착탄/물리기) */
  private spawnImpact(x: number, y: number, color: number) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const g = this.add.graphics().setDepth(40);
      g.fillStyle(color, 0.9);
      g.fillCircle(0, 0, 5 + Math.random() * 4);
      this.effectLayer.add(g);
      g.x = x; g.y = y;

      this.tweens.add({
        targets: g,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 350,
        ease: "Power2",
        onComplete: () => g.destroy(),
      });
    }
  }

  /** 피격 흰색 플래시 */
  private flashHurt(sprite: Phaser.GameObjects.Container) {
    const flash = this.add.graphics().setDepth(45);
    flash.fillStyle(0xFFFFFF, 0.7);
    flash.fillRect(-40, -40, 80, 80);
    sprite.add(flash);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });

    // 스프라이트 흔들림
    const origX = sprite.x;
    this.tweens.add({
      targets: sprite,
      x: origX + 8,
      duration: 50,
      yoyo: true,
      repeat: 3,
      ease: "Linear",
      onComplete: () => { sprite.x = origX; },
    });
  }

  /** 상태이상 파티클 이펙트 */
  private spawnStatusEffect(sprite: Phaser.GameObjects.Container, effect: NonNullable<StatusEffect>) {
    const col = STATUS_COLORS[effect] ?? 0xFFFFFF;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const g = this.add.graphics().setDepth(45);
      g.fillStyle(col, 1);
      g.fillStar(0, 0, 3, 5, 3);
      this.effectLayer.add(g);
      g.x = sprite.x + (Math.random() - 0.5) * 60;
      g.y = sprite.y + (Math.random() - 0.5) * 60;

      this.tweens.add({
        targets: g,
        y: g.y - 50 - Math.random() * 30,
        alpha: 0,
        duration: 700 + Math.random() * 400,
        ease: "Power2",
        onComplete: () => g.destroy(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 포획
  // ─────────────────────────────────────────────────────────────────────────────

  private handleCatch() {
    this.clearButtons();
    this.sceneState = "animating";

    const catchResult = checkCatchCondition(this.enemyMon, this.isCatchZone);
    if (!catchResult.canAttempt) {
      this.showMessageThenDo(catchResult.message, 800, () => this.showActionMenu());
      return;
    }

    this.showMessage("포획을 시도한다...");

    // 볼 던지기 애니메이션 (원이 날아감)
    const ball = this.add.graphics().setDepth(40);
    ball.fillStyle(0xFF2222, 1);
    ball.fillCircle(0, 0, 10);
    ball.fillStyle(0xFFFFFF, 1);
    ball.fillRect(-10, -2, 20, 4);
    ball.x = PLAYER_X + 30;
    ball.y = PLAYER_Y - 20;

    this.tweens.add({
      targets: ball,
      x: ENEMY_X,
      y: ENEMY_Y,
      duration: 500,
      ease: "Power2",
      onComplete: () => {
        ball.destroy();
        // 깜빡임 3번
        let blinks = 0;
        const blink = () => {
          this.enemySprite.setAlpha(this.enemySprite.alpha === 1 ? 0.3 : 1);
          blinks++;
          if (blinks < 6) this.time.delayedCall(200, blink);
          else {
            this.enemySprite.setAlpha(1);
            this.time.delayedCall(400, () => {
              if (catchResult.success) {
                this.enemySprite.setAlpha(0);
                this.showMessageThenDo(`${this.enemyMon.name} 포획 성공! 🎉`, 1200, () => this.endBattle("caught"));
              } else {
                this.showMessageThenDo(`${this.enemyMon.name}이(가) 탈출했다!`, 800, () => {
                  // 적 반격
                  const enemyMove = getAIAction(this.enemyMon, this.playerMon);
                  this.doEnemyAttack(enemyMove, () => {
                    if (isFainted(this.playerMon)) this.handleDefeat();
                    else this.showActionMenu();
                  });
                });
              }
            });
          }
        };
        blink();
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 도망
  // ─────────────────────────────────────────────────────────────────────────────

  private handleFlee() {
    this.clearButtons();
    this.sceneState = "animating";
    this.showMessageThenDo("도망쳤다!", 1000, () => this.endBattle("fled"));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 승리 / 패배
  // ─────────────────────────────────────────────────────────────────────────────

  private handleVictory() {
    this.sceneState = "victory";
    const expGain = this.enemyMon.rewardExp;
    const expResult = gainExp(this.playerMon, expGain);
    const prevLevel = this.playerMon.level;
    this.playerMon = expResult.updatedMonster;
    this.refreshHuds();

    const msgs: string[] = [
      `${this.enemyMon.name}을(를) 쓰러뜨렸다!`,
      `${this.playerMon.name}이(가) 경험치 ${expGain}을(를) 획득했다!`,
    ];

    if (expResult.leveledUp) {
      msgs.push(`${this.playerMon.name}의 레벨이 ${prevLevel} → ${this.playerMon.level}로 올랐다!`);
    }

    let idx = 0;
    const showNext = () => {
      if (idx < msgs.length) {
        this.showMessageThenDo(msgs[idx++], 700, showNext);
      } else {
        this.time.delayedCall(800, () => this.endBattle("player-win"));
      }
    };
    showNext();
  }

  private handleDefeat() {
    this.sceneState = "game_over";
    this.showMessageThenDo(
      `${this.playerMon.name}이(가) 쓰러졌다...`,
      1200,
      () => this.endBattle("enemy-win")
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 전투 종료
  // ─────────────────────────────────────────────────────────────────────────────

  private endBattle(outcome: string) {
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.time.delayedCall(900, () => {
      gameEvents.emit(GAME_EVENT.BATTLE_END, { outcome, playerMon: this.playerMon });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 씬 종료 정리
  // ─────────────────────────────────────────────────────────────────────────────

  shutdown() {
    if (this.typingTimer) this.typingTimer.remove();
    gameEvents.off(GAME_EVENT.BATTLE_END);
  }
}
