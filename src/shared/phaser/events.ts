import type { PersistedStoryFlag } from "../playerStore";
import type { QuestObjective } from "../../camp/questObjectives";
import type { QuestReward } from "../../camp/questRewards";

/**
 * React ↔ Phaser 공용 이벤트 버스.
 *
 * Phaser.Events.EventEmitter 를 쓰지 않는다. 이 파일은 main.tsx 가 임포트하는데,
 * Phaser 를 물고 오면 캔버스를 안 쓰는 화면(숲·가방·몬스터·공방)에서도 phaser 청크
 * 325KB 를 함께 받게 된다. 버스가 Phaser 에 기대야 할 이유도 없다 —
 * 필요한 건 on/off/once/emit 뿐이다.
 */
type Listener = (...args: never[]) => void;

class EventBus {
  private map = new Map<string, { fn: Listener; once: boolean }[]>();

  on(event: string, fn: Listener): this {
    this.add(event, fn, false);
    return this;
  }

  once(event: string, fn: Listener): this {
    this.add(event, fn, true);
    return this;
  }

  /** fn 을 생략하면 그 이벤트의 리스너를 전부 제거한다 */
  off(event: string, fn?: Listener): this {
    if (!fn) { this.map.delete(event); return this; }
    const list = this.map.get(event);
    if (!list) return this;
    const next = list.filter((l) => l.fn !== fn);
    if (next.length) this.map.set(event, next);
    else this.map.delete(event);
    return this;
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this.map.get(event);
    if (!list?.length) return false;
    // 핸들러 안에서 off/on 을 부르는 경우가 있어 복사본을 순회한다
    for (const l of [...list]) {
      if (l.once) this.off(event, l.fn);
      (l.fn as (...a: unknown[]) => void)(...args);
    }
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) this.map.delete(event);
    else this.map.clear();
    return this;
  }

  private add(event: string, fn: Listener, once: boolean) {
    const list = this.map.get(event) ?? [];
    list.push({ fn, once });
    this.map.set(event, list);
  }
}

export const gameEvents = new EventBus();

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
  /** BattlePage → BattleScene: 자동 진행 타이머 만료. Q 를 누른 것과 같게 처리한다 */
  BATTLE_LOG_ADVANCE: "battle:log-advance",
  /** BattlePage → BattleScene: 전투 결과 (승패/층) */
  BATTLE_RESULT: "battle:result",
  /** BattlePage → BattleScene: 전투 종료 (언마운트) */
  BATTLE_END: "battle:end",
  /** BattlePage → BattleScene: 플레이어 몬스터 교체 (스프라이트 변경) */
  BATTLE_PLAYER_SWITCH: "battle:player-switch",
  /** BattlePage → BattleScene: 한 방 맞았다. 연출(흔들림·플래시·데미지 숫자)용 */
  BATTLE_HIT: "battle:hit",
  /** BattlePage → BattleScene: 반짝임 한 번 (레벨업·포획 성공) */
  BATTLE_SPARKLE: "battle:sparkle",
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
  /** 이야기 대사일 때만. 끝까지 읽으면 "본 대사"로 기록된다 */
  dialogueId?: string;
  setsFlag?: PersistedStoryFlag;
  /** 대사가 끝나면 건네주는 몬스터 (첫 파티원) */
  grantsMonsterId?: string;
  acceptQuestId?: string;
  completeQuest?: {
    questId: string;
    /** 받은 것 화면의 제목. 뭘 하고 받은 건지가 붙어 있어야 기억에 남는다 */
    questTitle: string;
    objective: QuestObjective;
    rewards: QuestReward[];
    setsFlag?: PersistedStoryFlag;
  };
}

export interface BattleHitPayload {
  /** 맞은 쪽 */
  target: "enemy" | "player";
  damage: number;
  /** 속성 상성 배율. 2 이상이면 약점, 1 미만이면 반감 */
  multiplier: number;
  isCrit: boolean;
  isHit: boolean;
  category: "physical" | "special" | "status";
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
