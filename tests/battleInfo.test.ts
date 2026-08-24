import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { elementChip, hpToken, isHpDanger, HP_DANGER_PCT, ELEMENT_CHIP_INK, ELEMENT_COLOR } from "../src/shared/palette";
import { STATUS_META, statusBadge, statusDetail, statusLabel } from "../src/battle/statusInfo";
import {
  STATUS_TICK_RATIO, STATUS_DURATION, checkStatusEffects, createBattleMonster,
  applyStatusEffect, isFainted,
} from "../src/battle/battleUtils";
import { typeChart, ELEMENT_ORDER } from "../src/battle/typeChart";
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

const dummy = () => createBattleMonster({
  id: "m", name: "시험체", type: "fire", maxHp: 200, attack: 10, defense: 10, speed: 10,
  moves: [], level: 1, exp: 0, expToNextLevel: 100, rewardExp: 1,
});

/**
 * 상태이상은 전부 정해진 턴 뒤에 스스로 풀린다. 예전엔 빙결만 풀리고 화상·독·마비는
 * 전투가 끝날 때까지 갔다. 화상 하나면 12턴에 최대 HP 전부가 날아갔다.
 */
test("상태이상은 STATUS_DURATION 턴을 채우면 풀린다", () => {
  for (const status of ["paralysis", "poison", "burn", "freeze"] as const) {
    let mon = applyStatusEffect(dummy(), status);
    assert.equal(mon.statusTurns, STATUS_DURATION[status], `${status}: 지속 턴이 안 박혔다`);

    for (let i = 0; i < STATUS_DURATION[status]; i++) {
      assert.equal(mon.status, status, `${status}: ${i}턴째에 벌써 풀렸다`);
      mon = checkStatusEffects(mon).monster;
    }
    assert.equal(mon.status, null, `${status}: 지속 턴이 지나도 안 풀린다`);
  }
});

test("화면에 적히는 지속 턴이 전투가 쓰는 값과 같다", () => {
  for (const status of ["paralysis", "poison", "burn", "freeze"] as const) {
    assert.equal(STATUS_META[status].duration, `${STATUS_DURATION[status]}턴`);
  }
});

test("상태이상 표시는 좁은 곳·넓은 곳이 같은 표를 쓴다", () => {
  assert.equal(statusLabel("poison"), "독");
  assert.equal(statusBadge("poison", 3), "독 3턴");
  assert.equal(statusDetail("poison", 3), "독 3턴 · 매 턴 -6%");
  // 남은 턴을 모르는 자리에서는 걸렸을 때의 총 지속을 적는다
  assert.equal(statusBadge("poison"), `독 ${STATUS_DURATION.poison}턴`);
  // 깎이지 않는 상태이상에는 피해율을 붙이지 않는다
  assert.equal(statusDetail("paralysis", 2), "마비 2턴");
  assert.equal(statusLabel(null), "");
});

/**
 * 상태이상 피해로 HP 가 0 이 되면 그 자리에서 쓰러져야 한다. 전투 흐름은 React 안에
 * 있어 여기서 못 부르지만, 적어도 "HP 가 0 인데 isFainted 가 false"인 구멍은 없어야 한다.
 */
test("상태이상 피해만으로도 HP 가 0 이 되고 기절로 잡힌다", () => {
  const burning = { ...applyStatusEffect(dummy(), "burn"), currentHp: 5 };
  const after = checkStatusEffects(burning).monster;
  assert.equal(after.currentHp, 0);
  assert.equal(isFainted(after), true);
  // 쓰러진 몬스터에게 "상태가 풀렸다"를 띄우지 않는다. 되살아난 것처럼 읽힌다
  assert.ok(!checkStatusEffects(burning).logs.some((l) => l.includes("풀렸다")));
});

// ─── 상성표 ────────────────────────────────────────────────────────────────────

test("상성표가 typeChart 의 속성을 하나도 빠뜨리지 않는다", () => {
  assert.deepEqual(ELEMENT_ORDER, Object.keys(typeChart));
  assert.deepEqual([...ELEMENT_ORDER].sort(), (Object.keys(ELEMENT_COLOR) as ElementType[]).sort());
});

/**
 * 표를 손으로 옮겨 적지 않았는지 본다. 배율이 화면 코드에 박혀 있으면 상성을 고친 날
 * 표만 옛말을 한다. 값은 전투가 쓰는 getTypeMultiplier 에서만 나와야 한다.
 */
test("상성표 화면이 배율을 직접 적고 있지 않다", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, "..", "src", "battle", "TypeChartPanel.tsx"), "utf8");
  // Tailwind 여백(py-0.5)은 앞에 하이픈이 붙는다. 배율로 쓴 0.5 만 걸러낸다.
  assert.ok(!/(?<!-)0\.5/.test(src), "TypeChartPanel 이 배율을 직접 적고 있다");
  assert.ok(src.includes("getTypeMultiplier"), "전투가 쓰는 상성 함수를 부르지 않는다");
  assert.ok(src.includes("ELEMENT_ORDER"), "속성 순서를 따로 적고 있다");
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
