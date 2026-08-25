import { test } from "node:test";
import assert from "node:assert/strict";
import { containRect, cameraRect } from "../src/shared/ui/stageRect";

const GAME_VIEW = { width: 960, height: 540 };
/** 베이스캠프 맵(1536x2730)에 카메라 줌 0.5 를 먹인 크기 */
const CAMP_DRAWN = { width: 768, height: 1365 };
const WORKSHOP_RATIO = 2400 / 1792;

test("containRect: 창이 그림보다 납작하면 좌우가 남는다", () => {
  const r = containRect(1920, 1080, WORKSHOP_RATIO);
  assert.equal(Math.round(r.height), 1080);
  assert.equal(Math.round(r.width), 1446);
  assert.equal(Math.round(r.top), 0);
  assert.equal(Math.round(r.left), 237);
});

test("containRect: 창이 그림보다 길쭉하면 위아래가 남는다", () => {
  const r = containRect(768, 1024, WORKSHOP_RATIO);
  assert.equal(Math.round(r.width), 768);
  assert.equal(Math.round(r.height), 573);
  assert.equal(Math.round(r.left), 0);
  assert.equal(Math.round(r.top), 225);
});

test("cameraRect: 캔버스 띠와 카메라 여백을 둘 다 걷어낸다", () => {
  // 1440x900 → FIT 1.5배. 캔버스는 1440x810(위아래 45), 맵은 그 안에서 1152 폭.
  const r = cameraRect(1440, 900, GAME_VIEW, CAMP_DRAWN);
  assert.deepEqual(r, { left: 144, top: 45, width: 1152, height: 810 });
});

test("cameraRect: 맵이 세로로 길면 높이는 캔버스가 정한다", () => {
  const r = cameraRect(1920, 1080, GAME_VIEW, CAMP_DRAWN);
  assert.equal(r.height, 1080);          // 1365 가 아니라 캔버스 540 × 2배
  assert.equal(r.width, 1536);           // 768 × 2배
  assert.equal(r.top, 0);
  assert.equal(r.left, 192);
});

test("두 함수 모두 가운데 놓는다 — 남는 자리가 양쪽에 똑같이 간다", () => {
  for (const r of [
    containRect(1280, 720, WORKSHOP_RATIO),
    cameraRect(1280, 720, GAME_VIEW, CAMP_DRAWN),
  ]) {
    assert.equal(r.left, 1280 - r.width - r.left);
    assert.equal(r.top, 720 - r.height - r.top);
  }
});
