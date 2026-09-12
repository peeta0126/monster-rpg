import sharp from "sharp";
import path from "node:path";

const root = path.resolve("public/assets/player");
const W = 2172, H = 724, CELL_W = 362, FRAMES = 6;
const files = [
  ["south", "남.png"], ["southeast", "남동.png"], ["east", "동.png"],
  ["north", "북.png"], ["northeast", "북동.png"],
];

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function metadata(file) {
  return sharp(path.join(root, file)).metadata();
}

async function alphaBoxes(file) {
  const { data, info } = await sharp(path.join(root, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    let minX = CELL_W, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < CELL_W; x++) {
      const alpha = data[(y * info.width + frame * CELL_W + x) * info.channels + 3];
      if (alpha !== 0) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    }
    if (maxX < 0) throw new Error(`${file}: frame ${frame} is empty`);
    result.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, bottom: maxY });
  }
  return result;
}

async function makeWorking(direction, file) {
  const m = await metadata(file);
  const sourceFrameW = m.width / FRAMES;
  const scale = Math.min(CELL_W / sourceFrameW, H / m.height);
  const composites = [];
  for (let i = 0; i < FRAMES; i++) {
    const left = Math.round(i * sourceFrameW);
    const right = Math.round((i + 1) * sourceFrameW);
    const sw = right - left;
    const rw = Math.round(sw * scale), rh = Math.round(m.height * scale);
    const frame = await sharp(path.join(root, file)).ensureAlpha().extract({ left, top: 0, width: sw, height: m.height }).resize(rw, rh, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
    composites.push({ input: frame, left: i * CELL_W + Math.floor((CELL_W - rw) / 2), top: H - rh });
  }
  const out = `${direction}-working-2172x724.png`;
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites).png().toFile(path.join(root, out));
  return { direction, file, originalSize: `${m.width}x${m.height}`, workingSize: `${W}x${H}`, conversionScale: scale, working: out };
}

const working = [];
for (const [direction, file] of files) working.push(await makeWorking(direction, file));

const refBoxes = await alphaBoxes("south-working-2172x724.png");
const referenceMedianHeight = median(refBoxes.map((b) => b.h));
// Use the lowest opaque reference pixel so no walking pose is pushed below the cell.
const baseline = Math.max(...refBoxes.map((b) => b.bottom));
const reports = [];

for (const [direction] of files) {
  const item = working.find((x) => x.direction === direction);
  const before = await alphaBoxes(item.working);
  const beforeMedianHeight = median(before.map((b) => b.h));
  const heightScaleFactor = referenceMedianHeight / beforeMedianHeight;
  const beforeMaximumWidth = Math.max(...before.map((b) => b.w));
  // Keep the height-derived scale unless it would make opaque pixels leave a 362px cell.
  // The fallback is still one uniform factor for all six frames and prevents any crop.
  const cellFitScaleFactor = CELL_W / beforeMaximumWidth;
  const scaleFactor = Math.min(heightScaleFactor, cellFitScaleFactor);
  const composites = [];
  for (let i = 0; i < FRAMES; i++) {
    const b = before[i];
    const scaledBox = { w: Math.max(1, Math.round(b.w * scaleFactor)), h: Math.max(1, Math.round(b.h * scaleFactor)) };
    // Only transparent margins are omitted here; no character pixels are cropped.
    const input = await sharp(path.join(root, item.working)).extract({ left: i * CELL_W + b.x, top: b.y, width: b.w, height: b.h }).resize(scaledBox.w, scaledBox.h, { fit: "fill", kernel: "lanczos3" }).png().toBuffer();
    const left = i * CELL_W + Math.round((CELL_W - scaledBox.w) / 2);
    const top = baseline - scaledBox.h;
    if (left < i * CELL_W || left + scaledBox.w > (i + 1) * CELL_W || top < 0 || top + scaledBox.h > H) throw new Error(`${direction} frame ${i}: normalized character exceeds cell; source=${JSON.stringify(b)} scale=${scaleFactor} scaled=${JSON.stringify(scaledBox)}`);
    composites.push({ input, left, top });
  }
  const out = `monster-${direction}-normalized.png`;
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toFile(path.join(root, out));
  const after = await alphaBoxes(out);
  reports.push({ direction, originalSheetSize: item.originalSize, workingSheetSize: item.workingSize, medianCharacterHeightBefore: beforeMedianHeight, heightScaleFactor, scaleFactor, medianCharacterHeightAfter: median(after.map((b) => b.h)), baseline, frameBoundingBoxes: after.map(({ x, y, w, h }) => ({ x, y, w, h })) });
}

const previewW = W;
const previewInputs = [];
for (let i = 0; i < files.length; i++) {
  const input = await sharp(path.join(root, `monster-${files[i][0]}-normalized.png`)).extract({ left: 0, top: 0, width: CELL_W, height: H }).png().toBuffer();
  previewInputs.push({ input, left: i * CELL_W, top: 0 });
}
await sharp({ create: { width: previewW, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(previewInputs).png().toFile(path.join(root, "monster-normalized-comparison.png"));
console.log(JSON.stringify({ reference: "south-working-2172x724.png", referenceMedianCharacterHeight: referenceMedianHeight, baseline, reports, comparisonPreview: "monster-normalized-comparison.png" }, null, 2));
