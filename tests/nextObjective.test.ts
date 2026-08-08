import test from "node:test";
import assert from "node:assert/strict";
import { getNextObjective } from "../src/shared/nextObjective.ts";
import type { PersistedStoryFlag } from "../src/shared/playerStore.ts";

const NONE: Record<PersistedStoryFlag, boolean> = {
  met_orion: false, met_baros: false, first_capture: false,
  quest_baros_done: false, quest_orion_done: false, tower_cleared: false,
};
const all = (over: Partial<Record<PersistedStoryFlag, boolean>>) => ({ ...NONE, ...over });

test("첫 목표는 오리온", () => {
  const o = getNextObjective({ storyFlags: NONE, bestFloor: 0, potionCount: 0 });
  assert.match(o!.text, /오리온/);
});

test("진행에 따라 목표가 순서대로 넘어간다", () => {
  const steps: [Parameters<typeof getNextObjective>[0], RegExp][] = [
    [{ storyFlags: all({ met_orion: true }), bestFloor: 0, potionCount: 0 }, /바로스/],
    [{ storyFlags: all({ met_orion: true, met_baros: true }), bestFloor: 0, potionCount: 0 }, /포획/],
    [{ storyFlags: all({ met_orion: true, met_baros: true, first_capture: true }), bestFloor: 0, potionCount: 0 }, /1층/],
    [{ storyFlags: all({ met_orion: true, met_baros: true, first_capture: true }), bestFloor: 3, potionCount: 0 }, /공방/],
    [{ storyFlags: all({ met_orion: true, met_baros: true, first_capture: true }), bestFloor: 3, potionCount: 2 }, /4층/],
  ];
  for (const [input, expected] of steps) {
    assert.match(getNextObjective(input)!.text, expected);
  }
});

test("엔딩까지 봤으면 목표가 없다", () => {
  const done = all({
    met_orion: true, met_baros: true, first_capture: true, tower_cleared: true,
  });
  assert.equal(getNextObjective({ storyFlags: done, bestFloor: 50, potionCount: 5 }), null);
});
