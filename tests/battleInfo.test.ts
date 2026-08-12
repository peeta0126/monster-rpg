import { test } from "node:test";
import assert from "node:assert/strict";

import { elementChip, hpToken, isHpDanger, HP_DANGER_PCT, ELEMENT_CHIP_INK, ELEMENT_COLOR } from "../src/shared/palette";
import { STATUS_META, statusBadge, statusDetail, statusLabel } from "../src/battle/statusInfo";
import { STATUS_TICK_RATIO, checkStatusEffects, createBattleMonster } from "../src/battle/battleUtils";
import type { ElementType } from "../src/shared/game";

/** 적이 누구인지·내가 얼마나 위험한지를 화면이 제대로 말하는가 */

// ─── 속성 칩 ───────────────────────────────────────────────────────────────────

test("속성 7종에 이름·바탕색·글자색이 다 있다", () => {
  for (const type of Object.keys(ELEMENT_COLOR) as ElementType[]) {
    const chip = elementChip(type);
    assert.ok(chip.label.length > 0, `${type}: 이름이 없다`);
    assert.equal(chip.color, ELEMENT_COLOR[type]);
    assert.equal(chip.ink, ELEMENT_CHIP_INK[type]);
  }
});

// 오름(최종보스)은 type 이 null 이다. 여기서 터지면 50층에서 화면이 통째로 죽는다
test("속성이 null 이면 ? 로 적고 빈칸으로 두지 않는다", () => {
  const chip = elementChip(null);
  assert.equal(chip.label, "?");
  assert.ok(chip.color);
  assert.ok(chip.ink);
});

// ─── 상태이상 ──────────────────────────────────────────────────────────────────

test("상태이상 4종의 매 턴 피해율이 전투 계산과 같은 값이다", () => {
  assert.equal(STATUS_META.poison.tickPercent, STATUS_TICK_RATIO.poison * 100);
  assert.equal(STATUS_META.burn.tickPercent, STATUS_TICK_RATIO.burn * 100);
  assert.equal(STATUS_META.paralysis.tickPercent, 0);
  assert.equal(STATUS_META.freeze.tickPercent, 0);
});

test("표시한 피해율이 실제로 깎이는 양과 맞는다", () => {
  const base = createBattleMonster({
    id: "m", name: "시험체", type: "fire", maxHp: 200, attack: 10, defense: 10, speed: 10,
    moves: [], level: 1, exp: 0, expToNextLevel: 100, rewardExp: 1,
  });

  for (const status of ["poison", "burn"] as const) {
    const res = checkStatusEffects({ ...base, status });
    const lost = base.currentHp - res.monster.currentHp;
    assert.equal(lost, Math.floor(base.maxHp * (STATUS_META[status].tickPercent / 100)));
  }
});

/**
 * 남은 턴 개념이 이 게임에 없다는 것을 못 박는다. 빙결만 스스로 풀리고 나머지는 안 풀린다 —
 * 나중에 지속 턴이 생기면 이 테스트가 깨지고, 그때 표시도 같이 고치라는 신호가 된다.
 */
test("빙결만 스스로 풀린다 — 남은 턴이 있는 상태이상은 없다", () => {
  const base = createBattleMonster({
    id: "m", name: "시험체", type: "fire", maxHp: 200, attack: 10, defense: 10, speed: 10,
    moves: [], level: 1, exp: 0, expToNextLevel: 100, rewardExp: 1,
  });

  assert.equal(checkStatusEffects({ ...base, status: "freeze" }).monster.status, null);
  assert.equal(STATUS_META.freeze.duration, "1턴");

  for (const status of ["paralysis", "poison", "burn"] as const) {
    assert.equal(checkStatusEffects({ ...base, status }).monster.status, status);
    assert.equal(STATUS_META[status].duration, "지속");
  }
});

test("상태이상 표시는 좁은 곳·넓은 곳이 같은 표를 쓴다", () => {
  assert.equal(statusLabel("poison"), "☠독");
  assert.equal(statusBadge("poison"), "☠독 지속");
  assert.equal(statusDetail("poison"), "☠독 지속 · 매 턴 -6%");
  // 깎이지 않는 상태이상에는 피해율을 붙이지 않는다
  assert.equal(statusDetail("paralysis"), "⚡마비 지속");
  assert.equal(statusLabel(null), "");
});

// ─── 위험 구간 ─────────────────────────────────────────────────────────────────

test("위험 경계는 한 벌이고, 바 색과 경고가 같은 순간에 켜진다", () => {
  assert.equal(HP_DANGER_PCT, 25);
  assert.equal(hpToken(HP_DANGER_PCT), "ember700");
  assert.equal(hpToken(HP_DANGER_PCT + 0.1), "ember500");
  assert.equal(isHpDanger(HP_DANGER_PCT), true);
  assert.equal(isHpDanger(HP_DANGER_PCT + 0.1), false);
});

test("기절(0%)은 경고 대상이 아니다", () => {
  assert.equal(isHpDanger(0), false);
  assert.equal(isHpDanger(0.5), true);
});
