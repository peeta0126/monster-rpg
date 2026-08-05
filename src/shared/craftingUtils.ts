import type {
  ArtifactStatBonus,
  ArtifactStatType,
  ArtifactBonusStat,
  ArtifactBonusStatType,
  ArtifactInstance,
  ItemQuality,
} from "./crafting";

export type RpsResult = "win" | "draw" | "lose";

export function rollItemQuality(result: RpsResult): ItemQuality {
  const random = Math.random();

  if (result === "win") {
    if (random < 0.2) return "elite";
    if (random < 0.75) return "rare";
    return "normal";
  }

  if (result === "draw") {
    if (random < 0.05) return "elite";
    if (random < 0.4) return "rare";
    return "normal";
  }

  // lose
  if (random < 0.15) return "rare";
  return "normal";
}

export const QUALITY_LABEL: Record<ItemQuality, string> = {
  normal: "일반 제작품",
  rare:   "희귀 제작품",
  elite:  "최고급 제작품",
};

export const QUALITY_COLOR: Record<ItemQuality, string> = {
  normal: "#a1a1aa",
  rare:   "#818cf8",
  elite:  "#f59e0b",
};

export const QUALITY_GLOW: Record<ItemQuality, string> = {
  normal: "rgba(161,161,170,0.3)",
  rare:   "rgba(129,140,248,0.4)",
  elite:  "rgba(245,158,11,0.5)",
};

export const QUALITY_MULTIPLIER: Record<ItemQuality, number> = {
  normal: 1.0,
  rare:   1.35,
  elite:  1.8,
};

export const ARTIFACT_STAT_LABEL: Record<ArtifactStatType, string> = {
  attack:       "공격력",
  defense:      "방어력",
  hp:           "HP",
  speed:        "속도",
  critRate:     "치명타 확률",
  elementPower: "속성 능력",
};

// ─── 레벨·강화 스케일링 ───────────────────────────────────────────────────────────

/**
 * 레벨 배율: 레벨 1당 3% 증가
 * Lv.1 → ×1.00 · Lv.10 → ×1.27 · Lv.30 → ×1.87 · Lv.50 → ×2.47
 */
export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.03;
}

/**
 * 강화 배율: +1당 10% 증가
 * +0 → ×1.0 · +3 → ×1.3 · +5 → ×1.5
 */
export function getEnhancementMultiplier(enhancement: number): number {
  return 1 + enhancement * 0.10;
}

/** 단일 능력치에 레벨·강화 배율 적용 */
export function getEffectiveStat(base: number, level: number, enhancement: number): number {
  return Math.round(base * getLevelMultiplier(level) * getEnhancementMultiplier(enhancement));
}

/** 능력치 배열 전체에 레벨·강화 배율 적용 */
export function getEffectiveStats(
  statBonuses: ArtifactStatBonus[],
  level: number,
  enhancement: number,
): ArtifactStatBonus[] {
  return statBonuses.map((b) => ({
    ...b,
    value: getEffectiveStat(b.value, level, enhancement),
  }));
}

/** 장착된 아티팩트 전체의 레벨·강화 적용 능력치 합계 (부가 능력치 중 최대 HP만 hp에 합산) */
export function sumEquippedStatBonuses(
  equipped: ArtifactInstance[],
): Record<ArtifactStatType, number> {
  const totals: Record<ArtifactStatType, number> = {
    attack: 0, defense: 0, hp: 0, speed: 0, critRate: 0, elementPower: 0,
  };
  for (const a of equipped) {
    for (const b of getEffectiveStats(a.statBonuses, a.level ?? 1, a.enhancement ?? 0)) {
      totals[b.stat] += b.value;
    }
    for (const bonus of a.bonusStats ?? []) {
      if (bonus.type === "maxHpFlat") totals.hp += bonus.value;
    }
  }
  return totals;
}

// ─── 부가 능력치 풀 ────────────────────────────────────────────────────────────────

export interface ArtifactBonusStatDef {
  type:  ArtifactBonusStatType;
  value: number;
  label: string;
}

/**
 * 아티팩트 itemId별 부가 능력치 후보 풀
 * 레벨 10 달성마다 미해제 항목 중 1개를 랜덤 획득
 */
export const ARTIFACT_BONUS_POOL: Record<string, ArtifactBonusStatDef[]> = {
  power_necklace: [
    { type: "fireDamage",   value: 5,  label: "화염 데미지 +5%" },
    { type: "waterDamage",  value: 4,  label: "수류 데미지 +4%" },
    { type: "windDamage",   value: 4,  label: "풍속 데미지 +4%" },
    { type: "critDamage",   value: 8,  label: "치명타 데미지 +8%" },
    { type: "maxHpFlat",    value: 30, label: "최대 HP +30" },
  ],
  guard_bracelet: [
    { type: "maxHpFlat",    value: 50, label: "최대 HP +50" },
    { type: "waterDamage",  value: 5,  label: "수류 데미지 +5%" },
    { type: "earthDamage",  value: 5,  label: "대지 데미지 +5%" },
    { type: "expBonus",     value: 5,  label: "경험치 획득 +5%" },
    { type: "critDamage",   value: 6,  label: "치명타 데미지 +6%" },
  ],
  spirit_amulet: [
    { type: "maxHpFlat",    value: 60, label: "최대 HP +60" },
    { type: "windDamage",   value: 6,  label: "풍속 데미지 +6%" },
    { type: "expBonus",     value: 8,  label: "경험치 획득 +8%" },
    { type: "critDamage",   value: 6,  label: "치명타 데미지 +6%" },
    { type: "fireDamage",   value: 5,  label: "화염 데미지 +5%" },
  ],
};

export const ARTIFACT_BONUS_STAT_LABEL: Record<ArtifactBonusStatType, string> = {
  fireDamage:  "화염 데미지",
  waterDamage: "수류 데미지",
  windDamage:  "풍속 데미지",
  earthDamage: "대지 데미지",
  critDamage:  "치명타 데미지",
  maxHpFlat:   "최대 HP",
  expBonus:    "경험치 획득",
};

/**
 * 레벨 업 후 부가 능력치를 해제해야 하는지 여부와
 * 해제할 보너스 스탯을 반환한다.
 * 이전 레벨~새 레벨 사이에 걸친 10의 배수 임계값마다 1회 해제.
 */
export function rollBonusStats(
  itemId:    string,
  prevLevel: number,
  newLevel:  number,
  existing:  ArtifactBonusStat[],
): ArtifactBonusStat[] {
  const pool = ARTIFACT_BONUS_POOL[itemId] ?? [];
  const unlockedTypes = new Set(existing.map((b) => b.type));
  const result = [...existing];

  for (let threshold = 10; threshold <= newLevel; threshold += 10) {
    if (prevLevel < threshold) {
      const available = pool.filter((p) => !unlockedTypes.has(p.type));
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      result.push({ type: pick.type, value: pick.value, label: pick.label });
      unlockedTypes.add(pick.type);
    }
  }

  return result;
}

export function applyArtifactQualityStats(
  baseStats: ArtifactStatBonus[],
  quality: ItemQuality,
): ArtifactStatBonus[] {
  const multiplier = QUALITY_MULTIPLIER[quality];
  return baseStats.map((b) => ({
    ...b,
    value: Math.round(b.value * multiplier),
  }));
}

// ─── 장비 성장 시스템 ──────────────────────────────────────────────────────────────

/** 등급별 최대 레벨 */
export const EQUIPMENT_MAX_LEVEL: Record<ItemQuality, number> = {
  normal: 30,
  rare:   40,
  elite:  50,
};

/** 최대 강화 수치 (+5) */
export const MAX_EQUIPMENT_ENHANCEMENT = 5;

export function getEquipmentMaxLevel(quality: ItemQuality): number {
  return EQUIPMENT_MAX_LEVEL[quality];
}

/**
 * 레벨업에 필요한 강화석 수량
 * Normal×1 / Rare×2 / Elite×3 배율, 레벨이 높을수록 더 필요
 */
export function getEquipmentLevelUpCost(quality: ItemQuality, currentLevel: number): number {
  const mult = ({ normal: 1, rare: 2, elite: 3 } as const)[quality];
  return Math.ceil(currentLevel / 3) * mult;
}

/**
 * 분해 시 획득하는 강화석 수량
 * 등급 기본값 + 레벨 보너스 + 강화 보너스
 */
export function getDisassembleStones(
  quality: ItemQuality,
  level: number,
  enhancement: number,
): number {
  const base = ({ normal: 3, rare: 8, elite: 18 } as const)[quality];
  const levelBonus       = Math.floor(level / 5);
  const enhancementBonus = enhancement * 2;
  return base + levelBonus + enhancementBonus;
}

/** 다음 등급 반환 (elite이면 null) */
export function getNextQuality(quality: ItemQuality): ItemQuality | null {
  if (quality === "normal") return "rare";
  if (quality === "rare")   return "elite";
  return null;
}

/** 두 아티팩트의 합성 가능 여부 */
export function canSynthesizeArtifacts(
  a: { quality: ItemQuality; level?: number; enhancement?: number; instanceId: string },
  b: { quality: ItemQuality; level?: number; enhancement?: number; instanceId: string },
): boolean {
  if (a.instanceId === b.instanceId) return false;
  if (a.quality !== b.quality)       return false;
  if (a.quality === "elite")         return false;
  const maxLv = EQUIPMENT_MAX_LEVEL[a.quality];
  return (
    (a.level ?? 1) >= maxLv &&
    (b.level ?? 1) >= maxLv &&
    (a.enhancement ?? 0) >= MAX_EQUIPMENT_ENHANCEMENT &&
    (b.enhancement ?? 0) >= MAX_EQUIPMENT_ENHANCEMENT
  );
}

// ─── 방향키 QTE 품질 결정 ──────────────────────────────────────────────────────────

export type ArrowQteRating = "perfect" | "great" | "good" | "bad";

/**
 * 아티팩트 QTE 시험 결과(rating)를 기반으로 아이템 품질을 확률적으로 결정한다.
 *
 * perfect (5/5): Elite 40% · Rare 50% · Normal 10%
 * great   (4/5): Elite 20% · Rare 55% · Normal 25%
 * good    (3/5): Elite  5% · Rare 40% · Normal 55%
 * bad   (0-2/5): Elite  0% · Rare 15% · Normal 85%
 */
export function rollArtifactQualityFromArrowResult(rating: ArrowQteRating): ItemQuality {
  const r = Math.random();

  if (rating === "perfect") {
    if (r < 0.40) return "elite";
    if (r < 0.90) return "rare";
    return "normal";
  }
  if (rating === "great") {
    if (r < 0.20) return "elite";
    if (r < 0.75) return "rare";
    return "normal";
  }
  if (rating === "good") {
    if (r < 0.05) return "elite";
    if (r < 0.45) return "rare";
    return "normal";
  }
  // bad
  if (r < 0.15) return "rare";
  return "normal";
}

// ─── 아티팩트 슬롯 ────────────────────────────────────────────────────────────────
export const ARTIFACT_SLOT_MAP: Record<string, string> = {
  power_necklace: "necklace",
  guard_bracelet: "bracelet",
  spirit_amulet:  "amulet",
};

export const ARTIFACT_SLOT_LABEL: Record<string, string> = {
  necklace: "목걸이",
  bracelet: "팔찌",
  amulet:   "부적",
};

export const ALL_ARTIFACT_SLOTS = ["necklace", "bracelet", "amulet"] as const;
