// ─── 재질 / 등급 타입 ──────────────────────────────────────────────────────────

export type FurnitureMaterial = "wood" | "iron" | "crystal" | "leather";
export type FurnitureRarity   = "common" | "rare" | "epic" | "legendary";

export const MATERIAL_LABEL: Record<FurnitureMaterial, string> = {
  wood:    "나무",
  iron:    "철",
  crystal: "수정",
  leather: "가죽",
};

export const RARITY_LABEL: Record<FurnitureRarity, string> = {
  common:   "기본",
  rare:     "희귀",
  epic:     "진귀",
  legendary:"고귀",
};

export const RARITY_COLOR: Record<FurnitureRarity, string> = {
  common:   "#aaaaaa",
  rare:     "#4fc3f7",
  epic:     "#ce93d8",
  legendary:"#ffd54f",
};

// ─── 가구 인터페이스 ─────────────────────────────────────────────────────────────

export interface Furniture {
  id: string;
  name: string;
  emoji: string;
  description: string;
  material: FurnitureMaterial;
  rarity: FurnitureRarity;
  /** Phaser Graphics 렌더링용 hex 색상 */
  color: number;
  /** 재료 소비 레시피: materialId → 필요 수량 */
  recipe: Record<string, number>;
  /** 방 안에 배치 가능한 최대 수 */
  maxInRoom: number;
}

// ─── 가구 10종 ──────────────────────────────────────────────────────────────────

export const FURNITURE: Furniture[] = [
  // ── 나무(Wood) 4종 ──────────────────────────────────────────────────────────
  {
    id: "wooden_bed",
    name: "나무 침대",
    emoji: "🛏️",
    description: "튼튼한 나무 침대. 나무 세트의 시작.",
    material: "wood",
    rarity: "common",
    color: 0x8b5e3c,
    recipe: { wood_plank: 2, leather: 1 },
    maxInRoom: 1,
  },
  {
    id: "wooden_desk",
    name: "나무 책상",
    emoji: "📖",
    description: "전략을 세우는 나무 책상. 나무 세트 2종.",
    material: "wood",
    rarity: "common",
    color: 0x6b4226,
    recipe: { wood_plank: 3 },
    maxInRoom: 1,
  },
  {
    id: "wooden_dummy",
    name: "나무 훈련 인형",
    emoji: "🪆",
    description: "나무로 만든 훈련 인형. 나무 세트 3종 달성.",
    material: "wood",
    rarity: "rare",
    color: 0xbc8a4e,
    recipe: { wood_plank: 4, root: 1 },
    maxInRoom: 1,
  },
  {
    id: "ancient_altar",
    name: "고대 나무 제단",
    emoji: "🌿",
    description: "자연의 기운이 깃든 제단. 나무 풀세트 달성.",
    material: "wood",
    rarity: "epic",
    color: 0x2e7d32,
    recipe: { wood_plank: 6, crystal: 1 },
    maxInRoom: 1,
  },

  // ── 철(Iron) 3종 ────────────────────────────────────────────────────────────
  {
    id: "iron_stand",
    name: "철제 거치대",
    emoji: "⚔️",
    description: "무기를 걸어두는 철제 거치대. 철 세트의 시작.",
    material: "iron",
    rarity: "common",
    color: 0x546e7a,
    recipe: { iron_fragment: 2 },
    maxInRoom: 1,
  },
  {
    id: "iron_trainer",
    name: "철제 훈련 장비",
    emoji: "🏋️",
    description: "몸을 단련하는 철제 기구. 철 세트 2종.",
    material: "iron",
    rarity: "rare",
    color: 0x37474f,
    recipe: { iron_fragment: 3, leather: 1 },
    maxInRoom: 1,
  },
  {
    id: "magic_forge",
    name: "마법 용광로",
    emoji: "🔥",
    description: "마법이 깃든 용광로. 철 풀세트 달성.",
    material: "iron",
    rarity: "legendary",
    color: 0xbf360c,
    recipe: { iron_fragment: 5, crystal: 2 },
    maxInRoom: 1,
  },

  // ── 수정(Crystal) 2종 ───────────────────────────────────────────────────────
  {
    id: "crystal_display",
    name: "수정 진열대",
    emoji: "💎",
    description: "빛나는 수정을 전시한다. 수정 세트 발동.",
    material: "crystal",
    rarity: "epic",
    color: 0x6a1b9a,
    recipe: { crystal: 3, iron_fragment: 1 },
    maxInRoom: 1,
  },
  {
    id: "ancient_orb",
    name: "고대 수정 구슬",
    emoji: "🔮",
    description: "고대의 힘이 담긴 수정 구슬. 수정 풀세트.",
    material: "crystal",
    rarity: "legendary",
    color: 0x4a148c,
    recipe: { crystal: 5, wood_plank: 2 },
    maxInRoom: 1,
  },

  // ── 가죽(Leather) 1종 ───────────────────────────────────────────────────────
  {
    id: "leather_mat",
    name: "가죽 수련 매트",
    emoji: "🟫",
    description: "부드러운 가죽 매트. 물약과 경험치 효율 상승.",
    material: "leather",
    rarity: "rare",
    color: 0x6d4c1f,
    recipe: { leather: 4, herb: 2 },
    maxInRoom: 1,
  },
];

// ─── 재질별 세트 단계 정의 ───────────────────────────────────────────────────────

export interface MaterialSetTier {
  /** 필요한 동일 재질 가구 수 */
  count: number;
  /** 세트 단계 이름 */
  name: string;
  /** 세트 효과 설명 */
  description: string;
}

export const MATERIAL_SET_TIERS: Record<FurnitureMaterial, MaterialSetTier[]> = {
  wood: [
    { count: 2, name: "나무 2종 세트",   description: "풀타입 기술 위력 +10%" },
    { count: 3, name: "나무 3종 세트",   description: "풀타입 기술 위력 +20%" },
    { count: 4, name: "나무 풀세트 ✨", description: "풀타입 기술 위력 +20% + 최대 HP +10%" },
  ],
  iron: [
    { count: 2, name: "철 2종 세트",   description: "공격력 +10%" },
    { count: 3, name: "철 풀세트 ✨", description: "공격력 +10% + 방어력 +10%" },
  ],
  crystal: [
    { count: 1, name: "수정 1종 세트",   description: "탑 드랍 +15%" },
    { count: 2, name: "수정 풀세트 ✨", description: "탑 드랍 +30% + 포획률 +15%" },
  ],
  leather: [
    { count: 1, name: "가죽 세트",   description: "물약 회복 +15% + 경험치 획득 +10%" },
  ],
};

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────────

export function getFurniture(id: string): Furniture | undefined {
  return FURNITURE.find((f) => f.id === id);
}

/** 재질별 배치 수 집계 */
export function countMaterials(
  placedFurniture: (string | null)[],
): Record<FurnitureMaterial, number> {
  const counts: Record<FurnitureMaterial, number> = { wood: 0, iron: 0, crystal: 0, leather: 0 };
  for (const id of placedFurniture) {
    if (!id) continue;
    const f = getFurniture(id);
    if (f) counts[f.material]++;
  }
  return counts;
}

/** 배치된 가구에서 재질별 세트 보너스 합산 */
export function calcHousingBonuses(placedFurniture: (string | null)[]): {
  hpPercent: number;
  attackPercent: number;
  defensePercent: number;
  speedPercent: number;
  expBonusPercent: number;
  potionBonusPercent: number;
  statusResistPercent: number;
  catchRateBonus: number;
  grassTypePower: number;
  towerDropBonus: number;
  activeSets: string[];
} {
  const bonuses = {
    hpPercent: 0,
    attackPercent: 0,
    defensePercent: 0,
    speedPercent: 0,
    expBonusPercent: 0,
    potionBonusPercent: 0,
    statusResistPercent: 0,
    catchRateBonus: 0,
    grassTypePower: 0,
    towerDropBonus: 0,
    activeSets: [] as string[],
  };

  const counts = countMaterials(placedFurniture);

  // ── 나무 세트 ──
  if (counts.wood >= 4) {
    bonuses.grassTypePower = 20;
    bonuses.hpPercent      = 10;
    bonuses.activeSets.push("나무 풀세트 ✨");
  } else if (counts.wood >= 3) {
    bonuses.grassTypePower = 20;
    bonuses.activeSets.push("나무 3종 세트");
  } else if (counts.wood >= 2) {
    bonuses.grassTypePower = 10;
    bonuses.activeSets.push("나무 2종 세트");
  }

  // ── 철 세트 ──
  if (counts.iron >= 3) {
    bonuses.attackPercent  = 10;
    bonuses.defensePercent = 10;
    bonuses.activeSets.push("철 풀세트 ✨");
  } else if (counts.iron >= 2) {
    bonuses.attackPercent = 10;
    bonuses.activeSets.push("철 2종 세트");
  }

  // ── 수정 세트 ──
  if (counts.crystal >= 2) {
    bonuses.towerDropBonus = 30;
    bonuses.catchRateBonus = 15;
    bonuses.activeSets.push("수정 풀세트 ✨");
  } else if (counts.crystal >= 1) {
    bonuses.towerDropBonus = 15;
    bonuses.activeSets.push("수정 1종 세트");
  }

  // ── 가죽 세트 ──
  if (counts.leather >= 1) {
    bonuses.potionBonusPercent = 15;
    bonuses.expBonusPercent    = 10;
    bonuses.activeSets.push("가죽 세트");
  }

  return bonuses;
}
