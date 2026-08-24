/**
 * 측정용 파티 구성 한 벌.
 *
 * bossCurve 와 floorProbe 가 각자 파티를 만들고 있었는데, 그 둘이 서로 다른 파티를
 * 만들고 있었다. floorProbe 는 `scaleToLevel` 만 써서 진화를 안 시켰다. 그래서
 * 같은 층 같은 레벨을 두 도구가 13% 와 73% 로 재고 있었다. 측정 도구가 서로 다른
 * 값을 내면 어느 쪽을 믿을지부터 정해야 하므로, 파티 만드는 법은 여기 한 곳뿐이다.
 */
import type { ArtifactInstance, ItemQuality } from "../../src/shared/crafting";
import { applyArtifactQualityStats, rollBonusStats } from "../../src/shared/craftingUtils";
import { ARTIFACT_RECIPES } from "../../src/workshop/craftingRecipes";
import { applyLevelGrowth } from "../../src/monster/growth";
import { chainKeyOf, IMPRINT_TIERS } from "../../src/monster/imprint";
import { monsters } from "../../src/monster/monsters";
import { scaleToLevel } from "../../src/shared/floorTable";
import type { OwnedMon } from "./gameModel";

/** `rare:20:3` = 레어 등급 · 장비 레벨 20 · 강화 +3. `-` 는 맨몸 */
export interface GearSpec {
  quality: ItemQuality;
  level: number;
  enhancement: number;
}

export function parseGear(spec: string | undefined): GearSpec | null {
  if (!spec || spec === "-" || spec === "none") return null;
  const [quality, level, enhancement] = spec.split(":");
  if (!["normal", "rare", "elite"].includes(quality)) {
    throw new Error(`장비 등급이 이상하다: ${quality} (normal|rare|elite)`);
  }
  return {
    quality: quality as ItemQuality,
    level: Number(level ?? 1),
    enhancement: Number(enhancement ?? 0),
  };
}

/** 세 슬롯을 다 채운 세트. 보너스 스탯도 레벨에 맞게 굴려 준다(장비의 실제 값이 그렇다) */
export function makeGear(uid: string, spec: GearSpec | null): ArtifactInstance[] {
  if (!spec) return [];
  return ARTIFACT_RECIPES.map((r, i) => ({
    instanceId: `${uid}-g${i}`,
    itemId: r.resultItemId,
    name: r.resultItemName,
    quality: spec.quality,
    description: r.description,
    statBonuses: applyArtifactQualityStats(r.baseStats ?? [], spec.quality),
    createdAt: 0,
    level: spec.level,
    enhancement: spec.enhancement,
    source: "crafting" as const,
    bonusStats: rollBonusStats(r.resultItemId, 1, spec.level, []),
  }));
}

/**
 * `종족id:레벨` 목록으로 파티를 만든다.
 *
 * ⚠️ `applyLevelGrowth` 를 반드시 태운다. 이게 기술 습득과 진화를 적용하는 유일한
 * 경로다. 빼먹으면 Lv40 아쿠비(진화 전, 위력 45)로 40층을 재게 된다.
 */
export async function makeParty(spec: string): Promise<OwnedMon[]> {
  const entries = spec.split(",").map((s) => s.trim()).filter(Boolean);
  return Promise.all(entries.map(async (entry, i) => {
    const [id, lv] = entry.split(":");
    const base = monsters.find((m) => m.id === id);
    if (!base) throw new Error(`그런 몬스터가 없다: ${id}`);
    const level = Number(lv ?? 1);
    const scaled = scaleToLevel(base, level);
    let mon: OwnedMon = { ...scaled, uid: `p${i}`, currentHp: scaled.maxHp };
    mon = (await applyLevelGrowth(mon, 1)).monster as OwnedMon;
    mon.currentHp = mon.maxHp;
    return mon;
  }));
}

/** 그 등급이 되려면 몇 마리를 먹였어야 하는가 */
export function fedForTier(tier: number): number {
  if (tier <= 0) return 0;
  return IMPRINT_TIERS.find((d) => d.tier === tier)?.fed ?? 0;
}

/** 파티가 속한 모든 계열을 같은 각인 등급으로 맞춘 표 */
export function imprintAt(party: OwnedMon[], tier: number): Record<string, number> {
  const fed = fedForTier(tier);
  const table: Record<string, number> = {};
  for (const m of party) table[chainKeyOf(m)] = fed;
  return table;
}

/**
 * 측정 한 판에 쓸 물약. 시행마다 새로 만들어야 한다. 공유하면 앞 시행이 다 마신다.
 *
 * 층에 따라 다르게 준다. 한 벌로 22개를 쥐여 주면 15층 파티가 40층 파티만큼 버텨서,
 * 초반 관문이 실제보다 물러 보인다(맨몸 승률 100% 가 그렇게 나왔다). 판당 제작량이
 * 60개 남짓(scripts/sim/run.ts 실측)이라, 층 하나에 배정되는 몫은 이 정도다.
 */
export function freshPotions(floor: number): Record<string, number> {
  if (floor <= 15) return { potion: 4, antidote: 2 };
  if (floor <= 30) return { potion: 4, super_potion: 3, antidote: 2, attack_buff: 1 };
  return { super_potion: 4, max_potion: 2, antidote: 3, strong_attack_buff: 2 };
}

/** 사람이 읽는 장비 이름 */
export function gearLabel(spec: GearSpec | null, tier: number): string {
  const gear = spec ? `${spec.quality} L${spec.level}+${spec.enhancement}` : "맨몸";
  return tier > 0 ? `${gear} · 각인${tier}` : gear;
}
