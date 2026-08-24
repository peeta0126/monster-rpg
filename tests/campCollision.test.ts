import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMP_COLLISION_BOXES, CAMP_WALL_SEGMENTS, CAMP_MAP_W, CAMP_MAP_H, CAMP_INTERACTIONS,
  bodyYFromSpriteY, footYFromSpriteY, hitsWall, reachableCells,
} from "../src/camp/campCollision";
import { getCampPosition } from "../src/camp/campPositionStore";

/**
 * 베이스캠프 충돌 형상 검증.
 *
 * 형상은 걸을 수 있는 땅을 두르는 선분 스물두 줄이다. 눈으로만 보면 줄과 줄 사이의
 * 몇 px 짜리 틈을 놓치고, 그 틈 하나로 지붕 위까지 빠져나간다. 그래서 스폰에서 BFS 로
 * 실제 도달 영역을 구한 뒤, 갈 수 있어야 하는 곳과 갈 수 없어야 하는 곳을 둘 다 못 박는다.
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

test("충돌 박스가 지도 밖으로 나가지 않는다", () => {
  for (const b of CAMP_COLLISION_BOXES) {
    assert.ok(b.w > 0 && b.h > 0, `${b.id} 의 크기가 0 이하다`);
    assert.ok(b.x >= 0 && b.y >= 0, `${b.id} 가 지도 왼쪽/위로 나갔다`);
    assert.ok(b.x + b.w <= CAMP_MAP_W && b.y + b.h <= CAMP_MAP_H, `${b.id} 가 지도 오른쪽/아래로 나갔다`);
  }
});

/**
 * 선분은 가로·세로·비스듬 셋뿐이고, 비스듬한 줄만 정사각형 여러 개로 펴진다.
 * 줄 하나가 사각형을 하나도 안 내놓으면(지도 밖 등) 그 자리가 통째로 열린다.
 */
test("모든 선분이 실제 충돌 박스를 만든다", () => {
  for (const s of CAMP_WALL_SEGMENTS) {
    const made = CAMP_COLLISION_BOXES.filter((b) => b.id === s.id || b.id.startsWith(`${s.id}-`));
    assert.ok(made.length > 0, `${s.id} 이 충돌 박스를 만들지 않았다`);
  }
});

/**
 * 상호작용 지점. 탑·숲·집은 CAMP_INTERACTIONS 한 벌에서 그대로 가져온다 —
 * 예전에는 여기 숫자를 베껴 두고 "씬도 같이 고쳤는지 확인할 것"이라고 적어 뒀는데,
 * 그건 표가 두 벌이라는 뜻이었다. NPC 는 씬이 스프라이트와 함께 들고 있어 여기 적는다.
 */
const NPC_SPOTS = [
  { label: "바로스", x: 430,  y: 1200, radius: 160 },
  { label: "오리온", x: 1090, y: 1950, radius: 160 },
];

for (const spot of [...CAMP_INTERACTIONS.map((i) => ({ ...i, label: i.id })), ...NPC_SPOTS]) {
  test(`${spot.label} 상호작용 범위 안까지 걸어갈 수 있다`, () => {
    assert.ok(canStandWithin(spot, spot.radius), `${spot.label}(${spot.x}, ${spot.y}) 에 닿지 못한다`);
  });
}

/**
 * 다른 화면에서 돌아왔을 때 서는 자리.
 *
 * 예전에는 호출부에서 `FOREST_Y + 80` 처럼 즉석에서 더했고, 숲의 결과는 수풀 한가운데라
 * **벽 안에서 시작**했다. 좌표를 표로 옮긴 김에 여기서 못 박는다.
 */
for (const spot of CAMP_INTERACTIONS) {
  test(`${spot.id} 에서 돌아온 자리가 벽 안이 아니다`, () => {
    const by = bodyYFromSpriteY(spot.returnAt.y);
    assert.equal(
      hitsWall(spot.returnAt.x, by), false,
      `${spot.id} 의 returnAt(${spot.returnAt.x}, ${spot.returnAt.y}) 이 벽 안이다`,
    );
    const ok = reached.some((p) => Math.hypot(p.x - spot.returnAt.x, p.y - by) <= STEP * 1.5);
    assert.ok(ok, `${spot.id} 의 returnAt 에서 걸어 나올 수 없다`);
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
  { label: "서쪽 숲 안",    x: 60,   y: 1000 },
  { label: "우물 안",       x: 300,  y: 1600 },
  { label: "남서 건물 지붕", x: 300, y: 2100 },
  { label: "동쪽 건물 안",  x: 1350, y: 1550 },
  { label: "동쪽 지붕",     x: 1400, y: 900 },
  { label: "노점 좌판",     x: 1000, y: 1550 },
  // 숲 가장자리(y 2430)까지는 들어간다. 나무 밑동을 넘어서면 안 된다.
  { label: "남동 숲 속",    x: 1300, y: 2500 },
];

for (const spot of MUST_NOT_REACH) {
  test(`${spot.label} 안으로는 들어갈 수 없다`, () => {
    const near = reached.filter((p) => Math.hypot(p.x - spot.x, p.y - spot.y) <= STEP);
    assert.equal(near.length, 0, `${spot.label}(${spot.x}, ${spot.y}) 안에 설 수 있다`);
  });
}

/**
 * 테두리가 닫혀 있는지를 한 번에 본다.
 *
 * 위의 좌표 검사는 "그 자리"만 본다. 정작 무서운 건 줄과 줄 사이에 난 몇 px 짜리 틈이다 —
 * 한 곳만 새도 도달 영역이 지도 전체로 번지므로, 광장을 감싸는 상자를 벗어나면 잡힌다.
 */
test("걸어 닿는 곳이 광장 밖으로 번지지 않는다", () => {
  const BOUNDS = { minX: 120, maxX: 1520, minY: 900, maxY: 2720 };
  const out = reached.filter(
    (p) => p.x < BOUNDS.minX || p.x > BOUNDS.maxX || p.y < BOUNDS.minY || p.y > BOUNDS.maxY,
  );
  assert.equal(
    out.length, 0,
    `테두리에 틈이 있다 — ${out.slice(0, 5).map((p) => `(${p.x}, ${p.y})`).join(" ")}`,
  );
});

test("발끝이 바디 중심보다 아래에 있다", () => {
  assert.ok(footYFromSpriteY(0) > bodyYFromSpriteY(0), "depth 기준(발끝)이 바디 중심보다 위에 있다");
});
