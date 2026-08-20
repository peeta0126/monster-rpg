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
 * 딱 바닥 경계에서 멈추면 나무 앞에서 벽에 부딪힌 것처럼 뚝 서고, 가려지는 연출이
 * 아예 나오지 않는다. 그래서 바닥 밖으로 한 걸음 더 열어 준다 — 어디까지 열지는
 * 거리가 아니라 **몸이 얼마나 남아 보이는지**로 정한다(VISIBILITY_MIN).
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
 * 바닥 밖으로 나갈 수 있는 최대 거리(px). 여기까지가 후보고, 실제로 열리는지는
 * 아래 가시성 기준이 정한다.
 *
 * 예전에는 이 값이 곧 답이었다(가로 22 · 세로 46 등방). 그런데 세로 대칭이 틀렸다 —
 * 아래쪽 물체로 들어가면 다리만 가리지만, 위쪽 나무·벽으로 들어가면 그 물체가 발끝
 * 위 145px 을 통째로 덮는다. 같은 46 을 위아래에 쓴 결과 우물 앞 돌턱에서 플레이어가
 * **100% 사라졌다**(닿는 칸의 4%가 10% 미만으로 가려져 있었다).
 */
const MAX_TUCK = { x: 30, y: 60 };

/**
 * 뒤로 들어간 자리에서 플레이어가 최소한 이만큼은 보여야 한다(스프라이트 불투명
 * 픽셀 기준).
 *
 * 고정 거리 대신 이걸 재는 이유: "얼마나 들어갈 수 있는가"는 원래 거리가 아니라
 * **얼마나 남아 보이는가**의 문제였다. 물체 높이가 자리마다 다르니 거리로는 표현이
 * 안 된다. 나무 밑은 조금만 들어가도 몸이 없어지고, 낮은 수풀은 깊이 들어가도 멀쩡하다.
 */
const VISIBILITY_MIN = 0.35;

/**
 * 진짜 바닥에서도 이만큼은 보여야 한다.
 *
 * 바닥은 원칙적으로 다 열어 준다 — 길 위로 가지가 드리운 자리까지 막으면 길이 끊긴다.
 * 다만 원화의 바닥 구멍이 벽 밑동보다 살짝 높게 잘린 데가 있어서(우물 앞 돌턱),
 * 거기 서면 벽이 몸을 통째로 덮었다. 바닥이든 아니든 "화면에서 사라지는 자리"는
 * 없어야 한다는 최소선이다. 지나가는 자리는 TUNNELS 로 뺀다.
 */
const GROUND_VISIBILITY_MIN = 0.15;

/**
 * 전경 밑을 **지나가는** 통로. 여기서는 가시성 기준을 건너뛴다.
 *
 * 아치는 길을 가로질러 놓여 있어서 알파에서도 바닥이 통째로 끊긴다. 잠깐 가려지는
 * 건 아치를 통과하는 연출이라 맞는데, 가시성으로 자르면 길 자체가 막힌다 —
 * "뒤로 들어가 서 있는 자리"와 "밑으로 지나가는 자리"는 다른 것이다.
 *
 * 자동으로 가릴 방법이 없어 여기 적는다. 빠뜨리면 아래 연결성 검사가 생성 단계에서
 * 죽으므로 조용히 막히는 일은 없다.
 */
const TUNNELS = [
  // 통로 폭만. 넓게 잡으면 아치 기둥 속까지 열려 거기서 몸이 사라진다.
  { id: "south-arch", x: 640, y: 2112, w: 240, h: 192 },
];

/** 사각형 격자 크기(px). 작을수록 그림에 붙지만 바디 수가 는다. */
const CELL = 16;

/** 바닥이 이어져 있는지 판정할 시작점 — 씬의 기본 스폰(발밑 기준) */
const SEED = { x: 794, y: 1280 };

/**
 * 가시성을 잴 때 세우는 스프라이트. 씬이 쓰는 것과 같은 크기여야 한다.
 * 정면 정지 프레임을 아틀라스에서 떼어 쓴다.
 */
const PLAYER_ATLAS = path.join(ROOT, "public/assets/player/player.png");
const PLAYER_ATLAS_JSON = path.join(ROOT, "public/assets/player/player.json");
const PLAYER_IDLE_FRAME = "idle_S";

/**
 * 씬이 쓰는 스프라이트 규격. 여기는 TS 를 못 읽는 독립 스크립트라 값을 적어 두고,
 * campCollision.ts 와 어긋나면 tests/campCollision.test.ts 가 잡는다.
 */
const PLAYER_FRAME = 80;     // playerSprite.ts PLAYER_FRAME_SIZE
const PLAYER_SCALE = 2;      // campCollision.ts PLAYER_SCALE
const PLAYER_BODY_H = 30;    // campCollision.ts PLAYER_BODY.h
const PLAYER_FOOT_INSET = 2; // playerSprite.ts PLAYER_FOOT_INSET

const PLAYER_DISPLAY = PLAYER_FRAME * PLAYER_SCALE;

/** 스프라이트 중심 → 발밑 바디 중심의 y 차이(px). campCollision 의 bodyYFromSpriteY(0). */
const BODY_TO_SPRITE_Y =
  (PLAYER_DISPLAY - PLAYER_BODY_H) / 2 - PLAYER_FOOT_INSET * PLAYER_SCALE;

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

// ── 3. 바닥 밖 후보 만들기 ────────────────────────────────────────────────────
// 가로/세로 반경이 다르므로 1차원 팽창을 두 번 건다(분리 가능한 사각 구조 요소).
const candidate = (() => {
  const rowPass = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    // 각 행에서 마지막으로 바닥이었던 x 까지의 거리를 좌/우 두 번 훑는다
    let last = -1 << 20;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ground[i]) last = x;
      if (x - last <= MAX_TUCK.x) rowPass[i] = 1;
    }
    last = 1 << 20;
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (ground[i]) last = x;
      if (last - x <= MAX_TUCK.x) rowPass[i] = 1;
    }
  }
  const out = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -1 << 20;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (rowPass[i]) last = y;
      if (y - last <= MAX_TUCK.y) out[i] = 1;
    }
    last = 1 << 20;
    for (let y = H - 1; y >= 0; y--) {
      const i = y * W + x;
      if (rowPass[i]) last = y;
      if (last - y <= MAX_TUCK.y) out[i] = 1;
    }
  }
  return out;
})();

// ── 4. 가시성으로 후보 거르기 ─────────────────────────────────────────────────
// 바닥 밖 한 걸음은 "전경 뒤로 들어가는" 자리다. 얼마나 들어갈 수 있는지는 거리가
// 아니라 **몸이 얼마나 남아 보이는지**로 정해야 한다. 물체 높이가 자리마다 달라서
// 거리로는 표현이 안 된다 — 예전 고정 46px 이 우물 앞에서 몸을 통째로 지웠다.
//
// 스프라이트 불투명 픽셀을 행별 구간으로 쪼개 두고, 전경 불투명 픽셀의 적분 이미지로
// 한 자리당 구간 수만큼만 조회한다. 픽셀마다 스프라이트를 겹쳐 세는 것보다 수백 배 빠르다.
const spriteRuns = await (async () => {
  const atlas = JSON.parse(fs.readFileSync(PLAYER_ATLAS_JSON, "utf8"));
  const cell = atlas.frames.find((f) => f.filename === PLAYER_IDLE_FRAME);
  if (!cell) throw new Error(`아틀라스에 ${PLAYER_IDLE_FRAME} 이 없다`);
  const { data, info } = await sharp(PLAYER_ATLAS)
    .extract({ left: cell.frame.x, top: cell.frame.y, width: cell.frame.w, height: cell.frame.h })
    .resize(PLAYER_DISPLAY, PLAYER_DISPLAY, { kernel: "nearest" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const S = info.width, ch = info.channels, half = S / 2;
  const runs = [];
  let total = 0;
  for (let y = 0; y < S; y++) {
    let start = -1;
    for (let x = 0; x <= S; x++) {
      const on = x < S && data[(y * S + x) * ch + 3] > 32;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        // 발밑 바디 중심 기준 상대 좌표로 저장한다
        runs.push({ dy: y - half - BODY_TO_SPRITE_Y, x0: start - half, x1: x - 1 - half });
        total += x - start;
        start = -1;
      }
    }
  }
  return { runs, total };
})();

// 전경 불투명 픽셀의 적분 이미지 (경계 밖은 가려지지 않은 것으로 친다)
const integral = new Int32Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) {
  let rowSum = 0;
  for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > ALPHA_CUTOFF) rowSum++;
    integral[(y + 1) * (W + 1) + x + 1] = integral[y * (W + 1) + x + 1] + rowSum;
  }
}
/** [x0, x1] × 한 행의 전경 불투명 픽셀 수 */
function opaqueInRow(y, x0, x1) {
  if (y < 0 || y >= H) return 0;
  const a = Math.max(0, x0), b = Math.min(W - 1, x1);
  if (b < a) return 0;
  const r0 = y * (W + 1), r1 = (y + 1) * (W + 1);
  return integral[r1 + b + 1] - integral[r1 + a] - integral[r0 + b + 1] + integral[r0 + a];
}

/** 발밑 바디 중심이 (x, y) 일 때 스프라이트가 전경 밖으로 보이는 비율 */
function visibleRatio(x, y) {
  let hidden = 0;
  for (const r of spriteRuns.runs) hidden += opaqueInRow(y + r.dy, x + r.x0, x + r.x1);
  return 1 - hidden / spriteRuns.total;
}

const inTunnel = (x, y) =>
  TUNNELS.some((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);

const walkable = new Uint8Array(W * H);
let trimmed = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!candidate[i]) continue;
    if (inTunnel(x, y)) { walkable[i] = 1; continue; }
    // 바닥은 거의 다 열어 준다. 기준선이 다른 이유는 위 상수 주석 참고.
    const need = ground[i] ? GROUND_VISIBILITY_MIN : VISIBILITY_MIN;
    if (visibleRatio(x, y) >= need) walkable[i] = 1;
    else trimmed++;
  }
}

// ── 5. 격자로 내리고 사각형으로 병합 ──────────────────────────────────────────
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

// ── 6. 연결성 검사 ───────────────────────────────────────────────────────────
// 가시성으로 자르다 보면 좁은 길이 조용히 막힌다. 실제로 남쪽 아치가 그랬다 —
// 아치 석조가 알파에서 길을 가로질러 끊어 놓아서, 옆으로 새던 35px 짜리 틈까지
// 잘리자 통로가 없어졌다. 그런 건 캡처를 볼 때가 아니라 여기서 죽어야 한다.
//
// 소품 박스(CAMP_PROP_BOXES)는 여기 안 들어간다. 그건 씬 쪽 값이라 tests/campCollision.test.ts
// 가 둘을 합쳐 다시 본다. 여기서 보는 건 지형만으로 길이 이어지는가다.
{
  const HALF_W = 30, HALF_H = 15;   // campCollision.ts 의 PLAYER_BODY 절반
  const STEP = 8;
  const fits = (x, y) => {
    if (x - HALF_W < 0 || x + HALF_W >= W || y - HALF_H < 0 || y + HALF_H >= H) return false;
    for (let cy = ((y - HALF_H) / CELL) | 0; cy <= ((y + HALF_H) / CELL) | 0; cy++)
      for (let cx = ((x - HALF_W) / CELL) | 0; cx <= ((x + HALF_W) / CELL) | 0; cx++)
        if (blocked[cy * cols + cx]) return false;
    return true;
  };
  const key = (x, y) => y * W + x;
  const seen = new Set([key(SEED.x, SEED.y)]);
  const queue = [[SEED.x, SEED.y]];
  if (!fits(SEED.x, SEED.y)) throw new Error(`스폰 (${SEED.x}, ${SEED.y}) 에 플레이어가 못 선다`);
  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(key(nx, ny)) || !fits(nx, ny)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  /** 여기까지는 걸어갈 수 있어야 한다(발밑 바디 좌표). 못 가면 길이 막힌 것이다. */
  const REQUIRED = [
    { id: "탑 아치",     x:  285, y:  900 },
    { id: "우물 앞",     x:  300, y: 1750 },
    { id: "노점 앞",     x:  980, y: 1850 },
    // 숲 입구는 수풀 가장자리까지다. 안쪽은 캐노피라 설 자리가 아니다.
    { id: "숲 앞",       x: 1180, y: 2030 },
    { id: "남쪽 아치 밑", x:  760, y: 2200 },
    { id: "남쪽 끝",     x:  760, y: 2650 },
  ];
  const lost = REQUIRED.filter(
    (r) => ![...seen].some((k) => Math.hypot((k % W) - r.x, ((k / W) | 0) - r.y) <= 40),
  );
  if (lost.length) {
    throw new Error(
      `스폰에서 못 가는 곳이 생겼다: ${lost.map((l) => `${l.id}(${l.x}, ${l.y})`).join(", ")}\n` +
      "  가시성 기준이 좁은 길을 잘랐을 수 있다. 지나가는 자리라면 TUNNELS 에 적을 것.",
    );
  }
  console.log(`  연결성 OK · 걸어 닿는 자리 ${seen.size.toLocaleString()}개(${STEP}px 격자)`);
}

// ── 7. 쓰기 ───────────────────────────────────────────────────────────────────
const body = rects
  .map((r) => `  { x: ${String(r.x).padStart(4)}, y: ${String(r.y).padStart(4)}, ` +
              `w: ${String(r.w).padStart(4)}, h: ${String(r.h).padStart(4)} },`)
  .join("\n");

fs.writeFileSync(OUT, `// 자동 생성 — 손으로 고치지 말 것. \`node scripts/gen-camp-collision.mjs\`
//
// basecamp-bg-1.webp(전경 레이어)의 알파에서 뽑은 지형 충돌이다. 투명한 곳이 바닥이고,
// 바깥으로는 최대 가로 ${MAX_TUCK.x}px · 세로 ${MAX_TUCK.y}px 까지 후보로 두되, 그 자리에 섰을 때 스프라이트가
// ${(VISIBILITY_MIN * 100).toFixed(0)}% 이상 보이는 칸만 연다 — 그만큼만 전경 뒤로 "들어가 보이는" 연출이 된다.
// 왜 거리가 아니라 가시성인지는 scripts/gen-camp-collision.mjs 주석 참고.
//
// 소품(작업대·화단·좌판)은 여기 없다. 그건 배경 레이어라 알파로 안 잡힌다 —
// campCollision.ts 의 CAMP_PROP_BOXES 가 덮는다.

/** 생성에 쓴 원본. 배경을 갈면 이 값이 달라지고 tests/campCollision.test.ts 가 잡는다. */
export const GROUND_MASK_SOURCE = {
  file: "public/assets/basecamp/basecamp-bg-1.webp",
  sha256: "${sha}",
  alphaCutoff: ${ALPHA_CUTOFF},
  maxTuck: { x: ${MAX_TUCK.x}, y: ${MAX_TUCK.y} },
  visibilityMin: ${VISIBILITY_MIN},
  groundVisibilityMin: ${GROUND_VISIBILITY_MIN},
  /** 가시성을 잴 때 쓴 스프라이트 규격. campCollision 의 값과 어긋나면 테스트가 잡는다. */
  sprite: { display: ${PLAYER_DISPLAY}, bodyToSpriteY: ${BODY_TO_SPRITE_Y} },
  cell: ${CELL},
  /** 가시성 기준을 건너뛴 구역(전경 밑을 지나가는 통로). 회귀 테스트가 여기만 빼고 본다. */
  tunnels: ${JSON.stringify(TUNNELS)},
} as const;

/** 지형 충돌 사각형 (왼쪽 위 모서리 기준, 원본 ${W}×${H} px) */
export const CAMP_GROUND_RECTS: ReadonlyArray<{ x: number; y: number; w: number; h: number }> = [
${body}
];
`);

const openCells = blocked.length - blocked.reduce((a, b) => a + b, 0);
console.log(`${SRC.replace(ROOT + path.sep, "")} → ${OUT.replace(ROOT + path.sep, "")}`);
console.log(`  바닥 ${ground.reduce((a, b) => a + b, 0).toLocaleString()}px · 격자 ${CELL}px`);
console.log(`  바깥 후보 최대 ${MAX_TUCK.x}/${MAX_TUCK.y}px · 가시성 ${(VISIBILITY_MIN * 100) | 0}% 미만이라 잘라낸 픽셀 ${trimmed.toLocaleString()}개`);
console.log(`  열린 칸 ${openCells}/${blocked.length} · 사각형 ${rects.length}개`);
