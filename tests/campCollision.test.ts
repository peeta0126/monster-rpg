import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import {
  CAMP_COLLISION_BOXES, CAMP_MAP_W, CAMP_MAP_H, CAMP_INTERACTIONS,
  bodyYFromSpriteY, footYFromSpriteY, hitsWall, reachableCells,
} from "../src/camp/campCollision";
import { getCampPosition } from "../src/camp/campPositionStore";
import { GROUND_MASK_SOURCE } from "../src/camp/campGroundMask";

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

/**
 * 배경이 두 장이라 생기는 연출 — 전경 레이어(basecamp-bg-1) 쪽으로 걸어 들어가면
 * 플레이어가 그 뒤로 가려진다. 이미지 위를 지나가는 게 아니라 안으로 들어가는 것처럼
 * 보이는 자리다. 예전에는 여기를 통째로 막아 놔서 나무 앞에서 벽처럼 멈췄다.
 *
 * 아래 좌표는 전부 전경이 덮고 있는 곳이고, 전부 걸어 들어갈 수 있어야 한다.
 * 각 자리의 가시성은 34~68% 로 재서 골랐다 — 몸이 반쯤 가려지되 사라지지는 않는,
 * 이 연출이 성립하는 구간이다. 기준을 조이다 여기가 막히면 연출이 없어진 것이다.
 */
const MUST_REACH_BEHIND = [
  { label: "탑 아치 밑",     x:  280, y:  780 },
  { label: "남쪽 아치 밑",   x:  780, y: 2240 },
  { label: "아치 오른쪽 수풀", x: 1040, y: 2280 },
  { label: "숲 가장자리",    x: 1120, y: 2120 },
  { label: "벚나무 아래",    x: 1220, y: 1980 },
  { label: "서쪽 수풀 가",   x:  240, y: 1260 },
  { label: "우물 처마",      x:  320, y: 1380 },
];

for (const spot of MUST_REACH_BEHIND) {
  test(`${spot.label} 뒤로 걸어 들어갈 수 있다`, () => {
    const ok = reached.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) <= STEP * 1.5);
    assert.ok(ok, `${spot.label}(${spot.x}, ${spot.y}) 앞에서 막힌다 — 가려지는 연출이 안 나온다`);
  });
}

/**
 * 이 파일에서 제일 중요한 검사다.
 *
 * "여기는 들어갈 수 있다 / 없다"만 보다가 놓친 게 있었다 — **들어갈 수는 있는데
 * 들어가면 몸이 화면에서 사라지는 자리.** 우물 앞 돌턱에서 가시성이 0% 였고, 닿는
 * 칸의 4%가 10% 미만이었는데 테스트 35개가 전부 통과했다. 눈으로도 안 잡힌다 —
 * 캡처는 배경 위에 상자를 그릴 뿐 플레이어를 세워 보지 않기 때문이다.
 *
 * 그래서 실제로 세워 본다. 전경 레이어 알파와 스프라이트를 겹쳐 보이는 픽셀을 센다.
 * 아치 밑처럼 **지나가는** 자리는 생성기가 TUNNELS 로 빼 두고 여기서도 뺀다.
 */
test("걸어 닿는 어느 칸에서도 플레이어가 사라지지 않는다", async () => {
  const { display, bodyToSpriteY } = GROUND_MASK_SOURCE.sprite;
  const root = path.resolve(import.meta.dirname, "..");

  const fg = await sharp(path.join(root, GROUND_MASK_SOURCE.file))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = fg.info;

  const pl = await sharp(path.join(root, "public/assets/player/player-down.png"))
    .resize(display, display, { kernel: "nearest" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const half = display / 2;
  const opaque: Array<[number, number]> = [];
  for (let y = 0; y < display; y++) {
    for (let x = 0; x < display; x++) {
      // 스프라이트 좌표 → 발밑 바디 중심 기준 상대 좌표
      if (pl.data[(y * display + x) * pl.info.channels + 3] > 32) {
        opaque.push([x - half, y - half - bodyToSpriteY]);
      }
    }
  }

  const inTunnel = (x: number, y: number) =>
    GROUND_MASK_SOURCE.tunnels.some(
      (t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h,
    );

  /**
   * 이만큼은 보여야 한다.
   *
   * 생성기의 바닥 기준선(15%)보다 일부러 낮게 잡았다. 생성기는 픽셀 단위로 자르지만
   * 열림/막힘은 16px 칸 단위라, 칸 안에 한 점만 통과해도 그 칸이 열린다 — 몇 %p 는
   * 반올림으로 빠질 수 있다. 그 여유보다 낮게 두면 여기서 걸리는 건 반올림이 아니라
   * 진짜 구멍(소품 박스가 빠졌거나 TUNNELS 가 너무 넓거나)이다.
   */
  const MIN = 0.12;

  let worst = { x: 0, y: 0, ratio: 1 };
  for (const p of reached) {
    if (inTunnel(p.x, p.y)) continue;
    let visible = 0, total = 0;
    for (const [dx, dy] of opaque) {
      const x = p.x + dx, y = p.y + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      total++;
      if (fg.data[(y * W + x) * C + 3] <= GROUND_MASK_SOURCE.alphaCutoff) visible++;
    }
    const ratio = total ? visible / total : 1;
    if (ratio < worst.ratio) worst = { x: p.x, y: p.y, ratio };
  }

  assert.ok(
    worst.ratio >= MIN,
    `(${worst.x}, ${worst.y}) 에서 플레이어가 ${(worst.ratio * 100).toFixed(0)}% 밖에 안 보인다. ` +
    "지나가는 자리라면 gen-camp-collision.mjs 의 TUNNELS 에, 아니면 형상을 고칠 것",
  );
});

/** 생성기는 TS 를 못 읽어 이 값을 상수로 적어 둔다. 어긋나면 마스크 전체가 밀린다. */
test("생성기가 쓴 스프라이트 규격이 씬과 같다", () => {
  assert.equal(GROUND_MASK_SOURCE.sprite.bodyToSpriteY, bodyYFromSpriteY(0));
  assert.equal(footYFromSpriteY(0) > bodyYFromSpriteY(0), true, "발끝이 바디 중심보다 아래여야 한다");
});

/**
 * 지형 마스크는 배경 그림에서 뽑은 값이라, 배경을 갈면 다시 만들어야 한다.
 * 그냥 두면 새 그림 위에서 옛 형상으로 걸어 다니게 된다.
 */
test("지형 마스크가 지금 배경에서 나온 것이다", () => {
  const src = path.resolve(import.meta.dirname, "..", GROUND_MASK_SOURCE.file);
  const sha = crypto.createHash("sha256").update(fs.readFileSync(src)).digest("hex");
  assert.equal(
    sha, GROUND_MASK_SOURCE.sha256,
    "배경 전경 레이어가 바뀌었다. `node scripts/gen-camp-collision.mjs` 를 다시 돌릴 것",
  );
});
