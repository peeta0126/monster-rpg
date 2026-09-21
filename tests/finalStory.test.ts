import test from "node:test";
import assert from "node:assert/strict";
import {
  ORION_DIALOGUES,
  ORION_MOTHERS_CURE_QUEST,
  resolveNpcInteraction,
} from "../src/camp/campDialogues.ts";
import { usePlayerStore } from "../src/shared/playerStore.ts";
import { DEFAULT_STORY_FLAGS } from "../src/shared/storyFlags.ts";
import { POTION_RECIPES, visiblePotionRecipes } from "../src/workshop/craftingRecipes.ts";

const storySeenBeforeFloor50 = [
  "orion_intro", "orion_after_baros", "orion_first_capture", "orion_quest_medicine",
  "orion_floor_10", "orion_floor_20", "orion_floor_40",
];

function interaction(potions: Record<string, number>, questStatus: Record<string, "not_accepted" | "in_progress" | "completed">, seenDialogues: string[]) {
  return resolveNpcInteraction(ORION_DIALOGUES, {
    npcId: "orion",
    storyFlags: {
      ...DEFAULT_STORY_FLAGS,
      met_orion: true,
      met_baros: true,
      first_capture: true,
      quest_baros_done: true,
      quest_orion_done: true,
    },
    bestFloor: 50,
    snapshot: {
      materials: { ormr_essence: 1 }, potions, bestFloor: 50,
      dexCaught: [], equippedArtifacts: {}, craftedArtifacts: [], partyCount: 1, storageCount: 0,
    },
    questStatus,
    seenDialogues,
    talkState: { hurt: false, noPotion: false, loaded: false },
  });
}

test("50층 귀환 대사는 정수를 소비하지 않고 최종 퀘스트를 시작한다", () => {
  const result = interaction({}, {}, storySeenBeforeFloor50);
  assert.equal(result?.dialogueId, "orion_floor_50");
  assert.equal(result?.acceptQuestId, "orion_mothers_cure");
  assert.equal(result?.completeQuest, undefined);

  usePlayerStore.setState({
    materials: { ormr_essence: 1 },
    questStatus: {},
    seenDialogues: [...storySeenBeforeFloor50],
    storyFlags: { ...DEFAULT_STORY_FLAGS },
  });
  const store = usePlayerStore.getState();
  store.markDialogueSeen("orion_floor_50");
  store.acceptQuest("orion_mothers_cure");
  const after = usePlayerStore.getState();
  assert.equal(after.materials.ormr_essence, 1);
  assert.equal(after.questStatus.orion_mothers_cure, "in_progress");
});

test("50층에서 돌아오면 밀린 대사가 있어도 오리온 귀환 대사가 먼저다", () => {
  const result = interaction({}, {}, []);
  assert.equal(result?.dialogueId, "orion_floor_50");
});

test("치료약 레시피는 정수와 오리온 귀환 대화를 모두 요구한다", () => {
  const hiddenBeforeTalk = visiblePotionRecipes({ ormr_essence: 1 }, []);
  const hiddenWithoutEssence = visiblePotionRecipes({}, ["orion_floor_50"]);
  const visible = visiblePotionRecipes({ ormr_essence: 1 }, ["orion_floor_50"]);
  assert.ok(!hiddenBeforeTalk.some((r) => r.id === "ws_mothers_cure"));
  assert.ok(!hiddenWithoutEssence.some((r) => r.id === "ws_mothers_cure"));
  assert.ok(visible.some((r) => r.id === "ws_mothers_cure"));
});

test("치료약 제작은 정수만 소비하고 엔딩 상태를 바꾸지 않는다", () => {
  const recipe = POTION_RECIPES.find((r) => r.id === "ws_mothers_cure")!;
  usePlayerStore.setState({
    materials: { ormr_essence: 1 }, potions: {}, craftedPotions: [], craftedItems: [],
    questStatus: { orion_mothers_cure: "in_progress" },
    storyFlags: { ...DEFAULT_STORY_FLAGS },
  });

  const made = usePlayerStore.getState().craftWorkshopRecipeByQuality(recipe, "rare");
  assert.ok(made);
  const after = usePlayerStore.getState();
  assert.equal(after.materials.ormr_essence, 0);
  assert.equal(after.potions.mothers_cure_potion, 1);
  assert.equal(after.storyFlags.tower_cleared, false);
  assert.equal(after.questStatus.orion_mothers_cure, "in_progress");
});

test("오리온에게 치료약을 건네야 소비·완료되고, tower_cleared는 아직 false다", () => {
  const seen = [...storySeenBeforeFloor50, "orion_floor_50"];
  const result = interaction(
    { mothers_cure_potion: 1 },
    { orion_mothers_cure: "in_progress" },
    seen,
  );
  assert.equal(result?.completeQuest?.questId, "orion_mothers_cure");

  usePlayerStore.setState({
    materials: {}, potions: { mothers_cure_potion: 1 },
    craftedPotions: [{
      stackId: "mothers_cure_potion_rare", itemId: "mothers_cure_potion",
      name: "어머니의 치료약", quality: "rare", quantity: 1,
    }],
    craftedArtifacts: [], questStatus: { orion_mothers_cure: "in_progress" },
    storyFlags: { ...DEFAULT_STORY_FLAGS },
  });
  const completed = usePlayerStore.getState().completeQuest({
    questId: ORION_MOTHERS_CURE_QUEST.id,
    objective: ORION_MOTHERS_CURE_QUEST.objective,
    rewards: ORION_MOTHERS_CURE_QUEST.rewards,
  });
  assert.ok(completed);
  const after = usePlayerStore.getState();
  assert.equal(after.potions.mothers_cure_potion, 0);
  assert.ok(!after.craftedPotions.some((p) => p.itemId === "mothers_cure_potion"));
  assert.equal(after.questStatus.orion_mothers_cure, "completed");
  assert.equal(after.storyFlags.tower_cleared, false);

  const repeated = interaction({}, { orion_mothers_cure: "completed" }, seen);
  assert.notEqual(repeated?.completeQuest?.questId, "orion_mothers_cure");
});

test("완료한 최종 퀘스트는 50층 대사의 자동 수락으로 되돌아가지 않는다", () => {
  usePlayerStore.setState({ questStatus: { orion_mothers_cure: "completed" } });
  usePlayerStore.getState().acceptQuest("orion_mothers_cure");
  assert.equal(usePlayerStore.getState().questStatus.orion_mothers_cure, "completed");
});
