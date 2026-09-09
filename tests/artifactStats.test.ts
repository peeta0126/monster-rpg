import test from "node:test";
import assert from "node:assert/strict";
import type { ArtifactBonusStat, ArtifactInstance } from "../src/shared/crafting.ts";
import { elementDamageKey } from "../src/shared/crafting.ts";
import { ELEMENT_KO, type ElementType } from "../src/shared/game.ts";
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
  ELEMENT_DAMAGE_CAP,
  repairBonusStats,
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
  const base = sumEquippedStatBonuses(artifacts);
  const { elementDamage, critDamage } = sumEquippedBonusStats(artifacts);
  const totals: Record<string, number> = {};
  for (const [stat, value] of Object.entries(base)) {
    if (value !== 0) totals[ARTIFACT_STAT_LABEL[stat as keyof typeof ARTIFACT_STAT_LABEL]] = value;
  }
  for (const [element, value] of Object.entries(elementDamage)) {
    if (value !== 0) totals[ARTIFACT_BONUS_STAT_LABEL[elementDamageKey(element as ElementType)]] = value;
  }
  if (critDamage !== 0) totals[ARTIFACT_BONUS_STAT_LABEL.critDamage] = critDamage;
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
  // 힘의 목걸이는 기본 HP 가 없다. 부가 능력치로만 HP 가 생긴다.
  // 최대 HP 가 표의 몇 번째 줄이냐에 검사가 걸리지 않게, 그 줄만 골라 붙인다
  const necklace = maxedArtifact("power_necklace");
  const hpDef    = ARTIFACT_BONUS_POOL.power_necklace.find((b) => b.type === "maxHpFlat")!;
  necklace.bonusStats = [{ type: hpDef.type, value: hpDef.value, label: hpDef.label }];
  const hpFlat   = (necklace.bonusStats ?? [])
    .filter((b) => b.type === "maxHpFlat").reduce((s, b) => s + b.value, 0);
  const lines    = getArtifactDisplayStats(necklace);

  assert.ok(hpFlat > 0, "이 테스트는 최대 HP 부가 능력치를 전제로 한다");
  assert.equal(lines.filter((l) => l.label === "HP").length, 1);
  assert.equal(lines.find((l) => l.label === "HP")!.value, hpFlat);
  assert.equal(lines.filter((l) => l.label === "최대 HP").length, 0, "최대 HP 를 따로 또 세고 있다");
});

// ─── 부가 능력치 표 ────────────────────────────────────────────────────────────────
//
// 옛 표에는 아무 일도 안 하는 굴림이 섞여 있었다 — 이 게임에 없는 속성(풍속·대지),
// 같은 type 을 두 줄 적어 둔 것(해제가 타입 단위로 중복을 걸러서 뒤 줄은 영영 안 나온다),
// 컷오프에 막혀 죽은 경험치. 화면에는 값이 적히니 코드로만 보이는 고장이었다.

const ALL_ELEMENTS = Object.keys(ELEMENT_KO) as ElementType[];

test("후보는 전부 살아 있는 능력치다 (없는 속성이 섞여 있지 않다)", () => {
  const live = new Set<string>([
    ...ALL_ELEMENTS.map(elementDamageKey), "critDamage", "maxHpFlat",
  ]);
  for (const [itemId, pool] of Object.entries(ARTIFACT_BONUS_POOL)) {
    for (const b of pool) {
      assert.ok(live.has(b.type), `${itemId}: ${b.type} 은 이 게임에 없는 능력치다`);
      assert.ok(b.value > 0, `${itemId}: ${b.type} 값이 0 이다`);
      assert.ok(b.label.length > 0, `${itemId}: ${b.type} 이름이 비었다`);
    }
  }
});

test("한 장비의 후보에 같은 type 이 두 번 나오지 않는다", () => {
  for (const [itemId, pool] of Object.entries(ARTIFACT_BONUS_POOL)) {
    const types = pool.map((b) => b.type);
    assert.equal(new Set(types).size, types.length,
      `${itemId}: 같은 type 이 두 줄 있다 — 뒤 줄은 해제 대상에서 영영 빠진다`);
  }
});

test("만렙 정예(해제 다섯 번)가 빈손으로 끝나지 않는다", () => {
  for (const [itemId, pool] of Object.entries(ARTIFACT_BONUS_POOL)) {
    assert.ok(pool.length > 5,
      `${itemId}: 후보가 ${pool.length}개다 — 다섯을 다 채우고도 남아야 같은 장비가 다르게 자란다`);
  }
});

test("여덟 속성이 모두 어딘가의 후보에 있다", () => {
  const covered = new Set(Object.values(ARTIFACT_BONUS_POOL).flat().map((b) => b.type));
  for (const element of ALL_ELEMENTS) {
    assert.ok(covered.has(elementDamageKey(element)),
      `${ELEMENT_KO[element]}: 속성 데미지를 올릴 장비가 없다`);
  }
});

test("이름은 속성 표(ELEMENT_KO) 한 벌에서 온다", () => {
  for (const element of ALL_ELEMENTS) {
    assert.equal(ARTIFACT_BONUS_STAT_LABEL[elementDamageKey(element)], `${ELEMENT_KO[element]} 데미지`);
  }
});

// ─── 겹칠 때 ──────────────────────────────────────────────────────────────────────

/** 부가 능력치만 든 장비 한 개. 겹침을 볼 때는 기본 능력치가 필요 없다 */
function bonusOnly(instanceId: string, stats: ArtifactBonusStat[]): ArtifactInstance {
  return {
    instanceId, itemId: "spirit_amulet", name: "정령의 부적", quality: "elite", description: "",
    statBonuses: [], createdAt: 0, level: 50, enhancement: 0, bonusStats: stats,
  };
}

const fire = (value: number): ArtifactBonusStat =>
  ({ type: "fireDamage", value, label: `불꽃 데미지 +${value}%` });

test("같은 속성이 둘이면 더한다 (곱이 아니다)", () => {
  // 12 + 12 = 24. 곱이면 25.4(1.12² - 1) 인데, 카드마다 +12% 라고 적혀 있으니
  // 사람이 읽는 값은 더한 쪽이다
  const equipped = [bonusOnly("a", [fire(12)]), bonusOnly("b", [fire(12)])];
  assert.equal(sumEquippedBonusStats(equipped).elementDamage.fire, 24);
});

test("한 속성에 몰려도 상한을 넘지 않는다", () => {
  const equipped = [1, 2, 3, 4].map((i) => bonusOnly(`a${i}`, [fire(12)]));
  assert.equal(sumEquippedBonusStats(equipped).elementDamage.fire, ELEMENT_DAMAGE_CAP);
});

test("다른 속성끼리는 서로 안 섞인다", () => {
  const equipped = [
    bonusOnly("a", [fire(12)]),
    bonusOnly("b", [{ type: "waterDamage", value: 12, label: "물 데미지 +12%" }]),
  ];
  const { elementDamage } = sumEquippedBonusStats(equipped);
  assert.equal(elementDamage.fire, 12);
  assert.equal(elementDamage.water, 12);
  assert.equal(elementDamage.grass, 0);
});

// ─── 옛 세이브 고치기 ─────────────────────────────────────────────────────────────

test("표에 없는 이름은 살아 있는 것으로 갈아 준다", () => {
  // 옛 세이브의 힘의 목걸이. 셋 중 둘이 죽은 굴림이었다
  const repaired = repairBonusStats("power_necklace", 30, [
    { type: "fireDamage", value: 5, label: "화염 데미지 +5%" },
    { type: "windDamage", value: 4, label: "풍속 데미지 +4%" },
    { type: "expBonus",   value: 5, label: "경험치 획득 +5%" },
  ] as unknown as ArtifactBonusStat[]);

  // 개수는 레벨이 주는 만큼(30 → 셋) 그대로다. 갈아 준 것이지 뺏은 게 아니다
  assert.equal(repaired.length, 3);
  const types = repaired.map((b) => String(b.type));
  assert.ok(!types.includes("windDamage"), "없는 속성이 남았다");
  assert.ok(!types.includes("expBonus"), "죽은 굴림이 남았다");
  assert.equal(new Set(types).size, 3, "같은 것을 두 번 줬다");
  // 살아남은 줄의 값도 지금 표를 따른다 (5% → 12%)
  assert.equal(repaired.find((b) => b.type === "fireDamage")!.value, 12);
});

test("고치기는 한 번만 돈다 (로드마다 값이 흔들리지 않는다)", () => {
  const once  = repairBonusStats("spirit_amulet", 50, []);
  const twice = repairBonusStats("spirit_amulet", 50, once);
  assert.deepEqual(twice, once);
  assert.equal(once.length, 5, "Lv.50 이면 다섯이 열린다");
});

test("레벨이 낮으면 그만큼만 열린다", () => {
  assert.equal(repairBonusStats("guard_bracelet", 9,  []).length, 0);
  assert.equal(repairBonusStats("guard_bracelet", 10, []).length, 1);
  assert.equal(repairBonusStats("guard_bracelet", 30, []).length, 3);
});
