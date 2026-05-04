// ─── 하우징 배경 캔버스 ────────────────────────────────────────────────────────
// 베이스캠프 이미지 스타일 참고 — 아늑한 집 주변 정원 분위기
// ▸ 따뜻한 밝은 잔디 / 자갈 길 / 정원 꽃밭 / 둥근 수목

import { useEffect, useRef } from "react";

const TH = 44, HW = 44, HH = 22;
const ROOM_COLS = 10, ROOM_ROWS = 10;

// ─── PRNG ─────────────────────────────────────────────────────────────────────
function rand(bx: number, by: number, salt = 0): number {
  let s = ((bx & 0xffff) * 73856093 ^ (by & 0xffff) * 19349663 ^ salt * 3456789) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  s = Math.imul(s, 0x45d9f3b) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  return s / 0xffffffff;
}

function roomDist(bx: number, by: number): number {
  const dx = bx < 0 ? -bx : bx >= ROOM_COLS ? bx - ROOM_COLS + 1 : 0;
  const dy = by < 0 ? -by : by >= ROOM_ROWS ? by - ROOM_ROWS + 1 : 0;
  return Math.max(dx, dy);
}

// ─── 바이옴 ───────────────────────────────────────────────────────────────────
// yard    : 집 바로 옆 정원 잔디 (밝고 따뜻한)
// garden  : 꽃밭 / 화단 구역
// cobble  : 자갈·돌 길
// lawn    : 더 넓은 잔디 구역
// hedgerow: 외곽 짙은 수풀 경계
type Biome = "yard" | "garden" | "cobble" | "lawn" | "hedgerow";

function getBiome(bx: number, by: number): Biome {
  const dist = roomDist(bx, by);

  // 왼쪽 문 → 자갈 길 (bx: -10~-1, by: 3~6)
  if (bx >= -10 && bx <= -1 && by >= 3 && by <= 6) return "cobble";
  // 오른쪽 문 → 자갈 길 (bx: 10~19, by: 3~6)
  if (bx >= 10  && bx <= 19 && by >= 3 && by <= 6) return "cobble";

  // 집 앞 중앙 광장 (아래쪽)
  if (bx >= -2 && bx <= 11 && by >= 10 && by <= 13) return "cobble";

  // 화단: 집 위쪽(북쪽), dist 1~3
  if (dist >= 1 && dist <= 3 && by < 0) return "garden";
  // 화단: 집 양쪽 side 코너
  if (dist >= 2 && dist <= 4 && (bx < 0 || bx >= ROOM_COLS) && by >= 0 && by < ROOM_ROWS) {
    if (rand(bx, by, 77) < 0.5) return "garden";
  }

  // 집 바로 옆 yard
  if (dist <= 3) return "yard";
  if (dist <= 7) return "lawn";
  return "hedgerow";
}

// ─── 바이옴별 베이스 색 ────────────────────────────────────────────────────────
const BASE_COLOR: Record<Biome, [number, number, number]> = {
  yard:     [108, 168,  68],   // 밝고 따뜻한 잔디
  garden:   [ 88, 142,  52],   // 화단 잔디 (약간 짙음)
  cobble:   [162, 146, 122],   // 따뜻한 자갈
  lawn:     [ 90, 148,  56],   // 중간 잔디
  hedgerow: [ 56,  96,  30],   // 외곽 짙은 수풀
};

function clamp(v: number): number { return Math.max(0, Math.min(255, v | 0)); }

function smoothNoise(bx: number, by: number): number {
  return Math.sin(bx * 0.42 + by * 0.31 + 1.2) * 10
       + Math.sin(bx * 0.17 - by * 0.38 + 0.8) *  7
       + Math.sin(bx * 0.65 + by * 0.22 + 2.1) *  4;
}

function getTileColor(bx: number, by: number, biome: Biome): string {
  const [r, g, b] = BASE_COLOR[biome];
  const n = smoothNoise(bx, by) + (rand(bx, by, 20) - 0.5) * 5;
  return `rgb(${clamp(r + n)},${clamp(g + n)},${clamp(b + n)})`;
}

// ─── 타일 그리기 ─────────────────────────────────────────────────────────────
// expand > 0 이면 다이아몬드를 각 방향으로 늘려 인접 타일과 겹치게 한다.
// 페인터 알고리즘(뒤→앞)으로 그리면 앞 타일이 뒷 타일 경계를 완전히 덮어
// 타일 이음새(경계선)가 사라진다.
function fillDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, expand = 0) {
  const e = expand;
  ctx.beginPath();
  ctx.moveTo(cx,           cy - e);        // 꼭대기
  ctx.lineTo(cx + HW + e,  cy + HH);       // 오른쪽
  ctx.lineTo(cx,           cy + TH + e);   // 아래
  ctx.lineTo(cx - HW - e,  cy + HH);       // 왼쪽
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  bx: number, by: number,
  biome: Biome,
) {
  // expand=2 : 앞 타일이 뒷 타일 경계를 2px 덮어 이음새를 제거
  fillDiamond(ctx, cx, cy, 2);
  ctx.fillStyle = getTileColor(bx, by, biome);
  ctx.fill();

  // 미세한 깊이 힌트 (왼쪽 절반만 살짝 어둡게)
  ctx.beginPath();
  ctx.moveTo(cx,          cy - 2);
  ctx.lineTo(cx - HW - 2, cy + HH);
  ctx.lineTo(cx,          cy + TH + 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.035)";
  ctx.fill();

  // 자갈길 디테일
  if (biome === "cobble") {
    // 돌 틈 라인
    if (rand(bx, by, 30) < 0.6) {
      const px = cx + (rand(bx, by, 31) - 0.5) * 30;
      const py = cy + HH + (rand(bx, by, 32) - 0.5) * 10;
      const pw = rand(bx, by, 33) * 14 + 6;
      ctx.fillStyle = "rgba(100,88,70,0.22)";
      ctx.beginPath();
      ctx.ellipse(px, py, pw * 0.5, pw * 0.2, rand(bx, by, 34) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // 돌 하이라이트
    if (rand(bx, by, 35) < 0.4) {
      const hx = cx + (rand(bx, by, 36) - 0.5) * 26;
      const hy = cy + HH + (rand(bx, by, 37) - 0.5) * 8;
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.ellipse(hx, hy, 5, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── 풀 이삭 (밝은 정원 느낌) ────────────────────────────────────────────────
function drawGrassTuft(ctx: CanvasRenderingContext2D, cx: number, cy: number, bx: number, by: number) {
  const gx = cx + (rand(bx, by, 40) - 0.5) * 22;
  const gy = cy + HH + rand(bx, by, 41) * 5;
  const col = rand(bx, by, 42) < 0.5 ? "#72c830" : "#5ab022";
  ctx.fillStyle = col;
  ctx.fillRect(gx,     gy - 6, 2, 6);
  ctx.fillRect(gx + 4, gy - 8, 2, 8);
  ctx.fillRect(gx + 8, gy - 5, 2, 5);
}

// ─── 꽃 (정원 화단) ──────────────────────────────────────────────────────────
const FLOWER_PAL = ["#ff88aa","#ffdd55","#dd88ff","#ff6677","#ffbb33","#88ddff","#ff99cc"];
function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, bx: number, by: number) {
  const fx = cx + (rand(bx, by, 50) - 0.5) * 24;
  const fy = cy + HH + rand(bx, by, 51) * 5 - 2;
  const col = FLOWER_PAL[Math.floor(rand(bx, by, 52) * FLOWER_PAL.length)];
  // 줄기
  ctx.fillStyle = "#4a8818";
  ctx.fillRect(fx + 1, fy + 3, 1, 5);
  // 꽃잎 (작은 십자)
  ctx.fillStyle = col;
  ctx.fillRect(fx,     fy,     3, 3);
  ctx.fillStyle = "#fff5cc";
  ctx.fillRect(fx + 1, fy + 1, 1, 1); // 중심
}

// ─── 꽃 덤불 (화단 구역용, 더 풍성) ─────────────────────────────────────────
function drawFlowerCluster(ctx: CanvasRenderingContext2D, cx: number, cy: number, bx: number, by: number) {
  const n = 3 + Math.floor(rand(bx, by, 60) * 4);
  for (let i = 0; i < n; i++) {
    const fx = cx + (rand(bx, by, 61 + i) - 0.5) * 30;
    const fy = cy + HH + rand(bx, by, 62 + i) * 8 - 4;
    const col = FLOWER_PAL[Math.floor(rand(bx, by, 63 + i) * FLOWER_PAL.length)];
    ctx.fillStyle = "#3a7010";
    ctx.fillRect(fx + 1, fy + 3, 1, 6);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(fx + 1, fy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(fx + 1, fy - 1, 1, 1);
  }
}

// ─── 정원 수목 (둥근 파크 스타일) ─────────────────────────────────────────────
function drawGardenTree(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, r: number) {
  const h = 44 + r * 22, w = 26 + r * 16;
  const trunkH = 12 + r * 4;

  // 그림자
  ctx.beginPath();
  ctx.ellipse(baseX + 6, baseY + 3, w * 0.45, 7, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fill();

  // 기둥
  ctx.fillStyle = "#6a4820";
  ctx.fillRect(baseX - 3, baseY - trunkH, 6, trunkH);
  ctx.fillStyle = "#8a6030";
  ctx.fillRect(baseX - 2, baseY - trunkH + 1, 2, trunkH - 2);

  // 잎 — 3 레이어, 따뜻하고 밝은 정원 녹색
  const layers: [number, number, number, number, string][] = [
    [0,         -0.30, 0.50, 0.50, "#2e7010"],
    [-w * 0.06, -0.50, 0.44, 0.44, "#3e9018"],
    [ w * 0.08, -0.66, 0.28, 0.28, "#5ab828"],
  ];
  for (const [ox, oy, rx, ry, col] of layers) {
    ctx.beginPath();
    ctx.ellipse(baseX + ox, baseY - trunkH + oy * h, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }
  // 하이라이트
  ctx.beginPath();
  ctx.ellipse(baseX + w * 0.1, baseY - trunkH - h * 0.75, w * 0.12, h * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fill();
}

// ─── 벚꽃나무 (핑크 꽃잎) ─────────────────────────────────────────────────────
function drawCherryTree(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, r: number) {
  const h = 38 + r * 18, w = 30 + r * 18;
  const trunkH = 10 + r * 4;

  ctx.beginPath();
  ctx.ellipse(baseX + 5, baseY + 3, w * 0.42, 6, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fill();

  ctx.fillStyle = "#5a3818";
  ctx.fillRect(baseX - 3, baseY - trunkH, 6, trunkH);

  // 꽃잎 덩어리 — 분홍/흰 그러데이션
  const layers: [number, number, number, number, string][] = [
    [0,          -0.28, 0.52, 0.52, "#e8829a"],
    [-w * 0.10,  -0.48, 0.44, 0.44, "#f2a0b4"],
    [ w * 0.08,  -0.62, 0.34, 0.34, "#fcc8d8"],
    [ w * 0.05,  -0.74, 0.18, 0.18, "#ffe0ea"],
  ];
  for (const [ox, oy, rx, ry, col] of layers) {
    ctx.beginPath();
    ctx.ellipse(baseX + ox, baseY - trunkH + oy * h, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }

  // 꽃잎 파티클
  const petals = 8 + Math.floor(r * 8);
  for (let i = 0; i < petals; i++) {
    const angle = rand(baseX + i, baseY, 80 + i) * Math.PI * 2;
    const dist  = rand(baseX + i, baseY, 81 + i) * w * 0.55;
    const px    = baseX + Math.cos(angle) * dist;
    const py    = baseY - trunkH - h * 0.48 + Math.sin(angle) * dist * 0.45;
    ctx.fillStyle = "rgba(255,210,220,0.7)";
    ctx.beginPath();
    ctx.ellipse(px, py, 3, 2, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── 정원 관목 (트리밍된 느낌) ────────────────────────────────────────────────
function drawTrimmedBush(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, r: number) {
  const w = 22 + r * 12, h = 13 + r * 7;

  ctx.beginPath();
  ctx.ellipse(baseX + 3, baseY + 2, w * 0.38, 5, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.fill();

  // 둥글둥글 트리밍된 형태
  const layers: [number, number, number, number, string][] = [
    [0,       -0.30, 0.50, 0.50, "#2e7818"],
    [w * 0.1, -0.50, 0.38, 0.38, "#42a020"],
    [w * 0.1, -0.62, 0.20, 0.20, "#5ac030"],
  ];
  for (const [ox, oy, rx, ry, col] of layers) {
    ctx.beginPath();
    ctx.ellipse(baseX + ox, baseY + oy * h, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }
  // 살짝 꽃 달린 관목
  if (rand(baseX, baseY, 90) < 0.4) {
    ctx.fillStyle = "#ff88aa";
    ctx.beginPath();
    ctx.arc(baseX + w * 0.06, baseY - h * 0.55, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── 바위 ─────────────────────────────────────────────────────────────────────
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = 10 + r * 8, h = 7 + r * 4;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 2, w * 0.5, h * 0.4, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.10)"; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#9a9484"; ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - w * 0.1, y - h * 0.15, w * 0.25, h * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#bcb8a8"; ctx.fill();
}

// ─── 정원 돌 울타리 / 낮은 담장 ──────────────────────────────────────────────
function drawStoneWallPost(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  railDx: number, railDy: number,
) {
  // 돌 기둥
  ctx.fillStyle = "#8a8070";
  ctx.fillRect(px - 4, py - 16, 8, 16);
  ctx.fillStyle = "#a89e8c";
  ctx.fillRect(px - 5, py - 20, 10, 6);
  // 이끼
  ctx.fillStyle = "rgba(80,130,40,0.3)";
  ctx.fillRect(px - 4, py - 20, 10, 3);

  // 레일 (낮은 돌담)
  if (railDx !== 0 || railDy !== 0) {
    ctx.fillStyle = "#9a9080";
    const steps = 3;
    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const rx = px + railDx * t;
      const ry = py + railDy * t - 10;
      ctx.beginPath();
      ctx.ellipse(rx, ry, 8, 4, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ─── 석등 / 정원 장식 ─────────────────────────────────────────────────────────
function drawLantern(ctx: CanvasRenderingContext2D, px: number, py: number) {
  // 기둥
  ctx.fillStyle = "#7a7060";
  ctx.fillRect(px - 2, py - 28, 4, 28);
  // 기단
  ctx.fillStyle = "#9a9080";
  ctx.fillRect(px - 5, py - 2, 10, 4);
  // 등 본체
  ctx.fillStyle = "#6a6050";
  ctx.fillRect(px - 6, py - 26, 12, 12);
  // 등 지붕
  ctx.fillStyle = "#5a5040";
  ctx.beginPath();
  ctx.moveTo(px - 8, py - 26);
  ctx.lineTo(px,     py - 32);
  ctx.lineTo(px + 8, py - 26);
  ctx.closePath();
  ctx.fill();
  // 빛 (노란 광)
  ctx.fillStyle = "rgba(255, 210, 100, 0.55)";
  ctx.fillRect(px - 4, py - 24, 8, 8);
  // 빛 글로우
  const grd = ctx.createRadialGradient(px, py - 20, 2, px, py - 20, 18);
  grd.addColorStop(0, "rgba(255,200,80,0.25)");
  grd.addColorStop(1, "rgba(255,200,80,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(px, py - 20, 18, 0, Math.PI * 2);
  ctx.fill();
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
interface HousingBgCanvasProps {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export default function HousingBgCanvas({ offsetX, offsetY, width, height }: HousingBgCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── 오프스크린: 지형 타일만 (블러 적용 예정) ────────────────────────────
    const terrainCanvas = document.createElement("canvas");
    terrainCanvas.width  = width;
    terrainCanvas.height = height;
    const tc = terrainCanvas.getContext("2d")!;

    // 베이스 배경 — 따뜻한 짙은 잔디
    tc.fillStyle = "#2a5010";
    tc.fillRect(0, 0, width, height);

    // ── 지형 타일 항목 (정렬 후 그려야 expand 기법이 동작) ──────────────────
    type Item = { sortKey: number; draw: () => void };
    const terrainItems: Item[] = [];

    // ── 오브젝트 항목 (블러 없이 메인에 그릴 것들) ──────────────────────────
    type ObjItem = { sortKey: number; draw: () => void };
    const objItems: ObjItem[] = [];

    const BX_MIN = -20, BX_MAX = 30;
    const BY_MIN = -20, BY_MAX = 30;

    for (let bx = BX_MIN; bx <= BX_MAX; bx++) {
      for (let by = BY_MIN; by <= BY_MAX; by++) {
        if (bx >= 0 && bx < ROOM_COLS && by >= 0 && by < ROOM_ROWS) continue;

        const tileLeft = (bx - by) * HW + 440 + offsetX;
        const tileTop  = (bx + by) * HH + offsetY;
        const cx = tileLeft + HW;
        const cy = tileTop;

        if (cx + HW < -20 || cx - HW > width  + 20) continue;
        if (cy > height + 60 || cy + TH < -300) continue;

        const biome = getBiome(bx, by);
        const dist  = roomDist(bx, by);
        const r     = rand(bx, by);

        const _cx = cx, _cy = cy, _bx = bx, _by = by, _biome = biome;

        // 지형 타일 → 정렬 후 그리기 위해 수집
        terrainItems.push({ sortKey: bx + by, draw() { drawTile(tc, _cx, _cy, _bx, _by, _biome); } });

        const isGrass = biome !== "cobble";

        // ── 풀 이삭 ─────────────────────────────────────────────────────────
        if (isGrass && rand(bx, by, 1) < 0.20) {
          objItems.push({ sortKey: bx + by + 0.1, draw() { drawGrassTuft(ctx, _cx, _cy, _bx, _by); } });
        }

        // ── 화단 꽃 클러스터 ──────────────────────────────────────────────
        if (biome === "garden" && rand(bx, by, 4) < 0.55) {
          objItems.push({ sortKey: bx + by + 0.15, draw() { drawFlowerCluster(ctx, _cx, _cy, _bx, _by); } });
        }
        // 일반 꽃 (yard/lawn)
        if ((biome === "yard" || biome === "lawn") && rand(bx, by, 5) < 0.07) {
          objItems.push({ sortKey: bx + by + 0.1, draw() { drawFlower(ctx, _cx, _cy, _bx, _by); } });
        }

        // ── 바위 ────────────────────────────────────────────────────────────
        if (dist >= 2 && rand(bx, by, 8) < 0.025) {
          const _r = rand(bx, by, 9);
          const rx = _cx + (rand(bx, by, 10) - 0.5) * 20;
          const ry = _cy + HH + rand(bx, by, 11) * 5;
          objItems.push({ sortKey: bx + by + 0.3, draw() { drawRock(ctx, rx, ry, _r); } });
        }

        // ── 트리밍된 관목 ───────────────────────────────────────────────────
        if ((biome === "yard" || biome === "lawn" || biome === "garden") && rand(bx, by, 15) < 0.06) {
          const _r = rand(bx, by, 16);
          objItems.push({ sortKey: bx + by + 0.4, draw() { drawTrimmedBush(ctx, _cx, _cy + TH, _r); } });
        }

        // ── 벚꽃나무 — 집 근처 외곽에 드문드문 ───────────────────────────
        if (dist >= 3 && dist <= 7 && rand(bx, by, 96) < 0.04) {
          const _r = rand(bx, by, 97);
          objItems.push({ sortKey: bx + by + 0.6, draw() { drawCherryTree(ctx, _cx, _cy + TH, _r); } });
        }

        // ── 정원 수목 — 외곽 ────────────────────────────────────────────────
        if ((biome === "lawn" || biome === "hedgerow") && dist >= 4 && r < 0.07) {
          const _r = rand(bx, by, 99);
          objItems.push({ sortKey: bx + by + 0.6, draw() { drawGardenTree(ctx, _cx, _cy + TH, _r); } });
        }

        // ── 집 앞 석등 (문 좌우 한 쌍) ──────────────────────────────────
        if ((bx === -1 && (by === 3 || by === 6)) ||
            (bx === 10 && (by === 3 || by === 6))) {
          const lpx = _cx + (bx < 0 ? HW - 2 : -HW + 2);
          const lpy = _cy + TH;
          objItems.push({ sortKey: bx + by + 0.7, draw() { drawLantern(ctx, lpx, lpy); } });
        }

        // ── 돌담 (집 좌측 경계: bx=-1, by=0..9) ─────────────────────────
        if (bx === -1 && by >= 0 && by < ROOM_ROWS && by !== 3 && by !== 4 && by !== 5 && by !== 6) {
          const fpx = _cx + HW - 4;
          const fpy = _cy + TH + 2;
          const hasNext = by < ROOM_ROWS - 1 && !(by + 1 >= 3 && by + 1 <= 6);
          objItems.push({
            sortKey: bx + by + 0.5,
            draw() { drawStoneWallPost(ctx, fpx, fpy, hasNext ? -HW : 0, hasNext ? HH : 0); },
          });
        }

        // ── 돌담 (집 우측 경계: bx=10, by=0..9) ─────────────────────────
        if (bx === ROOM_COLS && by >= 0 && by < ROOM_ROWS && by !== 3 && by !== 4 && by !== 5 && by !== 6) {
          const fpx = _cx - HW + 4;
          const fpy = _cy + TH + 2;
          const hasNext = by < ROOM_ROWS - 1 && !(by + 1 >= 3 && by + 1 <= 6);
          objItems.push({
            sortKey: bx + by + 0.5,
            draw() { drawStoneWallPost(ctx, fpx, fpy, hasNext ? -HW : 0, hasNext ? HH : 0); },
          });
        }
      }
    }

    // ── 지형 타일: 뒤→앞 정렬 후 그리기 (expand 기법으로 이음새 제거) ────────
    terrainItems.sort((a, b) => a.sortKey - b.sortKey);
    for (const item of terrainItems) item.draw();

    // ── 오프스크린 → 메인 캔버스 합성 ──────────────────────────────────────
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(terrainCanvas, 0, 0);

    // ── 오브젝트 정렬 후 렌더링 ──────────────────────────────────────────────
    objItems.sort((a, b) => a.sortKey - b.sortKey);
    for (const item of objItems) item.draw();

    // ── 따뜻한 햇살 분위기 비녜트 ────────────────────────────────────────────
    // 중심부를 밝게, 외곽을 자연스럽게 어둡게
    const roomCenterX = 440 + offsetX + (ROOM_COLS / 2) * HW;
    const roomCenterY = offsetY + (ROOM_ROWS / 2) * HH;

    // 따뜻한 햇살 오버레이 (중앙)
    const sunGlow = ctx.createRadialGradient(
      roomCenterX - 80, roomCenterY - 60, 0,
      roomCenterX - 80, roomCenterY - 60, height * 0.55,
    );
    sunGlow.addColorStop(0,   "rgba(255,230,160,0.10)");
    sunGlow.addColorStop(0.5, "rgba(255,210,120,0.04)");
    sunGlow.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    // 외곽 비녜트
    const vg = ctx.createRadialGradient(
      roomCenterX, roomCenterY, height * 0.15,
      roomCenterX, roomCenterY, Math.max(width, height) * 0.72,
    );
    vg.addColorStop(0,   "rgba(0,0,0,0)");
    vg.addColorStop(0.45,"rgba(0,0,0,0.06)");
    vg.addColorStop(1,   "rgba(0,0,0,0.65)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);

  }, [offsetX, offsetY, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: "absolute", left: 0, top: 0,
        zIndex: 0, pointerEvents: "none",
        imageRendering: "auto",
      }}
    />
  );
}
