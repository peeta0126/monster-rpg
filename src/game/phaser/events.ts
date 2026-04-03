import Phaser from "phaser";

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  ENTER_BATTLE: "portal:enter-battle",
  /** BaseCampScene → BaseCampPage: 농장 페이지로 이동 */
  ENTER_FARM: "portal:enter-farm",
  /** BaseCampScene → BaseCampPage: 숲 탐험 페이지로 이동 */
  ENTER_FOREST: "portal:enter-forest",
  BATTLE_INIT: "battle:init",
  /** BattlePage → BattleScene: HP·상태이상 갱신 */
  BATTLE_STATE_UPDATE: "battle:state-update",
  /** BattlePage → BattleScene: 전투 로그 한 줄 표시 요청 */
  BATTLE_LOG: "battle:log",
  /** BattleScene → BattlePage: 로그 확인 완료 (Q 눌림) */
  BATTLE_LOG_ACK: "battle:log-ack",
  /** BattlePage → BattleScene: 전투 결과 (승패/층) */
  BATTLE_RESULT: "battle:result",
  /** BattlePage → BattleScene: 전투 종료 (언마운트) */
  BATTLE_END: "battle:end",
} as const;

export interface BattleResultPayload {
  outcome: "win" | "lose";
  floor: number;
}
