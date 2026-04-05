/** 속성 종류 (ice 포함 6종) */
export type ElementType = "fire" | "water" | "grass" | "electric" | "ice" | "normal" | "poison";

export interface Move {
  id: string;
  name: string;
  type: ElementType;
  power: number;
  accuracy: number;
  category: "physical" | "special" | "status";
  /** 이 스킬이 명중 시 유발할 수 있는 상태이상 */
  statusEffect?: NonNullable<StatusEffect>;
  /** 상태이상 발동 확률 0~100 (기본값: 0) */
  statusChance?: number;
}

export interface Monster {
  id: string;
  /** 한글 이름 */
  name: string;
  type: ElementType;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: Move[];
  level: number;
  exp: number;
  expToNextLevel: number;
  rewardExp: number;
  /** 진화 단계: 1(기초), 2(1차 진화), 3(2차 진화) */
  evolutionStage?: number;
  /** 진화 계열 ID (같은 계열끼리 동일) */
  evolutionChainId?: string;
  /** 다음 진화 몬스터 ID */
  evolvesTo?: string;
  /** 이전 단계 몬스터 ID */
  evolvesFrom?: string;
  /** 이 레벨 이상이면 진화 가능 */
  evolvesAtLevel?: number;
  /** 더미 데이터 여부 (미구현 몬스터) */
  isDummy?: boolean;
}

/** 진화 정보를 포함한 확장 몬스터 타입 */
export interface ExtendedMonster extends Monster {
  /** 진화 단계: 1(기초), 2(1차 진화), 3(2차 진화) */
  evolutionStage: number;
  /** 같은 진화 계열 ID */
  evolutionChainId?: string;
  /** 다음 진화 몬스터 ID */
  evolvesTo?: string;
  /** 이전 단계 몬스터 ID */
  evolvesFrom?: string;
  /** 이 레벨 이상이면 진화 가능 */
  evolvesAtLevel?: number;
}

// ─── 베이스캠프 타입 ──────────────────────────────────────────────────────────────

export type Position = { x: number; y: number };

export type CampMonsterData = {
  id: string;
  name: string;
  image: string;
  position: Position;
};

export type PortalData = {
  id: string;
  label: string;
  position: Position;
  target: "battle" | "forest" | "volcano";
};

export type UnlockZoneData = {
  id: string;
  name: string;
  position: Position;
  width: number;
  height: number;
  unlocked: boolean;
};

// ─── 전투 시스템 타입 ────────────────────────────────────────────────────────────

/** 상태이상 종류. null은 정상 상태를 의미한다. */
export type StatusEffect = "paralysis" | "poison" | "freeze" | "burn" | null;

/**
 * 전투 페이즈 상태 머신
 * IDLE → PLAYER_TURN → ENEMY_TURN → CATCH_PHASE → RESULT
 */
export type BattlePhase =
  | "IDLE"
  | "PLAYER_TURN"
  | "ENEMY_TURN"
  | "CATCH_PHASE"
  | "RESULT";

/** 플레이어가 한 턴에 수행할 수 있는 액션 종류 */
export type BattleActionType = "SKILL" | "CATCH" | "FLEE";

/** 한 턴의 액션 정보 */
export interface BattleAction {
  type: BattleActionType;
  skillId?: string;
}

/** 전투 최종 결과 */
export type BattleOutcome =
  | "idle"
  | "player-win"
  | "enemy-win"
  | "caught"
  | "fled";

/** 전투 전체 상태 인터페이스 */
export interface BattleState {
  phase: BattlePhase;
  result: BattleOutcome;
  isCatchZone: boolean;
  turn: number;
  logs: string[];
}
