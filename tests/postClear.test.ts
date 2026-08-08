import test from "node:test";
import assert from "node:assert/strict";
import { ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction } from "../src/camp/campDialogues.ts";
import type { PersistedStoryFlag } from "../src/shared/playerStore.ts";

const flags = (over: Partial<Record<PersistedStoryFlag, boolean>>): Record<PersistedStoryFlag, boolean> => ({
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false, ...over,
});

/** 퀘스트 분기를 타지 않도록 완료 상태로 채워둔다 */
const doneQuests = { baros_first_hunt: "completed", orion_mothers_medicine: "completed" } as const;

test("엔딩 전에는 클리어 대사가 안 나온다", () => {
  const r = resolveNpcInteraction(
    ORION_DIALOGUES,
    flags({ met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true }),
    50, {}, { ...doneQuests },
  );
  assert.ok(r);
  assert.ok(!r!.lines.some((l) => l.includes("마당까지")), "아직 엔딩 전");
});

test("엔딩 후에는 두 NPC 모두 대사가 바뀐다", () => {
  const f = flags({
    met_orion: true, met_baros: true, first_capture: true,
    quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
  });
  const orion = resolveNpcInteraction(ORION_DIALOGUES, f, 50, {}, { ...doneQuests });
  const baros = resolveNpcInteraction(BAROS_DIALOGUES, f, 50, {}, { ...doneQuests });

  assert.ok(orion!.lines.some((l) => l.includes("마당까지")), "오리온 엔딩 후 대사");
  assert.ok(baros!.lines.some((l) => l.includes("문은 계속 열어둔다")), "바로스 엔딩 후 대사");
});

test("클리어 대사가 각 NPC 목록의 마지막이다 (선택 로직이 마지막 항목을 고른다)", () => {
  for (const list of [ORION_DIALOGUES, BAROS_DIALOGUES]) {
    assert.equal(list[list.length - 1].requires, "tower_cleared");
  }
});
