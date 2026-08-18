import test from "node:test";
import assert from "node:assert/strict";
import {
  ORION_DIALOGUES, BAROS_DIALOGUES, resolveNpcInteraction, satisfiedEntries,
} from "../src/camp/campDialogues.ts";
import type { PersistedStoryFlag } from "../src/shared/playerStore.ts";

const flags = (over: Partial<Record<PersistedStoryFlag, boolean>>): Record<PersistedStoryFlag, boolean> => ({
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false, ...over,
});

/** 퀘스트 분기를 타지 않도록 완료 상태로 채워둔다 */
const doneQuests = { baros_first_hunt: "completed", orion_mothers_medicine: "completed" } as const;

/** 그 상태에서 조건을 만족하는 대사를 전부 읽은 사람 */
const allSeen = (
  list: typeof ORION_DIALOGUES,
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
  except: string[] = [],
) => satisfiedEntries(list, storyFlags, bestFloor)
  .map((e) => e.id)
  .filter((id) => !except.includes(id));

const talk = (
  list: typeof ORION_DIALOGUES,
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
  seenDialogues: string[],
) => resolveNpcInteraction(list, {
  npcId: list === ORION_DIALOGUES ? "orion" : "baros",
  storyFlags, bestFloor, materials: {}, questStatus: { ...doneQuests }, seenDialogues,
  talkState: { hurt: false, noPotion: false, loaded: false },
});

test("엔딩 전에는 클리어 대사가 안 나온다", () => {
  const f = flags({ met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true });
  // 50층까지 올랐지만 아직 엔딩 화면은 안 본 사람. 남은 이야기를 다 읽어도 클리어 대사는 없다
  let seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const r = talk(ORION_DIALOGUES, f, 50, seen);
    assert.ok(r);
    assert.ok(!r.lines.some((l) => l.includes("마당까지")), "아직 엔딩 전");
    if (!r.dialogueId) break;
    seen = [...seen, r.dialogueId];
  }
});

test("엔딩 후에는 두 NPC 모두 대사가 바뀐다", () => {
  const f = flags({
    met_orion: true, met_baros: true, first_capture: true,
    quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
  });
  // 클리어 대사만 안 읽은 상태 — 옛 세이브 마이그레이션이 만들어 내는 바로 그 상태다
  const orion = talk(ORION_DIALOGUES, f, 50, allSeen(ORION_DIALOGUES, f, 50, ["orion_cleared"]));
  const baros = talk(BAROS_DIALOGUES, f, 50, allSeen(BAROS_DIALOGUES, f, 50, ["baros_cleared"]));

  assert.ok(orion!.lines.some((l) => l.includes("마당까지")), "오리온 엔딩 후 대사");
  assert.ok(baros!.lines.some((l) => l.includes("문은 계속 열어둔다")), "바로스 엔딩 후 대사");
  assert.equal(orion!.dialogueId, "orion_cleared");
  assert.equal(baros!.dialogueId, "baros_cleared");
});

test("클리어 대사가 각 NPC 목록의 마지막이다 (마이그레이션이 이 순서를 믿는다)", () => {
  for (const list of [ORION_DIALOGUES, BAROS_DIALOGUES]) {
    assert.equal(list[list.length - 1].requires, "tower_cleared");
  }
});
