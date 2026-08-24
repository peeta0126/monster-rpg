#!/usr/bin/env node
/**
 * 에셋 최적화. 원본을 읽어 public/ 으로 내보낸다.
 *
 *   node scripts/optimize-assets.mjs           변환
 *   node scripts/optimize-assets.mjs --dry     무엇을 할지만 출력
 *   node scripts/optimize-assets.mjs --png8    픽셀아트 PNG-8 재인코딩까지 (아래 참고)
 *
 * ── 이 스크립트가 지키는 규칙 하나 ────────────────────────────────────────────
 * 출력 경로는 어떤 레시피의 입력도 될 수 없다. 시작할 때 실제로 검사하고, 어기면
 * 아무것도 하지 않고 죽는다.
 *
 * 예전엔 이 규칙이 없어서 두 가지가 동시에 깨져 있었다.
 *   · ART 단계가 변환 후 원본 PNG 를 지웠다 → 두 번째 실행에서 그 없는 PNG 를 열려다
 *     첫 항목에서 스크립트 전체가 죽었다.
 *   · KEY_ART 단계가 원본 PNG 를 절반 크기 폴백으로 덮어썼다 → 두 번 돌리면 이미 절반인
 *     PNG 로 WebP 를 다시 구워 원본 해상도가 소리 없이 깎였다.
 * 앞의 버그가 뒤의 버그를 막아준 덕에 실제 손실은 없었지만(scripts/audit-asset-resolution.mjs
 * 로 38개 전수 확인), 둘 중 하나만 고쳤으면 그때 터졌다.
 *
 * 그래서 입력과 출력을 물리적으로 갈랐다. 원본은 art-src/ 에 두고 public/ 에는 산출물만
 * 나간다. 몇 번을 돌려도 결과가 같다. tests/optimizeAssets.test.mjs 가 그걸 지킨다.
 *
 * art-src/ 는 저장소에 같이 들어간다(배포는 안 된다. public/ 밖이라 dist/ 에 안 실린다).
 * 마스터가 없는 레시피는 건너뛴다(이미 만들어진 산출물은 그대로 둔다).
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const ART_SRC = path.join(ROOT, "art-src");

const DRY  = process.argv.includes("--dry");
const PNG8 = process.argv.includes("--png8");

/**
 * 레시피. { src, out, ... }.
 * src 는 art-src/ 기준, out 은 public/ 기준 상대 경로.
 *
 * 대부분의 마스터는 이 구조를 만들기 전에 이미 사라졌다(변환 후 원본을 지우던 시절에
 * 없어졌고, 지금 저장소에는 WebP 만 남아 있다). 그것들은 여기 적어만 두고 마스터가
 * 생기면 그때 다시 구우면 된다. 없으면 조용히 건너뛴다.
 */
const RECIPES = [
  { src: "housing_bg.png",     out: "assets/housing/housing_bg.webp",   quality: 85 },
  { src: "start-loading.png",  out: "start-loading.webp",               quality: 82 },
  { src: "basecamp-bg.png",    out: "assets/basecamp/basecamp-bg.webp", quality: 82 },
  { src: "basecamp-bg-1.png",  out: "assets/basecamp/basecamp-bg-1.webp", quality: 82 },
  { src: "Orion_portrait.png", out: "assets/player/Orion_portrait.webp", quality: 82 },
  { src: "Baros_portrait.png", out: "assets/player/Baros_portrait.webp", quality: 82 },

  /**
   * 흐리게 깔아 쓰는 배경의 저해상도 사본.
   * GameBackground / ForestBackground 는 blur(10~14px) + brightness(0.3) 으로 뭉개서 쓴다.
   * 원본 517KB 를 받을 이유가 없다. 가로 640px 이면 블러 후 구분이 안 된다.
   *
   * 처음엔 마스터가 없을 때 이미 만들어진 basecamp-bg.webp 에서 뜨도록 적었는데, 그러면
   * 같은 실행 안에서 방금 쓴 출력을 다시 입력으로 읽게 되어 순서에 따라 결과가 달라진다.
   * 위 불변식 검사가 그걸 잡아냈다. 다른 레시피와 똑같이 마스터에서만 뜬다.
   */
  { src: "basecamp-bg.png", out: "assets/basecamp/basecamp-bg-blur.webp", width: 640, quality: 78 },

  /**
   * 파비콘. 로고를 정사각에 담아 PNG 로 뽑는다.
   *
   * 여기만 webp 가 아니라 png 다. 파비콘으로서의 webp 는 Safari 16 미만이 못 읽는데,
   * 아이콘은 몇 KB 라 아껴 봐야 의미가 없다.
   *
   * 로고가 564×442 라 그대로 줄이면 정사각 슬롯에서 세로가 남는다. `square` 는 긴 변에
   * 맞춰 담고 남는 자리를 투명으로 채운다. 탭 아이콘이 찌그러지지 않는다.
   * 180 은 iOS 홈 화면이 요구하는 크기다(그보다 작으면 확대되어 뭉갠다).
   */
  { src: "voyager-atelier-logo.png", out: "favicon-32.png",        square: 32,  format: "png" },
  { src: "voyager-atelier-logo.png", out: "apple-touch-icon.png",  square: 180, format: "png" },
];

/**
 * 손대지 않는 디렉터리.
 *
 * 이 밑의 파일은 밖에서 이미 최적화를 마치고 들어온 최종본이다. 여기서 다시 구우면
 * 화질만 깎인다. WebP 재인코딩은 무손실이 아니라, 같은 quality 로 돌려도 세대마다
 * 뭉갠다. 숲 배경 3종은 톤 보정·스크림·비네트까지 구워져 있어 특히 되돌릴 수 없다.
 *
 * "레시피에 안 적었으니 안전하다"로 두지 않고 검사로 박아 둔 이유: 언젠가 누가
 * art-src/forest_deep.png 를 넣고 레시피 한 줄을 추가하면 그날 조용히 깎인다.
 * 그때 이 검사가 먼저 죽는다.
 *
 * assets/icons 도 같은 이유로 들어 있다. 아이템 아이콘은 scripts/build-icons.mjs 가
 * art-src/icons/ 에서 64x64 무손실로 굽는다. 여기서 quality 82 로 다시 구우면 픽셀
 * 테두리가 번진다. 24px 로 보는 그림에서 그건 바로 보인다.
 *
 * assets/audio 는 이 스크립트가 지금은 손댈 수단조차 없지만(sharp 는 그림만 다룬다)
 * 같은 자리에 적어 둔다. BGM 여섯 곡은 이어 붙여도 티가 안 나게 다듬어 들어온
 * 최종본이라, 언젠가 오디오 레시피가 생기는 날 조용히 다시 인코딩되면 안 된다.
 */
const PRESERVED_DIRS = ["assets/forest", "assets/icons", "assets/audio"];

/** 몬스터 일러스트. art-src/monsters/*.png 를 512px 상한으로 줄여 내보낸다 */
const MONSTER_SRC_DIR = "monsters";
const MONSTER_OUT_DIR = "assets/monsters";
const MONSTER_MAX = 512;

/**
 * 픽셀아트 PNG-8 재인코딩 (--png8 일 때만).
 *
 * 이 단계만은 public/ 의 파일을 제자리에서 다시 쓴다. 그 스프라이트들은 산출물이자
 * 마스터라 갈라놓을 데가 없다(art-src 로 옮기면 배포물이 저장소에서 사라진다).
 * 이미 전부 PNG-8 이라 지금 돌리면 0~1% 밖에 안 줄고 파일만 흔든다. 그래서 기본에서
 * 뺐다. 새 스프라이트를 넣었을 때만 명시적으로 부른다.
 */
const PIXEL_DIRS = ["assets/player"];

const bytes = (n) => `${(n / 1048576).toFixed(2)}MB`;
const rows = [];
let before = 0, after = 0;

async function sizeOf(p) {
  try { return (await fs.stat(p)).size; } catch { return 0; }
}

/**
 * 출력이 입력을 덮지 않는지 확인한다. 이 스크립트가 존재하는 이유의 절반이다.
 * 어기면 아무것도 하지 않고 죽는다. 반쯤 처리된 상태가 제일 나쁘다.
 */
function assertNoInputIsOverwritten(recipes) {
  const inputs = new Set(recipes.map((r) => path.resolve(ART_SRC, r.src)));
  const clashes = [];
  for (const r of recipes) {
    const out = path.resolve(PUBLIC, r.out);
    if (inputs.has(out)) clashes.push(r.out);
  }
  if (clashes.length) {
    throw new Error(
      `출력이 입력을 덮어쓴다: ${clashes.join(", ")}\n` +
      "레시피를 고칠 것. 이 검사가 없던 시절에 원본 해상도가 소리 없이 깎였다.",
    );
  }
}

/** 보존 디렉터리로 내보내는 레시피가 있으면 아무것도 하지 않고 죽는다. */
function assertNothingWritesIntoPreserved(recipes) {
  const outs = [
    ...recipes.map((r) => r.out),
    // --png8 단계는 public/ 을 제자리에서 다시 쓴다. 같은 규칙을 적용한다.
    ...PIXEL_DIRS,
    `${MONSTER_OUT_DIR}/`,
  ];
  const hits = outs
    .map((out) => out.replace(/\\/g, "/"))
    .filter((out) => PRESERVED_DIRS.some((d) => out === d || out.startsWith(`${d}/`)));
  if (hits.length) {
    throw new Error(
      `보존 디렉터리에 쓰려 한다: ${hits.join(", ")}\n` +
      "이미 최적화된 최종본이다. 다시 구우면 화질만 깎인다.",
    );
  }
}

async function runRecipe(r) {
  const input = path.join(ART_SRC, r.src);
  if (!(await sizeOf(input))) {
    console.log(`[optimize] art-src/${r.src} 없음 — ${r.out} 건너뜀`);
    return;
  }

  const out = path.join(PUBLIC, r.out);
  const label = r.out;
  const format = r.format ?? "webp";
  if (DRY) { console.log(`${format.padEnd(4)}  ${label}`); return; }

  await fs.mkdir(path.dirname(out), { recursive: true });
  let img = sharp(input);
  if (r.square) {
    // 긴 변에 맞춰 담고 남는 자리는 투명. fit:"cover" 로 채우면 로고가 잘린다.
    img = img.resize(r.square, r.square, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  } else if (r.width) {
    img = img.resize({ width: r.width, withoutEnlargement: true });
  }
  await (format === "png"
    ? img.png({ palette: true, compressionLevel: 9, effort: 10 })
    : img.webp({ quality: r.quality ?? 82, effort: 6 })
  ).toFile(out);

  const b = await sizeOf(input);
  const a = await sizeOf(out);
  before += b; after += a;
  rows.push([label, b, a]);
}

async function runMonsters() {
  const dir = path.join(ART_SRC, MONSTER_SRC_DIR);
  let names;
  try { names = (await fs.readdir(dir)).filter((f) => /\.png$/i.test(f)); }
  catch { console.log(`[optimize] art-src/${MONSTER_SRC_DIR}/ 없음 — 몬스터 건너뜀`); return; }

  for (const name of names) {
    const src = path.join(dir, name);
    const rel = `${MONSTER_OUT_DIR}/${name.replace(/\.png$/i, ".webp")}`;
    const out = path.join(PUBLIC, rel);
    if (DRY) { console.log(`webp  ${rel} (${MONSTER_MAX}px 상한)`); continue; }
    await fs.mkdir(path.dirname(out), { recursive: true });
    await sharp(src)
      .resize({ width: MONSTER_MAX, height: MONSTER_MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 6 })
      .toFile(out);
    const b = await sizeOf(src), a = await sizeOf(out);
    before += b; after += a;
    rows.push([rel, b, a]);
  }
}

async function runPng8() {
  for (const rel of PIXEL_DIRS) {
    const dir = path.join(PUBLIC, rel);
    let names;
    try { names = (await fs.readdir(dir)).filter((f) => /\.png$/i.test(f)); } catch { continue; }
    for (const name of names) {
      const abs = path.join(dir, name);
      if (DRY) { console.log(`png8  ${rel}/${name}`); continue; }
      const b = await sizeOf(abs);
      const buf = await sharp(abs).png({ palette: true, compressionLevel: 9, effort: 10 }).toBuffer();
      // 팔레트화가 오히려 커지는 경우가 있다(이미 최적화된 작은 스프라이트). 그럴 땐 원본 유지.
      if (buf.length < b) await fs.writeFile(abs, buf);
      before += b; after += Math.min(b, buf.length);
      rows.push([`${rel}/${name}`, b, Math.min(b, buf.length)]);
    }
  }
}

async function main() {
  assertNoInputIsOverwritten(RECIPES);
  assertNothingWritesIntoPreserved(RECIPES);

  for (const r of RECIPES) await runRecipe(r);
  await runMonsters();
  if (PNG8) await runPng8();
  else if (!DRY) console.log("[optimize] 픽셀아트 PNG-8 은 건너뜀 (--png8 로 켠다)");

  if (DRY) return;
  if (!rows.length) { console.log("\n한 것 없음 — art-src/ 에 마스터가 없다."); return; }

  rows.sort((x, y) => (y[1] - y[2]) - (x[1] - x[2]));
  const w = Math.max(...rows.map((r) => r[0].length));
  console.log("\n" + "파일".padEnd(w) + "        전  →  후      절감");
  for (const [name, b, a] of rows) {
    const pct = b ? Math.round((1 - a / b) * 100) : 0;
    console.log(`${name.padEnd(w)}  ${bytes(b).padStart(8)} → ${bytes(a).padStart(8)}  ${String(pct).padStart(3)}%`);
  }
  console.log(`\n합계  ${bytes(before)} → ${bytes(after)}  (${Math.round((1 - after / before) * 100)}% 절감)`);
}

main().catch((e) => { console.error("[optimize] 실패:", e.message); process.exit(1); });
