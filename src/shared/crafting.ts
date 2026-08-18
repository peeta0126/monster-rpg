export type CraftingDifficulty = "easy" | "normal" | "hard";
export type CraftingStationType = "artifact" | "potion";
export type ItemQuality = "normal" | "rare" | "elite";

// ─── 아티팩트 기본 능력치 ─────────────────────────────────────────────────────────
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

// ─── 부가 능력치 (레벨 10마다 랜덤 해제) ──────────────────────────────────────────
export type ArtifactBonusStatType =
  | "fireDamage"    // 화염 데미지 증가 (%)
  | "waterDamage"   // 수류 데미지 증가 (%)
  | "windDamage"    // 풍속 데미지 증가 (%)
  | "earthDamage"   // 대지 데미지 증가 (%)
  | "critDamage"    // 치명타 데미지 증가 (%)
  | "maxHpFlat"     // 최대 HP 추가 (flat)
  | "expBonus";     // 경험치 획득 증가 (%)

export interface ArtifactBonusStat {
  type:  ArtifactBonusStatType;
  value: number;
  label: string; // 예: "화염 데미지 +5%"
}

export interface ArtifactInstance {
  instanceId: string;
  itemId: string;
  name: string;
  quality: ItemQuality;
  description: string;
  /** 제작 시 품질 배율이 적용된 기본 능력치. 레벨/강화는 표시 시 별도 계산 */
  statBonuses: ArtifactStatBonus[];
  createdAt: number;
  // ── 장비 성장 시스템 (기본값: level 1, enhancement 0) ──────────────────────
  level?: number;        // 현재 레벨
  enhancement?: number;  // 강화 수치 (0 ~ MAX_EQUIPMENT_ENHANCEMENT)
  source?: "crafting" | "synthesis" | "quest"; // 획득 경로
  // ── 부가 능력치 (레벨 10마다 랜덤 해제) ──────────────────────────────────────
  bonusStats?: ArtifactBonusStat[]; // 해제된 부가 능력치 목록
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
