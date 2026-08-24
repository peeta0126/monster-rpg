/** 속성 종류 (ice 포함 6종) */
export type ElementType = "fire" | "water" | "grass" | "electric" | "ice" | "normal" | "poison";

/** 속성 한글 이름. 화면에 속성을 적는 자리가 여럿이라 여기 한 벌만 둔다 */
export const ELEMENT_KO: Record<ElementType, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말", poison: "독",
};

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
  /** null 은 "무속성/전속성"(오름 전용). 방어할 때 모든 상성 배율이 1배로 고정된다 */
  type: ElementType | null;
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
}

// ─── 전투 시스템 타입 ────────────────────────────────────────────────────────────

/** 상태이상 종류. null 이면 정상 */
export type StatusEffect = "paralysis" | "poison" | "freeze" | "burn" | null;
