import Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "../events";
import { getBattleInitData } from "../battleInitStore";
import type { StatusEffect } from "../../../types/game";

// ─── 외부에서 전달받을 상태 갱신 페이로드 ────────────────────────────────────────

/** BATTLE_STATE_UPDATE 이벤트 페이로드 타입 */
export interface BattleSceneUpdatePayload {
  playerHp: number;
  playerMaxHp: number;
  playerStatus: StatusEffect;
  enemyHp: number;
  enemyMaxHp: number;
  enemyStatus: StatusEffect;
}

// ─── 상수 ────────────────────────────────────────────────────────────────────────

/** 플레이어 HP 바 좌상단 좌표 */
const PLAYER_BAR_X = 60;
const PLAYER_BAR_Y = 300;

/** 적 HP 바 좌상단 좌표 */
const ENEMY_BAR_X = 680;
const ENEMY_BAR_Y = 60;

const BAR_W = 200;
const BAR_H = 14;

// ─── BattleScene ─────────────────────────────────────────────────────────────────

/**
 * Phaser 전투 씬
 * - 배경, 플레이어/적 몬스터 스프라이트, HP 바, 상태이상 텍스트 렌더링
 * - 게임 로직은 React(BattlePage)가 담당하며,
 *   BATTLE_STATE_UPDATE 이벤트를 수신해 비주얼만 갱신한다
 */
export default class BattleScene extends Phaser.Scene {
  /** 플레이어 몬스터 스프라이트 */
  private playerSprite!: Phaser.GameObjects.Image;
  /** 적 몬스터 스프라이트 */
  private enemySprite!: Phaser.GameObjects.Image;

  /** 플레이어 HP 바 그래픽 객체 */
  private playerHpGraphics!: Phaser.GameObjects.Graphics;
  /** 적 HP 바 그래픽 객체 */
  private enemyHpGraphics!: Phaser.GameObjects.Graphics;

  /** 플레이어 상태이상 텍스트 */
  private playerStatusText!: Phaser.GameObjects.Text;
  /** 적 상태이상 텍스트 */
  private enemyStatusText!: Phaser.GameObjects.Text;

  /** 현재 HP 추적 (바 초기 렌더링에 사용) */
  private playerMaxHp = 100;
  private enemyMaxHp = 100;

  constructor() {
    super("BattleScene");
  }

  // ─── 이미지 사전 로드 ───────────────────────────────────────────────────────────

  preload() {
    const data = getBattleInitData();
    if (!data) return;

    // BattlePage가 setBattleInitData()로 전달한 Vite 처리 URL을 Phaser 로더에 등록
    this.load.image("battle-bg", data.bgImageUrl);
    this.load.image("player-monster", data.playerImageUrl);
    this.load.image("enemy-monster", data.enemyImageUrl);
  }

  // ─── 씬 생성 ────────────────────────────────────────────────────────────────────

  create() {
    const W = this.scale.width;   // 960
    const H = this.scale.height;  // 400

    // 배경 이미지 (없으면 단색으로 대체)
    if (this.textures.exists("battle-bg")) {
      this.add
        .image(W / 2, H / 2, "battle-bg")
        .setDisplaySize(W, H)
        .setDepth(0);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e).setDepth(0);
    }

    // 약간의 어두운 오버레이로 UI 가독성 향상
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.15).setDepth(1);

    // 적 몬스터 스프라이트 (화면 우상단)
    if (this.textures.exists("enemy-monster")) {
      this.enemySprite = this.add
        .image(W - 200, 130, "enemy-monster")
        .setScale(2.5)
        .setDepth(2);
    }

    // 플레이어 몬스터 스프라이트 (화면 좌하단)
    if (this.textures.exists("player-monster")) {
      this.playerSprite = this.add
        .image(200, H - 90, "player-monster")
        .setScale(2.5)
        .setDepth(2);
    }

    // HP 바 그래픽 초기화
    this.playerHpGraphics = this.add.graphics().setDepth(5);
    this.enemyHpGraphics = this.add.graphics().setDepth(5);

    // 상태이상 텍스트 (HP 바 위에 표시)
    this.playerStatusText = this.add
      .text(PLAYER_BAR_X, PLAYER_BAR_Y - 22, "", {
        fontSize: "13px",
        color: "#ffdd57",
        backgroundColor: "#000000aa",
        padding: { x: 5, y: 2 },
      })
      .setDepth(6);

    this.enemyStatusText = this.add
      .text(ENEMY_BAR_X, ENEMY_BAR_Y - 22, "", {
        fontSize: "13px",
        color: "#ffdd57",
        backgroundColor: "#000000aa",
        padding: { x: 5, y: 2 },
      })
      .setDepth(6);

    // 초기 HP 바 렌더링 (100% 풀 HP)
    const initData = getBattleInitData();
    if (initData) {
      this.playerMaxHp = 100; // 실제 값은 첫 BATTLE_STATE_UPDATE에서 갱신됨
      this.enemyMaxHp = 100;
    }

    this.drawHpBar(this.playerHpGraphics, PLAYER_BAR_X, PLAYER_BAR_Y, 1, true);
    this.drawHpBar(this.enemyHpGraphics, ENEMY_BAR_X, ENEMY_BAR_Y, 1, false);

    // BattlePage에서 보내는 상태 갱신 이벤트 구독
    gameEvents.on(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.on(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);
  }

  // ─── HP 바 그리기 ────────────────────────────────────────────────────────────────

  /**
   * HP 바를 지우고 다시 그린다
   * @param graphics  대상 Graphics 객체
   * @param x         바 좌상단 X
   * @param y         바 좌상단 Y
   * @param hpRatio   현재 HP 비율 (0~1)
   * @param isPlayer  플레이어 여부 (테두리 색 구분)
   */
  private drawHpBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    hpRatio: number,
    isPlayer: boolean
  ) {
    graphics.clear();

    // 바 배경
    graphics.fillStyle(0x222222, 0.85);
    graphics.fillRoundedRect(x, y, BAR_W, BAR_H, 4);

    // HP 비율에 따른 색상: 50% 초과 → 초록, 20% 초과 → 노랑, 이하 → 빨강
    const ratio = Math.max(0, Math.min(1, hpRatio));
    const barColor =
      ratio > 0.5 ? 0x4ade80 : ratio > 0.2 ? 0xfacc15 : 0xf87171;

    graphics.fillStyle(barColor, 1);
    graphics.fillRoundedRect(x, y, Math.floor(BAR_W * ratio), BAR_H, 4);

    // 테두리 (플레이어: 파랑, 적: 빨강)
    graphics.lineStyle(1.5, isPlayer ? 0x60a5fa : 0xfb7185, 0.7);
    graphics.strokeRoundedRect(x, y, BAR_W, BAR_H, 4);
  }

  // ─── 상태이상 이름 변환 ──────────────────────────────────────────────────────────

  /** StatusEffect 값을 한글 배지 문자열로 변환 */
  private getStatusBadge(status: StatusEffect): string {
    if (!status) return "";
    const labels: Record<NonNullable<StatusEffect>, string> = {
      paralysis: "⚡ 마비",
      poison: "☠ 독",
      freeze: "❄ 빙결",
      burn: "🔥 화상",
    };
    return labels[status];
  }

  // ─── 이벤트 핸들러 ───────────────────────────────────────────────────────────────

  /** BATTLE_STATE_UPDATE 수신 → 비주얼 갱신 */
  private onStateUpdate(payload: BattleSceneUpdatePayload) {
    // HP 비율 계산 후 바 재렌더링
    const playerRatio = payload.playerHp / payload.playerMaxHp;
    const enemyRatio = payload.enemyHp / payload.enemyMaxHp;

    this.drawHpBar(
      this.playerHpGraphics,
      PLAYER_BAR_X,
      PLAYER_BAR_Y,
      playerRatio,
      true
    );
    this.drawHpBar(
      this.enemyHpGraphics,
      ENEMY_BAR_X,
      ENEMY_BAR_Y,
      enemyRatio,
      false
    );

    // 상태이상 텍스트 갱신
    this.playerStatusText.setText(this.getStatusBadge(payload.playerStatus));
    this.enemyStatusText.setText(this.getStatusBadge(payload.enemyStatus));
  }

  /** BATTLE_END 수신 → 페이드 아웃 효과 */
  private onBattleEnd() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
  }

  // ─── 씬 종료 정리 ────────────────────────────────────────────────────────────────

  /** 씬 비활성화 시 이벤트 리스너 제거 (메모리 누수 방지) */
  shutdown() {
    gameEvents.off(GAME_EVENT.BATTLE_STATE_UPDATE, this.onStateUpdate, this);
    gameEvents.off(GAME_EVENT.BATTLE_END, this.onBattleEnd, this);
  }
}
