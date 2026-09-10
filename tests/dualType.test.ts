import { test } from "node:test";
import assert from "node:assert/strict";

import { computeDamage, createBattleMonster, getTypeMultiplier, isSameElement } from "../src/battle/battleUtils";
import { ELEMENT_ORDER, typeChart } from "../src/battle/typeChart";
import { monsters } from "../src/monster/monsters";
import { applyLevelGrowth } from "../src/monster/growth";
import { ALL_MOVES } from "../src/monster/moves";
import { LEARNSET } from "../src/monster/learnset";
import { ELEMENT_CHIP_CLASS, ELEMENT_COLOR, PALETTE } from "../src/shared/palette";
import { ELEMENT_KO, elementIdsOf, type ElementType } from "../src/shared/game";
import { towerBattleBg } from "../src/shared/assetPaths";
import type { TowerZone } from "../src/shared/floorTable";

/**
 * 이중 속성과 크리스탈이 지켜야 하는 성질. 값이 아니라 규칙을 본다 —
 * 속성을 또 하나 더할 때 여기서 걸리라고 두는 검사다.
 */

test("이중 속성 배율은 0.5~2 밖으로 안 나간다", () => {
  // 4배(2×2)는 그 층을 선택이 있는 판이 아니라 사고로 만든다. 풀/독이 얼음한테
  // 정확히 그 자리였다. 0.25 는 반대쪽 사고다 — 때려도 안 죽는다.
  for (const atk of ELEMENT_ORDER) {
    for (const a of ELEMENT_ORDER) {
      for (const b of ELEMENT_ORDER) {
        const mult = getTypeMultiplier(atk, a, b);
        assert.ok(mult >= 0.5 && mult <= 2, `${atk} → ${a}/${b} = ${mult}`);
      }
    }
  }
});

test("이중 속성은 상쇄가 살아 있다 — 곱이지 최댓값이 아니다", () => {
  // 버블돈(물/독)은 불을 0.5배로 받는다. 물이 0.5, 독이 1 이라 곱이 0.5다.
  // 여기서 "둘 중 큰 값"으로 접으면 이중 속성의 값이 통째로 사라진다.
  const bubldon = monsters.find((m) => m.id === "bubldon")!;
  assert.equal(getTypeMultiplier("fire", bubldon.type, bubldon.type2), 0.5);
  // 포자무스(풀/독)는 독을 1배로 받는다. 순수 풀이던 시절 2배로 맞던 자리인데,
  // 독이 0.5 를 물고 오면서 정확히 상쇄됐다. 최댓값으로 접으면 여기가 2배로 남는다.
  const sporemus = monsters.find((m) => m.id === "sporemus")!;
  assert.equal(getTypeMultiplier("poison", sporemus.type, sporemus.type2), 1);
});

test("얼음과 크리스탈은 약점이 안 겹친다", () => {
  // 크리샤가 둘을 같이 들고 있다. 겹치면 그 한 속성에 통째로 지워진다 — 곱이라
  // 배율이 두 배로 뛰기 때문에, clamp 가 있어도 그 속성 하나가 정답이 되어 버린다.
  const weakTo = (def: ElementType) => ELEMENT_ORDER.filter((atk) => typeChart[atk]?.[def] === 2);
  const shared = weakTo("ice").filter((t) => weakTo("crystal").includes(t));
  assert.deepEqual(shared, [], `얼음과 크리스탈이 같이 ${shared.join("·")} 에 약하다`);
});

test("크리스탈이 주속성인 종은 탑에서 설 방이 있다", () => {
  // towerBattleBg 는 주속성으로 방을 고르는데 z*_crystal.webp 가 없다. 젬 계열 셋이
  // 순수 크리스탈이라 그 이름이 실제로 들어오므로, 표가 접어 주지 않으면 배경이
  // 통째로 빈다. 속성을 또 더할 때도 여기서 걸린다.
  const primary = monsters.filter((m) => m.type === "crystal");
  assert.deepEqual(primary.map((m) => m.name), ["젬토", "젬가드", "젬로드"]);
  const zones: TowerZone[] = ["z01", "z11", "z21", "z31", "z41", "z50"];
  for (const zone of zones) {
    for (const m of primary) {
      const url = towerBattleBg(zone, m.type!);
      assert.ok(!url.includes("_crystal."), `${zone}: 없는 수정 방을 부른다 — ${url}`);
    }
  }
});

test("크리스탈 기술에는 상태이상이 없다", () => {
  // 얼음이 확정 빙결로 턴을 빼앗는 속성이라, 크리스탈까지 상태이상을 가지면
  // 크리샤(얼음/크리스탈) 한 마리가 상태이상 둘을 겸한다.
  for (const mv of ALL_MOVES.filter((m) => m.type === "crystal")) {
    assert.equal(mv.statusEffect, undefined, `${mv.name} 에 상태이상이 붙었다`);
  }
});

test("모든 속성에 한글 이름·색·칩이 있다", () => {
  for (const t of ELEMENT_ORDER) {
    assert.ok(ELEMENT_KO[t], `${t}: 한글 이름이 없다`);
    assert.ok(ELEMENT_COLOR[t as keyof typeof ELEMENT_COLOR], `${t}: 색 토큰이 없다`);
    assert.ok(ELEMENT_CHIP_CLASS[t as keyof typeof ELEMENT_CHIP_CLASS], `${t}: 칩 클래스가 없다`);
  }
});

test("속성 칩 색은 여덟이 전부 다르다", () => {
  // 예전에 불꽃과 전기가 ember-600 / ember-500 로 한 단계 차이였고, 도감 화면의
  // 사본에서는 아예 같은 문자열이었다. 12px 칩에서 그 차이는 안 보인다.
  const tokens = ELEMENT_ORDER.map((t) => ELEMENT_COLOR[t as keyof typeof ELEMENT_COLOR]);
  assert.equal(new Set(tokens).size, tokens.length, "같은 색을 쓰는 속성이 있다");
  const hexes = tokens.map((t) => PALETTE[t]);
  assert.equal(new Set(hexes).size, hexes.length, "다른 이름인데 같은 hex 다");
});

test("자속이 하나도 없는 종은 없다", () => {
  // 학습표가 자기 속성 기술을 한 줄도 안 주면 그 종은 이름만 그 속성이다.
  for (const m of monsters) {
    const set = LEARNSET[m.id];
    if (!set || set.length === 0) continue;
    const own = elementIdsOf(m);
    if (own.length === 0) continue;   // 오름(무속성)
    for (const t of own) {
      assert.ok(
        set.some((e) => e.move.type === t),
        `${m.name}: ${ELEMENT_KO[t]} 자속 기술이 학습표에 하나도 없다`,
      );
    }
  }
});

test("진화하면 부속성도 같이 옮겨진다", async () => {
  // `type` 만 옮기던 시절엔 버블돈(물/독)이 되어도 독이 안 붙었다. 화면은 칩을 둘
  // 그리는데 전투는 하나로 계산하던 셈이다. 계열 전체를 걸어 확인한다 —
  // 부속성이 붙는 진화(버블록→버블돈)와 그대로 이어지는 진화(젬토→젬가드) 둘 다.
  for (const [fromId, toId] of [["bublock", "bubldon"], ["gemto", "gemguard"]] as const) {
    const from = monsters.find((m) => m.id === fromId)!;
    const to   = monsters.find((m) => m.id === toId)!;
    const level = to.evolvesFrom === fromId ? (from.evolvesAtLevel ?? 1) : 1;

    const grown = (await applyLevelGrowth(
      { ...from, level, currentHp: from.maxHp }, level - 1,
    )).monster;

    assert.equal(grown.id, toId, `${from.name} 이 Lv${level} 에 진화하지 않았다`);
    assert.equal(grown.type, to.type, `${to.name}: 주속성이 안 옮겨졌다`);
    assert.equal(grown.type2, to.type2, `${to.name}: 부속성이 안 옮겨졌다`);
  }
});

test("자속 보정은 부속성에도 붙는다", () => {
  // 장비의 「속성 능력」은 자기 속성 기술을 쓸 때만 붙는다. 주속성만 보면 크리샤가
  // 크리스탈 기술을 쓸 때 그 장비가 죽은 값이 된다 — 정작 이 종의 정체가 그쪽인데.
  const crystafox = monsters.find((m) => m.id === "crystafox")!;
  assert.ok(isSameElement("ice", crystafox), "주속성이 자속이 아니다");
  assert.ok(isSameElement("crystal", crystafox), "부속성이 자속으로 안 잡힌다");
  assert.ok(!isSameElement("fire", crystafox), "남의 속성이 자속으로 잡힌다");

  // 실제 데미지로도 확인한다. 함수를 갈아 끼워도 이 줄이 잡는다
  const gemlord = monsters.find((m) => m.id === "gemlord")!;
  const attacker = createBattleMonster(gemlord);
  const target = createBattleMonster(monsters.find((m) => m.id === "nobi")!);
  const crystalMove = ALL_MOVES.find((m) => m.id === "crystal-lance")!;
  const plain = computeDamage(attacker, target, crystalMove, {});
  const buffed = computeDamage(attacker, target, crystalMove, { elementPowerBonus: 50 });
  assert.ok(buffed > plain, "크리스탈 기술에 자속 보정이 안 붙었다");
});
