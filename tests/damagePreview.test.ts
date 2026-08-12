import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { calculateDamage, computeDamage, createBattleMonster, type BattleMonster } from "../src/battle/battleUtils";
import { previewMove, formatDamageRange } from "../src/battle/damagePreview";
import type { ElementType, Move } from "../src/shared/game";

/**
 * 기술 셀의 예상 데미지가 **실제 전투 계산과 같은 값**인지 못 박는다.
 * 여기서 지키려는 건 숫자 하나가 아니라 "표시가 계산식의 사본이 아니다"라는 것이다.
 */

const move = (over: Partial<Move> = {}): Move => ({
  id: "test-move", name: "시험", type: "fire", power: 40, accuracy: 100,
  category: "physical", ...over,
});

const mon = (over: Partial<BattleMonster> = {}): BattleMonster => ({
  ...createBattleMonster({
    id: "m", name: "시험체", type: "fire" as ElementType | null,
    maxHp: 200, attack: 60, defense: 40, speed: 30,
    moves: [], level: 10, exp: 0, expToNextLevel: 100, rewardExp: 10,
  }),
  ...over,
});

// ─── 1. 계산 함수를 같이 쓴다 ──────────────────────────────────────────────────

test("예상 데미지가 실제 계산 함수(calculateDamage)가 내는 값과 같다", () => {
  const attacker = mon({ attack: 77 });
  const defender = mon({ id: "e", type: "grass", defense: 33, maxHp: 300, currentHp: 300 });
  const mv = move({ power: 45, accuracy: 100 });

  const p = previewMove(attacker, defender, mv);

  // 난수를 훑어 실제 함수가 내는 비치명타 데미지를 모은다.
  // (치명타 보너스를 0으로 주므로 치명타는 발생하지 않는다)
  const real = new Set<number>();
  const origRandom = Math.random;
  try {
    for (let i = 0; i <= 100; i++) {
      Math.random = () => i / 100;
      const r = calculateDamage(attacker, defender, mv);
      if (r.isHit) real.add(r.damage);
    }
  } finally {
    Math.random = origRandom;
  }

  assert.equal(Math.min(...real), p.minDamage);
  assert.equal(Math.max(...real), p.maxDamage);
});

test("장비 보너스·공격 버프·상성이 모두 예측에 반영된다", () => {
  const attacker = mon({ attack: 50, type: "fire", attackBuffMult: 1.5, attackBuffTurns: 2 });
  const defender = mon({ id: "e", type: "grass", defense: 25, currentHp: 999, maxHp: 999 });
  const mv = move({ type: "fire", power: 40 });
  const bonus = { attack: 10, elementPower: 20, elementalDamage: { fire: 15 } };

  const p = previewMove(attacker, defender, mv, bonus);

  // 전투가 하는 것과 같은 방식: 장비 공격력을 얹은 뒤 계산 함수에 넣는다
  const expected = computeDamage(
    { ...attacker, attack: attacker.attack + bonus.attack }, defender, mv,
    { elementPowerBonus: bonus.elementPower, elementalDamageBonus: bonus.elementalDamage },
  );
  assert.equal(p.minDamage, expected);
  assert.ok(p.minDamage > 0);

  // 보너스를 빼면 값이 줄어야 한다 — 인자를 그냥 흘려보내고 있지 않다는 확인
  assert.ok(previewMove(attacker, defender, mv).minDamage < p.minDamage);
});

/**
 * 사본 금지의 구조적 확인. 데미지 공식의 핵심 조각(방어력 나눗셈·소수 버림·치명타 배수)이
 * 예측 모듈 안에 다시 적혀 있으면 여기서 걸린다. 값 비교만으로는 "지금은 같은 값"까지만
 * 보장되고, 나중에 식을 고쳤을 때 표시가 따라오는지는 못 본다.
 */
test("예측 모듈이 데미지 공식을 다시 적고 있지 않다", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, "..", "src", "battle", "damagePreview.ts"), "utf8");
  for (const forbidden of ["defense", "Math.floor", "attackBuffMult", "1.5"]) {
    assert.ok(!src.includes(forbidden), `damagePreview.ts 가 "${forbidden}" 를 직접 다룬다 — 계산은 battleUtils 에만 있어야 한다`);
  }
  assert.ok(src.includes("computeDamage"), "예측이 실제 계산 함수를 부르지 않는다");
});

// ─── 2. 쓰러뜨린다 표시 ────────────────────────────────────────────────────────

test('"쓰러뜨린다"는 최소 데미지가 잔여 HP 이상일 때만 뜬다', () => {
  const attacker = mon({ attack: 60 });
  const defender = mon({ id: "e", type: "normal", defense: 40, maxHp: 200 });
  const mv = move({ type: "normal", power: 40 });

  const dmg = previewMove(attacker, defender, mv).minDamage;

  assert.equal(previewMove(attacker, { ...defender, currentHp: dmg }, mv).ko, "sure");
  assert.equal(previewMove(attacker, { ...defender, currentHp: dmg - 1 }, mv).ko, "sure");
  assert.equal(previewMove(attacker, { ...defender, currentHp: dmg + 1 }, mv).ko, null);
});

test("치명타가 떠야 닿는 경우에만 \"쓰러뜨릴 수도\"가 된다", () => {
  const attacker = mon({ attack: 60 });
  const defender = mon({ id: "e", type: "normal", defense: 40, maxHp: 200 });
  const mv = move({ type: "normal", power: 40 });
  const bonus = { critRate: 10 };

  const p = previewMove(attacker, defender, mv, bonus);
  const between = Math.floor((p.minDamage + (p.critDamage ?? 0)) / 2);

  assert.equal(previewMove(attacker, { ...defender, currentHp: between }, mv, bonus).ko, "maybe");
  // 치명타율이 0이면 같은 HP 에서 아무 표시도 뜨지 않는다 — 없는 가능성을 팔지 않는다
  assert.equal(previewMove(attacker, { ...defender, currentHp: between }, mv).ko, null);
});

test("보조 기술은 데미지도 쓰러뜨림 표시도 없다", () => {
  const attacker = mon();
  const defender = mon({ id: "e", currentHp: 1 });
  const p = previewMove(attacker, defender, move({ power: 0, category: "status" }));

  assert.equal(p.isStatus, true);
  assert.equal(p.minDamage, 0);
  assert.equal(p.ko, null);
});

// ─── 3. 무속성(오름) ───────────────────────────────────────────────────────────

test("적 속성이 null(오름)이어도 예측이 나온다", () => {
  const attacker = mon({ attack: 80 });
  const ormr = mon({ id: "ormr", type: null, defense: 50, maxHp: 1140, currentHp: 1140 });

  for (const type of ["fire", "water", "grass", "electric", "ice", "normal", "poison"] as ElementType[]) {
    const p = previewMove(attacker, ormr, move({ type }));
    assert.equal(p.multiplier, 1, `${type}: 무속성에는 약점도 저항도 없다`);
    assert.ok(p.minDamage > 0);
    assert.equal(p.ko, null);
    assert.equal(typeof formatDamageRange(p), "string");
  }
});

// ─── 4. 표시 형식 ──────────────────────────────────────────────────────────────

test("흔들림이 없으면 한 숫자로, 있으면 범위로 적는다", () => {
  const p = previewMove(mon(), mon({ id: "e" }), move());
  assert.equal(formatDamageRange(p), `${p.minDamage}`);
  assert.equal(formatDamageRange({ ...p, minDamage: 28, maxDamage: 34 }), "28~34");
});
