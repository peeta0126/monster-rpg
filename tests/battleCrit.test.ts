import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BASE_CRIT_RATE, critChanceOf, calculateDamage, createBattleMonster,
  type BattleMonster,
} from "../src/battle/battleUtils";
import type { ElementType, Move } from "../src/shared/game";

/** 치명타는 장비가 있을 때만 뜨는 것이 아니다. 적에게도 붙는다 */

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

test("치명타는 장비가 없어도 뜨고, 장비는 그 위에 얹힌다", () => {
  assert.ok(BASE_CRIT_RATE > 0);
  assert.equal(critChanceOf(), BASE_CRIT_RATE);
  assert.equal(critChanceOf(15), BASE_CRIT_RATE + 15);

  // 적은 치명타 인자를 아예 넘기지 않는다. 그래도 떠야 한다
  const orig = Math.random;
  try {
    Math.random = () => 0;   // 명중·치명타 모두 최소값 → 반드시 치명타
    const r = calculateDamage(mon(), mon({ id: "e" }), move());
    assert.equal(r.isCrit, true, "인자를 안 넘기면 치명타가 영영 안 뜬다");
  } finally {
    Math.random = orig;
  }
});
