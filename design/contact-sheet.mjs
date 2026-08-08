#!/usr/bin/env node
/**
 * 캡처 묶어보기(contact sheet) 생성기.
 *
 *   node design/contact-sheet.mjs before
 *
 * design/screenshots/<label>/*.png 를 3열 그리드 한 장으로 합쳐
 * design/contact-sheet-<label>.png 로 저장한다. 화면을 한 장씩 열어보면
 * "화면끼리 톤이 안 맞는다" 같은 문제가 안 보이기 때문에, 항상 나란히 놓고 본다.
 *
 * 개별 스크린샷은 .gitignore 대상이지만 이 컨택트시트는 커밋한다 — 리뷰 기록으로 남긴다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const DESIGN_DIR = path.dirname(fileURLToPath(import.meta.url));

const COLS = 3;
const CELL_W = 520;               // 썸네일 셀 가로
const CELL_H = 325;               // 1440×900 의 16:10 비율에 맞춘 세로
const LABEL_H = 40;               // 썸네일 아래 이름표 높이
const GAP = 16;
const PAD = 24;
const BG = "#141317";             // 시트 배경 (썸네일 경계가 보이도록 어둡게)
const CELL_BG = "#000000";
const LABEL_COLOR = "#e8e2d4";

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) => (
    { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]
  ));
}

/** 이름표를 SVG 로 그려 버퍼로 돌려준다 (sharp 자체엔 텍스트 렌더가 없다) */
function labelBuffer(text, width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${BG}"/>
  <text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle"
        font-family="Consolas, Menlo, monospace" font-size="18" fill="${LABEL_COLOR}"
        >${escapeXml(text)}</text>
</svg>`;
  return Buffer.from(svg);
}

async function main() {
  const label = process.argv[2] ?? "current";
  const srcDir = path.join(DESIGN_DIR, "screenshots", label);

  if (!fs.existsSync(srcDir)) {
    console.error(
      `[contact-sheet] ${path.relative(process.cwd(), srcDir)} 가 없습니다.\n` +
      `                먼저 캡처를 돌리세요:  SHOT_LABEL=${label} npm run design:shot`,
    );
    process.exit(1);
  }

  const files = fs.readdirSync(srcDir).filter((f) => f.toLowerCase().endsWith(".png")).sort();

  if (files.length === 0) {
    console.error(`[contact-sheet] ${srcDir} 에 png 가 없습니다.`);
    process.exit(1);
  }

  const rows = Math.ceil(files.length / COLS);
  const cellTotalH = CELL_H + LABEL_H;
  const sheetW = PAD * 2 + COLS * CELL_W + (COLS - 1) * GAP;
  const sheetH = PAD * 2 + rows * cellTotalH + (rows - 1) * GAP;

  const composites = [];

  for (const [i, file] of files.entries()) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const left = PAD + col * (CELL_W + GAP);
    const top = PAD + row * (cellTotalH + GAP);

    const thumb = await sharp(path.join(srcDir, file))
      .resize(CELL_W, CELL_H, { fit: "contain", background: CELL_BG })
      .png()
      .toBuffer();

    composites.push({ input: thumb, left, top });
    composites.push({
      input: labelBuffer(path.basename(file, ".png"), CELL_W, LABEL_H),
      left,
      top: top + CELL_H,
    });
  }

  const outPath = path.join(DESIGN_DIR, `contact-sheet-${label}.png`);
  await sharp({
    create: { width: sheetW, height: sheetH, channels: 4, background: BG },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(outPath);

  console.log(
    `[contact-sheet] ${files.length}장 → ${path.relative(process.cwd(), outPath)} ` +
    `(${sheetW}×${sheetH}, ${COLS}열 × ${rows}행)`,
  );
}

main().catch((err) => {
  console.error("[contact-sheet] 실패:", err);
  process.exit(1);
});
