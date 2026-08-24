import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_QUESTS, questsOf, questUnlocked, activeQuestFor,
} from "../src/camp/campDialogues.ts";
import { monsterReward } from "../src/camp/questRewards.ts";
import { AREA_MATERIAL_POOL, battleDropPool } from "../src/shared/dropTables.ts";
import { MATERIALS } from "../src/shared/items.ts";
import { ARTIFACT_RECIPES, POTION_RECIPES } from "../src/workshop/craftingRecipes.ts";
import { monsters } from "../src/monster/monsters.ts";
import type { PersistedStoryFlag, QuestStatus } from "../src/shared/storyFlags.ts";

const NO_FLAGS: Record<PersistedStoryFlag, boolean> = {
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false,
};
const ENDED: Record<PersistedStoryFlag, boolean> = {
  met_orion: true, met_baros: true, first_capture: true,
  quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
};

test("퀘스트 이름표가 겹치지 않는다", () => {
  const ids = ALL_QUESTS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("선행으로 가리키는 퀘스트가 실재하고, 자기보다 앞에 있다", () => {
  const order = ALL_QUESTS.map((q) => q.id);
  for (const q of ALL_QUESTS) {
    const prev = q.requires.questDone;
    if (!prev) continue;
    const at = order.indexOf(prev);
    assert.notEqual(at, -1, `${q.id} 가 없는 퀘스트를 가리킨다: ${prev}`);
    assert.ok(at < order.indexOf(q.id), `${q.id} 의 선행이 자기보다 뒤에 있다`);
  }
});

test("한 사람이 한 번에 하나만 내놓는다", () => {
  // 엔딩까지 본 옛 세이브를 열면 뒤쪽 조건이 한꺼번에 충족된다. 그래도 하나씩이어야
  // 로그가 한 번에 불어나지 않는다
  for (const npcId of ["orion", "baros"] as const) {
    const offered = activeQuestFor(npcId, ENDED, 50, {});
    assert.ok(offered, `${npcId} 가 아무것도 안 내놓는다`);
    // 가장 앞선 것이어야 한다
    assert.equal(offered.id, questsOf(npcId)[0].id);
  }
});

test("밀린 퀘스트는 순서대로 하나씩 흐른다", () => {
  const status: Record<string, QuestStatus> = {};
  const seen: string[] = [];
  for (let i = 0; i < ALL_QUESTS.length * 2; i++) {
    let any = false;
    for (const npcId of ["baros", "orion"] as const) {
      const q = activeQuestFor(npcId, ENDED, 50, status);
      if (!q) continue;
      status[q.id] = "completed";
      seen.push(q.id);
      any = true;
    }
    if (!any) break;
  }
  assert.equal(seen.length, ALL_QUESTS.length, "결국 전부 받을 수 있어야 한다");
  // 사람별로 보면 정의 순서 그대로다
  for (const npcId of ["orion", "baros"] as const) {
    const mine = seen.filter((id) => ALL_QUESTS.find((q) => q.id === id)!.npcId === npcId);
    assert.deepEqual(mine, questsOf(npcId).map((q) => q.id));
  }
});

test("갓 시작한 사람에게는 첫 퀘스트 하나만 열린다", () => {
  const open = ALL_QUESTS.filter((q) => questUnlocked(q, { ...NO_FLAGS, met_orion: true, met_baros: true }, 0, {}));
  assert.deepEqual(open.map((q) => q.id), ["baros_first_hunt"]);
});

test("몬스터를 주는 퀘스트는 하나뿐이다", () => {
  const withMonster = ALL_QUESTS.filter((q) => monsterReward(q.rewards));
  assert.equal(withMonster.length, 1, "몬스터 보상이 여럿이면 탑이 시시해진다");
  assert.equal(withMonster[0].id, "orion_where_i_stopped");
});

test("몬스터를 주는 퀘스트에는 자리 없을 때의 대사가 있다", () => {
  for (const q of ALL_QUESTS) {
    if (!monsterReward(q.rewards)) continue;
    assert.ok(q.noRoomLines?.length, `${q.id}: 자리가 없을 때 할 말이 없다`);
  }
});

test("주는 몬스터가 로스터에 있고, 진화가 없는 조커다", () => {
  const r = monsterReward(ALL_QUESTS.find((q) => q.id === "orion_where_i_stopped")!.rewards)!;
  const base = monsters.find((m) => m.id === r.monsterId);
  assert.ok(base, "없는 몬스터를 준다");
  assert.equal(base.type, "grass", "풀은 로스터에 하나뿐이라 스스로 못 메우는 구멍이다");
  assert.equal(base.evolvesTo, undefined, "진화가 있으면 파티를 통째로 밀어올린다");
});

test("퀘스트마다 수락·진행중·완료 대사가 다 있다", () => {
  for (const q of ALL_QUESTS) {
    assert.ok(q.acceptLines.length > 0, `${q.id}: 수락 대사가 없다`);
    assert.ok(q.progressLines.length > 0, `${q.id}: 독촉 대사가 없다`);
    assert.ok(q.completeLines.length > 0, `${q.id}: 완료 대사가 없다`);
  }
});

test("새로 쓴 대사의 말투가 사람마다 유지된다", () => {
  // 오리온은 `~게다/~하마/~느냐`, 바로스는 `~해라/~다`. 정확히 세는 대신
  // 두 사람의 어미가 섞이지 않았는지만 본다.
  //
  // 기존 둘은 뺀다. 바로스의 첫 사냥 완료 대사에 "…알아서 가고 싶어질 게다"가 있다.
  // 이미 나간 대사를 이 시험 하나 때문에 고칠 일은 아니라, 다듬을지는 따로 정한다.
  const GRANDFATHERED = new Set(["baros_first_hunt", "orion_mothers_medicine"]);
  for (const q of ALL_QUESTS) {
    if (GRANDFATHERED.has(q.id)) continue;
    const all = [...q.acceptLines, ...q.progressLines, ...q.completeLines, ...(q.noRoomLines ?? [])];
    if (q.npcId === "baros") {
      assert.ok(!all.some((l) => l.includes("게다") || l.includes("하마") || l.includes("느냐")),
        `${q.id}: 바로스가 이장 말투를 쓴다`);
    }
  }
});

test("보상으로 주는 재료·물약·장비가 실재한다", () => {
  const materialIds = new Set(MATERIALS.map((m) => m.id));
  const artifactIds = new Set(ARTIFACT_RECIPES.map((r) => r.resultItemId));
  const potionIds = new Set(POTION_RECIPES.map((r) => r.resultItemId));
  for (const q of ALL_QUESTS) {
    for (const r of q.rewards) {
      if (r.kind === "material") assert.ok(materialIds.has(r.itemId), `${q.id}: 없는 재료 ${r.itemId}`);
      if (r.kind === "artifact") assert.ok(artifactIds.has(r.itemId), `${q.id}: 없는 장비 ${r.itemId}`);
      if (r.kind === "potion") assert.ok(potionIds.has(r.potionId), `${q.id}: 없는 물약 ${r.potionId}`);
    }
  }
});

test("목표로 요구하는 재료는 어디선가 나온다", () => {
  // 슬라임 추출물처럼 "퀘스트가 요구하는데 어디서도 안 나오는" 재료가 생기면
  // 그 퀘스트와 그 뒤가 통째로 죽는다
  const obtainable = new Set([
    ...Object.values(AREA_MATERIAL_POOL).flat(),
    ...[1, 11, 21, 31].flatMap((f) => battleDropPool(f)),
  ]);
  for (const q of ALL_QUESTS) {
    if (q.objective.kind !== "material") continue;
    assert.ok(obtainable.has(q.objective.itemId), `${q.id}: ${q.objective.itemId} 는 어디서도 안 나온다`);
  }
});

test("강화석은 5층 시점에 스스로 못 구한다 — 그래서 보상으로 값어치가 있다", () => {
  // 이 전제가 깨지면 5층 보상의 근거가 사라진다
  const shallow = AREA_MATERIAL_POOL.shallow;
  assert.ok(!shallow.includes("enhancement_stone"), "얕은 숲에서 나오면 보상 의미가 없다");
  assert.ok(!battleDropPool(5).includes("enhancement_stone"), "5층 전투에서 나오면 마찬가지");
  assert.ok(battleDropPool(11).includes("enhancement_stone"), "11층 위에서는 나와야 한다");
});
