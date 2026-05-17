import type { FurnitureSize, FurnitureVisual } from "../types/housing";

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
  /** 타일 점유 크기 (기본 1×1) */
  size: FurnitureSize;
  /** 화면 렌더링 시각 정보 */
  visual: FurnitureVisual;
}

// ─── 가구 데이터 ──────────────────────────────────────────────────────────────

export const FURNITURE: Furniture[] = [

  // ── 나무(Wood) 4종 — 아늑한 나무 가구 세트 ────────────────────────────────────
  {
    id: "wooden_bed",
    name: "나무 침대",
    emoji: "🛏️",
    description: "따뜻한 나무 프레임의 침대. 푹신한 매트리스로 피로가 빠르게 회복된다.",
    material: "wood",
    rarity: "common",
    color: 0x8b5e3c,
    recipe: { wood_plank: 2, leather: 1 },
    maxInRoom: 1,
    size: { width: 2, height: 3 },
    visual: {
      width: 168,
      height: 252,
      offsetX: 0,
      offsetY: -18,
    },
  },
  {
    id: "wooden_desk",
    name: "나무 책상",
    emoji: "📖",
    description: "넓은 나무 책상. 지도와 전략서를 펼쳐두기 좋다.",
    material: "wood",
    rarity: "common",
    color: 0x6b4226,
    recipe: { wood_plank: 3 },
    maxInRoom: 1,
    size: { width: 2, height: 1 },
    visual: {
      width: 168,
      height: 112,
      offsetX: 0,
      offsetY: -10,
    },
  },
  {
    id: "wooden_dummy",
    name: "나무 의자",
    emoji: "🪑",
    description: "손으로 깎아 만든 나무 의자. 책상 옆에 두면 잘 어울린다.",
    material: "wood",
    rarity: "rare",
    color: 0xbc8a4e,
    recipe: { wood_plank: 2, leather: 1 },
    maxInRoom: 3,
    size: { width: 1, height: 1 },
    visual: {
      width: 88,
      height: 100,
      offsetX: 0,
      offsetY: -8,
    },
  },
  {
    id: "ancient_altar",
    name: "나무 식탁",
    emoji: "🍽️",
    description: "넉넉한 원목 식탁. 나무 세트를 완성해 집의 분위기를 높인다.",
    material: "wood",
    rarity: "epic",
    color: 0x7a4e28,
    recipe: { wood_plank: 5, leather: 1 },
    maxInRoom: 1,
    size: { width: 2, height: 2 },
    visual: {
      width: 168,
      height: 158,
      offsetX: 0,
      offsetY: -12,
    },
  },

  // ── 철(Iron) 3종 — 철제 인테리어 세트 ────────────────────────────────────────
  {
    id: "iron_stand",
    name: "철제 스탠드 조명",
    emoji: "💡",
    description: "우아한 철제 플로어 램프. 방 안을 포근하게 밝혀 준다.",
    material: "iron",
    rarity: "common",
    color: 0x546e7a,
    recipe: { iron_fragment: 2 },
    maxInRoom: 3,
    size: { width: 1, height: 1 },
    visual: {
      width: 72,
      height: 128,
      offsetX: 0,
      offsetY: -6,
    },
  },
  {
    id: "iron_trainer",
    name: "철제 책장",
    emoji: "📚",
    description: "튼튼한 철제 프레임의 책장. 전략서와 모험 일지가 빼곡히 꽂혀 있다.",
    material: "iron",
    rarity: "rare",
    color: 0x37474f,
    recipe: { iron_fragment: 3, wood_plank: 1 },
    maxInRoom: 2,
    size: { width: 1, height: 2 },
    visual: {
      width: 88,
      height: 172,
      offsetX: 0,
      offsetY: -10,
    },
  },
  {
    id: "magic_forge",
    name: "마법 벽난로",
    emoji: "🔥",
    description: "마법 불꽃이 타오르는 벽난로. 철 풀세트의 중심. 방 전체를 따뜻하게 한다.",
    material: "iron",
    rarity: "legendary",
    color: 0xbf360c,
    recipe: { iron_fragment: 5, crystal: 2 },
    maxInRoom: 1,
    size: { width: 2, height: 1 },
    visual: {
      width: 168,
      height: 120,
      offsetX: 0,
      offsetY: -12,
    },
  },

  // ── 수정(Crystal) 2종 — 마법 인테리어 세트 ────────────────────────────────────
  {
    id: "crystal_display",
    name: "수정 장식장",
    emoji: "💎",
    description: "수정으로 장식된 유리 장식장. 희귀 아이템을 전시하기 좋다.",
    material: "crystal",
    rarity: "epic",
    color: 0x6a1b9a,
    recipe: { crystal: 3, wood_plank: 2 },
    maxInRoom: 2,
    size: { width: 2, height: 1 },
    visual: {
      width: 168,
      height: 112,
      offsetX: 0,
      offsetY: -10,
    },
  },
  {
    id: "ancient_orb",
    name: "마법 화분",
    emoji: "🪴",
    description: "수정 조각이 박힌 신비로운 화분. 수정 풀세트 완성. 이상한 식물이 자라고 있다.",
    material: "crystal",
    rarity: "legendary",
    color: 0x4a148c,
    recipe: { crystal: 4, herb: 3 },
    maxInRoom: 2,
    size: { width: 1, height: 1 },
    visual: {
      width: 88,
      height: 92,
      offsetX: 0,
      offsetY: -6,
    },
  },

  // ── 가죽(Leather) 1종 — 편안한 가죽 세트 ──────────────────────────────────────
  {
    id: "leather_mat",
    name: "가죽 러그",
    emoji: "🟫",
    description: "부드러운 짐승 가죽으로 만든 장식 러그. 맨발로 밟으면 아늑하다.",
    material: "leather",
    rarity: "rare",
    color: 0x6d4c1f,
    recipe: { leather: 4, herb: 1 },
    maxInRoom: 2,
    size: { width: 3, height: 2 },
    visual: {
      width: 248,
      height: 164,
      offsetX: 0,
      offsetY: -14,
    },
  },
];

// ─── 재질별 세트 단계 정의 ───────────────────────────────────────────────────────

export interface MaterialSetTier {
  count: number;
  name: string;
  description: string;
}

export const MATERIAL_SET_TIERS: Record<FurnitureMaterial, MaterialSetTier[]> = {
  wood: [
    { count: 2, name: "나무 2종 세트",   description: "경험치 획득 +10%" },
    { count: 3, name: "나무 3종 세트",   description: "경험치 획득 +15% + 최대 HP +5%" },
    { count: 4, name: "나무 풀세트 ✨", description: "경험치 획득 +20% + 최대 HP +10% + 물약 회복 +10%" },
  ],
  iron: [
    { count: 2, name: "철 2종 세트",   description: "공격력 +10%" },
    { count: 3, name: "철 풀세트 ✨", description: "공격력 +10% + 방어력 +10%" },
  ],
  crystal: [
    { count: 1, name: "수정 1종 세트",   description: "탑 드랍 +15% + 포획률 +10%" },
    { count: 2, name: "수정 풀세트 ✨", description: "탑 드랍 +30% + 포획률 +20%" },
  ],
  leather: [
    { count: 1, name: "가죽 세트",   description: "물약 회복 +20% + 경험치 획득 +10%" },
  ],
};

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────────

export function getFurniture(id: string): Furniture | undefined {
  return FURNITURE.find((f) => f.id === id);
}

export function countMaterials(furnitureIds: string[]): Record<FurnitureMaterial, number> {
  const counts: Record<FurnitureMaterial, number> = { wood: 0, iron: 0, crystal: 0, leather: 0 };
  for (const id of furnitureIds) {
    const f = getFurniture(id);
    if (f) counts[f.material]++;
  }
  return counts;
}

export function calcHousingBonuses(furnitureIds: string[]): {
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
    hpPercent: 0, attackPercent: 0, defensePercent: 0, speedPercent: 0,
    expBonusPercent: 0, potionBonusPercent: 0, statusResistPercent: 0,
    catchRateBonus: 0, grassTypePower: 0, towerDropBonus: 0,
    activeSets: [] as string[],
  };
  const counts = countMaterials(furnitureIds);

  if (counts.wood >= 4) {
    bonuses.grassTypePower = 20; bonuses.hpPercent = 10;
    bonuses.activeSets.push("나무 풀세트 ✨");
  } else if (counts.wood >= 3) {
    bonuses.grassTypePower = 20;
    bonuses.activeSets.push("나무 3종 세트");
  } else if (counts.wood >= 2) {
    bonuses.grassTypePower = 10;
    bonuses.activeSets.push("나무 2종 세트");
  }

  if (counts.iron >= 3) {
    bonuses.attackPercent = 10; bonuses.defensePercent = 10;
    bonuses.activeSets.push("철 풀세트 ✨");
  } else if (counts.iron >= 2) {
    bonuses.attackPercent = 10;
    bonuses.activeSets.push("철 2종 세트");
  }

  if (counts.crystal >= 2) {
    bonuses.towerDropBonus = 30; bonuses.catchRateBonus = 15;
    bonuses.activeSets.push("수정 풀세트 ✨");
  } else if (counts.crystal >= 1) {
    bonuses.towerDropBonus = 15;
    bonuses.activeSets.push("수정 1종 세트");
  }

  if (counts.leather >= 1) {
    bonuses.potionBonusPercent = 15; bonuses.expBonusPercent = 10;
    bonuses.activeSets.push("가죽 세트");
  }

  return bonuses;
}
