import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALERT_BANDS, ALERT_MAX, NODE_ALERT, DEFEAT_ALERT,
  alertBand, clampAlert, isForcedRetreat, applyMaterialMultiplier, catchRateWithAlert,
  appliesAlertOnArrival,
} from "../src/camp/forest/alert.ts";
import { NODE_META, isDangerousNode, type ForestNodeType } from "../src/camp/forest/nodes.ts";

/**
 * 소란도는 숲이 이월하는 유일한 자원이다. 여기서 지키는 건 숫자 자체가 아니라
 * **다이얼로서 성립하는가**다 — 구간이 빈틈없이 이어지는지, 올릴수록 수확이 늘고
 * 위험해지는지, 그리고 낮게 두는 쪽에 고유한 이득(정찰)이 남아 있는지.
 * 마지막 것이 무너지면 "항상 최대"가 정답이 되어 선택이 사라진다.
 */

test("구간이 0 부터 빈틈없이 이어진다", () => {
  assert.equal(ALERT_BANDS[0].min, 0, "첫 구간은 0 에서 시작해야 한다");
  for (let i = 1; i < ALERT_BANDS.length; i++) {
    assert.ok(
      ALERT_BANDS[i].min > ALERT_BANDS[i - 1].min,
      `${ALERT_BANDS[i].id}: 구간 하한이 앞 구간보다 낮거나 같다`,
    );
  }
  // 0~99 어디를 찍어도 구간이 나온다
  for (let v = 0; v < ALERT_MAX; v++) assert.ok(alertBand(v), `${v} 에 해당하는 구간이 없다`);
});

test("올릴수록 수확이 늘고 위험해진다 — 단조성", () => {
  for (let i = 1; i < ALERT_BANDS.length; i++) {
    const prev = ALERT_BANDS[i - 1];
    const cur = ALERT_BANDS[i];
    assert.ok(cur.materialMul >= prev.materialMul, `${cur.id}: 재료 배수가 앞 구간보다 낮다`);
    assert.ok(cur.rareBonus >= prev.rareBonus, `${cur.id}: 희귀 가산이 앞 구간보다 낮다`);
    assert.ok(cur.catchPenalty >= prev.catchPenalty, `${cur.id}: 포획 페널티가 앞 구간보다 낮다`);
  }
  assert.ok(
    ALERT_BANDS[ALERT_BANDS.length - 1].materialMul > ALERT_BANDS[0].materialMul,
    "최상위 구간이 기본 구간보다 수확이 많지 않으면 올릴 이유가 없다",
  );
});

test("낮은 소란에는 고유한 이득이 남아 있다 — 정찰이 안전장치다", () => {
  // 이게 없으면 "항상 최대"가 언제나 정답이 되어 다이얼이 장식이 된다
  const scouts = ALERT_BANDS.map((b) => b.scout);
  assert.equal(scouts[0], "detail", "가장 낮은 구간이 가장 많이 보여 줘야 한다");
  assert.equal(scouts[scouts.length - 1], "none", "가장 높은 구간은 아무것도 안 보여야 한다");

  const rank = { detail: 3, type: 2, danger: 1, none: 0 } as const;
  for (let i = 1; i < scouts.length; i++) {
    assert.ok(
      rank[scouts[i]] < rank[scouts[i - 1]],
      `${ALERT_BANDS[i].id}: 소란이 올랐는데 정찰이 나빠지지 않았다`,
    );
  }
});

test("clamp 는 0~100 을 벗어나지 않는다", () => {
  assert.equal(clampAlert(-40), 0);
  assert.equal(clampAlert(0), 0);
  assert.equal(clampAlert(140), ALERT_MAX);
  assert.equal(clampAlert(37.6), 38, "소수점이 남으면 게이지와 저장값이 어긋난다");
  assert.equal(isForcedRetreat(99), false);
  assert.equal(isForcedRetreat(ALERT_MAX), true);
});

test("노드 표와 소란 표의 종류가 정확히 일치한다", () => {
  const metaKeys = Object.keys(NODE_META).sort();
  const alertKeys = Object.keys(NODE_ALERT).sort();
  assert.deepEqual(alertKeys, metaKeys, "노드를 추가하고 소란값을 안 정하면 undefined 가 더해진다");
});

test("은신처만 소란을 되산다", () => {
  const negative = (Object.keys(NODE_ALERT) as ForestNodeType[]).filter((t) => NODE_ALERT[t] < 0);
  assert.deepEqual(negative, ["rest"], "소란을 낮추는 노드는 은신처 하나뿐이어야 한다");

  // 은신처가 한 노드의 평균 상승분보다 적게 돌려주면 다이얼을 되돌릴 방법이 없다
  const gains = (Object.keys(NODE_ALERT) as ForestNodeType[])
    .map((t) => NODE_ALERT[t]).filter((v) => v > 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  assert.ok(-NODE_ALERT.rest >= avgGain, "은신처가 평균 상승분도 못 되돌린다");
});

test("위험 표시는 소란을 크게 올리는 노드에만 붙는다", () => {
  for (const t of Object.keys(NODE_ALERT) as ForestNodeType[]) {
    if (isDangerousNode(t)) {
      assert.ok(NODE_ALERT[t] >= 25, `${t}: 위험하다면서 소란은 조금만 올린다`);
    }
  }
});

test("재료 배수는 1개짜리를 삼키지 않는다", () => {
  // 반올림 때문에 배수를 올렸는데 개수가 그대로거나 줄면 플레이어는 배신당한다
  for (const band of ALERT_BANDS) {
    const v = band.min;
    assert.ok(applyMaterialMultiplier(1, v) >= 1, `${band.id}: 1개가 0개가 됐다`);
    assert.ok(
      applyMaterialMultiplier(4, v) >= 4,
      `${band.id}: 배수 ${band.materialMul} 인데 4개가 4개 미만이 됐다`,
    );
  }
  assert.ok(
    applyMaterialMultiplier(4, 80) > applyMaterialMultiplier(4, 0),
    "소란 80 이 소란 0 보다 많이 줘야 한다",
  );
});

test("포획 페널티는 시도를 무의미하게 만들지 않는다", () => {
  const worst = catchRateWithAlert(0.18, 99);
  assert.ok(worst > 0, "확률이 0 이면 시도 자체가 가짜 선택이 된다");
  assert.ok(worst < 0.18, "가장 시끄러울 때가 조용할 때보다 잘 잡히면 안 된다");
  assert.equal(catchRateWithAlert(0.72, 0), 0.72, "조용할 때는 기본 확률 그대로여야 한다");
});

test("주인만 소란이 판정 전에 붙는다", () => {
  const arrival = (Object.keys(NODE_ALERT) as ForestNodeType[]).filter(appliesAlertOnArrival);
  assert.deepEqual(arrival, ["boss"], "도착 시점에 소란이 붙는 노드는 주인 하나뿐이어야 한다");

  // 주인은 마지막 노드라 판정 후에 붙이면 그 뒤에 걸릴 데가 없다 — 죽은 값이 된다.
  // 앞으로 당겨야 자기 포획 확률에 스스로 걸린다.
  const base = 0.72;
  const atBoss = catchRateWithAlert(base, 60 + NODE_ALERT.boss);
  const without = catchRateWithAlert(base, 60);
  assert.ok(atBoss < without, "주인을 깨운 대가가 주인 포획 확률에 걸리지 않는다");
});

test("패배 대가가 노드 하나보다 무겁다", () => {
  // 지고도 최고 소란 노드보다 싸면 일부러 지는 게 이득이 된다
  const maxNode = Math.max(...Object.values(NODE_ALERT));
  assert.ok(DEFEAT_ALERT >= maxNode, "패배가 가장 비싼 노드보다 싸다");
});
