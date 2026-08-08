#!/usr/bin/env node
/**
 * Galmuri 폰트 서브셋. `npm run build` 앞에 자동으로 돈다.
 *
 * 원본은 20,965 글리프(한자 6,777 · 가나 187 포함)라 494KB + 163KB 다. 게임에는 한자도
 * 가나도 한 글자 안 나온다. 그런데 이건 모든 화면에서 받는 최대 항목이었다(design/PERF.md).
 *
 * 화면에 뜨는 한글은 **전부 소스에 박혀 있다** — 사용자가 한글을 입력할 수 있는 곳이 없다.
 * 아이디는 서버에서 /^[a-zA-Z0-9_]{3,20}$/ 로 막고, 몬스터 nickname 은 읽기만 하고
 * 설정하는 UI 가 없다. 그래서 소스에 실제로 등장하는 글자만 남겨도 안전하다.
 *
 * ⚠️ 그래서 빌드에 물려 뒀다. 한국어 문구를 추가하고 서브셋을 안 돌리면 그 글자만
 *    폴백 폰트로 나온다 — 손으로 기억해야 하는 절차를 만들지 않기 위해서다.
 */
import fs from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "assets", "fonts");
const SRC_DIR = path.join(ROOT, "node_modules", "galmuri", "dist");

/** 문구가 들어 있을 수 있는 곳. 서버 에러 메시지도 화면에 그대로 뜬다. */
const SCAN_DIRS = [
  path.join(ROOT, "src"),
  path.join(ROOT, "server", "src"),
];
const SCAN_EXT = /\.(tsx?|css|html)$/;

const FONTS = [
  { file: "Galmuri11.ttf",      family: "Galmuri11", weight: 400 },
  { file: "Galmuri11-Bold.ttf", family: "Galmuri11", weight: 700 },
  { file: "Galmuri14.ttf",      family: "Galmuri14", weight: 400 },
];

/**
 * 소스에 없더라도 항상 넣는 글자.
 * - ASCII 전체: 아이디·숫자·기호는 언제든 나온다
 * - 자주 쓰는 문장부호와 화살표: 앞으로 문구를 조금 고쳐도 깨지지 않게 여유를 둔다
 */
const ALWAYS = [
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)),
  "…·—–―‘’“”«»†‡•※", "←↑→↓↔▲▼◀▶△▽◆◇○●□■☆★♪♥",
  "㎏㎜㎝㎞％±×÷≠≤≥∞", "０１２３４５６７８９",
].join("");

async function* walk(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (SCAN_EXT.test(e.name)) yield p;
  }
}

async function collectChars() {
  const set = new Set(ALWAYS);
  let files = 0;
  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      files += 1;
      for (const ch of await fs.readFile(file, "utf8")) set.add(ch);
    }
  }
  return { text: [...set].join(""), count: set.size, files };
}

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function main() {
  const { text, count, files } = await collectChars();
  console.log(`[fonts] ${files}개 파일에서 ${count}자 수집`);

  await fs.mkdir(OUT_DIR, { recursive: true });
  let before = 0, after = 0;

  for (const f of FONTS) {
    const src = path.join(SRC_DIR, f.file);
    const outName = f.file.replace(/\.ttf$/, ".woff2");
    const out = path.join(OUT_DIR, outName);

    const buf = await fs.readFile(src);
    const subset = await subsetFont(buf, text, { targetFormat: "woff2" });
    await fs.writeFile(out, subset);

    // 비교 기준은 CDN 이 주던 woff2 다 (ttf 원본이 아니라)
    const cdnSize = await fs.readFile(path.join(SRC_DIR, outName)).then((b) => b.length).catch(() => 0);
    before += cdnSize; after += subset.length;
    console.log(`  ${outName.padEnd(22)} ${kb(cdnSize).padStart(7)} → ${kb(subset.length).padStart(7)}`);
  }

  console.log(`[fonts] 합계 ${kb(before)} → ${kb(after)} (${Math.round((1 - after / before) * 100)}% 절감)`);
}

main().catch((e) => { console.error("[fonts] 실패:", e); process.exit(1); });
