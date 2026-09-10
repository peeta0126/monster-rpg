/** 속성 종류 (8종) */
export type ElementType =
  | "fire" | "water" | "grass" | "electric" | "ice" | "normal" | "poison" | "crystal";

/** 속성 한글 이름. 화면에 속성을 적는 자리가 여럿이라 여기 한 벌만 둔다 */
export const ELEMENT_KO: Record<ElementType, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말", poison: "독",
  crystal: "크리스탈",
};

/**
 * 이 몬스터가 가진 속성을 화면에 그릴 순서대로. 이중 속성이면 둘, 아니면 하나,
 * 무속성(오름)이면 빈 배열이다.
 *
 * `m.type2 ? [m.type, m.type2] : [m.type]` 를 화면마다 손으로 쓰면 어느 화면은
 * 부속성을 빠뜨린다. 같은 몬스터가 전투에서는 두 칩, 「내 몬스터」에서는 한 칩으로
 * 보이면 둘 중 어느 쪽이 맞는지 플레이어가 알 방법이 없다.
 */
export function elementIdsOf(m: { type: ElementType | null; type2?: ElementType }): ElementType[] {
  if (!m.type) return [];
  return m.type2 && m.type2 !== m.type ? [m.type, m.type2] : [m.type];
}

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
  /**
   * 부속성. 있으면 이중 속성이다 — 방어 배율은 두 속성의 곱이고(clamp 는
   * battleUtils.getTypeMultiplier 참고), 자속 보정은 둘 중 하나만 맞아도 붙는다.
   *
   * ⚠️ 주속성(`type`)은 "그 종이 무엇인가"고 부속성은 "무엇을 하나 더 갖고 있나"다.
   * 화면에 칩을 둘 그릴 때도, 탑 배경을 고를 때도 주속성이 먼저다. 두 자리를 바꿔
   * 적으면 젬로드가 크리스탈 방에서 나오는데 그 방의 그림이 없다.
   */
  type2?: ElementType;
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
