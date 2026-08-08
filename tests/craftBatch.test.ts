import test from "node:test";
import assert from "node:assert/strict";
import { maxCraftable } from "../src/shared/craftingUtils.ts";
import { usePlayerStore } from "../src/shared/playerStore.ts";
import { POTION_RECIPES } from "../src/workshop/craftingRecipes.ts";

test("maxCraftable: 가장 모자란 재료가 상한을 정한다", () => {
  const costs = [{ itemId: "herb", amount: 2 }, { itemId: "berry", amount: 3 }];
  assert.equal(maxCraftable(costs, { herb: 10, berry: 9 }), 3);   // berry 9/3 = 3
  assert.equal(maxCraftable(costs, { herb: 4, berry: 100 }), 2);  // herb 4/2 = 2
});

test("maxCraftable: 재료가 없으면 0", () => {
  assert.equal(maxCraftable([{ itemId: "herb", amount: 2 }], {}), 0);
  assert.equal(maxCraftable([{ itemId: "herb", amount: 2 }], { herb: 1 }), 0);
});

test("maxCraftable: 비용이 없으면 0 (무한 제작 방지)", () => {
  assert.equal(maxCraftable([], { herb: 99 }), 0);
});

test("같은 품질로 N번 만들면 재료가 N배 소모되고 N개가 쌓인다", () => {
  const recipe = POTION_RECIPES[0];
  const store = usePlayerStore.getState();

  // 딱 3개 분량만 준다
  const materials: Record<string, number> = {};
  for (const c of recipe.costs) materials[c.itemId] = c.amount * 3;
  usePlayerStore.setState({ materials, craftedPotions: [], craftedItems: [], craftedArtifacts: [] });

  let made = 0;
  for (let i = 0; i < 5; i++) {          // 5개를 요청해도
    if (store.craftWorkshopRecipeByQuality(recipe, "rare")) made += 1;
  }

  assert.equal(made, 3, "재료가 떨어지면 만들어진 만큼만");
  const after = usePlayerStore.getState();
  for (const c of recipe.costs) {
    assert.equal(after.materials[c.itemId], 0, `${c.itemId} 전부 소모`);
  }
  const total = after.craftedPotions.reduce((a, p) => a + p.quantity, 0);
  assert.equal(total, 3);
  assert.ok(after.craftedPotions.every((p) => p.quality === "rare"), "품질이 하나로 통일된다");
});
