import { useRef, useEffect } from "react";
import { TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS, WALL_COLS, WALL_ROWS } from "../../constants/housing";
import { getWallDecoration } from "../../data/wallDecorations";
import { getWallpaper } from "../../data/wallpapers";
import { getFloorTile } from "../../data/floorTiles";
import type { PlacedWallDecoration } from "../../types/housing";

function hexLighten(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${Math.min(255,Math.round(((n>>16)&0xff)*(1+f)))},${Math.min(255,Math.round(((n>>8)&0xff)*(1+f)))},${Math.min(255,Math.round((n&0xff)*(1+f)))})`;
}

// ─── 색상 팔레트 (중세 석조/목재) ─────────────────────────────────────────────

const C = {
  void:     "#080502",   // 배경 (거의 검정)
  ceilDark: "#0C0704",   // 천장 영역 상단
  edge:     "#180804",   // 강한 외곽선
  winGlass: "#6AAED4",   // 창문 유리
  winSky:   "#9ACCE8",   // 창문 상단
  winFrame: "#2A1206",   // 창틀
};

// ─── 기하학 상수 ──────────────────────────────────────────────────────────────

export const ROOM_WALL_H = 148;
export const ROOM_BASE_H = 10;
export const ROOM_MOL_H  = 8;

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
  if (wall === "left") return { x: leX + u * (tpX - leX), y: leY + u * (tpY - leY) - h };
  return { x: tpX + u * (riX - tpX), y: tpY + u * (riY - tpY) - h };
}

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
  width, height, stageLeft, stageTop, cs, wallDecorations, wallpaperId, floorTileId,
}: {
  width: number; height: number;
  stageLeft: number; stageTop: number; cs: number;
  wallDecorations: PlacedWallDecoration[];
  wallpaperId: string;
  floorTileId: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    const hw  = (TILE_W / 2) * cs;
    const hh  = (TILE_H / 2) * cs;
    const WH  = ROOM_WALL_H * cs;
    const BH  = ROOM_BASE_H * cs;
    const MH  = ROOM_MOL_H  * cs;
    const inH = WH - BH - MH;
    const OL  = Math.max(1.5, cs * 2);

    const tpX = stageLeft + 440 * cs,  tpY = stageTop;
    const riX = stageLeft + 880 * cs,  riY = stageTop + 220 * cs;
    const btX = stageLeft + 440 * cs,  btY = stageTop + 440 * cs;
    const leX = stageLeft,             leY = stageTop + 220 * cs;
    const tpWY = tpY - WH;
    const riWY = riY - WH;
    const leWY = leY - WH;

    const wp     = getWallpaper(wallpaperId);
    const ft     = getFloorTile(floorTileId);
    const trimLt = hexLighten(wp.trimColor, 0.50);
    const trimMd = hexLighten(wp.trimColor, 0.24);

    // ── 1. 배경 ──────────────────────────────────────────────────────────
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, width, height);

    const ceilGrad = ctx.createLinearGradient(0, 0, 0, tpWY);
    ceilGrad.addColorStop(0, C.void);
    ceilGrad.addColorStop(1, C.ceilDark);
    ctx.fillStyle = ceilGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(width, 0); ctx.lineTo(width, tpWY + 20);
    ctx.lineTo(riX, riWY); ctx.lineTo(tpX, tpWY); ctx.lineTo(leX, leWY);
    ctx.closePath();
    ctx.fill();

    // ── 벽 공통: 벽돌 줄눈 그리기 ──────────────────────────────────────
    function drawWallJoints(ax: number, ay: number, bx: number, by: number) {
      // 수평 줄눈 (행 구분)
      ctx.lineWidth = Math.max(1.0, cs * 1.3);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = wp.trimColor;
      for (let i = 1; i < WALL_ROWS; i++) {
        const v = BH + inH * (i / WALL_ROWS);
        ctx.beginPath();
        ctx.moveTo(ax, ay - v);
        ctx.lineTo(bx, by - v);
        ctx.stroke();
      }
      // 세로 줄눈 (오프셋 벽돌 패턴)
      ctx.lineWidth = Math.max(0.5, cs * 0.7);
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < WALL_ROWS; i++) {
        const h1 = BH + inH * i / WALL_ROWS;
        const h2 = BH + inH * (i + 1) / WALL_ROWS;
        const uArr = i % 2 === 0 ? [0.33, 0.67] : [0.17, 0.50, 0.83];
        for (const u of uArr) {
          const jx  = ax + u * (bx - ax);
          const jyB = ay + u * (by - ay);
          ctx.beginPath();
          ctx.moveTo(jx, jyB - h1);
          ctx.lineTo(jx, jyB - h2);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // ── 2. 왼쪽 벽 ───────────────────────────────────────────────────────
    const wallLGrad = ctx.createLinearGradient(leX, leWY, leX, leY);
    wallLGrad.addColorStop(0, wp.leftColor1);
    wallLGrad.addColorStop(1, wp.leftColor2);
    ctx.fillStyle = wallLGrad;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpWY, leX, leWY);
    ctx.fill();

    drawWallJoints(leX, leY, tpX, tpY);

    // 걸레받이
    ctx.fillStyle = wp.trimColor;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpY - BH, leX, leY - BH);
    ctx.fill();
    ctx.strokeStyle = trimLt;
    ctx.lineWidth = Math.max(0.8, cs * 1.0);
    ctx.beginPath(); ctx.moveTo(leX, leY - BH); ctx.lineTo(tpX, tpY - BH); ctx.stroke();

    // 몰딩
    ctx.fillStyle = trimMd;
    quad(ctx, leX, leWY + MH, tpX, tpWY + MH, tpX, tpWY, leX, leWY);
    ctx.fill();
    ctx.strokeStyle = trimLt;
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    ctx.beginPath(); ctx.moveTo(leX, leWY + MH); ctx.lineTo(tpX, tpWY + MH); ctx.stroke();

    // ── 3. 오른쪽 벽 ──────────────────────────────────────────────────────
    const wallRGrad = ctx.createLinearGradient(tpX, tpWY, tpX, tpY);
    wallRGrad.addColorStop(0, wp.rightColor1);
    wallRGrad.addColorStop(1, wp.rightColor2);
    ctx.fillStyle = wallRGrad;
    quad(ctx, tpX, tpY, riX, riY, riX, riWY, tpX, tpWY);
    ctx.fill();

    drawWallJoints(tpX, tpY, riX, riY);

    // 걸레받이
    ctx.fillStyle = wp.trimColor;
    quad(ctx, tpX, tpY, riX, riY, riX, riY - BH, tpX, tpY - BH);
    ctx.fill();
    ctx.strokeStyle = trimLt;
    ctx.lineWidth = Math.max(0.8, cs * 1.0);
    ctx.beginPath(); ctx.moveTo(tpX, tpY - BH); ctx.lineTo(riX, riY - BH); ctx.stroke();

    // 몰딩
    ctx.fillStyle = trimMd;
    quad(ctx, tpX, tpWY + MH, riX, riWY + MH, riX, riWY, tpX, tpWY);
    ctx.fill();
    ctx.strokeStyle = trimLt;
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    ctx.beginPath(); ctx.moveTo(tpX, tpWY + MH); ctx.lineTo(riX, riWY + MH); ctx.stroke();

    // ── 4. 벽 장식 렌더링 ────────────────────────────────────────────────
    for (const wd of wallDecorations) {
      const pos = getWallCellCenter(wd.wall, wd.col, wd.row, leX, leY, tpX, tpY, riX, riY, BH, inH);
      const wallDX = wd.wall === "left" ? tpX - leX : riX - tpX;
      const wallDY = wd.wall === "left" ? tpY - leY : riY - tpY;
      drawWallDecoration(ctx, wd.decorId, pos.x, pos.y, wallDX, wallDY, inH, cs);
    }

    // ── 5. 바닥 타일 (대각선 순서 렌더링) ────────────────────────────────
    for (let sum = 0; sum <= (ROOM_COLS - 1) + (ROOM_ROWS - 1); sum++) {
      for (let ty2 = 0; ty2 <= sum; ty2++) {
        const tx2 = sum - ty2;
        if (tx2 >= 0 && tx2 < ROOM_COLS && ty2 >= 0 && ty2 < ROOM_ROWS) {
          drawFloorTile(ctx, tx2, ty2, stageLeft, stageTop, cs, hw, hh, ft.hoverBg, ft.normalBg, ft.normalOutline);
        }
      }
    }

    // ── 6. 외곽선 ────────────────────────────────────────────────────────
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL * 1.4;
    ctx.beginPath(); ctx.moveTo(tpX, tpWY); ctx.lineTo(tpX, tpY); ctx.stroke();
    ctx.lineWidth = OL;
    ctx.beginPath(); ctx.moveTo(leX, leWY); ctx.lineTo(leX, leY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(riX, riWY); ctx.lineTo(riX, riY); ctx.stroke();

    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL;
    ctx.beginPath(); ctx.moveTo(leX, leY); ctx.lineTo(tpX, tpY); ctx.lineTo(riX, riY); ctx.stroke();

    ctx.strokeStyle = "#241408";
    ctx.lineWidth = OL * 0.7;
    ctx.beginPath(); ctx.moveTo(leX, leWY); ctx.lineTo(tpX, tpWY); ctx.lineTo(riX, riWY); ctx.stroke();

    ctx.strokeStyle = ft.normalOutline;
    ctx.lineWidth = OL * 0.8;
    ctx.beginPath(); ctx.moveTo(leX, leY); ctx.lineTo(btX, btY); ctx.lineTo(riX, riY); ctx.stroke();

    // ── 7. 코너 그림자 (깊이감) ──────────────────────────────────────────
    const shadowSize = 30 * cs;
    const sL = ctx.createRadialGradient(leX, leY, 0, leX, leY, shadowSize * 2);
    sL.addColorStop(0, "rgba(0,0,0,0.32)");
    sL.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sL;
    ctx.fillRect(leX - shadowSize, leY - shadowSize * 2, shadowSize * 2, shadowSize * 3);

    const sR = ctx.createRadialGradient(riX, riY, 0, riX, riY, shadowSize * 2);
    sR.addColorStop(0, "rgba(0,0,0,0.32)");
    sR.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sR;
    ctx.fillRect(riX - shadowSize, riY - shadowSize * 2, shadowSize * 2, shadowSize * 3);

  }, [width, height, stageLeft, stageTop, cs, wallDecorations, wallpaperId, floorTileId]);

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
  const dhx   = wallDX / WALL_COLS * 0.45;
  const dhy   = wallDY / WALL_COLS * 0.45;
  const halfH = inH / WALL_ROWS * 0.45;

  const tl = { x: cx - dhx, y: cy - dhy - halfH };
  const tr = { x: cx + dhx, y: cy + dhy - halfH };
  const br = { x: cx + dhx, y: cy + dhy + halfH };
  const bl = { x: cx - dhx, y: cy - dhy + halfH };

  if (decorId === "window") {
    drawWindowDecoration(ctx, tl, tr, br, bl, cs);
    return;
  }

  const fw = Math.max(2, cs * 2.6);
  const pad = fw * 1.3;

  // 외부 짙은 테두리 (두께감)
  ctx.fillStyle = "rgba(20, 10, 4, 0.72)";
  quad(ctx, tl.x-pad, tl.y-pad*0.5, tr.x+pad, tr.y-pad*0.5, br.x+pad, br.y+pad*0.5, bl.x-pad, bl.y+pad*0.5);
  ctx.fill();

  // 패널 배경 (어두운 목재)
  ctx.fillStyle = "rgba(14, 7, 2, 0.68)";
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.fill();

  // 금빛 외곽 프레임
  ctx.strokeStyle = "#8A5818";
  ctx.lineWidth = fw;
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.stroke();

  // 내부 장식선 (이중 프레임)
  const pad2 = fw * 0.55;
  ctx.strokeStyle = "rgba(244,169,54,0.38)";
  ctx.lineWidth = Math.max(0.8, cs * 0.9);
  quad(ctx, tl.x+pad2, tl.y+pad2*0.4, tr.x-pad2, tr.y+pad2*0.4,
       br.x-pad2, br.y-pad2*0.4, bl.x+pad2, bl.y-pad2*0.4);
  ctx.stroke();

  // 이모지
  const deco = getWallDecoration(decorId);
  if (deco) {
    const fontSize = Math.max(12, halfH * 1.2);
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
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
  const p  = fw * 1.4;

  // 리세스 (돌출부 그림자)
  ctx.fillStyle = "#0E0602";
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
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  quad(ctx, tl.x, tl.y,
    tl.x + (tr.x-tl.x)*0.4, tl.y + (tr.y-tl.y)*0.4,
    bl.x + (br.x-bl.x)*0.4, bl.y + (br.y-bl.y)*0.4 + (bl.y-tl.y)*0.45,
    tl.x, tl.y + (bl.y-tl.y)*0.45);
  ctx.fill();

  // 창틀
  ctx.strokeStyle = C.winFrame;
  ctx.lineWidth = fw;
  quad(ctx, tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y);
  ctx.stroke();

  // 가로 창살
  ctx.lineWidth = Math.max(1.2, cs * 1.5);
  ctx.beginPath();
  ctx.moveTo((tl.x+bl.x)/2, (tl.y+bl.y)/2);
  ctx.lineTo((tr.x+br.x)/2, (tr.y+br.y)/2);
  ctx.stroke();

  // 세로 창살
  ctx.beginPath();
  ctx.moveTo((tl.x+tr.x)/2, (tl.y+tr.y)/2);
  ctx.lineTo((bl.x+br.x)/2, (bl.y+br.y)/2);
  ctx.stroke();
}

// ─── 바닥 타일 (중세 도트 느낌) ──────────────────────────────────────────────

function drawFloorTile(
  ctx: CanvasRenderingContext2D,
  tx: number, ty: number,
  stageLeft: number, stageTop: number,
  cs: number, hw: number, hh: number,
  tileA: string, tileB: string, tileEdge: string,
) {
  const cx = stageLeft + ((tx - ty) * 44 + 440) * cs;
  const cy = stageTop  + ((tx + ty) * 22) * cs;

  // 체커보드 패턴 — 강한 명암 대비로 스냅감 극대화
  const isAlt = (tx + ty) % 2 === 0;
  ctx.fillStyle = isAlt ? tileA : tileB;
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.fill();

  // 상단 하이라이트 (빛이 위에서 내려오는 느낌)
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 1.14);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.fill();

  // 하단 그림자 (깊이감)
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(cx + hw * 0.45, cy + hh * 1.45);
  ctx.lineTo(cx + hw,        cy + hh);
  ctx.lineTo(cx,             cy + hh * 2);
  ctx.lineTo(cx - hw,        cy + hh);
  ctx.lineTo(cx - hw * 0.45, cy + hh * 1.45);
  ctx.closePath();
  ctx.fill();

  // 두껍고 선명한 타일 테두리 — 스냅감의 핵심
  ctx.strokeStyle = tileEdge;
  ctx.lineWidth = Math.max(1.6, cs * 2.4);
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.stroke();
}
