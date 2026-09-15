import test from "node:test";
import assert from "node:assert/strict";
import {
  dirFromVector, DIRS_8,
  PLAYER_SHEET_METRICS, PLAYER_SHEET_FRAMES, spriteOriginY,
  type MonsterSheetDir,
} from "../src/shared/playerSprite.ts";
// @ts-expect-error — 순수 자바스크립트 도구라 타입 선언이 없다
import { measureSheet, SHEETS } from "../scripts/measure-player-sheets.mjs";

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

// ── 시트 치수 ─────────────────────────────────────────────────────────────────

/**
 * 표가 원본 PNG 와 맞는지 다시 잰다.
 *
 * 원화를 갈아끼우면 칸 크기도 발 높이도 조용히 달라진다. 표만 그대로면 캐릭터가
 * 공중에 뜨고, Phaser 쪽에서는 물리 바디가 방향을 바꿀 때마다 순간이동한다 —
 * 어느 쪽도 오류를 안 내고 그림에서만 보인다. 그래서 여기서 매번 다시 잰다.
 * 어긋나면 `node scripts/measure-player-sheets.mjs` 가 찍어 주는 표로 갈아라.
 */
test("PLAYER_SHEET_METRICS 가 원본 시트와 맞는다", async () => {
  for (const [dir, file] of SHEETS as Array<[MonsterSheetDir, string]>) {
    const m = await measureSheet(file);
    const table = PLAYER_SHEET_METRICS[dir];
    assert.equal(m.frameWidth, table.frameWidth, `${dir} 한 칸 폭`);
    assert.equal(m.frameHeight, table.frameHeight, `${dir} 한 칸 높이`);
    assert.equal(m.bottoms[0], table.footY, `${dir} 발이 닿는 줄`);
    assert.equal(m.bottoms.length, PLAYER_SHEET_FRAMES, `${dir} 칸 수`);
  }
});

/** 어느 방향을 보든 발은 같은 자리에 와야 한다. 여기가 어긋나면 돌 때 위아래로 튄다. */
test("방향이 달라도 발이 같은 자리에 온다", () => {
  const footFromOrigin = (dir: MonsterSheetDir) => {
    const m = PLAYER_SHEET_METRICS[dir];
    return m.footY - spriteOriginY(dir) * m.frameHeight;
  };
  const dirs = Object.keys(PLAYER_SHEET_METRICS) as MonsterSheetDir[];
  for (const dir of dirs) {
    assert.ok(
      Math.abs(footFromOrigin(dir) - footFromOrigin("south")) < 0.5,
      `${dir}: ${footFromOrigin(dir)} ≠ ${footFromOrigin("south")}`,
    );
  }
  // 정면은 손대지 않은 기준이라 정확히 한가운데여야 한다
  assert.equal(spriteOriginY("south"), 0.5);
});
