import test from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../src/shared/playerStore.ts";
import { ORION_DIALOGUES, BAROS_DIALOGUES, satisfiedEntries } from "../src/camp/campDialogues.ts";
import type { PersistedStoryFlag } from "../src/shared/storyFlags.ts";

/**
 * 본 대사 기록(seenDialogues)이 옛 세이브에 채워지는지 본다.
 *
 * 검사 대상이 migrate 가 아니라 normalizeState 인 것은 의도다. **서버 세이브에는 버전이
 * 없어서 migrate 를 아예 타지 않는다**(useSaveSync 가 normalizeState 만 거친다).
 * 두 경로가 다 지나는 곳이 여기라, 여기가 맞으면 둘 다 맞다.
 */

const flags = (over: Partial<Record<PersistedStoryFlag, boolean>>): Record<PersistedStoryFlag, boolean> => ({
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false, ...over,
});

const ENDED = flags({
  met_orion: true, met_baros: true, first_capture: true,
  quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
});

/** 옛 세이브 한 벌. seenDialogues 가 없는 것이 핵심이다 */
const oldSave = (storyFlags: Record<PersistedStoryFlag, boolean>, bestFloor: number) => ({
  party: [{ id: "flameling", level: 10, uid: "t0" }],
  storage: [], dexSeen: [], dexCaught: [],
  materials: {}, potions: {}, bestFloor,
  storyFlags, questStatus: {},
  craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
  imprint: {},
});

test("기록이 없는 엔딩 세이브 — 사람마다 마지막 하나만 미열람으로 남는다", () => {
  const s = normalizeState(oldSave(ENDED, 50));
  const seen = new Set(s.seenDialogues);

  for (const list of [ORION_DIALOGUES, BAROS_DIALOGUES]) {
    const reachable = satisfiedEntries(list, ENDED, 50);
    const unseen = reachable.filter((e) => !seen.has(e.id));
    assert.equal(unseen.length, 1, "미열람이 하나여야 한다");
    assert.equal(unseen[0].id, reachable[reachable.length - 1].id, "남는 건 마지막 대사다");
  }
});

test("엔딩 세이브에서 남는 마지막 대사는 엔딩 후 대사다", () => {
  const s = normalizeState(oldSave(ENDED, 50));
  const seen = new Set(s.seenDialogues);
  assert.ok(!seen.has("orion_cleared"), "오리온 엔딩 대사는 아직 안 본 것으로 남아야 한다");
  assert.ok(!seen.has("baros_cleared"), "바로스 엔딩 대사도 마찬가지");
  assert.ok(seen.has("orion_intro"), "첫 만남은 이미 본 것으로 찍혀야 한다");
  assert.ok(seen.has("baros_intro"), "바로스 첫 대면도 마찬가지");
});

test("두 번 통과시켜도 결과가 같다 — 저장할 때마다 도는 경로다", () => {
  const once  = normalizeState(oldSave(ENDED, 50));
  const twice = normalizeState(once);
  assert.deepEqual(twice.seenDialogues, once.seenDialogues);
});

test("빈 배열은 손대지 않는다 — 새로 시작한 사람이다", () => {
  const fresh = { ...oldSave(flags({}), 0), seenDialogues: [] };
  const s = normalizeState(fresh);
  assert.deepEqual(s.seenDialogues, [], "새 게임에 지난 대사를 채워 넣으면 첫 대화가 사라진다");
});

test("빈 배열이 저장을 반복해도 안 채워진다", () => {
  let s = normalizeState({ ...oldSave(ENDED, 50), seenDialogues: [] });
  for (let i = 0; i < 3; i++) s = normalizeState(s);
  assert.deepEqual(s.seenDialogues, []);
});

test("중간 진행 세이브 — 그 시점까지만 찍힌다", () => {
  const mid = flags({ met_orion: true, met_baros: true, first_capture: true, quest_baros_done: true });
  const s = normalizeState(oldSave(mid, 20));
  const seen = new Set(s.seenDialogues);

  assert.ok(seen.has("orion_after_baros"), "지나온 대사");
  assert.ok(!seen.has("orion_floor_40"), "40층은 아직 조건도 안 된다");
  assert.ok(!seen.has("orion_cleared"), "엔딩 대사가 찍히면 안 된다");

  // 조건을 만족하지 않는 대사는 애초에 후보가 아니므로 기록에도 없다
  for (const id of s.seenDialogues) {
    const all = [...ORION_DIALOGUES, ...BAROS_DIALOGUES];
    const entry = all.find((e) => e.id === id);
    assert.ok(entry, `모르는 이름표가 들어 있다: ${id}`);
  }
});

test("손상된 기록은 버리고 다시 채우지 않는다", () => {
  const broken = { ...oldSave(ENDED, 50), seenDialogues: ["orion_intro", 42, null, "baros_intro"] };
  const s = normalizeState(broken);
  assert.deepEqual(s.seenDialogues, ["orion_intro", "baros_intro"], "문자열만 남는다");
});

test("기록이 배열이 아니면 옛 세이브로 보고 채운다", () => {
  const s = normalizeState({ ...oldSave(ENDED, 50), seenDialogues: "망가짐" });
  assert.ok(s.seenDialogues.length > 0);
});

test("대사 이름표가 겹치지 않는다 — 겹치면 한쪽이 영영 안 나온다", () => {
  const ids = [...ORION_DIALOGUES, ...BAROS_DIALOGUES].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "이름표가 중복됐다");
  for (const id of ids) assert.ok(id.length > 0, "빈 이름표가 있다");
});
