import type { ElementType } from "./game";

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

/**
 * 속성별 데미지 증가(%). 이름을 손으로 적지 않고 `ElementType` 에서 만든다 —
 * 속성을 하나 더하면 이 표도 같이 늘어나고, 없는 속성은 애초에 적을 수 없다.
 *
 * ⚠️ 예전에는 `windDamage`(풍속) · `earthDamage`(대지) 가 있었다. **이 게임에 없는
 * 속성이다.** 어떤 기술도 그 타입을 못 가지니 굴림이 나와도 아무 일이 안 일어나는데,
 * 카드에는 "풍속 데미지 +4%" 라고 적혀 있었다. 여덟 속성 중 실제로 데미지가 붙는 것이
 * 불꽃·물 둘뿐이었던 이유가 이것이다.
 */
export type ElementDamageBonusType = `${ElementType}Damage`;

export type ArtifactBonusStatType =
  | ElementDamageBonusType
  | "critDamage"    // 치명타 데미지 증가 (%)
  | "maxHpFlat";    // 최대 HP 추가 (flat)

/** 속성 → 부가 능력치 키. 문자열을 손으로 잇는 곳을 한 군데로 모은다 */
export function elementDamageKey(type: ElementType): ElementDamageBonusType {
  return `${type}Damage`;
}

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


export interface CraftedItem {
  id: string;
  recipeId: string;
  name: string;
  quality: ItemQuality;
  stationType: CraftingStationType;
  createdAt: number;
  statBonuses?: ArtifactStatBonus[];   // 아티팩트 제작 시 계산된 능력치
}
