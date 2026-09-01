import { test } from "node:test";
import assert from "node:assert/strict";
import { monsters } from "../src/monster/monsters";
import { movesAtLevel } from "../src/monster/growth";
import { getFullLearnset } from "../src/monster/learnset";

/**
 * 잡은 몬스터가 학습표를 건너뛰지 않는지.
 *
 * `monsters.ts` 의 moves 는 그 종을 대표하는 묶음이라 최종기까지 들어 있다. 그걸
 * 잡은 개체에 그대로 얹으면 고대 숲의 Lv18 모왕이 Lv52 기술 천둥강타(95)를 들고 나온다.
 * 키운 개체는 학습표를 따라 올라오므로, 키우는 쪽이 손해가 되는 자리였다.
 */
test("잡은 레벨에 못 배우는 기술은 들고 나오지 않는다", () => {
  for (const m of monsters) {
    const learnset = getFullLearnset(m.id);
    if (learnset.length === 0) continue;   // 학습표가 없는 종은 기본기를 그대로 쓴다
    for (const level of [1, 10, 20, 30]) {
      for (const mv of movesAtLevel(m.id, level, m.moves)) {
        const entry = learnset.find((e) => e.move.name === mv.name);
        assert.ok(entry, `${m.name} Lv${level}: 학습표에 없는 기술 ${mv.name}`);
        assert.ok(
          entry.level <= level,
          `${m.name} Lv${level}: ${mv.name} 은 Lv${entry.level} 기술이다`,
        );
      }
    }
  }
});

test("기술은 최대 넷이고, 레벨이 오르면 줄지 않는다", () => {
  for (const m of monsters) {
    if (getFullLearnset(m.id).length === 0) continue;
    let prev = 0;
    for (const level of [1, 5, 10, 20, 30, 40, 50]) {
      const n = movesAtLevel(m.id, level, m.moves).length;
      assert.ok(n <= 4, `${m.name} Lv${level}: 기술이 ${n}개다`);
      assert.ok(n >= prev, `${m.name}: Lv${level} 에서 기술 수가 줄었다`);
      prev = n;
    }
  }
});
