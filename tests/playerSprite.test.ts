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
