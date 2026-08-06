import Phaser from "phaser";
import type { PersistedStoryFlag } from "../playerStore";

export const gameEvents = new Phaser.Events.EventEmitter();

export const GAME_EVENT = {
  ENTER_BATTLE: "portal:enter-battle",
  /** BaseCampScene → BaseCampPage: 집 내부로 이동 */
  ENTER_HOUSING: "portal:enter-housing",
  /** BaseCampScene → BaseCampPage: 숲 탐험 페이지로 이동 */
  ENTER_FOREST: "portal:enter-forest",
  /** BaseCampScene → BaseCampPage: NPC 대화창 표시 */
  SHOW_NPC_DIALOGUE: "npc:show-dialogue",
  /** BattleScene → BattlePage: create() 완료, 리스너 등록됨 (스킬 조작 허용 시점) */
  BATTLE_READY: "battle:ready",
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
  /** BattlePage → BattleScene: 플레이어 몬스터 교체 (스프라이트 변경) */
  BATTLE_PLAYER_SWITCH: "battle:player-switch",
  /** Phaser 씬 진입점(create/update/이벤트 핸들러) 또는 전역 핸들러에서 잡힌 예외를 React로 전달 */
  APP_ERROR: "app:error",
} as const;

export interface AppErrorPayload {
  /** 에러 발생 지점 (씬 키, "window", "promise" 등) */
  source: string;
  message: string;
}

export interface NpcDialoguePayload {
  name: string;
  lines: string[];
  portraitPath: string;
  setsFlag?: PersistedStoryFlag;
  acceptQuestId?: string;
  completeQuest?: {
    questId: string;
    objective: { itemId: string; amount: number };
    rewards: { itemId: string; amount: number }[];
    setsFlag: PersistedStoryFlag;
  };
}

export interface BattlePlayerSwitchPayload {
  /** 파티 인덱스 (preload된 party-mon-{i} 텍스처 키 결정) */
  partyIndex: number;
  name: string;
  level: number;
}

export interface BattleResultPayload {
  outcome: "win" | "lose";
  floor: number;
}
