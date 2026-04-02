import Phaser from "phaser";

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  ENTER_BATTLE: "portal:enter-battle",
  BATTLE_INIT: "battle:init",
  /** BattlePage → BattleScene: HP·상태이상 갱신 */
  BATTLE_STATE_UPDATE: "battle:state-update",
  /** BattlePage → BattleScene: 전투 로그 한 줄 */
  BATTLE_LOG: "battle:log",
  /** BattlePage → BattleScene: 전투 결과 (승패/층) */
  BATTLE_RESULT: "battle:result",
  /** BattleScene → BattlePage: 다음 층 이동 요청 */
  BATTLE_NEXT_FLOOR: "battle:next-floor",
  /** BattleScene → BattlePage: 이 층 재도전 요청 */
  BATTLE_RETRY: "battle:retry",
  /** BattlePage → BattleScene: 전투 종료 (언마운트) */
  BATTLE_END: "battle:end",
} as const;

export interface BattleResultPayload {
  outcome: "win" | "lose";
  floor: number;
}
