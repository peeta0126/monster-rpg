import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  dirFromVector, getPlayerFrame, atlasFrameCell, resolveDir,
  DIRS_8, PLAYER_ATLAS_ROW_DIRS, PLAYER_WALK_FRAMES, PLAYER_FRAME_SIZE,
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

/**
 * 원래 규칙은 "서쪽 셋(NW·W·SW)만 반전" 이었다. 지금은 SE 가 그 자리에 끼어 있고
 * SW 가 빠져 있는데, 오타가 아니라 **아틀라스의 SE 줄이 좌우 반대로 그려져 있어서**다.
 *
 * 확인한 방법: E 줄은 짐이 몸 왼쪽에 있다(= 오른쪽을 본다). 그런데 SE 줄은 짐이
 * 오른쪽에 있어서 왼쪽을 보고 있다 — 즉 그려진 건 SE 가 아니라 SW 다. 그래서
 * SE 를 그릴 때 뒤집고, SW 는 원본을 그대로 쓴다.
 *
 * 아틀라스를 다시 구워 SE 줄을 뒤집으면 이 예외가 사라지고 규칙이 "서쪽 셋만 반전"
 * 으로 돌아간다. 그때는 이 테스트도 같이 되돌릴 것.
 */
test("반전 목록은 아틀라스에 없는 방향 + 반대로 그려진 SE", () => {
  const flipped = DIRS_8.filter((d) => getPlayerFrame(d, 0).flipX);
  assert.deepEqual([...flipped], ["SE", "NW", "W"]);

  // 자기 줄이 없는 방향은 반드시 어딘가를 빌려 쓴다
  for (const dir of DIRS_8) {
    if (PLAYER_ATLAS_ROW_DIRS.includes(dir)) continue;
    const cell = atlasFrameCell(getPlayerFrame(dir, 0).source);
    assert.ok(cell.row >= 0, `${dir} 가 빌릴 줄이 없다`);
  }
  // SW 만 예외적으로 원본을 그대로 쓴다. 나머지 서쪽 둘은 뒤집는다
  assert.equal(getPlayerFrame("SW", 0).flipX, false);
  assert.equal(getPlayerFrame("W", 0).flipX, true);
  assert.equal(getPlayerFrame("NW", 0).flipX, true);
});

test("getPlayerFrame: 걷기 프레임은 네 장을 순환한다", () => {
  const frames = [1, 2, 3, 4, 5, 6].map((n) => getPlayerFrame("S", n).source);
  assert.deepEqual(frames, [
    "walk_S_00", "walk_S_01", "walk_S_02", "walk_S_03", "walk_S_00", "walk_S_01",
  ]);
});

test("왼쪽 방향은 오른쪽 줄을 빌려 쓴다", () => {
  // 아래쪽 대각선 둘은 같은 SE 줄을 쓰되 반전이 서로 반대다. SE 줄이 반대로
  // 그려져 있어서 그렇다(위 테스트 주석 참고)
  assert.deepEqual(getPlayerFrame("SW", 2), { source: "walk_SE_01", flipX: false });
  assert.deepEqual(getPlayerFrame("SE", 2), { source: "walk_SE_01", flipX: true });

  assert.deepEqual(getPlayerFrame("W", 0), { source: "idle_E", flipX: true });
  assert.deepEqual(getPlayerFrame("NW", 0), { source: "idle_NE", flipX: true });
});

test("atlasFrameCell: 이름에서 격자 칸이 나온다", () => {
  assert.deepEqual(atlasFrameCell("idle_S"), { col: 0, row: 0 });
  assert.deepEqual(atlasFrameCell("walk_S_00"), { col: 1, row: 0 });
  assert.deepEqual(atlasFrameCell("walk_N_03"), { col: PLAYER_WALK_FRAMES, row: 4 });
  assert.throws(() => atlasFrameCell("player-down.png"), /아틀라스 프레임 이름이 아니다/);
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
 * 이름이 하나만 어긋나도 Phaser 는 조용히 빈 프레임을 그린다. 화면에서는
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
