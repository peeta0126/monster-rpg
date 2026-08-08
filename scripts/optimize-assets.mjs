#!/usr/bin/env node
/**
 * public/ 에셋 최적화.
 *
 *   node scripts/optimize-assets.mjs           변환 + 원본 PNG 정리
 *   node scripts/optimize-assets.mjs --dry     무엇을 할지만 출력
 *   node scripts/optimize-assets.mjs --keep    원본 PNG 를 지우지 않음
 *
 * 두 갈래로 나눠 처리한다.
 *  - 일러스트/배경  → WebP q82. 크고 부드러운 그림이라 손실 압축이 가장 잘 듣는다.
 *  - 픽셀아트 스프라이트 → PNG-8(팔레트). WebP 로 바꾸면 용량 이득이 거의 없고
 *    색이 미묘하게 흔들려 픽셀아트가 상한다.
 *
 * ⚠️ 픽셀아트를 리사이즈할 때는 반드시 kernel: "nearest". 기본 lanczos 는 픽셀을 뭉갠다.
 * ⚠️ 업스케일은 하지 않는다. 몬스터는 512 보다 작으면 그대로 둔다.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const DRY  = process.argv.includes("--dry");
const KEEP = process.argv.includes("--keep");

/** 일러스트/배경 — WebP 로 바꾸고 원본 PNG 는 지운다 */
const ART = [
  "assets/basecamp/basecamp-bg.png",
  "assets/basecamp/basecamp-bg-1.png",
  "assets/player/Orion_portrait.png",
  "assets/player/Baros_portrait.png",
];

/**
 * 흐리게 깔아 쓰는 배경의 저해상도 사본.
 * GameBackground / ForestBackground 는 blur(10~14px) + brightness(0.3) 으로 뭉개서 쓴다.
 * 원본 517KB 를 받을 이유가 없다 — 가로 640px 이면 블러 후 구분이 안 된다.
 */
const BLURRED_COPIES = [
  { src: "assets/basecamp/basecamp-bg.png", out: "assets/basecamp/basecamp-bg-blur.webp", width: 640 },
];

/**
 * 키아트 — WebP 를 만들되 PNG 폴백을 남긴다(단, 절반 해상도로 줄여서).
 * ART 에 넣으면 안 된다. 그쪽은 변환 후 원본 PNG 를 지우므로 폴백이 사라진다.
 *
 * pixel: true 면 축소에 kernel "nearest" 를 쓴다. 기본 lanczos 는 픽셀을 뭉갠다.
 * quality 를 적으면 WebP 품질을 개별 지정한다(기본 82).
 */
const KEY_ART = [
  { src: "start-loading.png", fallbackWidth: 1312 },
  { src: "assets/housing/housing_bg.png", fallbackWidth: 1200, pixel: true, quality: 85 },
];

const MONSTER_DIR = "assets/monsters";
const MONSTER_MAX = 512;

/** 픽셀아트 — PNG-8 로 다시 인코딩. 크기는 건드리지 않는다 */
const PIXEL_DIRS = ["assets/player"];

const bytes = (n) => `${(n / 1048576).toFixed(2)}MB`;
const rows = [];
let before = 0, after = 0;

async function sizeOf(p) {
  try { return (await fs.stat(p)).size; } catch { return 0; }
}

async function record(label, srcPath, outPath) {
  const b = await sizeOf(srcPath);
  const a = await sizeOf(outPath);
  before += b; after += a;
  rows.push([label, b, a]);
}

async function toWebp(rel, { width } = {}) {
  const src = path.join(PUBLIC, rel);
  const out = src.replace(/\.png$/i, ".webp");
  if (DRY) { console.log(`webp  ${rel}`); return; }
  // 이 함수는 변환 후 원본 PNG 를 지운다. 그래서 두 번째 실행부터는 입력이 없는 게
  // 정상인데, 예전엔 그대로 예외를 던져 첫 항목에서 스크립트 전체가 죽었다.
  if (!(await sizeOf(src))) { console.log(`[optimize] ${rel} 없음 (변환 완료) — 건너뜁니다`); return; }
  let img = sharp(src);
  if (width) img = img.resize({ width, withoutEnlargement: true });
  await img.webp({ quality: 82, effort: 6 }).toFile(out);
  await record(rel, src, out);
  if (!KEEP) await fs.rm(src);
}

async function toPng8(abs) {
  if (DRY) { console.log(`png8  ${path.relative(PUBLIC, abs)}`); return; }
  const b = await sizeOf(abs);
  const buf = await sharp(abs).png({ palette: true, compressionLevel: 9, effort: 10 }).toBuffer();
  // 팔레트화가 오히려 커지는 경우가 있다(이미 최적화된 작은 스프라이트). 그럴 땐 원본 유지.
  if (buf.length < b) await fs.writeFile(abs, buf);
  before += b; after += Math.min(b, buf.length);
  rows.push([path.relative(PUBLIC, abs), b, Math.min(b, buf.length)]);
}

async function optimizeMonsters() {
  const dir = path.join(PUBLIC, MONSTER_DIR);
  for (const name of (await fs.readdir(dir)).filter((f) => f.endsWith(".png"))) {
    const src = path.join(dir, name);
    const out = src.replace(/\.png$/i, ".webp");
    const meta = await sharp(src).metadata();
    // 512 보다 작으면 그대로. 업스케일은 사람이 Upscayl 로 따로 처리한다.
    const resize = (meta.width ?? 0) > MONSTER_MAX || (meta.height ?? 0) > MONSTER_MAX;
    if (DRY) { console.log(`webp  ${MONSTER_DIR}/${name}${resize ? ` (${meta.width}→${MONSTER_MAX})` : ""}`); continue; }
    let img = sharp(src);
    if (resize) img = img.resize(MONSTER_MAX, MONSTER_MAX, { fit: "inside", withoutEnlargement: true });
    await img.webp({ quality: 82, effort: 6 }).toFile(out);
    await record(`${MONSTER_DIR}/${name}`, src, out);
    if (!KEEP) await fs.rm(src);
  }
}

async function optimizePixelArt() {
  for (const rel of PIXEL_DIRS) {
    const dir = path.join(PUBLIC, rel);
    for (const name of (await fs.readdir(dir)).filter((f) => f.endsWith(".png"))) {
      // 초상화는 픽셀아트가 아니라 위에서 WebP 로 이미 처리했다
      if (name.includes("portrait")) continue;
      await toPng8(path.join(dir, name));
    }
  }
}

async function main() {
  for (const rel of ART) await toWebp(rel);

  // 키아트만 PNG 폴백을 남긴다 (WebP 미지원 브라우저용). 원본 해상도는 과하니 절반으로.
  //
  // ⚠️ 이 단계는 원본 PNG 를 폴백으로 덮어쓴다. 그래서 두 번째 실행부터는 입력이 이미
  //    절반 크기다 — 그대로 두면 WebP 까지 절반 해상도로 다시 구워 원본이 소리 없이
  //    깎인다. 폭이 폴백 크기 이하면 이미 처리된 것으로 보고 건너뛴다.
  for (const art of KEY_ART) {
    const src = path.join(PUBLIC, art.src);
    const out = src.replace(/\.png$/i, ".webp");
    if (DRY) {
      console.log(`webp  ${art.src} (+ ${art.fallbackWidth}px PNG 폴백${art.pixel ? ", nearest" : ""})`);
      continue;
    }
    const b = await sizeOf(src);
    if (!b) { console.warn(`[optimize] ${art.src} 없음 — 건너뜁니다`); continue; }
    const { width } = await sharp(src).metadata();
    if (width <= art.fallbackWidth) {
      console.log(`[optimize] ${art.src} 는 이미 폴백(${width}px) — 건너뜁니다`);
      continue;
    }
    await sharp(src).webp({ quality: art.quality ?? 82, effort: 6 }).toFile(out);
    const fallback = await sharp(src)
      .resize({ width: art.fallbackWidth, withoutEnlargement: true, ...(art.pixel ? { kernel: "nearest" } : {}) })
      .png({ compressionLevel: 9 }).toBuffer();
    await fs.writeFile(src, fallback);
    const a = (await sizeOf(out)) + (await sizeOf(src));
    before += b; after += a;
    rows.push([`${art.src} (webp + png 폴백)`, b, a]);
  }

  // 흐린 배경용 축소본. 원본(webp)이 이미 만들어진 뒤라 그걸 입력으로 쓴다.
  for (const c of BLURRED_COPIES) {
    const src = path.join(PUBLIC, c.src.replace(/\.png$/i, ".webp"));
    const out = path.join(PUBLIC, c.out);
    if (DRY) { console.log(`blur  ${c.out} (${c.width}px)`); continue; }
    try {
      await sharp(src).resize({ width: c.width }).webp({ quality: 78, effort: 6 }).toFile(out);
      after += await sizeOf(out);
      rows.push([c.out, 0, await sizeOf(out)]);
    } catch {
      console.warn(`[optimize] ${c.src} 원본이 없어 흐린 사본을 건너뜁니다`);
    }
  }

  await optimizeMonsters();
  await optimizePixelArt();

  if (DRY) return;

  rows.sort((x, y) => (y[1] - y[2]) - (x[1] - x[2]));
  const w = Math.max(...rows.map((r) => r[0].length));
  console.log("\n" + "파일".padEnd(w) + "        전  →  후      절감");
  for (const [name, b, a] of rows) {
    const pct = b ? Math.round((1 - a / b) * 100) : 0;
    console.log(`${name.padEnd(w)}  ${bytes(b).padStart(8)} → ${bytes(a).padStart(8)}  ${String(pct).padStart(3)}%`);
  }
  console.log(`\n합계  ${bytes(before)} → ${bytes(after)}  (${Math.round((1 - after / before) * 100)}% 절감)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
