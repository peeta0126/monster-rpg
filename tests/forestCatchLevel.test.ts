import test from "node:test";
import assert from "node:assert/strict";
import { FOREST_AREAS } from "../src/camp/forest/areas.ts";
import { canCatchIn, encounterLevelRange, partyCapLevel } from "../src/camp/forest/catchLevel.ts";
import { rollNestChoices } from "../src/camp/forest/nest.ts";
import { rollFork, rollStep, hasCatch } from "../src/camp/forest/steps.ts";
import { makeRng, startRun } from "../src/camp/forest/runStore.ts";
import type { OwnedMonster } from "../src/shared/playerStore.ts";

const shallow = FOREST_AREAS[0];   // 레벨 1–8
const deep    = FOREST_AREAS[1];   // 레벨 8–18

const owned = (level: number): OwnedMonster =>
  ({ uid: `u${level}`, id: "flameling", level } as OwnedMonster);

test("천장은 파티 최고 레벨이다 — 보관함은 안 본다", () => {
  assert.equal(partyCapLevel([]), 0);
  assert.equal(partyCapLevel([owned(3), owned(11), owned(7)]), 11);
});

test("천장이 구역 최저에 못 미치면 그 구역에는 아무것도 안 나온다", () => {
  assert.equal(encounterLevelRange(shallow, 0), null);
  assert.equal(canCatchIn(shallow, 0), false);
  assert.equal(canCatchIn(deep, 7), false);
  assert.deepEqual(encounterLevelRange(deep, 8), [8, 8]);
});

test("천장이 구역 상한보다 낮으면 그 아래로 잘린다", () => {
  assert.deepEqual(encounterLevelRange(shallow, 3), [1, 3]);
  assert.deepEqual(encounterLevelRange(shallow, 99), [1, 8]);
});

test("둥지 후보는 천장을 넘지 않는다", () => {
  for (let seed = 0; seed < 120; seed++) {
    const { rng } = makeRng(seed);
    for (const m of rollNestChoices(shallow, 3, [], rng, 4)) {
      assert.ok(m.level <= 4, `${m.id} Lv.${m.level}`);
      assert.ok(m.level >= shallow.levelRange[0]);
    }
  }
});

test("잡을 게 없으면 둥지 후보가 비어 있다", () => {
  const { rng } = makeRng(1);
  assert.deepEqual(rollNestChoices(shallow, 3, [], rng, 0), []);
});

test("잡을 게 없으면 포획 사건 자체가 뽑히지 않는다", () => {
  for (let seed = 0; seed < 300; seed++) {
    const { rng } = makeRng(seed);
    const kind = rollStep(60, 20, rng, false);
    assert.ok(!hasCatch(kind), `seed ${seed}: ${kind}`);
    const [a, b] = rollFork(90, 30, makeRng(seed).rng, false);
    assert.ok(!hasCatch(a) && !hasCatch(b), `seed ${seed}: ${a}/${b}`);
  }
});

test("런은 들어설 때의 천장을 들고 다닌다", () => {
  const run = startRun("shallow", 0, { capLevel: 6, canCatch: true }, 4242);
  assert.equal(run.capLevel, 6);
});
