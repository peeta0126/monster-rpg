export type CraftingDifficulty = "easy" | "normal" | "hard";
export type CraftingStationType = "artifact" | "potion";
export type ItemQuality = "normal" | "rare" | "elite";

// ─── 아티팩트 능력치 ──────────────────────────────────────────────────────────────
export type ArtifactStatType =
  | "attack"
  | "defense"
  | "hp"
  | "speed"
  | "critRate"
  | "elementPower";

export interface ArtifactStatBonus {
  stat: ArtifactStatType;
  value: number;
}

export interface ArtifactInstance {
  instanceId: string;
  itemId: string;
  name: string;
  quality: ItemQuality;
  description: string;
  statBonuses: ArtifactStatBonus[];
  createdAt: number;
}

export interface CraftedPotionStack {
  stackId: string;    // itemId + "_" + quality
  itemId: string;
  name: string;
  quality: ItemQuality;
  quantity: number;
}

// ─── 기존 타입 유지 ────────────────────────────────────────────────────────────────
export type CraftingMaterialId =
  | "wood"
  | "iron"
  | "crystal"
  | "monster_essence"
  | "herb"
  | "water"
  | "slime_extract"
  | "magic_dust"
  | "fiber";

export interface CraftingMaterialCost {
  itemId: string;
  name: string;
  amount: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  difficulty: CraftingDifficulty;
  stationType: CraftingStationType;
  costs: CraftingMaterialCost[];
  resultItemId: string;
  resultItemName: string;
  baseStats?: ArtifactStatBonus[];   // 아티팩트 전용 기본 능력치
}

export type CraftingResult = "success" | "failed" | "no-materials";

export interface CraftedItem {
  id: string;
  recipeId: string;
  name: string;
  quality: ItemQuality;
  stationType: CraftingStationType;
  createdAt: number;
  statBonuses?: ArtifactStatBonus[];   // 아티팩트 제작 시 계산된 능력치
}
