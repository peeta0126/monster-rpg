// ─── 가구 보너스 타입 ────────────────────────────────────────────────────────────

export interface FurnitureBonus {
  hp?: number;           // 파티 몬스터 최대 HP 증가
  attack?: number;       // 공격력 증가
  defense?: number;      // 방어력 증가
  speed?: number;        // 속도 증가
  expBonus?: number;     // 경험치 획득 보너스 (%)
  potionBonus?: number;  // 물약 회복량 보너스 (%)
  statusResist?: number; // 상태이상 저항률 (%)
}

// ─── 가구 인터페이스 ─────────────────────────────────────────────────────────────

export interface Furniture {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** Phaser Graphics 렌더링용 hex 색상 */
  color: number;
  bonus: FurnitureBonus;
  /** 재료 소비 레시피: materialId → 필요 수량 */
  recipe: Record<string, number>;
  /** 방 안에 배치 가능한 최대 수 */
  maxInRoom: number;
}

// ─── 조합 세트 인터페이스 ────────────────────────────────────────────────────────

export interface FurnitureCombination {
  id: string;
  name: string;
  description: string;
  requiredFurniture: string[];
  /** 개별 보너스 외에 추가로 적용되는 세트 보너스 */
  bonus: FurnitureBonus;
}

// ─── 가구 10종 ──────────────────────────────────────────────────────────────────

export const FURNITURE: Furniture[] = [
  {
    id: "wooden_bed",
    name: "나무 침대",
    emoji: "🛏️",
    description: "푹신한 나무 침대. 파티 몬스터의 최대 체력이 증가한다.",
    color: 0x8b5e3c,
    bonus: { hp: 15 },
    recipe: { wood_plank: 3, leather: 2 },
    maxInRoom: 1,
  },
  {
    id: "study_desk",
    name: "공부 책상",
    emoji: "📖",
    description: "전략 연구용 책상. 전투 경험치 획득이 늘어난다.",
    color: 0x6b4226,
    bonus: { expBonus: 10 },
    recipe: { wood_plank: 2, iron_fragment: 1 },
    maxInRoom: 1,
  },
  {
    id: "bookshelf",
    name: "책장",
    emoji: "📚",
    description: "지식이 가득한 책장. 경험치 획득량이 더욱 증가한다.",
    color: 0x5d4037,
    bonus: { expBonus: 15 },
    recipe: { wood_plank: 4, root: 1 },
    maxInRoom: 1,
  },
  {
    id: "fireplace",
    name: "벽난로",
    emoji: "🔥",
    description: "따뜻한 벽난로. 몸을 단련하여 상태이상에 강해진다.",
    color: 0xbf360c,
    bonus: { statusResist: 20 },
    recipe: { iron_fragment: 3, crystal: 1 },
    maxInRoom: 1,
  },
  {
    id: "training_dummy",
    name: "훈련 인형",
    emoji: "🪆",
    description: "매일 훈련하는 인형. 파티 몬스터의 공격력이 증가한다.",
    color: 0xc8a000,
    bonus: { attack: 8 },
    recipe: { wood_plank: 2, leather: 3 },
    maxInRoom: 1,
  },
  {
    id: "herb_shelf",
    name: "약초 선반",
    emoji: "🌿",
    description: "약초와 재료를 보관하는 선반. 물약의 회복 효과가 강해진다.",
    color: 0x2e7d32,
    bonus: { potionBonus: 20 },
    recipe: { wood_plank: 2, herb: 3 },
    maxInRoom: 1,
  },
  {
    id: "aquarium",
    name: "수조",
    emoji: "🐠",
    description: "신비로운 물고기가 사는 수조. 방어력과 최대 체력이 증가한다.",
    color: 0x0d47a1,
    bonus: { defense: 5, hp: 10 },
    recipe: { iron_fragment: 2, crystal: 2 },
    maxInRoom: 1,
  },
  {
    id: "weapon_rack",
    name: "무기 거치대",
    emoji: "⚔️",
    description: "무기를 보관하는 거치대. 공격력과 방어력이 모두 증가한다.",
    color: 0x546e7a,
    bonus: { attack: 5, defense: 5 },
    recipe: { iron_fragment: 3, wood_plank: 1 },
    maxInRoom: 1,
  },
  {
    id: "training_mat",
    name: "수련 매트",
    emoji: "🟦",
    description: "몸을 단련하는 매트. 파티 몬스터의 속도가 크게 증가한다.",
    color: 0x1a237e,
    bonus: { speed: 5 },
    recipe: { leather: 4, herb: 1 },
    maxInRoom: 1,
  },
  {
    id: "crystal_display",
    name: "수정 진열대",
    emoji: "💎",
    description: "마법 수정을 전시하는 진열대. 공격력이 크게 증가한다.",
    color: 0x6a1b9a,
    bonus: { attack: 10 },
    recipe: { crystal: 3, iron_fragment: 2 },
    maxInRoom: 1,
  },
];

// ─── 조합 세트 4종 ──────────────────────────────────────────────────────────────

export const FURNITURE_COMBINATIONS: FurnitureCombination[] = [
  {
    id: "athlete_room",
    name: "선수의 방",
    description: "침대 + 수련 매트. 체력과 속도가 크게 향상된다.",
    requiredFurniture: ["wooden_bed", "training_mat"],
    bonus: { hp: 20, speed: 5 },
  },
  {
    id: "scholar_room",
    name: "학자의 방",
    description: "책상 + 책장. 경험치 획득이 대폭 증가한다.",
    requiredFurniture: ["study_desk", "bookshelf"],
    bonus: { expBonus: 25 },
  },
  {
    id: "dojo",
    name: "수련 도장",
    description: "훈련 인형 + 무기 거치대 + 수련 매트. 공격·방어가 크게 향상된다.",
    requiredFurniture: ["training_dummy", "weapon_rack", "training_mat"],
    bonus: { attack: 15, defense: 5 },
  },
  {
    id: "apothecary",
    name: "약사의 방",
    description: "약초 선반 + 벽난로. 물약 효과와 상태이상 저항이 크게 높아진다.",
    requiredFurniture: ["herb_shelf", "fireplace"],
    bonus: { potionBonus: 30, statusResist: 20 },
  },
];

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────────

export function getFurniture(id: string): Furniture | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/** 배치된 가구 슬롯 배열에서 현재 활성화된 조합 세트 목록 반환 */
export function getActiveCombinations(
  placedFurniture: (string | null)[],
): FurnitureCombination[] {
  const placed = new Set(placedFurniture.filter(Boolean) as string[]);
  return FURNITURE_COMBINATIONS.filter((combo) =>
    combo.requiredFurniture.every((id) => placed.has(id)),
  );
}

/** 배치된 가구 + 활성 조합 세트를 합산한 총 보너스 반환 */
export function calcHousingBonuses(placedFurniture: (string | null)[]): {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  expBonus: number;
  potionBonus: number;
  statusResist: number;
  activeCombinations: string[];
} {
  const total = {
    hp: 0, attack: 0, defense: 0, speed: 0,
    expBonus: 0, potionBonus: 0, statusResist: 0,
    activeCombinations: [] as string[],
  };

  // 개별 가구 보너스
  for (const id of placedFurniture) {
    if (!id) continue;
    const f = getFurniture(id);
    if (!f) continue;
    total.hp           += f.bonus.hp           ?? 0;
    total.attack       += f.bonus.attack       ?? 0;
    total.defense      += f.bonus.defense      ?? 0;
    total.speed        += f.bonus.speed        ?? 0;
    total.expBonus     += f.bonus.expBonus     ?? 0;
    total.potionBonus  += f.bonus.potionBonus  ?? 0;
    total.statusResist += f.bonus.statusResist ?? 0;
  }

  // 조합 세트 보너스
  const combos = getActiveCombinations(placedFurniture);
  for (const combo of combos) {
    total.hp           += combo.bonus.hp           ?? 0;
    total.attack       += combo.bonus.attack       ?? 0;
    total.defense      += combo.bonus.defense      ?? 0;
    total.speed        += combo.bonus.speed        ?? 0;
    total.expBonus     += combo.bonus.expBonus     ?? 0;
    total.potionBonus  += combo.bonus.potionBonus  ?? 0;
    total.statusResist += combo.bonus.statusResist ?? 0;
    total.activeCombinations.push(combo.name);
  }

  // 저항은 최대 85%로 제한
  total.statusResist = Math.min(total.statusResist, 85);

  return total;
}
