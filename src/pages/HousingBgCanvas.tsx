// ─── 하우징 배경 캔버스 ────────────────────────────────────────────────────────
// 방 주변을 자연스러운 RPG 야외 환경으로 표현한다.
// ▸ 타일 경계선/삼각 패턴 없음 — 색상 노이즈로 부드럽게 블렌딩
// ▸ 중앙은 잔디/흙 질감, 주변부에 나무·울타리·표지판·강 배치

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
type Biome = "clearing" | "meadow" | "forest" | "path" | "water" | "bridge";

function getBiome(bx: number, by: number): Biome {
  // 강 (화면 오른쪽 끝)
  if (bx >= 19 && by >= -10 && by <= 22) return "water";
  // 다리 (강 위)
  if (bx === 18 && by >= 2 && by <= 7) return "bridge";
  // 출구 방향 흙길 (right door → east)
  if (bx >= 10 && bx <= 18 && by >= 2 && by <= 7) {
    const edge = by === 2 || by === 7;
    return edge && rand(bx, by, 50) < 0.45 ? "clearing" : "path";
  }
  // 농장 방향 흙길 (left door → west)
  if (bx >= -9 && bx <= -1 && by >= 2 && by <= 7) {
    const edge = by === 2 || by === 7;
    return edge && rand(bx, by, 51) < 0.45 ? "clearing" : "path";
  }

  const dist = roomDist(bx, by);
  if (dist <= 2) return "clearing";
  if (dist <= 6) return "meadow";
  return "forest";
}

// ─── 바이옴별 베이스 색 [R, G, B] ─────────────────────────────────────────────
const BASE_COLOR: Record<Biome, [number, number, number]> = {
  clearing: [68,  106, 46],   // 밝은 잔디 — 방 근처
  meadow:   [52,  86,  32],   // 보통 잔디
  forest:   [36,  62,  20],   // 짙은 잔디
  path:     [102, 82,  50],   // 흙길 (갈색)
  water:    [22,  48,  82],   // 강 (어두운 파랑)
  bridge:   [106, 84,  48],   // 다리 (나무 색)
};

function clamp(v: number): number { return Math.max(0, Math.min(255, v | 0)); }

// 부드러운 저주파 노이즈 → 타일이 자연스럽게 블렌딩되도록
function smoothNoise(bx: number, by: number): number {
  return Math.sin(bx * 0.38 + by * 0.27 + 1.4) * 7
       + Math.sin(bx * 0.15 - by * 0.43 + 0.9) * 5;
}

function getTileColor(bx: number, by: number, biome: Biome): string {
  const [r, g, b] = BASE_COLOR[biome];
  const n = smoothNoise(bx, by) + (rand(bx, by, 20) - 0.5) * 4;
  return `rgb(${clamp(r + n)},${clamp(g + n)},${clamp(b + n)})`;
}

// ─── 타일 다이아몬드 그리기 ───────────────────────────────────────────────────
// cx,cy = top-point (꼭대기 점) 좌표
function fillDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + HW, cy + HH);
  ctx.lineTo(cx, cy + TH);
  ctx.lineTo(cx - HW, cy + HH);
  ctx.closePath();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  bx: number, by: number,
  biome: Biome,
) {
  // ── 기본 채우기 (단색 + 노이즈) — 삼각 패턴 방지를 위해 half-split 없음 ──
  fillDiamond(ctx, cx, cy);
  ctx.fillStyle = getTileColor(bx, by, biome);
  ctx.fill();

  // 아주 약한 왼쪽 깊이 힌트 (0.04 α — 거의 안 보임)
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - HW, cy + HH);
  ctx.lineTo(cx, cy + TH);
  ctx.closePath();
  ctx.fillStyle = "rgba(0,0,0,0.04)";
  ctx.fill();

  // ── 바이옴별 디테일 ──────────────────────────────────────────────────────
  if (biome === "water") {
    if (rand(bx, by, 1) < 0.55) {
      const wx = cx + (rand(bx, by, 2) - 0.5) * 28;
      const wy = cy + HH + (rand(bx, by, 3) - 0.5) * 10;
      ctx.strokeStyle = "rgba(100,175,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx - 10, wy);
      ctx.bezierCurveTo(wx - 4, wy - 3, wx + 4, wy - 3, wx + 10, wy);
      ctx.stroke();
    }
  } else if (biome === "bridge") {
    // 나무 판자 라인
    ctx.strokeStyle = "rgba(50,32,12,0.28)";
    ctx.lineWidth = 1.2;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const x1 = cx - HW * t,     y1 = cy + HH * t;
      const x2 = cx + HW * (1-t), y2 = cy + HH * (1+t);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  } else if (biome === "path") {
    // 자갈 흔적
    if (rand(bx, by, 11) < 0.42) {
      const px = cx + (rand(bx, by, 12) - 0.5) * 20;
      const py = cy + HH + (rand(bx, by, 13) - 0.5) * 7;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(px, py - 1, rand(bx, by, 14) * 8 + 4, 2);
    }
  }
}

// ─── 풀 이삭 ─────────────────────────────────────────────────────────────────
function drawGrassTuft(ctx: CanvasRenderingContext2D, cx: number, cy: number, bx: number, by: number) {
  const gx = cx + (rand(bx, by, 30) - 0.5) * 20;
  const gy = cy + HH + rand(bx, by, 31) * 4;
  ctx.fillStyle = "#5ab828";
  ctx.fillRect(gx,     gy - 5, 2, 5);
  ctx.fillRect(gx + 4, gy - 7, 2, 7);
  ctx.fillRect(gx + 8, gy - 4, 2, 4);
}

// ─── 꽃 ──────────────────────────────────────────────────────────────────────
const FLOWER_PAL = ["#ff7799","#ffdd44","#cc88ff","#44ddaa","#ff9933","#88ccff"];
function drawFlower(ctx: CanvasRenderingContext2D, cx: number, cy: number, bx: number, by: number) {
  const fx = cx + (rand(bx, by, 40) - 0.5) * 22;
  const fy = cy + HH + rand(bx, by, 41) * 4 - 1;
  ctx.fillStyle = FLOWER_PAL[Math.floor(rand(bx, by, 42) * FLOWER_PAL.length)];
  ctx.fillRect(fx - 1, fy - 1, 4, 4);
  ctx.fillStyle = "#4a8a20";
  ctx.fillRect(fx, fy + 3, 1, 4);
}

// ─── 나무 ─────────────────────────────────────────────────────────────────────
function drawTree(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, r: number) {
  const h = 54 + r * 28, w = 28 + r * 14;
  const trunkH = 13 + r * 5;

  // 그림자
  ctx.beginPath();
  ctx.ellipse(baseX + 7, baseY + 2, w * 0.38, 6, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fill();

  // 기둥
  ctx.fillStyle = "#5a3c1e";
  ctx.fillRect(baseX - 3, baseY - trunkH, 7, trunkH);
  ctx.fillStyle = "#7a5430";
  ctx.fillRect(baseX - 2, baseY - trunkH + 1, 2, trunkH - 2);

  // 잎 — 4 레이어 (어두움→밝음)
  const layers: [number, number, number, number, string][] = [
    [0,          -0.36, 0.44, 0.44, "#1e4c08"],
    [-w * 0.08,  -0.52, 0.41, 0.41, "#2c6812"],
    [ w * 0.05,  -0.63, 0.37, 0.37, "#3c881e"],
    [ w * 0.12,  -0.72, 0.22, 0.22, "#58a82c"],
  ];
  for (const [ox, oy, rx, ry, col] of layers) {
    ctx.beginPath();
    ctx.ellipse(baseX + ox, baseY - trunkH + oy * h, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }
  // 하이라이트
  ctx.beginPath();
  ctx.ellipse(baseX + w * 0.09, baseY - trunkH - h * 0.8, w * 0.1, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fill();
}

// ─── 관목 ─────────────────────────────────────────────────────────────────────
function drawBush(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, r: number) {
  const w = 20 + r * 10, h = 14 + r * 8;

  ctx.beginPath();
  ctx.ellipse(baseX + 4, baseY + 2, w * 0.38, 5, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fill();

  const layers: [number, number, number, number, string][] = [
    [0,        -0.35, 0.48, 0.48, "#265a10"],
    [w * 0.1,  -0.50, 0.40, 0.40, "#388a1e"],
    [w * 0.15, -0.62, 0.20, 0.20, "#52a828"],
  ];
  for (const [ox, oy, rx, ry, col] of layers) {
    ctx.beginPath();
    ctx.ellipse(baseX + ox, baseY + oy * h, w * rx, h * ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }
}

// ─── 바위 ─────────────────────────────────────────────────────────────────────
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const w = 12 + r * 10, h = 8 + r * 5;

  ctx.beginPath();
  ctx.ellipse(x + 3, y + 2, w * 0.5, h * 0.4, 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#625e52"; ctx.fill();

  ctx.beginPath();
  ctx.ellipse(x - w * 0.08, y - h * 0.12, w * 0.28, h * 0.28, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#88836e"; ctx.fill();
}

// ─── 울타리 기둥 ──────────────────────────────────────────────────────────────
// px,py = 기둥 하단 중심. 다음 기둥 방향 벡터 (dx,dy) 로 레일을 그린다.
function drawFencePost(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,
  railDx: number, railDy: number,
) {
  // 기둥
  ctx.fillStyle = "#8a6a3a";
  ctx.fillRect(px - 2, py - 22, 5, 22);
  ctx.fillStyle = "#aa8848";
  ctx.fillRect(px - 3, py - 25, 7, 5);

  // 레일 2개 (다음 기둥 방향으로)
  if (railDx !== 0 || railDy !== 0) {
    ctx.strokeStyle = "#7a5a30";
    ctx.lineWidth = 2;
    for (const offset of [-15, -8] as const) {
      ctx.beginPath();
      ctx.moveTo(px + 3,              py + offset);
      ctx.lineTo(px + 3 + railDx - 3, py + offset + railDy);
      ctx.stroke();
    }
  }
}

// ─── 표지판 ───────────────────────────────────────────────────────────────────
function drawSignpost(ctx: CanvasRenderingContext2D, px: number, py: number) {
  ctx.fillStyle = "#8a6a3a";
  ctx.fillRect(px - 2, py - 34, 5, 34);
  ctx.fillStyle = "#9a7228";
  ctx.fillRect(px - 15, py - 46, 32, 17);
  ctx.fillStyle = "#c49838";
  ctx.fillRect(px - 14, py - 45, 30, 15);
  ctx.fillStyle = "#7a5820";
  ctx.fillRect(px - 10, py - 40, 14, 2);
  ctx.fillRect(px - 10, py - 36, 10, 2);
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

    // ── 배경 베이스 ───────────────────────────────────────────────────────────
    ctx.fillStyle = "#162209";
    ctx.fillRect(0, 0, width, height);

    // ── 타일 + 오브젝트 수집 후 페인터 알고리즘 정렬 ─────────────────────────
    type Item = { sortKey: number; draw: () => void };
    const items: Item[] = [];

    const BX_MIN = -22, BX_MAX = 32;
    const BY_MIN = -22, BY_MAX = 32;

    for (let bx = BX_MIN; bx <= BX_MAX; bx++) {
      for (let by = BY_MIN; by <= BY_MAX; by++) {
        // 룸 내부 타일은 FloorSVG 가 덮으므로 스킵
        if (bx >= 0 && bx < ROOM_COLS && by >= 0 && by < ROOM_ROWS) continue;

        // 화면 좌표 (top-point)
        const tileLeft = (bx - by) * HW + 440 + offsetX;
        const tileTop  = (bx + by) * HH + offsetY;
        const cx = tileLeft + HW;
        const cy = tileTop;

        // 시야 컬링
        if (cx + HW < -20 || cx - HW > width  + 20) continue;
        if (cy > height + 40 || cy + TH < -280) continue;

        const biome = getBiome(bx, by);
        const dist  = roomDist(bx, by);
        const r     = rand(bx, by);

        const _cx = cx, _cy = cy, _bx = bx, _by = by, _biome = biome;

        // 타일
        items.push({
          sortKey: bx + by,
          draw() { drawTile(ctx, _cx, _cy, _bx, _by, _biome); },
        });

        // ── 잔디·꽃 ─────────────────────────────────────────────────────────
        const isGrass = biome === "clearing" || biome === "meadow" || biome === "forest";
        if (isGrass) {
          if (rand(bx, by, 1) < 0.28) {
            items.push({ sortKey: bx + by + 0.1, draw() { drawGrassTuft(ctx, _cx, _cy, _bx, _by); } });
          }
          if (biome !== "forest" && rand(bx, by, 4) < 0.08) {
            items.push({ sortKey: bx + by + 0.1, draw() { drawFlower(ctx, _cx, _cy, _bx, _by); } });
          }
        }

        // ── 바위 ────────────────────────────────────────────────────────────
        if (dist >= 2 && rand(bx, by, 8) < 0.04) {
          const _r = rand(bx, by, 9);
          const rx = _cx + (rand(bx, by, 10) - 0.5) * 24;
          const ry = _cy + HH + rand(bx, by, 11) * 6;
          items.push({ sortKey: bx + by + 0.3, draw() { drawRock(ctx, rx, ry, _r); } });
        }

        // ── 관목 ────────────────────────────────────────────────────────────
        if ((biome === "meadow" || biome === "forest") && rand(bx, by, 15) < 0.07) {
          const _r = rand(bx, by, 16);
          items.push({ sortKey: bx + by + 0.4, draw() { drawBush(ctx, _cx, _cy + TH, _r); } });
        }

        // ── 나무 ────────────────────────────────────────────────────────────
        if (isGrass && dist >= 3 && r < 0.075) {
          const _r = rand(bx, by, 99);
          items.push({ sortKey: bx + by + 0.6, draw() { drawTree(ctx, _cx, _cy + TH, _r); } });
        }

        // ── 울타리 (방 좌측 경계: bx=-1, by=0..9) ──────────────────────────
        if (bx === -1 && by >= 0 && by < ROOM_ROWS) {
          // 기둥 위치: 타일 오른쪽-앞 꼭짓점 근처
          const fpx = _cx + HW - 4;
          const fpy = _cy + TH + 2;
          // 레일 방향: +by 방향 = screen (−HW, +HH) per tile
          const hasNext = by < ROOM_ROWS - 1;
          items.push({
            sortKey: bx + by + 0.5,
            draw() { drawFencePost(ctx, fpx, fpy, hasNext ? -HW : 0, hasNext ? HH : 0); },
          });
        }

        // ── 울타리 (방 우측 경계 윗라인: bx=10, by=0..9) ─────────────────
        if (bx === ROOM_COLS && by >= 0 && by < ROOM_ROWS) {
          const fpx = _cx - HW + 4;
          const fpy = _cy + TH + 2;
          const hasNext = by < ROOM_ROWS - 1;
          items.push({
            sortKey: bx + by + 0.5,
            draw() { drawFencePost(ctx, fpx, fpy, hasNext ? -HW : 0, hasNext ? HH : 0); },
          });
        }

        // ── 표지판 (출구 길 입구) ────────────────────────────────────────────
        if (bx === 12 && by === 3) {
          items.push({
            sortKey: bx + by + 0.7,
            draw() { drawSignpost(ctx, _cx + 10, _cy + TH); },
          });
        }
      }
    }

    // 페인터 알고리즘 정렬 후 드로우
    items.sort((a, b) => a.sortKey - b.sortKey);
    for (const item of items) item.draw();

    // ── 비녜트 + 중앙 밝음 ────────────────────────────────────────────────────
    // 방 위치 기준으로 중앙을 밝게, 주변을 어둡게
    const roomCenterX = 440 + offsetX + (ROOM_COLS / 2) * HW;
    const roomCenterY = offsetY + (ROOM_ROWS / 2) * HH;

    const vg = ctx.createRadialGradient(
      roomCenterX, roomCenterY, height * 0.12,
      roomCenterX, roomCenterY, Math.max(width, height) * 0.75,
    );
    vg.addColorStop(0,    "rgba(0,0,0,0)");
    vg.addColorStop(0.5,  "rgba(0,0,0,0.1)");
    vg.addColorStop(1,    "rgba(0,0,0,0.75)");
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
        imageRendering: "pixelated",
      }}
    />
  );
}
