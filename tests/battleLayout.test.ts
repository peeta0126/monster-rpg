import { test } from "node:test";
import assert from "node:assert/strict";

import {
  W, H, FLOOR_TOP, FLOOR_BOTTOM,
  PLAYER_X, PLAYER_FEET, PLAYER_SIZE, PLAYER_CY,
  ENEMY_X, ENEMY_FEET, ENEMY_SIZE, ENEMY_CY,
  PLAYER_SPRITE_BOX, PLAYER_PANEL_BOX, LOG_BOX_RECT,
  ORMR_X, ORMR_FEET, ORMR_SIZE,
  enemySpriteBox, enemyPanelBox, getEnemyLayout,
  overlaps, shouldFlipX, type Box,
} from "../src/battle/battleLayout";
import { getTowerZone, isBossFloor, MAX_TOWER_FLOOR } from "../src/shared/floorTable";
import { towerBattleBg } from "../src/shared/assetPaths";
import type { ElementType } from "../src/shared/game";

/**
 * 배치가 겹치는지 본다. 눈으로 보면 "대충 안 겹치는 것 같다"에서 멈추는데, 실제로는
 * 배치를 옮길 때마다 HP 패널이 몬스터를 가리는 일이 되풀이됐다.
 */

const boxesAt = (floor: number): Record<string, Box> => ({
  "적 스프라이트":   enemySpriteBox(floor),
  "아군 스프라이트": PLAYER_SPRITE_BOX,
  "적 패널":         enemyPanelBox(floor),
  "아군 패널":       PLAYER_PANEL_BOX,
  "로그 상자":       LOG_BOX_RECT,
});

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

// 1~49층(적 140px)과 50층(오름 256px)은 배치가 다르다. 둘 다 본다 —
// 오름만 커지면서 패널을 덮은 적이 있어서, 한쪽만 재면 그걸 못 잡는다.
for (const floor of [1, MAX_TOWER_FLOOR]) {
  const boxes = boxesAt(floor);
  for (const [a, b] of MUST_NOT_TOUCH) {
    test(`${floor}층: ${a} 와 ${b} 가 겹치지 않는다`, () => {
      assert.equal(overlaps(boxes[a], boxes[b]), false,
        `${a}(${JSON.stringify(boxes[a])}) 와 ${b}(${JSON.stringify(boxes[b])}) 가 겹친다`);
    });
  }
}

test("HP 패널 네 변이 캔버스 안에 있다", () => {
  const BOXES = boxesAt(MAX_TOWER_FLOOR);
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
  for (const [name, feet] of [["아군", PLAYER_FEET], ["적", ENEMY_FEET], ["오름", ORMR_FEET]] as const) {
    assert.ok(feet >= FLOOR_TOP && feet <= FLOOR_BOTTOM, `${name} 발끝 ${feet} 가 바닥(${FLOOR_TOP}~${FLOOR_BOTTOM}) 밖`);
  }
});

test("중심 Y 는 발끝에서 파생된다", () => {
  assert.equal(PLAYER_CY, PLAYER_FEET - PLAYER_SIZE / 2);
  assert.equal(ENEMY_CY, ENEMY_FEET - ENEMY_SIZE / 2);
  assert.equal(getEnemyLayout(MAX_TOWER_FLOOR).cy, ORMR_FEET - ORMR_SIZE / 2);
});

// ─── 오름 전용 배치 ────────────────────────────────────────────────────────────

test("오름만 크다 — 49층까지는 예전 크기 그대로", () => {
  for (const floor of [1, 10, 41, 45, MAX_TOWER_FLOOR - 1]) {
    const e = getEnemyLayout(floor);
    assert.equal(e.size, ENEMY_SIZE, `${floor}층이 기본 크기가 아니다`);
    assert.equal(e.x, ENEMY_X);
    assert.equal(e.feet, ENEMY_FEET);
  }
  const ormr = getEnemyLayout(MAX_TOWER_FLOOR);
  assert.equal(ormr.size, ORMR_SIZE);
  assert.equal(ormr.x, ORMR_X);
  assert.equal(ormr.feet, ORMR_FEET);
  assert.ok(ormr.size > PLAYER_SIZE, "최종보스가 아군보다 커야 한다");
});

test("오름 상자가 (527,84)~(783,340) 이다", () => {
  const b = enemySpriteBox(MAX_TOWER_FLOOR);
  assert.deepEqual([b.x, b.y, b.x + b.w, b.y + b.h], [527, 84, 783, 340]);
});

// 그림자 폭은 스프라이트 폭의 52% 규칙에서 나온다. 상수로 박으면 오름만 발밑이 헐렁해진다
test("그림자 폭이 크기에서 계산된다", () => {
  assert.equal(getEnemyLayout(MAX_TOWER_FLOOR).size * 0.52, 133.12);
  assert.equal(getEnemyLayout(1).size * 0.52, 72.8);
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
  assert.equal(getTowerZone(MAX_TOWER_FLOOR - 1), "z41");
});

// 층은 라우트 state 로 들어와서 이론상 아무 숫자나 올 수 있다. 배경이 없느니 양 끝으로 접는다
test("범위 밖 층도 배경이 나온다", () => {
  assert.equal(getTowerZone(0), "z01");
  assert.equal(getTowerZone(-5), "z01");
  // 위쪽은 탑 정상 방으로 접힌다 — 51층 이상은 존재하지 않는 층이다
  assert.equal(getTowerZone(999), "z50");
});

test("50층만 자기 방(z50)을 쓰고 41~49층은 z41 이다", () => {
  assert.equal(getTowerZone(41), "z41");
  assert.equal(getTowerZone(49), "z41");
  assert.equal(getTowerZone(MAX_TOWER_FLOOR), "z50");
});

test("50층 오름은 z50 + normal 이다 (type 이 null)", () => {
  // 씬이 하는 것과 같은 판단: 무속성은 배경 고르기에서만 normal 로 접는다
  const ormrType: ElementType | null = null;
  const element: ElementType = ormrType ?? "normal";
  assert.equal(towerBattleBg(getTowerZone(MAX_TOWER_FLOOR), element), "/assets/tower/z50_normal.webp");
  assert.equal(isBossFloor(MAX_TOWER_FLOOR), true);
});

// z50 에는 normal 한 장뿐이다. 다른 속성을 요청해도 없는 파일을 부르지 않는다
test("z50 은 어떤 속성으로 물어도 normal 을 돌려준다", () => {
  for (const e of ["fire", "water", "ice", "grass", "poison", "electric"] as ElementType[]) {
    assert.equal(towerBattleBg("z50", e), "/assets/tower/z50_normal.webp");
  }
});

test("z41 까지의 경로 규칙이 구간·속성 35 조합을 다 만든다", () => {
  const zones = ["z01", "z11", "z21", "z31", "z41"] as const;
  const elements: ElementType[] = ["fire", "electric", "water", "ice", "grass", "poison", "normal"];
  const paths = new Set(zones.flatMap((z) => elements.map((e) => towerBattleBg(z, e))));
  assert.equal(paths.size, 35);
  assert.ok(paths.has("/assets/tower/z21_grass.webp"));
});

// ── 마주보기 ──────────────────────────────────────────────────────────────────
// 원화는 왼쪽 아니면 정면을 본다. 오른쪽을 보는 그림이 없으니 "왼쪽에 선 쪽만 뒤집는다"
// 한 줄로 전 층이 해결된다. 상수로 박아 두면 배치를 옮길 때마다 서로 등진다.

test("왼쪽에 선 쪽만 뒤집는다 — 둘이 마주본다", () => {
  assert.equal(shouldFlipX(PLAYER_X, ENEMY_X), true);
  assert.equal(shouldFlipX(ENEMY_X, PLAYER_X), false);
});

test("좌우를 뒤바꿔도 규칙 하나로 계속 마주본다", () => {
  // 언젠가 아군을 오른쪽에 세우더라도 두 값이 서로 반대이기만 하면 된다
  assert.notEqual(shouldFlipX(800, 250), shouldFlipX(250, 800));
});

test("모든 층에서 아군과 적의 뒤집기가 서로 반대다 (50층 오름 포함)", () => {
  for (const floor of [1, 10, 25, 30, 49, MAX_TOWER_FLOOR]) {
    const e = getEnemyLayout(floor);
    assert.equal(shouldFlipX(PLAYER_X, e.x), true, `${floor}층 아군은 왼쪽이라 뒤집는다`);
    assert.equal(shouldFlipX(e.x, PLAYER_X), false, `${floor}층 적은 오른쪽이라 안 뒤집는다`);
  }
});
