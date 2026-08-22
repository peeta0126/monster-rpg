import test from "node:test";
import assert from "node:assert/strict";
import type { ArtifactInstance } from "../src/shared/crafting.ts";
import {
  getArtifactDisplayStats,
  sumEquippedStatBonuses,
  sumEquippedBonusStats,
  applyArtifactQualityStats,
  getEquipmentMaxLevel,
  MAX_EQUIPMENT_ENHANCEMENT,
  ARTIFACT_STAT_LABEL,
  ARTIFACT_BONUS_STAT_LABEL,
  ARTIFACT_BONUS_POOL,
} from "../src/shared/craftingUtils.ts";
import { ARTIFACT_RECIPES } from "../src/workshop/craftingRecipes.ts";

/**
 * 화면에 찍는 능력치와 전투에 실제로 들어가는 능력치가 갈라지지 않게 못 박는다.
 *
 * 예전에는 장비 화면 세 곳이 제작 시점의 원본(statBonuses)을 그대로 찍었다.
 * 레벨·강화 배율이 안 들어가서 Lv.50 +5 정예 목걸이가 화면에는 공격 +14,
 * 전투에는 +52 였다. 어느 테스트도 이걸 안 잡았다.
 */

/** 레시피에서 최대까지 키운 장비 한 개를 만든다 */
function maxedArtifact(itemId: string, quality: "normal" | "rare" | "elite" = "elite"): ArtifactInstance {
  const recipe = ARTIFACT_RECIPES.find((r) => r.id === itemId)!;
  return {
    instanceId:  `${itemId}-maxed`,
    itemId,
    name:        recipe.resultItemName,
    quality,
    description: recipe.description,
    statBonuses: applyArtifactQualityStats(recipe.baseStats ?? [], quality),
    createdAt:   0,
    level:       getEquipmentMaxLevel(quality),
    enhancement: MAX_EQUIPMENT_ENHANCEMENT,
    source:      "crafting",
    // 레벨 50 이면 부가 능력치는 풀에서 다섯 개까지 열린다
    bonusStats:  (ARTIFACT_BONUS_POOL[itemId] ?? []).slice(0, 5).map((b) => ({
      type: b.type, value: b.value, label: b.label,
    })),
  };
}

/** 화면 줄들을 전투 합계와 같은 모양(라벨 → 값)으로 접는다 */
function foldDisplay(artifacts: ArtifactInstance[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const a of artifacts) {
    for (const line of getArtifactDisplayStats(a)) {
      totals[line.label] = (totals[line.label] ?? 0) + line.value;
    }
  }
  return totals;
}

/** 전투가 실제로 더하는 값 (BattlePage.getEquipCombatBonus 와 같은 경로) */
function foldBattle(artifacts: ArtifactInstance[]): Record<string, number> {
  const base  = sumEquippedStatBonuses(artifacts);
  const bonus = sumEquippedBonusStats(artifacts);
  const totals: Record<string, number> = {};
  for (const [stat, value] of Object.entries(base)) {
    if (value !== 0) totals[ARTIFACT_STAT_LABEL[stat as keyof typeof ARTIFACT_STAT_LABEL]] = value;
  }
  for (const [stat, value] of Object.entries(bonus)) {
    if (value !== 0) totals[ARTIFACT_BONUS_STAT_LABEL[stat as keyof typeof ARTIFACT_BONUS_STAT_LABEL]] = value;
  }
  return totals;
}

test("Lv.50 +5 정예 장비: 화면 표시값이 전투 실수치와 같다", () => {
  for (const recipe of ARTIFACT_RECIPES) {
    const artifact = maxedArtifact(recipe.id);
    assert.deepEqual(
      foldDisplay([artifact]),
      foldBattle([artifact]),
      `${recipe.resultItemName}: 화면과 전투가 다른 값을 본다`,
    );
  }
});

test("장착 세 개를 한꺼번에 세도 화면 합계 = 전투 합계", () => {
  const equipped = ARTIFACT_RECIPES.map((r) => maxedArtifact(r.id));
  assert.deepEqual(foldDisplay(equipped), foldBattle(equipped));
});

test("원본 능력치를 그대로 찍으면 실제보다 한참 낮다 (회귀 감시)", () => {
  const necklace = maxedArtifact("power_necklace");
  const raw      = necklace.statBonuses.find((b) => b.stat === "attack")!.value;
  const shown    = getArtifactDisplayStats(necklace).find((l) => l.label === "공격력")!.value;

  // 정예 배율까지만 먹은 원본은 14, 레벨·강화까지 먹으면 52다.
  assert.equal(raw, 14);
  assert.equal(shown, 52);
  assert.ok(shown > raw * 3, "레벨·강화 배율이 빠졌다");
});

test("갓 만든 장비(Lv.1 +0)는 원본 값 그대로다", () => {
  const recipe = ARTIFACT_RECIPES.find((r) => r.id === "guard_bracelet")!;
  const fresh: ArtifactInstance = {
    instanceId: "fresh", itemId: recipe.id, name: recipe.resultItemName,
    quality: "rare", description: recipe.description,
    statBonuses: applyArtifactQualityStats(recipe.baseStats ?? [], "rare"),
    createdAt: 0, level: 1, enhancement: 0,
  };
  for (const line of getArtifactDisplayStats(fresh)) {
    const base = fresh.statBonuses.find((b) => ARTIFACT_STAT_LABEL[b.stat] === line.label)!;
    assert.equal(line.value, base.value, `${line.label} 이 갓 만든 값과 다르다`);
  }
});

test("최대 HP 부가 능력치는 HP 줄에 한 번만 더해진다", () => {
  // 힘의 목걸이는 기본 HP 가 없다 — 부가 능력치로만 HP 가 생긴다
  const necklace = maxedArtifact("power_necklace");
  const hpFlat   = (necklace.bonusStats ?? [])
    .filter((b) => b.type === "maxHpFlat").reduce((s, b) => s + b.value, 0);
  const lines    = getArtifactDisplayStats(necklace);

  assert.ok(hpFlat > 0, "이 테스트는 최대 HP 부가 능력치를 전제로 한다");
  assert.equal(lines.filter((l) => l.label === "HP").length, 1);
  assert.equal(lines.find((l) => l.label === "HP")!.value, hpFlat);
  assert.equal(lines.filter((l) => l.label === "최대 HP").length, 0, "최대 HP 를 따로 또 세고 있다");
});
