#!/usr/bin/env node
/**
 * 에셋 최적화 — 원본을 읽어 public/ 으로 내보낸다.
 *
 *   node scripts/optimize-assets.mjs           변환
 *   node scripts/optimize-assets.mjs --dry     무엇을 할지만 출력
 *   node scripts/optimize-assets.mjs --png8    픽셀아트 PNG-8 재인코딩까지 (아래 참고)
 *
 * ── 이 스크립트가 지키는 규칙 하나 ────────────────────────────────────────────
 * **출력 경로는 어떤 레시피의 입력도 될 수 없다.** 시작할 때 실제로 검사하고, 어기면
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
 * 나간다. 몇 번을 돌려도 결과가 같다 — tests/optimizeAssets.test.mjs 가 그걸 지킨다.
 *
 * ⚠️ art-src/ 는 .gitignore 대상이다. 마스터 보관은 사람 책임이다. art-src/README.md 참고.
 *    마스터가 없으면 그 레시피는 건너뛴다(이미 만들어진 산출물은 그대로 둔다).
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
 * 레시피 — { src, out, ... }.
 * out 은 public/ 기준. src 는 art-src/ 기준이되, "public/" 으로 시작하면 저장소 루트 기준이다.
 *
 * 공방 배경만 마스터를 public/ 안에 둔다. art-src/ 는 .gitignore 대상이라 새로 클론하면
 * 비어 있는데, 그 상태에서 배경 마스터를 잃는 사고가 실제로 났다. 커밋되는 자리에 두고
 * tests/workshopBackground.test.mjs 가 SHA256 으로 지킨다. 출력은 .webp 라 아래 불변식
 * (출력이 입력을 덮지 않는다)에도 걸리지 않는다.
 *
 * 대부분의 마스터는 이 구조를 만들기 전에 이미 사라졌다(변환 후 원본을 지우던 시절에
 * 없어졌고, 지금 저장소에는 WebP 만 남아 있다). 그것들은 여기 적어만 두고 마스터가
 * 생기면 그때 다시 구우면 된다. 없으면 조용히 건너뛴다.
 */
const RECIPES = [
  { src: "public/assets/housing/housing_bg.png", out: "assets/housing/housing_bg.webp", quality: 85 },
  { src: "start-loading.png",  out: "start-loading.webp",               quality: 82 },
  { src: "basecamp-bg.png",    out: "assets/basecamp/basecamp-bg.webp", quality: 82 },
  { src: "basecamp-bg-1.png",  out: "assets/basecamp/basecamp-bg-1.webp", quality: 82 },
  { src: "Orion_portrait.png", out: "assets/player/Orion_portrait.webp", quality: 82 },
  { src: "Baros_portrait.png", out: "assets/player/Baros_portrait.webp", quality: 82 },

  /**
   * 흐리게 깔아 쓰는 배경의 저해상도 사본.
   * GameBackground / ForestBackground 는 blur(10~14px) + brightness(0.3) 으로 뭉개서 쓴다.
   * 원본 517KB 를 받을 이유가 없다 — 가로 640px 이면 블러 후 구분이 안 된다.
   *
   * 처음엔 마스터가 없을 때 이미 만들어진 basecamp-bg.webp 에서 뜨도록 적었는데, 그러면
   * 같은 실행 안에서 방금 쓴 출력을 다시 입력으로 읽게 되어 순서에 따라 결과가 달라진다.
   * 위 불변식 검사가 그걸 잡아냈다. 다른 레시피와 똑같이 마스터에서만 뜬다.
   */
  { src: "basecamp-bg.png", out: "assets/basecamp/basecamp-bg-blur.webp", width: 640, quality: 78 },
];

/** 몬스터 일러스트 — art-src/monsters/*.png 를 512px 상한으로 줄여 내보낸다 */
const MONSTER_SRC_DIR = "monsters";
const MONSTER_OUT_DIR = "assets/monsters";
const MONSTER_MAX = 512;

/**
 * 픽셀아트 PNG-8 재인코딩 (--png8 일 때만).
 *
 * 이 단계만은 public/ 의 파일을 제자리에서 다시 쓴다 — 그 스프라이트들은 산출물이자
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
 * 어기면 아무것도 하지 않고 죽는다 — 반쯤 처리된 상태가 제일 나쁘다.
 */
/** src 를 실제 경로로. "public/" 으로 시작하면 저장소 루트 기준, 아니면 art-src/ 기준. */
function resolveSrc(src) {
  return src.startsWith("public/") ? path.resolve(ROOT, src) : path.resolve(ART_SRC, src);
}

function assertNoInputIsOverwritten(recipes) {
  const inputs = new Set(recipes.map((r) => resolveSrc(r.src)));
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

async function runRecipe(r) {
  const input = resolveSrc(r.src);
  if (!(await sizeOf(input))) {
    const shown = r.src.startsWith("public/") ? r.src : `art-src/${r.src}`;
    console.log(`[optimize] ${shown} 없음 — ${r.out} 건너뜀`);
    return;
  }

  const out = path.join(PUBLIC, r.out);
  const label = r.out;
  if (DRY) { console.log(`webp  ${label}`); return; }

  await fs.mkdir(path.dirname(out), { recursive: true });
  let img = sharp(input);
  if (r.width) img = img.resize({ width: r.width, withoutEnlargement: true });
  await img.webp({ quality: r.quality ?? 82, effort: 6 }).toFile(out);

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
