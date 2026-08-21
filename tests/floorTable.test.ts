import { test } from "node:test";
import assert from "node:assert/strict";
import { getFloorEnemy, getFloorEnemySkill } from "../src/shared/floorTable";
import { tackle, waterGun } from "../src/monster/moves";
import { scaleToLevel } from "../src/shared/floorTable";
import { monsters } from "../src/monster/monsters";
import { isAnomalyMove } from "../src/monster/learnset";

/**
 * 예전에 getFloorEnemy 는 `floor <= 9` 로 막혀 있고 getFloorEnemySkill 은 안 막혀 있었다.
 * 그 결과 11~25층은 랜덤 적이 나오는데 스킬 표는 다른 몬스터 걸 뒤졌고, 이름이 겹치는
 * 몸통박치기를 찾아내 적이 최약체 기술만 반복했다. 두 함수가 같은 층 집합을 보는지 지킨다.
 */
/** 고정 구성이 있어야 하는 층 = n0층 보스와 50층을 뺀 1~49 전부 */
const FIXED_FLOORS = Array.from({ length: 49 }, (_, i) => i + 1).filter((f) => f % 10 !== 0);

test("고정 구성 층은 매번 같은 적이 나온다", () => {
  for (const f of FIXED_FLOORS) {
    const names = new Set(Array.from({ length: 30 }, () => getFloorEnemy(f).name));
    assert.equal(names.size, 1, `${f}층이 ${names.size}종을 뽑는다: ${[...names].join(", ")}`);
  }
});

test("고정 구성 층은 지정된 스킬 순서를 그대로 쓴다", () => {
  for (const f of FIXED_FLOORS) {
    const e = getFloorEnemy(f);
    for (let t = 0; t < 8; t++) {
      const mv = getFloorEnemySkill(f, t, e.moves);
      assert.ok(mv, `${f}층 ${t}턴에 지정 기술이 없다`);
      assert.ok(e.moves.some((m) => m.id === mv.id), `${f}층 ${t}턴: 적이 못 쓰는 기술`);
    }
  }
});

test("적 구성이 표와 안 맞으면 표를 따르지 않는다 (AI 에 맡긴다)", () => {
  // 19층 표는 전격탄·전기불꽃을 요구한다. 일부만 겹치는 적에게 표를 씌우면
  // 겹치는 몸통박치기만 반복하게 되므로 아예 null 이어야 한다.
  assert.equal(getFloorEnemySkill(19, 0, [tackle, waterGun]), null);
});

test("26~49층도 고정 구성을 갖는다", () => {
  // 예전엔 이 구간이 티어 풀 랜덤이라 45층 관문이 「관문의 플레미」가 될 수도 있었다.
  for (let f = 26; f <= 49; f++) {
    if (f % 10 === 0) continue;
    const names = new Set(Array.from({ length: 40 }, () => getFloorEnemy(f).name));
    assert.equal(names.size, 1, `${f}층이 ${names.size}종을 뽑는다: ${[...names].join(", ")}`);
  }
});

test("26층부터는 구간 배수가 붙는다 — 고정 구성 갈래에서도", () => {
  // buildFloorEnemy 는 고정 구성이 있으면 거기서 바로 반환한다. 구간 배수를 랜덤
  // 갈래에만 두면 26~49층이 소리 없이 15~40% 약해진다. 아무도 에러를 안 본다.
  for (const [floor, mult] of [[29, 1.15], [39, 1.28], [49, 1.40]] as const) {
    const e = getFloorEnemy(floor);
    const base = monsters.find((m) => m.id === e.id)!;
    const bare = scaleToLevel(base, floor);
    assert.equal(e.maxHp, Math.floor(bare.maxHp * mult), `${floor}층 HP 에 구간 배수가 안 붙었다`);
  }
});

test("일반 층 적은 자기 학습표 밖 기술을 들지 않는다", () => {
  // 학습표 밖 기술은 "…이 몬스터가 쓸 수 있는 기술이 아니다" 연출을 켠다. 그건
  // n0층 보스가 탑의 비밀을 흘리는 장치라, 평범한 층에서 새면 장치가 닳는다.
  for (const f of FIXED_FLOORS) {
    const e = getFloorEnemy(f);
    for (const mv of e.moves) {
      assert.ok(!isAnomalyMove(e.id, mv.id), `${f}층 ${e.name} 이 못 배우는 ${mv.name} 을 든다`);
    }
  }
});

test("보스층은 고정 구성보다 우선한다", () => {
  assert.equal(getFloorEnemy(10).name, "분노한 모시");
  assert.equal(getFloorEnemy(20).name, "격노한 모치");
});
