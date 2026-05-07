import { useRef, useEffect } from "react";
import { TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS } from "../../constants/housing";

// ─── 색상 팔레트 ───────────────────────────────────────────────────────────────

const C = {
  void:       "#0a0705",
  ceiling:    "#180f08",
  wallL:      "#cdb990",   // 왼벽 — 따뜻한 회반죽
  wallR:      "#ddc9a0",   // 오른벽 — 밝은 면
  wallLine:   "#b8a478",   // 벽 패널 선
  base:       "#4a2e10",   // 걸레받이
  molding:    "#7a5a28",   // 크라운 몰딩
  floorA:     "#c07c30",   // 바닥 A
  floorB:     "#a86820",   // 바닥 B
  floorGrain: "#8a5010",   // 목재 결
  floorEdge:  "#683a0c",   // 타일 테두리
  edge:       "#2e1a08",   // 외곽선
  win:        "#8cc8ec",   // 창문 유리
  winSky:     "#aadcf8",   // 창문 하늘
  winFrame:   "#3a2208",   // 창틀
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function quad(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  x4: number, y4: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function IndoorRoomBg({
  width, height, stageLeft, stageTop, cs,
}: {
  width: number;
  height: number;
  stageLeft: number;
  stageTop: number;
  cs: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // ── 기본 단위 ─────────────────────────────────────────────────────────
    const hw = (TILE_W / 2) * cs;
    const hh = (TILE_H / 2) * cs;
    const WH  = 148 * cs;   // 벽 높이
    const BH  = 10  * cs;   // 걸레받이
    const MH  =  8  * cs;   // 몰딩
    const OL  = Math.max(1.5, cs * 2.0); // 외곽선 두께

    // ── 마름모 꼭짓점 (캔버스 좌표) ──────────────────────────────────────
    const tpX = stageLeft + 440 * cs,  tpY = stageTop;
    const riX = stageLeft + 880 * cs,  riY = stageTop + 220 * cs;
    const btX = stageLeft + 440 * cs,  btY = stageTop + 440 * cs;
    const leX = stageLeft,             leY = stageTop + 220 * cs;

    // 벽 상단 Y
    const tpWY = tpY - WH;
    const riWY = riY - WH;
    const leWY = leY - WH;

    // ── 1. 천장 / 배경 ────────────────────────────────────────────────────
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, width, height);

    // 천장 영역 (벽 위 공간)
    ctx.fillStyle = C.ceiling;
    ctx.beginPath();
    ctx.moveTo(leX, leWY);
    ctx.lineTo(tpX, tpWY);
    ctx.lineTo(riX, riWY);
    ctx.lineTo(riX, 0);
    ctx.lineTo(leX, 0);
    ctx.closePath();
    ctx.fill();

    // ── 2. 왼쪽 벽 ───────────────────────────────────────────────────────
    ctx.fillStyle = C.wallL;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpWY, leX, leWY);
    ctx.fill();

    // 왼벽 수평 패널 선
    const panelCount = 6;
    const innerH_L = WH - BH - MH;
    for (let i = 1; i <= panelCount; i++) {
      const v = BH + innerH_L * (i / (panelCount + 1));
      ctx.strokeStyle = C.wallLine;
      ctx.lineWidth = Math.max(0.7, cs * 0.9);
      ctx.beginPath();
      ctx.moveTo(leX, leY - v);
      ctx.lineTo(tpX, tpY - v);
      ctx.stroke();
    }

    // 왼벽 수직 타일 경계선 (그리드 맞춤)
    for (let ty = 1; ty < ROOM_ROWS; ty++) {
      const sx = stageLeft + (440 - ty * 44) * cs;
      const sy = stageTop  + ty * 22 * cs;
      ctx.strokeStyle = C.wallLine;
      ctx.lineWidth = Math.max(0.4, cs * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx, sy - BH);
      ctx.lineTo(sx, sy - WH + MH);
      ctx.stroke();
    }

    // 왼벽 걸레받이
    ctx.fillStyle = C.base;
    quad(ctx, leX, leY, tpX, tpY, tpX, tpY - BH, leX, leY - BH);
    ctx.fill();

    // 왼벽 몰딩
    ctx.fillStyle = C.molding;
    quad(ctx, leX, leWY + MH, tpX, tpWY + MH, tpX, tpWY, leX, leWY);
    ctx.fill();

    // ── 3. 오른쪽 벽 ──────────────────────────────────────────────────────
    ctx.fillStyle = C.wallR;
    quad(ctx, tpX, tpY, riX, riY, riX, riWY, tpX, tpWY);
    ctx.fill();

    // 오른벽 수평 패널 선
    const innerH_R = WH - BH - MH;
    for (let i = 1; i <= panelCount; i++) {
      const v = BH + innerH_R * (i / (panelCount + 1));
      ctx.strokeStyle = "#c8b888";
      ctx.lineWidth = Math.max(0.7, cs * 0.9);
      ctx.beginPath();
      ctx.moveTo(tpX, tpY - v);
      ctx.lineTo(riX, riY - v);
      ctx.stroke();
    }

    // 오른벽 수직 타일 경계선
    for (let tx = 1; tx < ROOM_COLS; tx++) {
      const sx = stageLeft + (tx * 44 + 440) * cs;
      ctx.strokeStyle = "#c8b888";
      ctx.lineWidth = Math.max(0.4, cs * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx, tpY - BH);
      ctx.lineTo(sx, tpWY + MH);
      ctx.stroke();
    }

    // 오른벽 걸레받이
    ctx.fillStyle = C.base;
    quad(ctx, tpX, tpY, riX, riY, riX, riY - BH, tpX, tpY - BH);
    ctx.fill();

    // 오른벽 몰딩
    ctx.fillStyle = C.molding;
    quad(ctx, tpX, tpWY + MH, riX, riWY + MH, riX, riWY, tpX, tpWY);
    ctx.fill();

    // ── 4. 창문 (왼쪽 벽, u=0.35~0.65) ──────────────────────────────────
    drawWindow(ctx, leX, leY, tpX, tpY, WH, BH, MH, cs);

    // ── 5. 바닥 타일 (페인터 순서) ────────────────────────────────────────
    for (let sum = 0; sum <= (ROOM_COLS - 1) + (ROOM_ROWS - 1); sum++) {
      for (let ty = 0; ty <= sum; ty++) {
        const tx = sum - ty;
        if (tx >= 0 && tx < ROOM_COLS && ty >= 0 && ty < ROOM_ROWS) {
          drawFloorTile(ctx, tx, ty, stageLeft, stageTop, cs, hw, hh);
        }
      }
    }

    // ── 6. 외곽선 ────────────────────────────────────────────────────────

    // 벽 코너 세로선
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL * 1.2;
    ctx.beginPath(); ctx.moveTo(tpX, tpWY); ctx.lineTo(tpX, tpY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(leX, leWY); ctx.lineTo(leX, leY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(riX, riWY); ctx.lineTo(riX, riY); ctx.stroke();

    // 벽 바닥 선 (벽-바닥 경계)
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = OL;
    ctx.beginPath();
    ctx.moveTo(leX, leY);
    ctx.lineTo(tpX, tpY);
    ctx.lineTo(riX, riY);
    ctx.stroke();

    // 천장 선
    ctx.strokeStyle = "#3a2510";
    ctx.lineWidth = OL * 0.8;
    ctx.beginPath();
    ctx.moveTo(leX, leWY);
    ctx.lineTo(tpX, tpWY);
    ctx.lineTo(riX, riWY);
    ctx.stroke();

    // 바닥 앞면 선 (열린 면)
    ctx.strokeStyle = C.floorEdge;
    ctx.lineWidth = OL * 0.6;
    ctx.beginPath();
    ctx.moveTo(leX, leY);
    ctx.lineTo(btX, btY);
    ctx.lineTo(riX, riY);
    ctx.stroke();

  }, [width, height, stageLeft, stageTop, cs]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
    />
  );
}

// ─── 창문 ─────────────────────────────────────────────────────────────────────

function drawWindow(
  ctx: CanvasRenderingContext2D,
  leX: number, leY: number,
  tpX: number, tpY: number,
  WH: number, BH: number, MH: number,
  cs: number,
) {
  const dx = tpX - leX;
  const dy = tpY - leY;
  const innerH = WH - BH - MH;

  const u1 = 0.32, u2 = 0.68;
  const v1 = BH + innerH * 0.10;
  const v2 = BH + innerH * 0.80;
  const fw = Math.max(2.5, cs * 2.8); // 창틀 두께

  const p = (u: number, v: number) => ({
    x: leX + u * dx,
    y: leY + u * dy - v,
  });

  const bl = p(u1, v1); const br = p(u2, v1);
  const tr = p(u2, v2); const tl = p(u1, v2);

  // 창문 뒤 어두운 리세스
  const pad = fw * 1.2;
  ctx.fillStyle = "#1a0e06";
  quad(ctx, bl.x - pad, bl.y + pad, br.x + pad, br.y + pad, tr.x + pad, tr.y - pad, tl.x - pad, tl.y - pad);
  ctx.fill();

  // 하늘 그라데이션 (위는 밝게)
  const grad = ctx.createLinearGradient(tl.x, tl.y, bl.x, bl.y);
  grad.addColorStop(0, C.winSky);
  grad.addColorStop(1, C.win);
  ctx.fillStyle = grad;
  quad(ctx, bl.x, bl.y, br.x, br.y, tr.x, tr.y, tl.x, tl.y);
  ctx.fill();

  // 창문 반사 (밝은 하이라이트)
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  quad(ctx, tl.x, tl.y, p(u1 + 0.08, v2 - (v2-v1)*0.05).x, p(u1 + 0.08, v2).y,
       p(u1 + 0.08, v1 + (v2-v1)*0.4).x, p(u1 + 0.08, v1 + (v2-v1)*0.4).y,
       tl.x, tl.y + (bl.y - tl.y) * 0.4);
  ctx.fill();

  // 창틀 (외부)
  ctx.strokeStyle = C.winFrame;
  ctx.lineWidth = fw;
  quad(ctx, bl.x, bl.y, br.x, br.y, tr.x, tr.y, tl.x, tl.y);
  ctx.stroke();

  // 창살 — 가로
  const midV = (v1 + v2) / 2;
  ctx.lineWidth = Math.max(1.5, cs * 1.8);
  ctx.beginPath();
  ctx.moveTo(p(u1, midV).x, p(u1, midV).y);
  ctx.lineTo(p(u2, midV).x, p(u2, midV).y);
  ctx.stroke();

  // 창살 — 세로
  const midU = (u1 + u2) / 2;
  ctx.beginPath();
  ctx.moveTo(leX + midU * dx, leY + midU * dy - v1);
  ctx.lineTo(leX + midU * dx, leY + midU * dy - v2);
  ctx.stroke();
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

  // 교차 색상으로 목재 판자 패턴
  const alt = (tx + ty) % 2 === 0;
  const topColor = alt ? C.floorA : C.floorB;

  // 상단 면
  ctx.fillStyle = topColor;
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.fill();

  // 목재 결 (대각선)
  ctx.strokeStyle = C.floorGrain;
  ctx.lineWidth = Math.max(0.4, cs * 0.45);
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.3, cy + hh * 0.7);
  ctx.lineTo(cx + hw * 0.3, cy + hh * 1.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.1, cy + hh * 0.3);
  ctx.lineTo(cx + hw * 0.55, cy + hh * 1.1);
  ctx.stroke();

  // 타일 테두리
  ctx.strokeStyle = C.floorEdge;
  ctx.lineWidth = Math.max(0.5, cs * 0.65);
  ctx.beginPath();
  ctx.moveTo(cx,      cy);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx,      cy + hh * 2);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.closePath();
  ctx.stroke();
}
