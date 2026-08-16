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

test("이장의 첫 대화가 첫 몬스터를 준다", () => {
  const r = resolveNpcInteraction(ORION_DIALOGUES, flags({}), 0, {}, {});
  assert.ok(r, "첫 대화가 나와야 한다");
  assert.equal(r.grantsMonsterId, "flameling");
  assert.equal(r.setsFlag, "met_orion");
  assert.ok(r.lines.some((l) => l.includes("플레미")), "이름을 말해야 받은 줄 안다");
});

test("이장을 만난 뒤에는 몬스터를 또 주지 않는다", () => {
  const r = resolveNpcInteraction(ORION_DIALOGUES, flags({ met_orion: true, met_baros: true }), 0, {}, {});
  assert.ok(r);
  assert.equal(r.grantsMonsterId, undefined);
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

test("바로스의 육성 강의는 실제로 잡아 온 뒤에 나온다", () => {
  const before = resolveNpcInteraction(
    BAROS_DIALOGUES, flags({ met_orion: true, met_baros: true, quest_baros_done: true }), 0, {}, QUEST_DONE);
  const after = resolveNpcInteraction(
    BAROS_DIALOGUES,
    flags({ met_orion: true, met_baros: true, quest_baros_done: true, first_capture: true }), 0, {}, QUEST_DONE);
  assert.ok(before && after);
  assert.notEqual(before.lines.join(), after.lines.join());
  assert.ok(after.lines.some((l) => l.includes("보관함")), "파티/보관함 이야기가 여기 있어야 한다");
});

test("5층 대사가 장비를 짚는다", () => {
  const r = resolveNpcInteraction(
    BAROS_DIALOGUES,
    flags({ met_orion: true, met_baros: true, quest_baros_done: true, first_capture: true }), 5, {}, QUEST_DONE);
  assert.ok(r);
  assert.ok(r.lines.some((l) => l.includes("장비")), "난이도가 장비를 요구하는데 아무도 안 짚는다");
});
