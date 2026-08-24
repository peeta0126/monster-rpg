#!/usr/bin/env node
/**
 * 색 검사. `npm run lint` 에 물려 있다.
 *
 * 금지하는 건 "hex 를 쓰는 것"이 아니라 "마스터 팔레트에 없는 색을 쓰는 것"이다.
 * 알파가 필요하면 rgba(토큰값, .4) 는 괜찮다. CSS 에서 토큰에 알파를 먹이는
 * 깔끔한 방법이 없어서다. 다만 RGB 삼원색은 반드시 팔레트 안의 값이어야 한다.
 *
 * ESLint 커스텀 룰 대신 스크립트인 이유: 잡을 대상이 JSX 뿐 아니라 문자열·템플릿·
 * CSS 에 걸쳐 있어서 AST 룰로는 오히려 지저분해진다.
 *
 * 예외는 그 줄 끝에 `// palette-ok: 이유`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

// docs/ART_DIRECTION.md 1-2 표. index.css / palette.ts 와 같아야 한다.
const PALETTE = [
  "0D1223", "183B4F", "1E354A", "423D46", "844B3F", "AC7B62",
  "CDB27E", "E0C69B", "F3E5B9", "E99441", "C25828", "A83D1F",
  "AEE2D5", "5C9396", "7A8455", "39412A",
];
const ALLOWED_HEX = new Set(PALETTE.map((h) => h.toLowerCase()));
const ALLOWED_RGB = new Set(
  PALETTE.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",")),
);

// 색 값의 단일 출처
const ALLOWLIST = new Set([
  path.join("src", "shared", "palette.ts"),
  path.join("src", "index.css"),
]);

const CLASS_RE = /\b(?:bg|text|border|from|to|via|ring|divide|fill|stroke|placeholder)(?:-[trblxyse])?-(?:zinc|slate|gray|neutral|amber|yellow|orange|red|rose|green|emerald|lime|teal|blue|cyan|sky|indigo|purple|violet|fuchsia|pink)-(?:50|[1-9]00|950)\b/g;
const BW_RE = /\b(?:bg|text|border|from|to)-(?:black|white)\b/g;
const HEX_RE = /(?<![\w-])#([0-9a-fA-F]{3,8})\b/g;
const PHASER_RE = /\b0x([0-9a-fA-F]{6})\b/g;
const RGB_RE = /\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(e.name)) yield p;
  }
}

const problems = [];
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (ALLOWLIST.has(rel)) continue;

  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
    if (line.includes("palette-ok")) return;
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    const at = (msg) => problems.push(`${rel}:${i + 1}  ${msg}`);

    for (const [m] of code.matchAll(CLASS_RE)) at(`Tailwind 기본 팔레트: ${m}`);
    for (const [m] of code.matchAll(BW_RE)) at(`검정/순백: ${m}`);

    for (const [m, hex] of code.matchAll(HEX_RE)) {
      // 8자리는 뒤 2자리가 알파
      const rgb = hex.length >= 6 ? hex.slice(0, 6).toLowerCase() : null;
      if (!rgb || !ALLOWED_HEX.has(rgb)) at(`표에 없는 색: ${m}`);
    }
    for (const [m, hex] of code.matchAll(PHASER_RE)) {
      if (!ALLOWED_HEX.has(hex.toLowerCase())) at(`표에 없는 색: ${m}`);
    }
    for (const [, r, g, b] of code.matchAll(RGB_RE)) {
      if (!ALLOWED_RGB.has(`${r},${g},${b}`)) at(`표에 없는 색: rgb(${r},${g},${b})`);
    }
  });
}

if (problems.length) {
  console.error(`팔레트 밖의 색 ${problems.length}건.`);
  console.error("docs/ART_DIRECTION.md 1-2 표에 먼저 추가하고 index.css·palette.ts 에 등록하세요.");
  console.error("정말 예외라면 그 줄에 `// palette-ok: 이유` 를 붙입니다.\n");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("색 검사 통과");
