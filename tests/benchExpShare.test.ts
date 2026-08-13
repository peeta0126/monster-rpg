import { test } from "node:test";
import assert from "node:assert/strict";
import { benchExpShare, expLevelGapMultiplier, EXP_GAP_CUTOFF, expToNext } from "../src/battle/battleUtils";

/** 벤치 분배 — 뒤처진 몬스터만 당겨 준다 */

test("선봉과 같은 레벨이면 절반 조금 아래를 받는다", () => {
  assert.equal(benchExpShare(30, 30), 0.45);
});

test("뒤처진 만큼 비율이 올라간다", () => {
  assert.ok(benchExpShare(25, 30) > benchExpShare(28, 30));
  assert.ok(benchExpShare(20, 30) > benchExpShare(25, 30));
});

test("아주 많이 벌어지면 동등까지 받고, 그 위로는 더 오르지 않는다", () => {
  assert.equal(benchExpShare(1, 60), 1);
  assert.ok(benchExpShare(10, 30) <= 1);
});

// 앞서 있는 몬스터까지 보너스를 받으면 격차가 되레 벌어진다 — 이 보정의 전제가 무너진다
test("선봉보다 앞서 있으면 보너스가 없다", () => {
  assert.equal(benchExpShare(40, 30), 0.45);
  assert.equal(benchExpShare(31, 30), 0.45);
});

/**
 * 레벨차 컷오프 — 이 게임에서 레벨을 재화로 되돌리는 장치다.
 * 예전엔 무장비 파티가 낮은 층을 갈아 50층까지 갔다.
 */

test("동급 이하 상대는 경험치를 그대로 준다", () => {
  assert.equal(expLevelGapMultiplier(20, 20), 1);
  assert.equal(expLevelGapMultiplier(30, 20), 1);   // 나보다 센 상대는 만점
});

test("레벨이 벌어질수록 급감하고, 컷오프에서 0 이 된다", () => {
  const seq = [1, 2, 3, 4, 5].map((gap) => expLevelGapMultiplier(20, 20 + gap));
  for (let i = 1; i < seq.length; i++) {
    assert.ok(seq[i] < seq[i - 1], `${i}단계에서 안 줄어든다: ${seq.join(", ")}`);
  }
  assert.equal(expLevelGapMultiplier(20, 20 + EXP_GAP_CUTOFF), 0);
  assert.equal(expLevelGapMultiplier(20, 60), 0);
});

test("컷오프 아래에서는 갈아도 레벨이 안 오른다 — 배수가 0 이므로", () => {
  // Lv45 파티가 35층(적 Lv35)을 도는 상황
  assert.equal(expLevelGapMultiplier(35, 45), 0);
});

/**
 * 요구 경험치는 레벨 하나로 정해진다. 잡은 몬스터가 다른 곡선을 물려받아
 * Lv40 개체가 122,480 을 요구하던 버그를 여기서 못 박는다.
 */
test("요구 경험치는 레벨만 보고 정해진다", () => {
  assert.equal(expToNext(1), 100);
  assert.ok(expToNext(40) > expToNext(20));
  // 직접 키운 개체든 잡은 개체든 같은 레벨이면 같은 값이어야 한다
  assert.equal(expToNext(40), expToNext(40));
  // 지수가 완만해야 한다 — Lv40 요구치가 Lv1 의 20배를 넘으면 후반이 멈춘다
  assert.ok(expToNext(40) < expToNext(1) * 20, `Lv40 요구치가 너무 크다: ${expToNext(40)}`);
});
