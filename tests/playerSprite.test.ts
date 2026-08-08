import test from "node:test";
import assert from "node:assert/strict";
import { dirFromVector, getPlayerFrame, DIRS_8, DIR8_TO_DIR4 } from "../src/shared/playerSprite.ts";

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

test("getPlayerFrame: 4방향 에셋만 있어도 8방향 요청이 깨지지 않는다", () => {
  for (const dir of DIRS_8) {
    const f = getPlayerFrame(dir, 0);
    assert.match(f.source, /^\/assets\/player\/player-(up|down|left|right)\.png$/);
    assert.equal(f.flipX, false, "4방향 폴백에서는 반전을 쓰지 않는다");
  }
});

test("getPlayerFrame: 걷기 프레임은 1과 2를 순환한다", () => {
  const frames = [1, 2, 3, 4, 5].map((n) => getPlayerFrame("S", n).source);
  assert.deepEqual(frames, [
    "/assets/player/player-down-1.png",
    "/assets/player/player-down-2.png",
    "/assets/player/player-down-1.png",
    "/assets/player/player-down-2.png",
    "/assets/player/player-down-1.png",
  ]);
});

test("DIR8_TO_DIR4: 8방향이 빠짐없이 매핑돼 있다", () => {
  for (const dir of DIRS_8) {
    assert.ok(DIR8_TO_DIR4[dir], `${dir} 매핑 없음`);
  }
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
