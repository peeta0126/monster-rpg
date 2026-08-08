import { test } from "node:test";
import assert from "node:assert/strict";
import { getFloorEnemy, getFloorEnemySkill } from "../src/shared/floorTable";
import { tackle, waterGun } from "../src/monster/moves";

/**
 * 예전에 getFloorEnemy 는 `floor <= 9` 로 막혀 있고 getFloorEnemySkill 은 안 막혀 있었다.
 * 그 결과 11~25층은 랜덤 적이 나오는데 스킬 표는 다른 몬스터 걸 뒤졌고, 이름이 겹치는
 * 몸통박치기를 찾아내 적이 최약체 기술만 반복했다. 두 함수가 같은 층 집합을 보는지 지킨다.
 */
const FIXED_FLOORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25];

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

test("26층부터는 고정 구성이 없다", () => {
  const names = new Set(Array.from({ length: 40 }, () => getFloorEnemy(26).name));
  assert.ok(names.size > 1, "26층이 한 종만 뽑는다");
  assert.equal(getFloorEnemySkill(26, 0, getFloorEnemy(26).moves), null);
});

test("보스층은 고정 구성보다 우선한다", () => {
  assert.equal(getFloorEnemy(10).name, "분노한 모시");
  assert.equal(getFloorEnemy(20).name, "격노한 모치");
});
