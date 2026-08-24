import { test } from "node:test";
import assert from "node:assert/strict";

import { getAIAction, aiFocus, createBattleMonster, type BattleMonster } from "../src/battle/battleUtils";
import type { ElementType, Move } from "../src/shared/game";

/** 적이 무엇을 내는가. 읽힐 정도로 띄어나면 그것도 고장이다 */

const mon = (over: Partial<BattleMonster> = {}): BattleMonster => ({
  ...createBattleMonster({
    id: "m", name: "시험체", type: "fire" as ElementType | null,
    maxHp: 200, attack: 60, defense: 40, speed: 30,
    moves: [], level: 10, exp: 0, expToNextLevel: 100, rewardExp: 10,
  }),
  ...over,
});

const move = (over: Partial<Move> = {}): Move => ({
  id: "mv", name: "시험", type: "normal", power: 50, accuracy: 100,
  category: "physical", ...over,
});

const weak  = move({ id: "weak",  power: 40, type: "normal" });
const heavy = move({ id: "heavy", power: 90, type: "normal" });
const shaky = move({ id: "shaky", power: 95, type: "normal", accuracy: 20 });
const hex   = move({ id: "hex", power: 0, type: "poison", category: "status",
  statusEffect: "poison", statusChance: 100 });

/**
 * 늘 최선만 고르면 읽힌다. 2,000번 중 한 번도 다른 수가 안 나오면 그게 예전 AI 다.
 *
 * 굴림은 씨를 고정한다. AI 가 확률로 고르는 이상 표본이 흔들리는데, 테스트가 가끔
 * 빨개지면 사람은 곧 테스트를 안 믿게 된다.
 */
function sample(enemy: BattleMonster, target: BattleMonster, floor: number): Record<string, number> {
  const counts: Record<string, number> = {};
  const orig = Math.random;
  let seed = 12345;
  Math.random = () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try {
    for (let i = 0; i < 2000; i++) {
      const m = getAIAction(enemy, target, floor);
      counts[m.id] = (counts[m.id] ?? 0) + 1;
    }
  } finally {
    Math.random = orig;
  }
  return counts;
}

test("적은 상성 배율이 같아도 위력이 큰 기술을 더 자주 고른다", () => {
  // 예전엔 배율만 봤다. 상대가 normal 이면 전부 1배라 늘 목록 첫 번째(위력 40)만 나왔다
  const enemy = mon({ moves: [weak, heavy] });
  const counts = sample(enemy, mon({ id: "p", type: "normal" }), 40);
  assert.ok((counts.heavy ?? 0) > (counts.weak ?? 0) * 1.5, `위력을 안 본다: ${JSON.stringify(counts)}`);
  // 그렇다고 늘 최선만 고르지도 않는다. 두 수 다 나와야 읽히지 않는다
  assert.ok((counts.weak ?? 0) > 0, `한 가지 기술만 나온다: ${JSON.stringify(counts)}`);
});

test("적은 명중률을 기대값에 넣는다", () => {
  // 위력 95 · 명중 20 은 기대 19, 위력 40 · 명중 100 은 기대 40. 후자가 낫다
  const enemy = mon({ moves: [shaky, weak] });
  const counts = sample(enemy, mon({ id: "p", type: "normal" }), 20);
  assert.ok((counts.weak ?? 0) > (counts.shaky ?? 0), `명중을 안 본다: ${JSON.stringify(counts)}`);
});

test("이미 상태이상이 걸린 상대에게는 상태기를 쓰지 않는다", () => {
  const enemy = mon({ moves: [hex, weak] });
  const target = mon({ id: "p", type: "normal", status: "burn", statusTurns: 3 });
  const counts = sample(enemy, target, 30);
  assert.equal(counts.hex ?? 0, 0, "이미 걸린 상대에게 상태기를 던진다");
});

test("낮은 층일수록 최선을 덜 고른다", () => {
  const enemy = mon({ moves: [weak, heavy] });
  const low  = sample(enemy, mon({ id: "p", type: "normal" }), 1);
  const high = sample(enemy, mon({ id: "p", type: "normal" }), 50);
  assert.ok((high.heavy ?? 0) > (low.heavy ?? 0), "층이 올라도 적이 더 매서워지지 않는다");
  assert.ok(aiFocus(1) < aiFocus(50) && aiFocus(50) <= 0.9);
});

test("기술이 하나뿐인 적도 고를 수 있다", () => {
  assert.equal(getAIAction(mon({ moves: [weak] }), mon({ id: "p" }), 10).id, "weak");
});
