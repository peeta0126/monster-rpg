import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  dirFromVector, getPlayerFrame, atlasFrameCell, resolveDir,
  DIRS_8, DIR8_TO_DIR4, PLAYER_ATLAS_ROW_DIRS, PLAYER_WALK_FRAMES, PLAYER_FRAME_SIZE,
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

test("getPlayerFrame: 8방향 전부 아틀라스에 있는 프레임으로 떨어진다", () => {
  for (const dir of DIRS_8) {
    const f = getPlayerFrame(dir, 0);
    const cell = atlasFrameCell(f.source);
    assert.equal(cell.col, 0, `${dir} 정지는 첫 칸`);
    assert.ok(cell.row >= 0 && cell.row < PLAYER_ATLAS_ROW_DIRS.length, `${dir} 줄 번호`);
  }
});

test("getPlayerFrame: 서쪽 셋만 반전으로 만든다", () => {
  const flipped = DIRS_8.filter((d) => getPlayerFrame(d, 0).flipX);
  assert.deepEqual([...flipped], ["NW", "W", "SW"]);
  // 반전해서 쓰는 방향은 아틀라스에 자기 줄이 없다
  for (const dir of flipped) assert.equal(PLAYER_ATLAS_ROW_DIRS.includes(dir), false);
});

test("getPlayerFrame: 걷기 프레임은 네 장을 순환한다", () => {
  const frames = [1, 2, 3, 4, 5, 6].map((n) => getPlayerFrame("S", n).source);
  assert.deepEqual(frames, [
    "walk_S_00", "walk_S_01", "walk_S_02", "walk_S_03", "walk_S_00", "walk_S_01",
  ]);
});

test("getPlayerFrame: 왼쪽 대각선은 오른쪽 프레임을 뒤집어 쓴다", () => {
  const sw = getPlayerFrame("SW", 2);
  assert.deepEqual(sw, { source: "walk_SE_01", flipX: true });
  assert.deepEqual(getPlayerFrame("W", 0), { source: "idle_E", flipX: true });
});

test("atlasFrameCell: 이름에서 격자 칸이 나온다", () => {
  assert.deepEqual(atlasFrameCell("idle_S"), { col: 0, row: 0 });
  assert.deepEqual(atlasFrameCell("walk_S_00"), { col: 1, row: 0 });
  assert.deepEqual(atlasFrameCell("walk_N_03"), { col: PLAYER_WALK_FRAMES, row: 4 });
  assert.throws(() => atlasFrameCell("/assets/player/player-down.png"));
  assert.throws(() => atlasFrameCell("idle_SW"), /아틀라스에 없는 방향/);
});

test("resolveDir: 반전 규칙이 getPlayerFrame 과 같다", () => {
  for (const dir of DIRS_8) {
    assert.equal(resolveDir(dir).flipX, getPlayerFrame(dir, 0).flipX, dir);
  }
});

/**
 * 코드가 부르는 이름이 아틀라스에 실제로 있는지 본다.
 *
 * 이름이 하나만 어긋나도 Phaser 는 조용히 빈 프레임을 그린다 — 화면에서는
 * 캐릭터가 사라진 것처럼 보이는데 오류는 안 난다.
 */
test("아틀라스에 코드가 부르는 프레임이 전부 있다", () => {
  const atlas = JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, "../public/assets/player/player.json"), "utf8"),
  ) as { frames: Array<{ filename: string; frame: { w: number; h: number } }> };
  const names = new Set(atlas.frames.map((f) => f.filename));

  for (const dir of DIRS_8) {
    for (let frame = 0; frame <= PLAYER_WALK_FRAMES; frame++) {
      const { source } = getPlayerFrame(dir, frame);
      assert.ok(names.has(source), `${source} 없음`);
    }
  }
  for (const f of atlas.frames) {
    assert.equal(f.frame.w, PLAYER_FRAME_SIZE, `${f.filename} 폭`);
    assert.equal(f.frame.h, PLAYER_FRAME_SIZE, `${f.filename} 높이`);
  }
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
