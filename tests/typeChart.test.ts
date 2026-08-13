import { test } from "node:test";
import assert from "node:assert/strict";

import { getTypeMultiplier } from "../src/battle/battleUtils";
import { typeChart, ELEMENT_ORDER } from "../src/battle/typeChart";
import { ALL_MOVES } from "../src/monster/moves";
import type { ElementType } from "../src/shared/game";

/**
 * 상성표에 구멍이 없는가. 지금 값이 아니라 **성질**을 본다 — 어느 속성을 더하든
 * "약점 없는 속성"과 "한 속성만 강한 표"로 돌아가지 않게 못 박는다.
 */

/**
 * 약점이 없는 속성이 하나라도 있으면 그 속성은 방어적으로 무적에 가깝다. 예전 표에서
 * electric·normal·poison 이 그랬고, 시작 몬스터와 40층 보스가 둘 다 electric 이었다.
 */
test("모든 속성에 약점이 최소 하나 있다", () => {
  for (const def of ELEMENT_ORDER) {
    const weak = ELEMENT_ORDER.filter((atk) => getTypeMultiplier(atk, def) >= 2);
    assert.ok(weak.length >= 1, `${def}: 2배로 맞는 속성이 하나도 없다`);
  }
});

/**
 * 한 속성만 강하면 안 된다. "A→B→C→A" 로 도는 고리가 실제로 있는지 확인한다.
 */
test("속성이 물고 물리는 순환이 있다", () => {
  const beats = (a: ElementType, b: ElementType) => getTypeMultiplier(a, b) >= 2;
  const cycle = ELEMENT_ORDER.some((a) =>
    ELEMENT_ORDER.some((b) =>
      ELEMENT_ORDER.some((c) => a !== b && b !== c && c !== a && beats(a, b) && beats(b, c) && beats(c, a))));
  assert.ok(cycle, "3개 이상으로 도는 상성 고리가 없다");
});

/** normal 의 정체성 — 때리는 쪽 상성이 없는 대신 최상급 기술 위력이 제일 높다 */
test("normal 은 상성으로 때리지 않고 위력으로 때린다", () => {
  assert.deepEqual(typeChart.normal, {}, "normal 이 상성으로 때리기 시작했다");

  const topPower = (type: ElementType) =>
    Math.max(...ALL_MOVES.filter((m) => m.type === type).map((m) => m.power));
  for (const type of ELEMENT_ORDER) {
    if (type === "normal") continue;
    assert.ok(topPower("normal") >= topPower(type), `${type} 의 최상급 위력이 normal 을 넘었다`);
  }
});
