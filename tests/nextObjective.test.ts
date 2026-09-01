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

test("진행 중인 부탁이 '다음 층에 도전' 보다 앞선다", () => {
  // 예전에는 1층 이후로 층 안내만 반복해서, 벽에 부딪힌 사람이 갈 곳을 몰랐다
  const flags = {
    met_orion: true, met_baros: true, first_capture: true,
    quest_baros_done: true, quest_orion_done: true, tower_cleared: false,
  };
  const withQuest = getNextObjective({
    storyFlags: flags, bestFloor: 12, potionCount: 5,
    activeQuest: { text: "맨몸으로는 안 된다 — 아티팩트를 만들어 장착하기", where: "집" },
  });
  assert.equal(withQuest?.where, "집");
  assert.ok(withQuest?.text.includes("아티팩트"));

  const without = getNextObjective({
    storyFlags: flags, bestFloor: 12, potionCount: 5, activeQuest: null,
  });
  assert.equal(without?.text, "무한의 탑 13층에 도전해 보세요");
});

test("엔딩을 봤어도 남은 부탁이 있으면 그걸 가리킨다", () => {
  const flags = {
    met_orion: true, met_baros: true, first_capture: true,
    quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
  };
  assert.equal(getNextObjective({
    storyFlags: flags, bestFloor: 50, potionCount: 5, activeQuest: null,
  }), null);
  assert.ok(getNextObjective({
    storyFlags: flags, bestFloor: 50, potionCount: 5,
    activeQuest: { text: "어머니의 치료약", where: "집" },
  }));
});

test("관문 직전에 회복 물약이 없으면 공방부터 가리킨다", () => {
  const base = {
    storyFlags: all({ met_orion: true, met_baros: true, first_capture: true }),
    potionCount: 12,        // 해독제만 잔뜩 있는 가방
    activeQuest: { text: "부탁 진행중", where: "마을 안쪽" },
  };
  // 다음이 15층(관문)인데 회복이 1개뿐 — 부탁보다 이게 앞선다
  const warn = getNextObjective({ ...base, bestFloor: 14, healPotionCount: 1 });
  assert.match(warn!.text, /15층은 관문입니다/);
  assert.equal(warn!.where, "집");

  // 채워 갔으면 원래 순서대로 부탁이 앞선다
  const ok = getNextObjective({ ...base, bestFloor: 14, healPotionCount: 5 });
  assert.equal(ok!.text, "부탁 진행중");

  // 일반 층 앞에서는 재고를 따지지 않는다. 캠프 회복이 무료라 물약 없이도 오른다
  const plain = getNextObjective({ ...base, bestFloor: 12, healPotionCount: 0 });
  assert.equal(plain!.text, "부탁 진행중");

  // 보스층(n0)도 같은 자리에서 걸리되, 관문이라고 부르지는 않는다
  const boss = getNextObjective({ ...base, bestFloor: 19, healPotionCount: 0 });
  assert.match(boss!.text, /20층에는 보스가 있습니다/);
});
