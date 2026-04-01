import Phaser from "phaser";

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  /** 베이스캠프 포탈에서 전투 씬으로 진입 */
  ENTER_BATTLE: "portal:enter-battle",

  /** BattlePage → BattleScene: 씬 초기화 완료 후 첫 상태 전달 */
  BATTLE_INIT: "battle:init",

  /**
   * BattlePage → BattleScene: 매 턴 후 전투 상태(HP·상태이상 등) 갱신
   * payload: BattleSceneUpdatePayload
   */
  BATTLE_STATE_UPDATE: "battle:state-update",

  /** BattlePage → BattleScene: 전투 종료 알림 */
  BATTLE_END: "battle:end",
} as const;