import { useRef, useEffect } from "react";
import { TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, WALL_COLS, WALL_ROWS } from "../../constants/housing";
import { getWallDecoration } from "../../data/wallDecorations";
import type { PlacedWallDecoration } from "../../types/housing";

// ─── 색상 팔레트 ───────────────────────────────────────────────────────────────

const C = {
  void:       "#080604",
  ceilDark:   "#120c07",
  wallL:      "#c8b585",   // 왼벽 — 따뜻한 베이지
  wallLhi:    "#d4c490",   // 왼벽 하이라이트 (아래쪽)
  wallR:      "#ddd0a0",   // 오른벽 — 더 밝음
  wallRhi:    "#e8dab0",   // 오른벽 하이라이트
  wallLine:   "#b0a070",   // 벽 패널선
  base:       "#3a2008",   // 걸레받이
  baseLt:     "#5a3412",   // 걸레받이 밝은면
  molding:    "#6e4c20",   // 크라운 몰딩
  moldLt:     "#8a6030",   // 몰딩 밝은면
  floorA:     "#c88040",   // 바닥 타일 A
  floorB:     "#b06c28",   // 바닥 타일 B
  floorGrain: "#8c5010",   // 목재 결
  floorEdge:  "#6a3c0c",   // 타일 테두리
  edge:       "#2a1808",   // 외곽선
  winGlass:   "#90c8e8",   // 창문 유리
  winSky:     "#b8dff4",   // 창문 상단
  winFrame:   "#3a2008",   // 창틀
};

// ─── 기하학 상수 (IndoorRoomBg 외부에서도 동일하게 사용) ──────────────────────

export const ROOM_WALL_H   = 148;   // 벽 높이 (스테이지 단위)
export const ROOM_BASE_H   = 10;    // 걸레받이 (스테이지 단위)
export const ROOM_MOL_H    = 8;     // 크라운 몰딩 (스테이지 단위)

/** 캔버스에서 벽 격자 셀 중심 위치 반환 (BH, inH 는 cs 적용된 픽셀 값) */
function getWallCellCenter(
  wall: "left" | "right",
  col: number, row: number,
  leX: number, leY: number,
  tpX: number, tpY: number,
  riX: number, riY: number,
  BH: number, inH: number,
) {
  const u = (col + 0.5) / WALL_COLS;
  const h = BH + (row + 0.5) * inH / WALL_ROWS;
  if (wall === "left") {
    return { x: leX + u * (tpX - leX), y: leY + u * (tpY - leY) - h };
  }
  return { x: tpX + u * (riX - tpX), y: tpY + u * (riY - tpY) - h };
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function quad(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
  ctx.closePath();
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function IndoorRoomBg({
  width, height, stageLeft, stageTop, cs, wallDecorations,
}: {
  width: number; height: number;
  stageLeft: number; stageTop: number; cs: number;
  wallDecorations: PlacedWallDecoration[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const hw   = (TILE_W / 2) * cs;
    const hh   = (TILE_H / 2) * cs;
    const WH   = ROOM_WALL_H * cs;
    const BH   = ROOM_BASE_H * cs;
    const MH   = ROOM_MOL_H  * cs;
    const inH  = WH - BH - MH;       // 패널 영역 높이
    const OL   = Math.max(1.5, cs * 2);

    // ── 꼭짓점 ──────────────────────────────────────────────────────────
    const tpX = stageLeft + 440 * cs,  tpY = stageTop;
    const riX = stageLeft + 880 * cs,  riY = stageTop + 220 * cs;
    const btX = stageLeft + 440 * cs,  btY = stageTop + 440 * cs;
    const leX = stageLeft,             leY = stageTop + 220 * cs;
    const tpWY = tpY - WH;
    const riWY = riY - WH;
    const leWY = leY - WH;

    // ── 1. 배경 ──────────────────────────────────────────────────────────
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, width, height);

    // 천장 영역 (그라데이션: 위 = 어두움, 아래 = 살짝 밝음)
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, tpWY);
    ceilGrad.addColorStop(0, C.void);
    ceilGrad.addColorStop(1, C.ceilDark);
    ctx.fillStyle = ceilGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, tpWY + 20);
    ctx.lineTo(riX, riWY); ctx.lineTo(tpX, tpWY); ctx.lineTo(leX, leWY);
    ctx.closePath();
    ctx.fill();

    // ── 2. 왼쪽 벽 ───────────────────────────────────────────────────────

    // 벽 그라데이션 (아래가 약간 더 밝음)
    const wallLGrad = ctx.createLinearGradient(leX, leWY, leX, leY);
    wallLGrad.addColorStop(0, C.wallL);
    wallLGrad.addColorStop(1, C.wallLhi);
    ctx.fillStyle = wallLGrad;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpWY, leX, leWY);
    ctx.fill();

    // 수평 패널선 (3줄 → 4 구역)
    for (let i = 1; i <= 3; i++) {
      const v = BH + inH * (i / 4);
      ctx.strokeStyle = C.wallLine;
      ctx.lineWidth = Math.max(0.8, cs * 1.0);
      ctx.beginPath();
      ctx.moveTo(leX, leY - v);
      ctx.lineTo(tpX, tpY - v);
      ctx.stroke();
    }

    // 걸레받이
    const baseGradL = ctx.createLinearGradient(leX, 0, tpX, 0);
    baseGradL.addColorStop(0, C.base); baseGradL.addColorStop(1, C.baseLt);
    ctx.fillStyle = baseGradL;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpY - BH, leX, leY - BH);
    ctx.fill();
    // 걸레받이 상단 하이라이트
    ctx.strokeStyle = C.baseLt;
    ctx.lineWidth = Math.max(0.8, cs * 1.0);
    ctx.beginPath(); ctx.moveTo(leX, leY - BH); ctx.lineTo(tpX, tpY - BH); ctx.stroke();

    // 크라운 몰딩
    ctx.fillStyle = C.molding;
    quad(ctx, leX, leWY + MH, tpX, tpWY + MH, tpX, tpWY, leX, leWY);
    ctx.fill();
    ctx.strokeStyle = C.moldLt;
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    ctx.beginPath(); ctx.moveTo(leX, leWY + MH); ctx.lineTo(tpX, tpWY + MH); ctx.stroke();

    // ── 3. 오른쪽 벽 ──────────────────────────────────────────────────────

    const wallRGrad = ctx.createLinearGradient(tpX, tpWY, tpX, tpY);
    wallRGrad.addColorStop(0, C.wallR);
    wallRGrad.addColorStop(1, C.wallRhi);
    ctx.fillStyle = wallRGrad;
    quad(ctx, tpX, tpY, riX, riY, riX, riWY, tpX, tpWY);
    ctx.fill();

    for (let i = 1; i <= 3; i++) {
      const v = BH + inH * (i / 4);
      ctx.strokeStyle = "#cabb88";
      ctx.lineWidth = Math.max(0.8, cs * 1.0);
      ctx.beginPath();
      ctx.moveTo(tpX, tpY - v);
      ctx.lineTo(riX, riY - v);
      ctx.stroke();
    }

    const baseGradR = ctx.createLinearGradient(tpX, 0, riX, 0);
    baseGradR.addColorStop(0, C.baseLt); baseGradR.addColorStop(1, C.base);
    ctx.fillStyle = baseGradR;
    quad(ctx, tpX, tpY, riX, riY, riX, riY - BH, tpX, tpY - BH);
    ctx.fill();
    ctx.strokeStyle = C.baseLt;
    ctx.lineWidth = Math.max(0.8, cs * 1.0);
    ctx.beginPath(); ctx.moveTo(tpX, tpY - BH); ctx.lineTo(riX, riY - BH); ctx.stroke();

    ctx.fillStyle = C.molding;
    quad(ctx, tpX, tpWY + MH, riX, riWY + MH, riX, riWY, tpX, tpWY);
    ctx.fill();
    ctx.strokeStyle = C.moldLt;
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    ctx.beginPath(); ctx.moveTo(tpX, tpWY + MH); ctx.lineTo(riX, riWY + MH); ctx.stroke();

    // ── 4. 벽 장식 렌더링 ────────────────────────────────────────────────
    for (const wd of wallDecorations) {
      const pos = getWallCellCenter(wd.wall, wd.col, wd.row, leX, leY, tpX, tpY, riX, riY, BH, inH);
      const wallDX = wd.wall === "left" ? tpX - leX : riX - tpX;
      const wallDY = wd.wall === "left" ? tpY - leY : riY - tpY;
      drawWallDecoration(ctx, wd.decorId, pos.x, pos.y, wallDX, wallDY, inH, cs);
    }

    // ── 5. 바닥 타일 ─────────────────────────────────────────────────────
    for (let sum = 0; sum <= (ROOM_COLS - 1) + (ROOM_ROWS - 1); sum++) {
      for (let ty = 0; ty <= sum; ty++) {
        const tx = sum - ty;
        if (tx >= 0 && tx < ROOM_COLS && ty >= 0 && ty < ROOM_ROWS) {
          drawFloorTile(ctx, tx, ty, stageLeft, stageTop, cs, hw, hh);
        }
      }
    }

    // ── 6. 외곽선 ────────────────────────────────────────────────────────

    // 벽 코너 세로선 (가장 눈에 띄는 선)
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL * 1.3;
    ctx.beginPath(); ctx.moveTo(tpX, tpWY); ctx.lineTo(tpX, tpY); ctx.stroke();
    ctx.lineWidth = OL;
    ctx.beginPath(); ctx.moveTo(leX, leWY); ctx.lineTo(leX, leY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(riX, riWY); ctx.lineTo(riX, riY); ctx.stroke();

    // 벽-바닥 경계선
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL;
    ctx.beginPath(); ctx.moveTo(leX, leY); ctx.lineTo(tpX, tpY); ctx.lineTo(riX, riY); ctx.stroke();

    // 천장 선
    ctx.strokeStyle = "#302010";
    ctx.lineWidth = OL * 0.7;
    ctx.beginPath(); ctx.moveTo(leX, leWY); ctx.lineTo(tpX, tpWY); ctx.lineTo(riX, riWY); ctx.stroke();

    // 바닥 앞면 (열린 면)
    ctx.strokeStyle = C.floorEdge;
    ctx.lineWidth = OL * 0.7;
    ctx.beginPath(); ctx.moveTo(leX, leY); ctx.lineTo(btX, btY); ctx.lineTo(riX, riY); ctx.stroke();

    // ── 7. 코너 그림자 (깊이감) ──────────────────────────────────────────
    const shadowSize = 30 * cs;
    // 왼쪽 코너
    const sL = ctx.createRadialGradient(leX, leY, 0, leX, leY, shadowSize * 2);
    sL.addColorStop(0, "rgba(0,0,0,0.25)");
    sL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sL;
    ctx.fillRect(leX - shadowSize, leY - shadowSize * 2, shadowSize * 2, shadowSize * 3);

    // 오른쪽 코너
    const sR = ctx.createRadialGradient(riX, riY, 0, riX, riY, shadowSize * 2);
    sR.addColorStop(0, "rgba(0,0,0,0.25)");
    sR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sR;
    ctx.fillRect(riX - shadowSize, riY - shadowSize * 2, shadowSize * 2, shadowSize * 3);

  }, [width, height, stageLeft, stageTop, cs, wallDecorations]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
    />
  );
}

// ─── 벽 장식 렌더링 ──────────────────────────────────────────────────────────

function drawWallDecoration(
  ctx: CanvasRenderingContext2D,
  decorId: string,
  cx: number, cy: number,
  wallDX: number, wallDY: number,
  inH: number, cs: number,
) {
  const halfW  = Math.abs(wallDX) / WALL_COLS * 0.45;
  const halfHw = Math.abs(wallDY) / WALL_COLS * 0.45;
  const halfH  = inH / WALL_ROWS * 0.45;

  const sign = wallDX > 0 ? 1 : -1;

  const tl = { x: cx - sign * halfW, y: cy - halfHw - halfH };
  const tr = { x: cx + sign * halfW, y: cy + halfHw - halfH };
  const br = { x: cx + sign * halfW, y: cy + halfHw + halfH };
  const bl = { x: cx - sign * halfW, y: cy - halfHw + halfH };

  if (decorId === "window") {
    drawWindowDecoration(ctx, tl, tr, br, bl, cs);
    return;
  }

  // ── 일반 장식: 어두운 패널 + 이모지 ──────────────────────────────────
  ctx.fillStyle = "rgba(10,6,2,0.55)";
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.fill();

  ctx.strokeStyle = "#6a4820";
  ctx.lineWidth = Math.max(1.5, cs * 1.8);
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.stroke();

  const deco = getWallDecoration(decorId);
  if (deco) {
    const fontSize = Math.max(12, halfH * 1.2);
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign  = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(deco.emoji, cx, cy);
  }
}

function drawWindowDecoration(
  ctx: CanvasRenderingContext2D,
  tl: {x:number;y:number}, tr: {x:number;y:number},
  br: {x:number;y:number}, bl: {x:number;y:number},
  cs: number,
) {
  const fw = Math.max(2, cs * 2.4);

  // 리세스 (약간 어두운 배경)
  const p = fw * 1.4;
  ctx.fillStyle = "#1a0e06";
  quad(ctx, tl.x-p, tl.y-p, tr.x+p, tr.y-p, br.x+p, br.y+p, bl.x-p, bl.y+p);
  ctx.fill();

  // 유리 (하늘 그라데이션)
  const grad = ctx.createLinearGradient(tl.x, tl.y, bl.x, bl.y);
  grad.addColorStop(0, C.winSky);
  grad.addColorStop(1, C.winGlass);
  ctx.fillStyle = grad;
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.fill();

  // 반사 하이라이트
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  quad(ctx, tl.x, tl.y,
    tl.x + (tr.x-tl.x)*0.4, tl.y + (tr.y-tl.y)*0.4,
    bl.x + (br.x-bl.x)*0.4, bl.y + (br.y-bl.y)*0.4 + (bl.y-tl.y)*0.45,
    tl.x, tl.y + (bl.y-tl.y)*0.45);
  ctx.fill();

  // 외곽 프레임
  ctx.strokeStyle = C.winFrame;
  ctx.lineWidth = fw;
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.stroke();

  // 가로 창살
  const mx1 = (tl.x+bl.x)/2, my1 = (tl.y+bl.y)/2;
  const mx2 = (tr.x+br.x)/2, my2 = (tr.y+br.y)/2;
  ctx.lineWidth = Math.max(1.2, cs * 1.5);
  ctx.strokeStyle = C.winFrame;
  ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();

  // 세로 창살
  const mx3 = (tl.x+tr.x)/2, my3 = (tl.y+tr.y)/2;
  const mx4 = (bl.x+br.x)/2, my4 = (bl.y+br.y)/2;
  ctx.beginPath(); ctx.moveTo(mx3, my3); ctx.lineTo(mx4, my4); ctx.stroke();
}

// ─── 바닥 타일 ────────────────────────────────────────────────────────────────

function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  stageLeft: number, stageTop: number,
  cs: number, hw: number, hh: number,
) {
  const cx = stageLeft + ((tx - ty) * 44 + 440) * cs;
  const cy = stageTop  + ((tx + ty) * 22) * cs;

  // ty 기준 줄무늬 (가로 판재 방향)
  const alt  = ty % 2 === 0;
  const base = alt ? C.floorA : C.floorB;

  ctx.fillStyle = base;
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.fill();

  // 목재 결 (1~2줄)
  ctx.strokeStyle = C.floorGrain;
  ctx.lineWidth = Math.max(0.4, cs * 0.45);
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.28, cy + hh * 0.72);
  ctx.lineTo(cx + hw * 0.28, cy + hh * 1.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + hw * 0.05, cy + hh * 0.25);
  ctx.lineTo(cx + hw * 0.60, cy + hh * 1.0);
  ctx.stroke();

  // 타일 테두리
  ctx.strokeStyle = C.floorEdge;
  ctx.lineWidth = Math.max(0.5, cs * 0.6);
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.stroke();
}
