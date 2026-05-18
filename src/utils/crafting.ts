import type { ArtifactStatBonus, ArtifactStatType, ItemQuality } from "../types/crafting";

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
