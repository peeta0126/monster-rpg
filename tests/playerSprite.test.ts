import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import {
  dirFromVector, monsterDirection, getMonsterFrame, DIRS_8,
  PLAYER_SHEET_PATHS, PLAYER_SHEET_FRAMES, PLAYER_MONSTER_WALK_FRAMES,
  PLAYER_FRAME_WIDTH, PLAYER_FRAME_HEIGHT,
  PLAYER_NORTHEAST_FRAME_WIDTH, PLAYER_NORTHEAST_FRAME_HEIGHT,
} from "../src/shared/playerSprite.ts";

test("dirFromVector: 축 방향 4개", () => {
  assert.equal(dirFromVector(0, 1), "S");    // 화면 좌표라 +y가 아래(남)
  assert.equal(dirFromVector(1, 0), "E");
  assert.equal(dirFromVector(0, -1), "N");
  assert.equal(dirFromVector(-1, 0), "W");
});

test("dirFromVector: 대각선 4개", () => {
  assert.equal(dirFromVector(1, 1), "SE");
  assert.equal(dirFromVector(1, -1), "NE");
  assert.equal(dirFromVector(-1, -1), "NW");
  assert.equal(dirFromVector(-1, 1), "SW");
});

test("dirFromVector: 버킷 경계는 22.5도마다 넘어간다", () => {
  const deg = (d: number) => {
    const r = ((90 - d) * Math.PI) / 180;   // 남쪽에서 시계 방향으로 d도
    return dirFromVector(Math.cos(r), Math.sin(r));
  };
  assert.equal(deg(0), "S");
  assert.equal(deg(22), "S");
  assert.equal(deg(23), "SE");   // 22.5도 직후
  assert.equal(deg(45), "SE");
  assert.equal(deg(67), "SE");
  assert.equal(deg(68), "E");
});

test("dirFromVector: 정지 상태는 정면", () => {
  assert.equal(dirFromVector(0, 0), "S");
});

test("dirFromVector: 크기와 무관하게 방향만 본다", () => {
  assert.equal(dirFromVector(100, 0), dirFromVector(0.01, 0));
});

test("dirFromVector: 8방향 전부 자기 자신으로 되돌아온다", () => {
  DIRS_8.forEach((dir, i) => {
    const rad = ((90 - i * 45) * Math.PI) / 180;
    assert.equal(dirFromVector(Math.cos(rad), Math.sin(rad)), dir);
  });
});

test("monsterDirection: 왼쪽 셋만 반전으로 만든다", () => {
  const flipped = DIRS_8.filter((d) => monsterDirection(d).flipX);
  assert.deepEqual([...flipped], ["NW", "W", "SW"]);
});

test("getMonsterFrame: 정지는 0번, 걷기는 다섯 장을 순환한다", () => {
  assert.deepEqual(getMonsterFrame("S", 0), { source: "south", frame: 0, flipX: false });
  const frames = [1, 2, 3, 4, 5, 6, 7].map((n) => getMonsterFrame("S", n).frame);
  assert.deepEqual(frames, [1, 2, 3, 4, 5, 1, 2]);
});

test("getMonsterFrame: 왼쪽은 오른쪽 시트를 뒤집어 쓴다", () => {
  assert.deepEqual(getMonsterFrame("W", 2), { source: "east", frame: 2, flipX: true });
  assert.deepEqual(getMonsterFrame("E", 2), { source: "east", frame: 2, flipX: false });
});

test("뒤집어 쓰는 방향은 자기 시트가 없다", () => {
  const sheets = new Set(Object.keys(PLAYER_SHEET_PATHS));
  for (const dir of DIRS_8) {
    const { direction, flipX } = monsterDirection(dir);
    assert.ok(sheets.has(direction), `${dir} -> ${direction} 시트 없음`);
    // 뒤집는다는 건 그 방향의 원화가 없다는 뜻이다. 뒤집힌 결과는 반대쪽 시트여야 한다.
    if (flipX) assert.notEqual(direction.toUpperCase(), dir);
  }
});

/**
 * 시트 폭이 칸 폭의 정수배인지 실제 파일에서 잰다.
 *
 * Phaser 는 남는 픽셀을 조용히 버린다. 남쪽 시트가 2170px 이라 362 로 나누면 다섯
 * 칸밖에 안 나왔고, 걷기 애니메이션이 마지막 프레임을 잃은 채 돌고 있었다. 콘솔에
 * 경고 한 줄이 뜰 뿐이라 화면만 봐서는 "남쪽만 걸음이 어색하다"로 보인다.
 *
 * 칸 폭이 정수가 아닌 것도 같이 막는다. 경계가 픽셀 사이에 떨어지면 옆 칸 한 줄이
 * 딸려 나온다(북동이 2048/6 = 341.33 이었다).
 */
test("시트 여섯 칸이 폭에 정확히 들어간다", async () => {
  for (const [direction, url] of Object.entries(PLAYER_SHEET_PATHS)) {
    const isNortheast = direction === "northeast";
    const cellW = isNortheast ? PLAYER_NORTHEAST_FRAME_WIDTH : PLAYER_FRAME_WIDTH;
    const cellH = isNortheast ? PLAYER_NORTHEAST_FRAME_HEIGHT : PLAYER_FRAME_HEIGHT;
    assert.equal(Number.isInteger(cellW), true, `${direction} 칸 폭이 정수가 아니다`);

    const file = path.resolve(import.meta.dirname, "../public", url.slice(1));
    const { width, height } = await sharp(file).metadata();
    assert.equal(width, cellW * PLAYER_SHEET_FRAMES, `${direction} 시트 폭`);
    assert.equal(height, cellH, `${direction} 시트 높이`);
  }
});

/** 걷기가 부르는 마지막 칸이 시트 안에 있어야 한다. */
test("걷기가 쓰는 칸 번호가 시트 안에 있다", () => {
  assert.ok(
    PLAYER_MONSTER_WALK_FRAMES < PLAYER_SHEET_FRAMES,
    `걷기가 ${PLAYER_MONSTER_WALK_FRAMES}번 칸을 부르는데 시트에는 ${PLAYER_SHEET_FRAMES}칸뿐이다`,
  );
});

// ── 문서(ART_DIRECTION 3-3)와 구현이 어긋나지 않게 잡아두는 테스트 ──────────────

/** 문서에 적힌 공식. 구현과 같은 결과가 나와야 한다. */
function dirFromVectorAsDocumented(dx: number, dy: number) {
  const DIRS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] as const;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const idx = Math.round(((90 - deg + 360) % 360) / 45) % 8;
  return DIRS[idx];
}

/** 예전에 문서에 적혀 있던 틀린 공식. 무엇이 왜 틀리는지 남겨둔다. */
function dirFromVectorBuggy(dx: number, dy: number) {
  const DIRS = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"] as const;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const idx = Math.round(((deg + 90 + 360) % 360) / 45) % 8;
  return DIRS[idx];
}

const CASES: [number, number, string][] = [
  [0, 1, "S"], [1, 1, "SE"], [1, 0, "E"], [1, -1, "NE"],
  [0, -1, "N"], [-1, -1, "NW"], [-1, 0, "W"], [-1, 1, "SW"],
];

test("8방향 전부 명시적으로 검증", () => {
  for (const [dx, dy, expected] of CASES) {
    assert.equal(dirFromVector(dx, dy), expected, `(${dx},${dy})`);
  }
});

test("문서 코드와 구현이 같은 결과를 낸다", () => {
  for (let deg = 0; deg < 360; deg += 3) {
    const r = (deg * Math.PI) / 180;
    const [dx, dy] = [Math.cos(r), Math.sin(r)];
    assert.equal(dirFromVector(dx, dy), dirFromVectorAsDocumented(dx, dy), `${deg}도`);
  }
});

test("부호를 뒤집은 공식은 E/W 만 맞고 6방향이 틀린다", () => {
  const wrong = CASES.filter(([dx, dy, exp]) => dirFromVectorBuggy(dx, dy) !== exp);
  assert.deepEqual(wrong.map(([, , exp]) => exp), ["S", "SE", "NE", "N", "NW", "SW"]);
});
