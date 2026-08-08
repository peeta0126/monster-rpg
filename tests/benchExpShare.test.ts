import { test } from "node:test";
import assert from "node:assert/strict";
import { benchExpShare } from "../src/battle/battleUtils";

test("선봉과 같은 레벨이면 절반만 받는다", () => {
  assert.equal(benchExpShare(30, 30), 0.5);
});

test("뒤처진 만큼 비율이 올라간다", () => {
  assert.ok(benchExpShare(25, 30) > benchExpShare(28, 30));
  assert.ok(benchExpShare(20, 30) > benchExpShare(25, 30));
});

test("10레벨 이상 벌어지면 동등하게 받고, 그 위로는 더 오르지 않는다", () => {
  assert.equal(benchExpShare(20, 30), 1);
  assert.equal(benchExpShare(1, 60), 1);
});

// 앞서 있는 몬스터까지 보너스를 받으면 격차가 되레 벌어진다 — 이 보정의 전제가 무너진다
test("선봉보다 앞서 있으면 보너스가 없다", () => {
  assert.equal(benchExpShare(40, 30), 0.5);
  assert.equal(benchExpShare(31, 30), 0.5);
});
