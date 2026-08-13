import { test } from "node:test";
import assert from "node:assert/strict";

import { tickSpeedGauge, turnsToExtraAction, SPEED_GAUGE_WEIGHT } from "../src/battle/battleUtils";

/** 속도 차이가 실제로 무언가를 하는가 */

test("속도 차이가 클수록 추가 행동이 자주 온다", () => {
  // 필요한 값은 (느린 쪽 속도 × SPEED_GAUGE_WEIGHT). 상대(속도 60)보다 30 빠르면
  // 180/30 = 여섯 턴에 한 번, 6 빠르면 서른 턴에 한 번이라 사실상 선공권만 남는다
  assert.equal(turnsToExtraAction(0, 90, 60), 6);
  assert.equal(turnsToExtraAction(0, 66, 60), 30);
  assert.ok(turnsToExtraAction(0, 90, 60)! < turnsToExtraAction(0, 66, 60)!);
  // 느리거나 같으면 영영 오지 않는다
  assert.equal(turnsToExtraAction(0, 60, 60), null);
  assert.equal(turnsToExtraAction(0, 40, 60), null);
});

test("추가 행동은 한 턴에 한 번까지다", () => {
  // 6배 빠른 상대라도 한 턴에 두 번만 움직인다
  let charge = 0;
  for (let i = 0; i < 5; i++) {
    const r = tickSpeedGauge(charge, 80, 12);
    assert.equal(r.extra, true);
    charge = r.gauge.charge;
    assert.ok(charge <= 12 * SPEED_GAUGE_WEIGHT, "게이지가 무한히 쌓인다");
  }
});

test("느린 쪽은 게이지가 차지 않는다", () => {
  const r = tickSpeedGauge(0, 20, 50);
  assert.equal(r.extra, false);
  assert.equal(r.gauge.charge, 0);
});
