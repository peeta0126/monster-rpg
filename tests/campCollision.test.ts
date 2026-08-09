import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMP_COLLISION_BOXES, CAMP_MAP_W, CAMP_MAP_H,
  bodyYFromSpriteY, hitsWall, reachableCells,
} from "../src/camp/campCollision";
import { getCampPosition } from "../src/camp/campPositionStore";

/**
 * 베이스캠프 충돌 형상 검증.
 *
 * 눈으로만 보면 12px 짜리 틈을 놓친다 — 예전 선분 벽이 그래서 지붕 위까지 새어나갔다.
 * 여기서는 스폰에서 BFS 로 실제 도달 영역을 구한 뒤, 갈 수 있어야 하는 곳과 갈 수
 * 없어야 하는 곳을 둘 다 못 박는다.
 *
 * 그림으로 확인하려면 `npm run design:collision`.
 */

const STEP = 20;

// 상호작용 판정은 스프라이트 중심(player.y)으로 재는데 물리 바디는 발밑에 있다.
// BFS 좌표는 바디 중심이므로 그 차이만큼 올려야 게임과 같은 값이 된다.
const BODY_TO_SPRITE_Y = bodyYFromSpriteY(0);

const spawnSprite = getCampPosition();
const SPAWN = { x: spawnSprite.x, y: bodyYFromSpriteY(spawnSprite.y) };
const reached = [...reachableCells(SPAWN, STEP)].map((k) => {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
});

function canStandWithin(target: { x: number; y: number }, radius: number): boolean {
  return reached.some(
    (p) => Math.hypot(p.x - target.x, p.y - BODY_TO_SPRITE_Y - target.y) <= radius,
  );
}

test("스폰 지점이 벽 안이 아니다", () => {
  assert.equal(hitsWall(SPAWN.x, SPAWN.y), false);
});

test("충돌 박스 id 가 중복되지 않는다", () => {
  const ids = CAMP_COLLISION_BOXES.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, `중복: ${ids.filter((v, i) => ids.indexOf(v) !== i).join(", ")}`);
});

test("충돌 박스가 지도 밖으로 크게 튀어나가지 않는다", () => {
  for (const b of CAMP_COLLISION_BOXES) {
    assert.ok(b.w > 0 && b.h > 0, `${b.id} 의 크기가 0 이하다`);
    assert.ok(b.x >= 0 && b.y >= 0, `${b.id} 가 지도 왼쪽/위로 나갔다`);
    assert.ok(b.x + b.w <= CAMP_MAP_W && b.y + b.h <= CAMP_MAP_H, `${b.id} 가 지도 오른쪽/아래로 나갔다`);
  }
});

/**
 * 상호작용 지점. 좌표와 사거리는 BaseCampScene 의 keydown-E 핸들러와 같아야 한다.
 * 여기 숫자를 고칠 일이 생기면 씬도 같이 고친 것인지 확인할 것.
 */
const INTERACTIONS = [
  { label: "탑",     x: 278,  y: 1110, radius: 90 },
  { label: "숲",     x: 1500, y: 1900, radius: 130 },
  { label: "집",     x: 794,  y: 1215, radius: 90 },
  { label: "바로스", x: 430,  y: 1200, radius: 160 },
  { label: "오리온", x: 1090, y: 1950, radius: 160 },
];

for (const spot of INTERACTIONS) {
  test(`${spot.label} 상호작용 범위 안까지 걸어갈 수 있다`, () => {
    assert.ok(canStandWithin(spot, spot.radius), `${spot.label}(${spot.x}, ${spot.y}) 에 닿지 못한다`);
  });
}

test("남쪽 아치 통로로 내려갈 수 있다", () => {
  assert.ok(reached.some((p) => p.y > 2500 && p.x > 660 && p.x < 860), "남쪽 통로가 막혔다");
});

/**
 * 여기가 이 파일의 핵심이다. 걸어 다닐 수 있는 곳이 "길"에만 있어야 한다.
 * 아래 좌표는 전부 배경에서 건물·숲·물체가 차지한 자리다.
 */
const MUST_NOT_REACH = [
  { label: "집 지붕",       x: 700,  y: 700 },
  { label: "시계탑",        x: 1000, y: 500 },
  { label: "북쪽 아치 길",  x: 780,  y: 200 },
  { label: "큰 나무(서북)", x: 250,  y: 300 },
  { label: "우물 안",       x: 300,  y: 1600 },
  { label: "남서 건물 지붕", x: 300, y: 2100 },
  { label: "동쪽 건물 안",  x: 1350, y: 1550 },
  { label: "노점 좌판",     x: 1000, y: 1550 },
  { label: "남동 숲 속",    x: 1300, y: 2400 },
  { label: "집 문짝 위",    x: 794,  y: 1150 },
];

for (const spot of MUST_NOT_REACH) {
  test(`${spot.label} 안으로는 들어갈 수 없다`, () => {
    const near = reached.filter((p) => Math.hypot(p.x - spot.x, p.y - spot.y) <= STEP);
    assert.equal(near.length, 0, `${spot.label}(${spot.x}, ${spot.y}) 안에 설 수 있다`);
  });
}
