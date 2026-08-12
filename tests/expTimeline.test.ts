import { test } from "node:test";
import assert from "node:assert/strict";

import { buildExpTimeline } from "../src/battle/expTimeline";
import { createBattleMonster, gainExp, type BattleMonster } from "../src/battle/battleUtils";

const mon = (over: Partial<BattleMonster> = {}): BattleMonster => ({
  ...createBattleMonster({
    id: "m", name: "시험체", type: "fire", maxHp: 200, attack: 60, defense: 40, speed: 30,
    moves: [], level: 5, exp: 0, expToNextLevel: 100, rewardExp: 10,
  }),
  ...over,
});

/**
 * 연출이 전투와 다른 계산을 하고 있지 않은지 본다. 바가 차오르는 모습은 눈으로 볼 수 있어도
 * "그 바가 실제 경험치와 같은가"는 눈으로 못 본다.
 */

test("잘라 넣은 결과가 한 번에 넣은 결과와 같다", () => {
  for (const gained of [1, 40, 100, 260, 999]) {
    const m = mon({ exp: 30 });
    const { final } = buildExpTimeline(m, gained);
    assert.deepEqual(final, gainExp(m, gained).updatedMonster, `${gained} 경험치에서 어긋난다`);
  }
});

test("레벨이 안 오르면 구간 하나로 끝난다", () => {
  const { segments } = buildExpTimeline(mon({ exp: 10 }), 20);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].levelUp, null);
  assert.equal(segments[0].from, 0.1);
  assert.equal(segments[0].to, 0.3);
});

test("레벨업 구간은 바를 끝까지 채우고 멈춘다", () => {
  const m = mon({ exp: 90 });
  const { segments } = buildExpTimeline(m, 30);

  assert.equal(segments[0].to, 1, "레벨이 오르는 구간은 가득 차야 한다");
  assert.equal(segments[0].levelUp?.level, m.level + 1);
  // 남은 20 은 다음 레벨의 바에서 이어진다
  assert.equal(segments[1].from, 0);
  assert.equal(segments[1].levelUp, null);
});

// 레벨당 증가분은 gainExp 가 정한다. 여기 숫자를 박으면 밸런스를 고친 날 연출만 옛말을 한다
test("보여주는 스탯 증가가 실제 증가와 같다", () => {
  const m = mon({ exp: 99 });
  const { segments } = buildExpTimeline(m, 1);
  const after = gainExp(m, 1).updatedMonster;

  assert.deepEqual(segments[0].levelUp?.gains, {
    maxHp:   after.maxHp   - m.maxHp,
    attack:  after.attack  - m.attack,
    defense: after.defense - m.defense,
    speed:   after.speed   - m.speed,
  });
});

test("한 번에 여러 레벨이 올라도 레벨마다 멈춘다", () => {
  const { segments, final } = buildExpTimeline(mon(), 400);
  const levelUps = segments.filter((s) => s.levelUp !== null);

  assert.ok(levelUps.length >= 3, `레벨업이 ${levelUps.length}번뿐이다`);
  assert.equal(final.level, mon().level + levelUps.length);
  // 레벨 번호가 하나씩 올라간다
  levelUps.forEach((s, i) => assert.equal(s.levelUp?.level, mon().level + i + 1));
});

test("경험치 0 이면 연출할 게 없다", () => {
  assert.equal(buildExpTimeline(mon(), 0).segments.length, 0);
});
