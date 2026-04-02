import Phaser from "phaser";

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  ENTER_BATTLE: "portal:enter-battle",
  BATTLE_INIT: "battle:init",
  /** BattlePage → BattleScene: 매 턴 후 HP·상태이상 갱신 */
  BATTLE_STATE_UPDATE: "battle:state-update",
  /** BattlePage → BattleScene: 전투 로그 한 줄 전달 */
  BATTLE_LOG: "battle:log",
  /** BattlePage → BattleScene: 전투 종료 */
  BATTLE_END: "battle:end",
} as const;
