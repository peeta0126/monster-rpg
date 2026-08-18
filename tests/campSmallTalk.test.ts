import test from "node:test";
import assert from "node:assert/strict";
import {
  talkStage, pickSmallTalk, smallTalkCandidates, LOADED_MATERIAL_COUNT,
  type TalkStage, type SmallTalkNpcId,
} from "../src/camp/campSmallTalk.ts";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction, satisfiedEntries } from "../src/camp/campDialogues.ts";
import type { PersistedStoryFlag } from "../src/shared/storyFlags.ts";

const CALM = { hurt: false, noPotion: false, loaded: false };
const STAGES: TalkStage[] = ["early", "mid", "late", "cleared"];
const NPCS: SmallTalkNpcId[] = ["orion", "baros"];

test("구간이 층수와 엔딩으로 갈린다", () => {
  assert.equal(talkStage(0, false), "early");
  assert.equal(talkStage(9, false), "early");
  assert.equal(talkStage(10, false), "mid");
  assert.equal(talkStage(29, false), "mid");
  assert.equal(talkStage(30, false), "late");
  assert.equal(talkStage(49, false), "late");
  assert.equal(talkStage(50, true), "cleared");
  // 엔딩은 층수를 이긴다 — 50층에 올랐어도 엔딩을 안 봤으면 아직 후반이다
  assert.equal(talkStage(50, false), "late");
  assert.equal(talkStage(3, true), "cleared");
});

test("구간마다 사람마다 잡담이 다섯 줄 이상 있다", () => {
  for (const npc of NPCS) {
    for (const stage of STAGES) {
      const lines = smallTalkCandidates(npc, stage, CALM);
      assert.ok(lines.length >= 5, `${npc}/${stage} 가 ${lines.length}줄이다`);
    }
  }
});

test("잡담이 구간마다 다르다 — 1층 때와 엔딩 후가 같으면 안 된다", () => {
  for (const npc of NPCS) {
    const seen = new Set<string>();
    for (const stage of STAGES) {
      for (const line of smallTalkCandidates(npc, stage, CALM)) {
        assert.ok(!seen.has(line), `${npc}: 구간을 넘어 같은 줄이 있다 — ${line}`);
        seen.add(line);
      }
    }
  }
});

test("두 사람의 잡담이 겹치지 않는다", () => {
  const orion = new Set(STAGES.flatMap((s) => smallTalkCandidates("orion", s, CALM)));
  for (const stage of STAGES) {
    for (const line of smallTalkCandidates("baros", stage, CALM)) {
      assert.ok(!orion.has(line), `두 사람이 같은 말을 한다 — ${line}`);
    }
  }
});

test("조건부 대사는 그 상태일 때만 후보에 낀다", () => {
  for (const npc of NPCS) {
    const calm = smallTalkCandidates(npc, "mid", CALM);
    const hurt = smallTalkCandidates(npc, "mid", { ...CALM, hurt: true });
    assert.equal(hurt.length, calm.length + 1, `${npc}: 다쳤을 때 한 줄이 늘어야 한다`);

    const all = smallTalkCandidates(npc, "mid", { hurt: true, noPotion: true, loaded: true });
    assert.equal(all.length, calm.length + 3);
  }
});

test("조건부 대사가 평소를 덮지 않는다 — 잔소리만 듣게 되면 안 된다", () => {
  // 별도 계층이 아니라 후보에 끼기만 한다. 다쳐 있어도 평상시 줄이 나올 수 있어야 한다
  const state = { hurt: true, noPotion: true, loaded: true };
  const picks = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const line = pickSmallTalk("baros", "mid", state, undefined, () => i / 40);
    if (line) picks.add(line);
  }
  const plain = smallTalkCandidates("baros", "mid", CALM);
  assert.ok(picks.size > 3, "여러 줄이 나와야 한다");
  assert.ok([...picks].some((l) => plain.includes(l)), "평상시 줄도 나와야 한다");
});

test("바로 앞에 한 말은 연달아 안 나온다", () => {
  for (const npc of NPCS) {
    for (const stage of STAGES) {
      const all = smallTalkCandidates(npc, stage, CALM);
      for (const last of all) {
        // 무작위가 어디로 떨어지든 직전 줄은 안 나와야 한다
        for (let i = 0; i < all.length; i++) {
          const got = pickSmallTalk(npc, stage, CALM, last, () => i / all.length);
          assert.notEqual(got, last, `${npc}/${stage}: 같은 말이 두 번 나왔다`);
        }
      }
    }
  }
});

test("후보가 하나뿐이면 그거라도 낸다", () => {
  // 실제 표는 여섯 줄이라 이 경우가 없지만, 규칙이 무너지면 undefined 가 나가 대화가 안 뜬다
  const only = pickSmallTalk("orion", "early", CALM, "있지도 않은 줄", () => 0);
  assert.ok(only);
});

test("엔딩 전 잡담은 용을 말하지 않는다 — 40층 대사가 먼저 꺼내야 한다", () => {
  // "조용하진" 처럼 글자만 겹치는 건 걸리면 안 되니 낱말로 쓰인 자리만 본다
  const DRAGON = /(^|[\s"“'])용[이을은과와도만]?[\s.,…!?"”']/;
  for (const npc of NPCS) {
    for (const stage of ["early", "mid", "late"] as TalkStage[]) {
      for (const line of smallTalkCandidates(npc, stage, { hurt: true, noPotion: true, loaded: true })) {
        assert.ok(!DRAGON.test(line), `${npc}/${stage} 가 용을 먼저 말한다 — ${line}`);
      }
    }
  }
  // 엔딩 후에는 말해도 된다. 실제로 말하는지도 같이 본다 — 아니면 이 시험이 아무것도 안 지킨다
  const after = smallTalkCandidates("orion", "cleared", CALM);
  assert.ok(after.some((l) => DRAGON.test(l)), "엔딩 후에는 용을 꺼내야 한다");
});

// ─── 대사 선택과의 연결 ────────────────────────────────────────────────────────

const flags = (over: Partial<Record<PersistedStoryFlag, boolean>>): Record<PersistedStoryFlag, boolean> => ({
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false, ...over,
});

const ENDED = flags({
  met_orion: true, met_baros: true, first_capture: true,
  quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
});
const DONE_QUESTS = { baros_first_hunt: "completed", orion_mothers_medicine: "completed" } as const;

test("엔딩까지 보고 대사를 다 읽으면 잡담이 나온다", () => {
  for (const [npcId, list] of [["orion", ORION_DIALOGUES], ["baros", BAROS_DIALOGUES]] as const) {
    const seen = satisfiedEntries(list, ENDED, 50).map((e) => e.id);
    const r = resolveNpcInteraction(list, {
      npcId, storyFlags: ENDED, bestFloor: 50,
      snapshot: { materials: {}, potions: {}, bestFloor: 50, dexCaught: [], equippedArtifacts: {}, craftedArtifacts: [], partyCount: 0, storageCount: 0 },
      questStatus: { ...DONE_QUESTS }, seenDialogues: seen,
      talkState: CALM, random: () => 0,
    });
    assert.ok(r, `${npcId}: 할 말이 없어 대화가 안 뜬다`);
    assert.ok(r.smallTalkLine, `${npcId}: 잡담이 아니라 ${r.dialogueId ?? "옛 대사"} 가 나왔다`);
    assert.ok(smallTalkCandidates(npcId, "cleared", CALM).includes(r.smallTalkLine));
  }
});

test("안 본 이야기가 남아 있으면 잡담이 그걸 덮지 않는다", () => {
  const r = resolveNpcInteraction(ORION_DIALOGUES, {
    npcId: "orion", storyFlags: ENDED, bestFloor: 50,
    snapshot: { materials: {}, potions: {}, bestFloor: 50, dexCaught: [], equippedArtifacts: {}, craftedArtifacts: [], partyCount: 0, storageCount: 0 },
    questStatus: { ...DONE_QUESTS },
    seenDialogues: satisfiedEntries(ORION_DIALOGUES, ENDED, 50)
      .map((e) => e.id).filter((id) => id !== "orion_cleared"),
    talkState: CALM, random: () => 0,
  });
  assert.ok(r);
  assert.equal(r.dialogueId, "orion_cleared", "이야기가 먼저다");
  assert.equal(r.smallTalkLine, undefined);
});

test("재료가 쌓였다고 보는 기준이 상수 하나다", () => {
  assert.equal(LOADED_MATERIAL_COUNT, 40);
});
