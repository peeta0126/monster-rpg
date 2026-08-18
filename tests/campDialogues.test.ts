import test from "node:test";
import assert from "node:assert/strict";
import {
  ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction,
} from "../src/camp/campDialogues.ts";
import type { PersistedStoryFlag } from "../src/shared/playerStore.ts";

const NO_FLAGS = {
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false,
} as Record<PersistedStoryFlag, boolean>;

const flags = (on: Partial<Record<PersistedStoryFlag, boolean>>) => ({ ...NO_FLAGS, ...on });

/** 퀘스트가 안 끝나 있으면 퀘스트 대사가 이야기 대사를 가린다 — 그건 여기서 볼 게 아니다 */
const QUEST_DONE = { baros_first_hunt: "completed" } as const;

/** 말을 건다. 기본은 "아무것도 안 본" 상태 */
const talk = (
  list: typeof ORION_DIALOGUES,
  on: Partial<Record<PersistedStoryFlag, boolean>>,
  opts: {
    bestFloor?: number;
    materials?: Record<string, number>;
    questStatus?: Record<string, "not_accepted" | "in_progress" | "completed">;
    seen?: string[];
  } = {},
) => resolveNpcInteraction(list, {
  storyFlags: flags(on),
  bestFloor: opts.bestFloor ?? 0,
  materials: opts.materials ?? {},
  questStatus: opts.questStatus ?? {},
  seenDialogues: opts.seen ?? [],
});

test("이장의 첫 대화가 첫 몬스터를 준다", () => {
  const r = talk(ORION_DIALOGUES, {});
  assert.ok(r, "첫 대화가 나와야 한다");
  assert.equal(r.grantsMonsterId, "flameling");
  assert.equal(r.setsFlag, "met_orion");
  assert.equal(r.dialogueId, "orion_intro", "읽었다고 기록할 이름표가 붙어야 한다");
  assert.ok(r.lines.some((l) => l.includes("플레미")), "이름을 말해야 받은 줄 안다");
});

test("이미 읽은 첫 대화는 다시 나오지 않는다 — 몬스터를 두 번 주지 않는다", () => {
  const r = talk(ORION_DIALOGUES, { met_orion: true, met_baros: true }, { seen: ["orion_intro"] });
  assert.ok(r);
  assert.equal(r.grantsMonsterId, undefined);
  assert.equal(r.dialogueId, "orion_after_baros", "다음 이야기로 넘어가야 한다");
});

test("놓친 이야기는 순서대로 하나씩 따라온다", () => {
  const on = { met_orion: true, met_baros: true, first_capture: true };
  // 20층까지 오르는 동안 이장에게 한 번도 안 들렀다면, 밀린 이야기를 앞에서부터 듣는다
  const order: string[] = [];
  const seen = ["orion_intro"];
  for (let i = 0; i < 4; i++) {
    const r = talk(ORION_DIALOGUES, on, { bestFloor: 20, seen });
    assert.ok(r?.dialogueId, "이야기가 남아 있어야 한다");
    order.push(r.dialogueId);
    seen.push(r.dialogueId);
  }
  assert.deepEqual(order, [
    "orion_after_baros", "orion_first_capture", "orion_floor_10", "orion_floor_20",
  ], "예전에는 마지막 하나만 나오고 나머지는 영영 못 봤다");
});

test("바로스는 없는 기능(탑 포획)을 가르치지 않는다", () => {
  const all = BAROS_DIALOGUES.flatMap((e) => e.lines).join(" ");
  assert.ok(!all.includes("포획 버튼"), "삭제된 UI 를 설명하고 있다");
  assert.ok(!all.includes("30% 아래"), "탑 포획 조건이 남아 있다");
  assert.ok(all.includes("탑에서는 못 잡는다"), "어디서 잡는지는 말해야 한다");
});

test("바로스의 첫 대면이 한 번에 쏟아붓지 않는다", () => {
  const first = BAROS_DIALOGUES.find((e) => e.setsFlag === "met_baros");
  assert.ok(first);
  assert.ok(first.lines.length <= 12, `첫 대면이 ${first.lines.length}줄이다 — 나눠야 한다`);
});

test("이장을 만나고 온 사람에게 이장한테 가라고 하지 않는다", () => {
  // "이장 영감한테 먼저 가봐라"는 조건이 always 라 늘 만족한다. 메우는 줄로 표시해 두지
  // 않으면 이야기 순번의 맨 앞에 서서, 이장을 이미 만난 사람에게 그 말이 나간다.
  const r = talk(BAROS_DIALOGUES, { met_orion: true });
  assert.ok(r);
  assert.equal(r.dialogueId, "baros_intro");
  assert.ok(!r.lines.some((l) => l.includes("이장 영감한테 먼저")));
});

test("이장을 만나기 전에는 바로스가 돌려보낸다", () => {
  const r = talk(BAROS_DIALOGUES, {});
  assert.ok(r);
  assert.ok(r.lines.some((l) => l.includes("이장 영감한테 먼저")));
});

test("바로스의 육성 강의는 실제로 잡아 온 뒤에 나온다", () => {
  const base = { met_orion: true, met_baros: true, quest_baros_done: true };
  const seen = ["baros_intro", "baros_quest_first_hunt"];
  const before = talk(BAROS_DIALOGUES, base, { questStatus: { ...QUEST_DONE }, seen });
  const after  = talk(BAROS_DIALOGUES, { ...base, first_capture: true },
    { questStatus: { ...QUEST_DONE }, seen });
  assert.ok(before && after);
  assert.notEqual(before.lines.join(), after.lines.join());
  assert.ok(after.lines.some((l) => l.includes("보관함")), "파티/보관함 이야기가 여기 있어야 한다");
});

test("5층 대사가 장비를 짚는다", () => {
  const r = talk(BAROS_DIALOGUES,
    { met_orion: true, met_baros: true, quest_baros_done: true, first_capture: true },
    {
      bestFloor: 5,
      questStatus: { ...QUEST_DONE },
      seen: ["baros_intro", "baros_quest_first_hunt", "baros_first_capture"],
    });
  assert.ok(r);
  assert.ok(r.lines.some((l) => l.includes("장비")), "난이도가 장비를 요구하는데 아무도 안 짚는다");
});

test("재료를 다 모아 오면 안 본 이야기보다 보상이 먼저다", () => {
  // 손에 든 것을 건네러 온 사람을 돌려세우지 않는다
  const r = talk(BAROS_DIALOGUES,
    { met_orion: true, met_baros: true },
    { materials: { herb: 5 }, questStatus: { baros_first_hunt: "in_progress" }, seen: [] });
  assert.ok(r);
  assert.ok(r.completeQuest, "완료 처리가 실려야 한다");
  assert.equal(r.completeQuest.questId, "baros_first_hunt");
});

test("재료가 모자라면 독촉 대사로 떨어진다 — 이야기를 다 본 뒤에", () => {
  const r = talk(BAROS_DIALOGUES,
    { met_orion: true, met_baros: true },
    {
      materials: { herb: 1 },
      questStatus: { baros_first_hunt: "in_progress" },
      seen: ["baros_intro"],
    });
  assert.ok(r);
  assert.ok(r.lines.some((l) => l.includes("약초 3개")), "독촉 대사가 나와야 한다");
});
