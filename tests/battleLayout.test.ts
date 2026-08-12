import { test } from "node:test";
import assert from "node:assert/strict";

import {
  W, H, FLOOR_TOP, FLOOR_BOTTOM,
  PLAYER_X, PLAYER_FEET, PLAYER_SIZE, PLAYER_CY,
  ENEMY_X, ENEMY_FEET, ENEMY_SIZE, ENEMY_CY,
  PLAYER_SPRITE_BOX, ENEMY_SPRITE_BOX, PLAYER_PANEL_BOX, ENEMY_PANEL_BOX, LOG_BOX_RECT,
  overlaps, type Box,
} from "../src/battle/battleLayout";
import { getTowerZone, isBossFloor, MAX_TOWER_FLOOR } from "../src/shared/floorTable";
import { towerBattleBg } from "../src/shared/assetPaths";
import type { ElementType } from "../src/shared/game";

/**
 * 배치가 겹치는지 본다. 눈으로 보면 "대충 안 겹치는 것 같다"에서 멈추는데, 실제로는
 * 배치를 옮길 때마다 HP 패널이 몬스터를 가리는 일이 되풀이됐다.
 */

const BOXES: Record<string, Box> = {
  "적 스프라이트":   ENEMY_SPRITE_BOX,
  "아군 스프라이트": PLAYER_SPRITE_BOX,
  "적 패널":         ENEMY_PANEL_BOX,
  "아군 패널":       PLAYER_PANEL_BOX,
  "로그 상자":       LOG_BOX_RECT,
};

const MUST_NOT_TOUCH: [string, string][] = [
  ["적 스프라이트", "적 패널"],
  ["적 스프라이트", "아군 패널"],
  ["아군 스프라이트", "적 패널"],
  ["아군 스프라이트", "아군 패널"],
  ["아군 패널", "적 패널"],
  ["아군 패널", "로그 상자"],
  ["적 패널", "로그 상자"],
  ["아군 스프라이트", "로그 상자"],
  ["적 스프라이트", "로그 상자"],
];

for (const [a, b] of MUST_NOT_TOUCH) {
  test(`${a} 와 ${b} 가 겹치지 않는다`, () => {
    assert.equal(overlaps(BOXES[a], BOXES[b]), false,
      `${a}(${JSON.stringify(BOXES[a])}) 와 ${b}(${JSON.stringify(BOXES[b])}) 가 겹친다`);
  });
}

test("HP 패널 네 변이 캔버스 안에 있다", () => {
  for (const name of ["적 패널", "아군 패널"] as const) {
    const b = BOXES[name];
    assert.ok(b.x >= 0, `${name} 왼쪽이 화면 밖`);
    assert.ok(b.y >= 0, `${name} 위쪽이 화면 밖`);
    assert.ok(b.x + b.w <= W, `${name} 오른쪽이 화면 밖`);
    assert.ok(b.y + b.h <= H, `${name} 아래쪽이 화면 밖`);
  }
});

// 배경 이미지의 바닥이 평행사변형이라, 발끝이 이 범위를 벗어나면 벽에 서 있거나 공중에 뜬다
test("두 발끝이 배경의 바닥 범위 안에 있다", () => {
  for (const [name, feet] of [["아군", PLAYER_FEET], ["적", ENEMY_FEET]] as const) {
    assert.ok(feet >= FLOOR_TOP && feet <= FLOOR_BOTTOM, `${name} 발끝 ${feet} 가 바닥(${FLOOR_TOP}~${FLOOR_BOTTOM}) 밖`);
  }
});

test("중심 Y 는 발끝에서 파생된다", () => {
  assert.equal(PLAYER_CY, PLAYER_FEET - PLAYER_SIZE / 2);
  assert.equal(ENEMY_CY, ENEMY_FEET - ENEMY_SIZE / 2);
});

// 아군이 앞(왼쪽·아래·큼), 적이 뒤(오른쪽·위·작음) — 원근이 뒤집히면 도전하는 그림이 아니게 된다
test("아군이 앞, 적이 뒤에 선다", () => {
  assert.ok(PLAYER_X < ENEMY_X, "아군이 왼쪽이어야 한다");
  assert.ok(PLAYER_FEET > ENEMY_FEET, "아군이 더 아래(앞)여야 한다");
  assert.ok(PLAYER_SIZE > ENEMY_SIZE, "아군이 더 커야 한다");
});

// ─── 배경 고르기 ───────────────────────────────────────────────────────────────

test("층 구간이 10층마다 바뀐다", () => {
  assert.equal(getTowerZone(1), "z01");
  assert.equal(getTowerZone(10), "z01");
  assert.equal(getTowerZone(11), "z11");
  assert.equal(getTowerZone(20), "z11");
  assert.equal(getTowerZone(21), "z21");
  assert.equal(getTowerZone(30), "z21");
  assert.equal(getTowerZone(31), "z31");
  assert.equal(getTowerZone(40), "z31");
  assert.equal(getTowerZone(41), "z41");
  assert.equal(getTowerZone(MAX_TOWER_FLOOR), "z41");
});

// 층은 라우트 state 로 들어와서 이론상 아무 숫자나 올 수 있다. 배경이 없느니 양 끝으로 접는다
test("범위 밖 층도 배경이 나온다", () => {
  assert.equal(getTowerZone(0), "z01");
  assert.equal(getTowerZone(-5), "z01");
  assert.equal(getTowerZone(999), "z41");
});

test("50층 오름은 z41 + normal 이다 (type 이 null)", () => {
  const zone = getTowerZone(MAX_TOWER_FLOOR);
  // 씬이 하는 것과 같은 판단: 무속성은 배경 고르기에서만 normal 로 접는다
  const ormrType: ElementType | null = null;
  const element: ElementType = ormrType ?? "normal";
  assert.equal(zone, "z41");
  assert.equal(towerBattleBg(zone, element), "/assets/tower/z41_normal.webp");
  assert.equal(isBossFloor(MAX_TOWER_FLOOR), true);
});

test("경로 규칙이 구간·속성 35 조합을 다 만든다", () => {
  const zones = ["z01", "z11", "z21", "z31", "z41"] as const;
  const elements: ElementType[] = ["fire", "electric", "water", "ice", "grass", "poison", "normal"];
  const paths = new Set(zones.flatMap((z) => elements.map((e) => towerBattleBg(z, e))));
  assert.equal(paths.size, 35);
  assert.ok(paths.has("/assets/tower/z21_grass.webp"));
});
