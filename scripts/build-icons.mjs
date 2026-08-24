#!/usr/bin/env node
/**
 * 아이템 아이콘 굽기. art-src/icons/*.png → public/assets/icons/*.webp (64x64)
 *
 *   npm run build:icons              변환
 *   npm run build:icons -- --sheet   확인용 시트도 같이 (design/screenshots/icons-sheet.png)
 *
 * 입력과 출력을 갈라놓은 이유는 scripts/optimize-assets.mjs 머리말에 적힌 것과 같다.
 * public/ 은 산출물만 나가는 곳이고, 원본은 art-src/ 에 있다. 몇 번을 돌려도 결과가 같다.
 *
 * ── 왜 아이콘마다 여백을 따로 자르지 않는가 ──────────────────────────────────
 * 21장은 한 세트로 그려졌고 크기 차이가 의도다. 열매는 작고 나무판자는 크다. 각자를
 * 제 경계까지 잘라 채우면 열매가 판자만큼 커진다. 그래서 21장의 경계를 합집합으로
 * 묶어 그 한 틀로 전부 자른다. 세트가 공유하는 죽은 여백(32칸 중 양옆 3칸)만 사라지고
 * 서로의 크기 관계는 그대로 남는다.
 *
 * ── 왜 논리 격자로 한 번 내려찍는가 ──────────────────────────────────────────
 * 원본은 32x32 픽셀아트를 16배로 키운 512x512 다. 512 에서 바로 줄이면 나누어떨어지지
 * 않아 칸 폭이 들쭉날쭉해진다. 먼저 칸 중심을 찍어 32x32 로 되돌린 뒤 정수배(2배)로만
 * 키운다. 안티에일리어싱으로 흐려진 테두리도 이때 같이 정리된다.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC_DIR = path.join(ROOT, "art-src", "icons");
const OUT_DIR = path.join(ROOT, "public", "assets", "icons");
const MANIFEST = path.join(ROOT, "src", "shared", "ui", "rasterIcons.ts");
const SHEET = path.join(ROOT, "design", "screenshots", "icons-sheet.png");

const CANVAS = 64;
/** 가장자리 여백. 정수배 확대만 쓰므로 실제 여백은 여기서 조금 더 커질 수 있다. */
const MARGIN_RATIO = 0.06;

const WANT_SHEET = process.argv.includes("--sheet");

// ─── 원본 읽기 ────────────────────────────────────────────────────────────────

/** 흰색으로 볼 문턱. 픽셀아트 하이라이트가 순백일 수 있어 넉넉하게 잡지 않는다. */
const WHITE = 244;

async function readRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/**
 * 흰 배경을 투명으로. 테두리에서 이어진 흰색만 지운다.
 * 아이콘 안쪽 하이라이트까지 지우면 그림이 뚫린다.
 * 이어서 경계에 남는 흰 프린지를 흰색 기준으로 되풀어(unpremultiply) 걷어낸다.
 */
function stripWhiteBackground({ data, w, h }) {
  const isWhite = (i) => data[i + 3] > 8
    && data[i] >= WHITE && data[i + 1] >= WHITE && data[i + 2] >= WHITE;

  // 테두리가 대부분 불투명한 흰색일 때만 손댄다. 이미 투명이면 배경이 없는 것이다.
  let border = 0, borderWhite = 0;
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) {
    border++; if (isWhite((y * w + x) * 4)) borderWhite++;
  }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) {
    border++; if (isWhite((y * w + x) * 4)) borderWhite++;
  }
  if (borderWhite / border < 0.9) return false;

  // 테두리에서 흰색을 따라 번져 나간다.
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p] || !isWhite(p * 4)) return;
    seen[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  for (let p = 0; p < w * h; p++) if (seen[p]) data[p * 4 + 3] = 0;

  // 프린지: 지워진 칸에 붙어 있으면서 밝게 뜬 칸의 알파를 흰색 기준으로 되풀어 준다.
  const near = (x, y) => x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    if (seen[p] || data[i + 3] === 0) continue;
    if (!(near(x + 1, y) || near(x - 1, y) || near(x, y + 1) || near(x, y - 1))) continue;
    const lum = Math.max(data[i], data[i + 1], data[i + 2]);
    if (lum < WHITE - 24) continue;
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const a = Math.round(255 - min);                       // 흰색이 섞인 만큼을 덜어낸다
    if (a <= 0) { data[i + 3] = 0; continue; }
    for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, (data[i + c] - (255 - a)) * 255 / a));
    data[i + 3] = Math.min(data[i + 3], a);
  }
  return true;
}

/**
 * 원본이 논리 픽셀 몇 배로 커져 있는지 찾는다. 후보(큰 것부터) 중, 칸 안이 칸 중심색과
 * 거의 다 같은 가장 큰 배율을 쓴다. 튄 픽셀 몇 개는 무시한다.
 */
function detectScale({ data, w, h }) {
  const at = (x, y) => (y * w + x) * 4;
  const same = (i, j) => Math.abs(data[i + 3] - data[j + 3]) < 24
    && (data[i + 3] < 24 || (Math.abs(data[i] - data[j]) < 24
      && Math.abs(data[i + 1] - data[j + 1]) < 24 && Math.abs(data[i + 2] - data[j + 2]) < 24));

  for (let b = 32; b >= 2; b >>= 1) {
    if (w % b || h % b) continue;
    let total = 0, ok = 0;
    for (let gy = 0; gy < h / b; gy++) for (let gx = 0; gx < w / b; gx++) {
      const c = at(gx * b + (b >> 1), gy * b + (b >> 1));
      for (let y = gy * b; y < (gy + 1) * b; y++) for (let x = gx * b; x < (gx + 1) * b; x++) {
        total++; if (same(at(x, y), c)) ok++;
      }
    }
    if (ok / total > 0.995) return b;
  }
  return 1;
}

/** 칸 중심을 찍어 논리 격자로 되돌린다. 흐려진 테두리는 여기서 정리된다. */
function toLogicalGrid({ data, w, h }, b) {
  const gw = w / b, gh = h / b;
  const out = Buffer.alloc(gw * gh * 4);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const s = ((gy * b + (b >> 1)) * w + gx * b + (b >> 1)) * 4;
    data.copy(out, (gy * gw + gx) * 4, s, s + 4);
  }
  return { data: out, w: gw, h: gh };
}

function bounds({ data, w, h }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] <= 8) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

// ─── 굽기 ─────────────────────────────────────────────────────────────────────

async function main() {
  let names;
  try {
    names = (await fs.readdir(SRC_DIR)).filter((f) => /\.(png|webp|jpe?g)$/i.test(f)).sort();
  } catch {
    console.error(`[icons] art-src/icons/ 가 없다. 원본을 거기 두고 다시 부를 것.`);
    process.exit(1);
  }
  if (!names.length) { console.error("[icons] art-src/icons/ 가 비어 있다."); process.exit(1); }

  const grids = [];
  for (const name of names) {
    const id = name.replace(/\.[^.]+$/, "");
    const img = await readRgba(path.join(SRC_DIR, name));
    const stripped = stripWhiteBackground(img);
    const scale = detectScale(img);
    const grid = scale > 1 ? toLogicalGrid(img, scale) : img;
    grids.push({ id, grid, scale, stripped, src: img });
  }

  // 격자 크기가 섞이면 한 틀로 자를 수 없다. 조용히 뭉개는 대신 죽는다.
  const sizes = new Set(grids.map((g) => `${g.grid.w}x${g.grid.h}`));
  if (sizes.size > 1) {
    throw new Error(`논리 격자 크기가 섞여 있다: ${[...sizes].join(", ")} — 원본을 맞출 것`);
  }

  // 21장의 경계 합집합 = 세트가 공유하는 틀
  let X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
  for (const g of grids) {
    const b = bounds(g.grid);
    if (b.x1 < 0) throw new Error(`${g.id}: 그림이 비어 있다`);
    X0 = Math.min(X0, b.x0); Y0 = Math.min(Y0, b.y0);
    X1 = Math.max(X1, b.x1); Y1 = Math.max(Y1, b.y1);
  }
  const frame = Math.max(X1 - X0 + 1, Y1 - Y0 + 1);
  const inner = CANVAS - 2 * Math.round(CANVAS * MARGIN_RATIO);
  const zoom = Math.max(1, Math.floor(inner / frame));
  const drawn = frame * zoom;
  const pad = Math.floor((CANVAS - drawn) / 2);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const tiles = [];
  for (const { id, grid } of grids) {
    // 합집합 틀을 격자 가운데에 맞춰 잘라낸다(가로·세로 같은 정사각 틀).
    const left = Math.round((grid.w - frame) / 2), top = Math.round((grid.h - frame) / 2);
    const buf = await sharp(grid.data, { raw: { width: grid.w, height: grid.h, channels: 4 } })
      .extract({ left, top, width: frame, height: frame })
      .resize(drawn, drawn, { kernel: "nearest" })
      .extend({
        top: pad, bottom: CANVAS - drawn - pad, left: pad, right: CANVAS - drawn - pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ lossless: true, effort: 6 })          // 픽셀아트는 손실 압축이 테두리를 흘린다
      .toBuffer();
    await fs.writeFile(path.join(OUT_DIR, `${id}.webp`), buf);
    tiles.push({ id, buf });
  }

  const ids = tiles.map((t) => t.id);
  await fs.writeFile(MANIFEST,
    `/**\n` +
    ` * 생성물 — scripts/build-icons.mjs 가 art-src/icons/ 를 보고 쓴다. 손으로 고치지 말 것.\n` +
    ` *\n` +
    ` * 그림 파일이 있는 아이콘만 여기 적힌다. 여기 없는 이름은 SVG 로 그려진다\n` +
    ` * (상태이상·메뉴·공방 탭). 이 표가 없으면 화면마다 없는 파일을 먼저 요청해\n` +
    ` * 404 를 깔고 나서야 폴백으로 떨어진다.\n` +
    ` */\n` +
    `export const RASTER_ICON_IDS = new Set([\n` +
    ids.map((id) => `  "${id}",`).join("\n") + `\n]);\n`,
    "utf8");

  if (WANT_SHEET) await writeSheet(tiles);

  const cleaned = grids.filter((g) => g.stripped).map((g) => g.id);
  console.log(`[icons] ${ids.length}장 — 논리격자 ${grids[0].grid.w}x${grids[0].grid.h}, ` +
    `틀 ${frame}칸 ×${zoom} → ${drawn}px, 여백 ${pad}px (${Math.round(pad / CANVAS * 100)}%)`);
  console.log(`[icons] 흰 배경 제거: ${cleaned.length ? cleaned.join(", ") : "해당 없음(전부 이미 투명)"}`);
  console.log(`[icons] → public/assets/icons/  평균 ${Math.round(
    tiles.reduce((s, t) => s + t.buf.length, 0) / tiles.length)}B`);
}

/** 21장을 나란히 붙인 확인용 시트. 배경을 체커로 깔아 투명 여부가 눈에 보이게 한다. */
async function writeSheet(tiles) {
  const COLS = 7, CELL = 128, LABEL = 22;
  const rows = Math.ceil(tiles.length / COLS);
  const W = COLS * CELL, H = rows * (CELL + LABEL);

  const checker = Buffer.alloc(16 * 16 * 3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = (x < 8) === (y < 8) ? 90 : 60;
    checker.fill(v, (y * 16 + x) * 3, (y * 16 + x) * 3 + 3);
  }
  const bg = await sharp(checker, { raw: { width: 16, height: 16, channels: 3 } })
    .resize(W, H, { kernel: "nearest" }).png().toBuffer();

  const layers = [];
  for (const [i, t] of tiles.entries()) {
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * (CELL + LABEL);
    layers.push({
      input: await sharp(t.buf).resize(CANVAS * 2, CANVAS * 2, { kernel: "nearest" }).png().toBuffer(),
      left: cx, top: cy,
    });
    layers.push({
      input: Buffer.from(
        `<svg width="${CELL}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="${CELL / 2}" y="15" font-family="monospace" font-size="11" fill="#fff" ` +
        `text-anchor="middle">${t.id}</text></svg>`),
      left: cx, top: cy + CELL,
    });
  }
  await fs.mkdir(path.dirname(SHEET), { recursive: true });
  await sharp(bg).composite(layers).png().toFile(SHEET);
  console.log(`[icons] 확인용 시트 → design/screenshots/icons-sheet.png`);
}

main().catch((e) => { console.error("[icons] 실패:", e.message); process.exit(1); });
