#!/usr/bin/env node
/**
 * 베이스캠프 지형 충돌을 배경 전경 레이어에서 뽑아낸다.
 *
 *   node scripts/gen-camp-collision.mjs
 *   → src/camp/campGroundMask.ts
 *
 * 베이스캠프 배경은 두 장이다. `basecamp-bg`(depth 0)가 장면 전체고,
 * `basecamp-bg-1`(depth 3000)은 **바닥만 도려낸 같은 그림**이라 플레이어 위에 덮인다.
 * 그래서 플레이어가 나무·처마·아치 쪽으로 들어가면 그 뒤로 가려진다 — 위를 지나가는 게
 * 아니라 안으로 들어가는 것처럼 보인다. 이 연출이 성립하는 범위를 손으로 적으면 반드시
 * 어긋나므로, 전경 레이어의 알파를 그대로 읽어 만든다.
 *
 *   투명(alpha ≤ 16) = 바닥. 여기서는 플레이어가 배경 위에 그려진다.
 *   불투명                = 전경. 여기로 들어가면 가려진다.
 *
 * 바닥을 TUCK px 만큼 부풀린 것이 걸어 다닐 수 있는 범위다. 딱 바닥 경계에서 멈추면
 * 나무 앞에서 벽에 부딪힌 것처럼 뚝 서고, 가려지는 연출이 아예 나오지 않는다.
 *
 * ⚠️ 이 파일이 만드는 건 "지형"뿐이다. 바닥 구멍 안에 있는 소품(작업대·화단·좌판
 *    바구니·통나무)은 전경이 아니라 배경 레이어에 있어서 플레이어가 그 위에 그려진다.
 *    그건 알파로 알 수 없으므로 campCollision.ts 의 CAMP_PROP_BOXES 가 손으로 덮는다.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "public/assets/basecamp/basecamp-bg-1.webp");
const OUT = path.join(ROOT, "src/camp/campGroundMask.ts");

/** 알파 임계값. WebP 는 완전 투명이 0 으로 안 나올 수 있어 여유를 둔다. */
const ALPHA_CUTOFF = 16;

/**
 * 바닥 밖으로 얼마나 더 들어갈 수 있는가(px). 가로·세로가 다르다.
 *
 * 스프라이트가 92×160 이라 방향에 따라 가려지는 양이 딴판이다.
 *
 *   옆에서 수풀로 들어가면  보이는 폭 = 46 − TUCK.x   (반너비 46)
 *   위로 나무 밑에 들어가면 보이는 높이 = TUCK.y + 15 (발밑 바디 반높이 15)
 *
 * 같은 값을 쓰면 한쪽이 반드시 어긋난다. 40 등방으로 해 봤더니 서쪽 수풀에서 몸이
 * 통째로 가려 안 보였고, 24 로 줄이니 이번엔 숲 입구가 사거리 밖으로 밀려났다.
 * 가로는 좁게, 세로는 넓게 — 어느 쪽으로 들어가도 몸의 3할쯤은 남는다.
 */
const TUCK = { x: 22, y: 46 };

/** 사각형 격자 크기(px). 작을수록 그림에 붙지만 바디 수가 는다. */
const CELL = 16;

/** 바닥이 이어져 있는지 판정할 시작점 — 씬의 기본 스폰(발밑 기준) */
const SEED = { x: 794, y: 1280 };

const buf = fs.readFileSync(SRC);
const sha = crypto.createHash("sha256").update(buf).digest("hex");
const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;

// ── 1. 투명한 곳 = 바닥 ───────────────────────────────────────────────────────
const hole = new Uint8Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += C) hole[i] = data[p + 3] <= ALPHA_CUTOFF ? 1 : 0;

// ── 2. 스폰과 이어진 덩어리만 ─────────────────────────────────────────────────
// 창문 유리처럼 바닥이 아닌 투명 영역이 섞여 있다. 그런 곳까지 걸을 수 있게 두면
// 지도 반대편에 닿을 수 없는 섬이 생긴다.
const ground = new Uint8Array(W * H);
{
  const seed = SEED.y * W + SEED.x;
  if (!hole[seed]) throw new Error(`시작점 (${SEED.x}, ${SEED.y}) 이 바닥이 아니다`);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  ground[seed] = 1;
  queue[tail++] = seed;
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    if (x > 0        && hole[i - 1] && !ground[i - 1]) { ground[i - 1] = 1; queue[tail++] = i - 1; }
    if (x < W - 1    && hole[i + 1] && !ground[i + 1]) { ground[i + 1] = 1; queue[tail++] = i + 1; }
    if (y > 0        && hole[i - W] && !ground[i - W]) { ground[i - W] = 1; queue[tail++] = i - W; }
    if (y < H - 1    && hole[i + W] && !ground[i + W]) { ground[i + W] = 1; queue[tail++] = i + W; }
  }
}

// ── 3. TUCK 만큼 부풀리기 ─────────────────────────────────────────────────────
// 가로/세로 반경이 다르므로 1차원 팽창을 두 번 건다(분리 가능한 사각 구조 요소).
// 결과는 "바닥에서 x 로 TUCK.x, y 로 TUCK.y 안쪽까지"가 열린 영역이다.
const walkable = (() => {
  const rowPass = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    // 각 행에서 마지막으로 바닥이었던 x 까지의 거리를 좌/우 두 번 훑는다
    let last = -1 << 20;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ground[i]) last = x;
      if (x - last <= TUCK.x) rowPass[i] = 1;
    }
    last = 1 << 20;
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (ground[i]) last = x;
      if (last - x <= TUCK.x) rowPass[i] = 1;
    }
  }
  const out = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -1 << 20;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (rowPass[i]) last = y;
      if (y - last <= TUCK.y) out[i] = 1;
    }
    last = 1 << 20;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (rowPass[i]) last = y;
      if (last - y <= TUCK.y) out[i] = 1;
    }
  }
  return out;
})();

// ── 4. 격자로 내리고 사각형으로 병합 ──────────────────────────────────────────
// 걸을 수 있는 픽셀이 한 점이라도 있으면 열린 칸으로 친다. 애매하면 열어 두는 쪽이
// 맞다 — 막아 두면 "들어갈 수 있어 보이는데 안 들어가지는" 자리가 생긴다.
const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
const blocked = new Uint8Array(cols * rows);
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    let open = false;
    for (let y = cy * CELL; y < Math.min((cy + 1) * CELL, H) && !open; y += 2) {
      for (let x = cx * CELL; x < Math.min((cx + 1) * CELL, W); x += 2) {
        if (walkable[y * W + x]) { open = true; break; }
      }
    }
    blocked[cy * cols + cx] = open ? 0 : 1;
  }
}

// 탐욕적 병합: 가로로 최대한 늘린 뒤 같은 폭이 이어지는 만큼 아래로 늘린다
const used = new Uint8Array(cols * rows);
const rects = [];
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const at = cy * cols + cx;
    if (!blocked[at] || used[at]) continue;
    let x2 = cx;
    while (x2 + 1 < cols && blocked[cy * cols + x2 + 1] && !used[cy * cols + x2 + 1]) x2++;
    let y2 = cy;
    grow: while (y2 + 1 < rows) {
      for (let x = cx; x <= x2; x++) {
        if (!blocked[(y2 + 1) * cols + x] || used[(y2 + 1) * cols + x]) break grow;
      }
      y2++;
    }
    for (let y = cy; y <= y2; y++) for (let x = cx; x <= x2; x++) used[y * cols + x] = 1;
    rects.push({
      x: cx * CELL,
      y: cy * CELL,
      w: Math.min((x2 + 1) * CELL, W) - cx * CELL,
      h: Math.min((y2 + 1) * CELL, H) - cy * CELL,
    });
  }
}

// ── 5. 쓰기 ───────────────────────────────────────────────────────────────────
const body = rects
  .map((r) => `  { x: ${String(r.x).padStart(4)}, y: ${String(r.y).padStart(4)}, ` +
              `w: ${String(r.w).padStart(4)}, h: ${String(r.h).padStart(4)} },`)
  .join("\n");

fs.writeFileSync(OUT, `// 자동 생성 — 손으로 고치지 말 것. \`node scripts/gen-camp-collision.mjs\`
//
// basecamp-bg-1.webp(전경 레이어)의 알파에서 뽑은 지형 충돌이다. 투명한 곳이 바닥이고,
// 거기서 가로 ${TUCK.x}px · 세로 ${TUCK.y}px 까지는 더 들어갈 수 있다 — 그만큼 전경에 가려서 "안으로 들어가는" 연출이 된다.
// 왜 이렇게 하는지는 scripts/gen-camp-collision.mjs 주석 참고.
//
// 소품(작업대·화단·좌판)은 여기 없다. 그건 배경 레이어라 알파로 안 잡힌다 —
// campCollision.ts 의 CAMP_PROP_BOXES 가 덮는다.

/** 생성에 쓴 원본. 배경을 갈면 이 값이 달라지고 tests/campCollision.test.ts 가 잡는다. */
export const GROUND_MASK_SOURCE = {
  file: "public/assets/basecamp/basecamp-bg-1.webp",
  sha256: "${sha}",
  alphaCutoff: ${ALPHA_CUTOFF},
  tuck: { x: ${TUCK.x}, y: ${TUCK.y} },
  cell: ${CELL},
} as const;

/** 지형 충돌 사각형 (왼쪽 위 모서리 기준, 원본 ${W}×${H} px) */
export const CAMP_GROUND_RECTS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = [
${body}
];
`);

const openCells = blocked.length - blocked.reduce((a, b) => a + b, 0);
console.log(`${SRC.replace(ROOT + path.sep, "")} → ${OUT.replace(ROOT + path.sep, "")}`);
console.log(`  바닥 ${ground.reduce((a, b) => a + b, 0).toLocaleString()}px · tuck ${TUCK.x}/${TUCK.y}px · 격자 ${CELL}px`);
console.log(`  열린 칸 ${openCells}/${blocked.length} · 사각형 ${rects.length}개`);
