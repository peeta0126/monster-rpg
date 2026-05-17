import { useRef, useEffect } from "react";
import { ROOM_COLS, ROOM_ROWS, TILE_SIZE } from "../../constants/housing";
import { getFloorTile } from "../../data/floorTiles";

// ─── 레이아웃 상수 ─────────────────────────────────────────────────────────────
const WALL_THICK = 32;  // 벽 두께 (scale 1 기준 픽셀)
const PLANK_H    = 14;  // 나무 마루 높이 (scale 1 기준 픽셀)

// 문 위치 (타일 인덱스)
const FARM_X1 = 4;  // 농장 문 좌측
const FARM_X2 = 6;  // 농장 문 우측 (exclusive)
const EXIT_Y1 = 4;  // 출구 문 상단
const EXIT_Y2 = 6;  // 출구 문 하단 (exclusive)

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export function IndoorRoomBg({
  width, height, stageLeft, stageTop, cs, floorTileId,
}: {
  width: number; height: number;
  stageLeft: number; stageTop: number; cs: number;
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

    const ts    = TILE_SIZE * cs;
    const roomW = ROOM_COLS * ts;
    const roomH = ROOM_ROWS * ts;
    const wt    = WALL_THICK * cs;
    const ft    = getFloorTile(floorTileId);

    const rx  = stageLeft;
    const ry  = stageTop;
    const rx2 = rx + roomW;
    const ry2 = ry + roomH;

    // 문 절대 좌표
    const fdX1 = rx + FARM_X1 * ts;
    const fdX2 = rx + FARM_X2 * ts;
    const edY1 = ry + EXIT_Y1 * ts;
    const edY2 = ry + EXIT_Y2 * ts;

    // ── 1. 외부 배경 ──────────────────────────────────────────────────────────
    // 방 바깥: 어두운 돌/흙 바닥
    ctx.fillStyle = "#0E0804";
    ctx.fillRect(0, 0, width, height);

    // ── 2. 석조 벽 ────────────────────────────────────────────────────────────
    // 북쪽 벽
    paintStoneWall(ctx, rx - wt, ry - wt, roomW + wt * 2, wt, cs);
    // 서쪽 벽
    paintStoneWall(ctx, rx - wt, ry, wt, roomH, cs);
    // 동쪽 벽 (출구 문 갭)
    paintStoneWall(ctx, rx2, ry, wt, edY1 - ry, cs);
    paintStoneWall(ctx, rx2, edY2, wt, ry2 - edY2, cs);
    // 남쪽 벽 (농장 문 갭)
    paintStoneWall(ctx, rx - wt, ry2, fdX1 - (rx - wt), wt, cs);
    paintStoneWall(ctx, fdX2, ry2, rx2 + wt - fdX2, wt, cs);

    // 코너 기둥 (석조 + 금빛 강조)
    const corners: [number, number][] = [
      [rx - wt, ry - wt], [rx2, ry - wt],
      [rx - wt, ry2],     [rx2, ry2],
    ];
    for (const [cx, cy] of corners) {
      paintStoneWall(ctx, cx, cy, wt, wt, cs);
      // 코너 기둥 금테
      ctx.strokeStyle = "rgba(180,120,40,0.55)";
      ctx.lineWidth = Math.max(1.2, cs * 1.8);
      const ip = cs * 4;
      ctx.strokeRect(cx + ip, cy + ip, wt - ip * 2, wt - ip * 2);
    }

    // ── 3. 바닥 ───────────────────────────────────────────────────────────────
    paintFloor(ctx, rx, ry, roomW, roomH, ts, cs, ft, floorTileId);

    // ── 4. 문 개구부 ──────────────────────────────────────────────────────────
    // 남쪽 문 (농장)
    ctx.fillStyle = "#060402";
    ctx.fillRect(fdX1, ry2, fdX2 - fdX1, wt);
    // 동쪽 문 (출구)
    ctx.fillRect(rx2, edY1, wt, edY2 - edY1);

    // 문 문지방 (바닥 끝 어두운 전환)
    const thresh = ts * 0.20;
    const thrGrad1 = ctx.createLinearGradient(fdX1, ry2 - thresh, fdX1, ry2);
    thrGrad1.addColorStop(0, "rgba(0,0,0,0)");
    thrGrad1.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = thrGrad1;
    ctx.fillRect(fdX1, ry2 - thresh, fdX2 - fdX1, thresh);

    const thrGrad2 = ctx.createLinearGradient(rx2 - thresh, edY1, rx2, edY1);
    thrGrad2.addColorStop(0, "rgba(0,0,0,0)");
    thrGrad2.addColorStop(1, "rgba(0,0,0,0.50)");
    ctx.fillStyle = thrGrad2;
    ctx.fillRect(rx2 - thresh, edY1, thresh, edY2 - edY1);

    // 문 기둥선 (황금)
    ctx.strokeStyle = "#8A5818";
    ctx.lineWidth = Math.max(2, cs * 2.6);
    for (const x of [fdX1, fdX2]) {
      ctx.beginPath(); ctx.moveTo(x, ry2); ctx.lineTo(x, ry2 + wt); ctx.stroke();
    }
    for (const y of [edY1, edY2]) {
      ctx.beginPath(); ctx.moveTo(rx2, y); ctx.lineTo(rx2 + wt, y); ctx.stroke();
    }

    // ── 5. 벽 내면 그림자 ─────────────────────────────────────────────────────
    const sw = ts * 0.55;
    type ShadowDir = "down" | "up" | "right" | "left";
    const shadows: [number, number, number, number, ShadowDir, number][] = [
      [rx,      ry,      roomW, sw,   "down",  0.50],
      [rx,      ry2 - sw,roomW, sw,   "up",    0.35],
      [rx,      ry,      sw,    roomH,"right", 0.42],
      [rx2 - sw,ry,      sw,    roomH,"left",  0.30],
    ];
    for (const [gx, gy, gw, gh, dir, alpha] of shadows) {
      let g: CanvasGradient;
      if (dir === "down")  g = ctx.createLinearGradient(gx, gy, gx, gy + gh);
      else if (dir === "up")   g = ctx.createLinearGradient(gx, gy + gh, gx, gy);
      else if (dir === "right") g = ctx.createLinearGradient(gx, gy, gx + gw, gy);
      else                     g = ctx.createLinearGradient(gx + gw, gy, gx, gy);
      g.addColorStop(0, `rgba(0,0,0,${alpha})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(gx, gy, gw, gh);
    }

    // ── 6. 방 내부 캔들 조명 ──────────────────────────────────────────────────
    const ambGrad = ctx.createRadialGradient(
      rx + roomW * 0.5, ry + roomH * 0.42, 0,
      rx + roomW * 0.5, ry + roomH * 0.42, Math.max(roomW, roomH) * 0.62,
    );
    ambGrad.addColorStop(0,    "rgba(240,170,60,0.10)");
    ambGrad.addColorStop(0.45, "rgba(200,120,30,0.05)");
    ambGrad.addColorStop(1,    "rgba(0,0,0,0)");
    ctx.fillStyle = ambGrad;
    ctx.fillRect(rx, ry, roomW, roomH);

    // ── 7. 방 테두리 ──────────────────────────────────────────────────────────
    ctx.strokeStyle = "#2A1408";
    ctx.lineWidth = Math.max(3, cs * 4);
    ctx.strokeRect(rx, ry, roomW, roomH);

    // 내부 금빛 몰딩선
    ctx.strokeStyle = "rgba(200,140,50,0.28)";
    ctx.lineWidth = Math.max(1, cs * 1.5);
    const molding = Math.max(4, cs * 5);
    ctx.strokeRect(rx + molding, ry + molding, roomW - molding * 2, roomH - molding * 2);

  }, [width, height, stageLeft, stageTop, cs, floorTileId]);

  return (
    <canvas
      ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
    />
  );
}

// ─── 석조 벽 채우기 ────────────────────────────────────────────────────────────
function paintStoneWall(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, cs: number,
) {
  if (w <= 0 || h <= 0) return;

  // 기본 돌 색
  const g = ctx.createLinearGradient(x, y, x + w * 0.25, y + h);
  g.addColorStop(0,    "#4E3C28");
  g.addColorStop(0.35, "#3E2C18");
  g.addColorStop(1,    "#241408");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // 돌 줄눈 (벽돌 패턴)
  const bh = Math.max(10 * cs, 9);   // 벽돌 높이
  const bw = Math.max(22 * cs, 20);  // 벽돌 너비
  ctx.strokeStyle = "rgba(16, 8, 2, 0.70)";
  ctx.lineWidth = Math.max(0.8, cs * 1.1);

  // 수평 줄눈
  for (let sy = bh; sy < h; sy += bh) {
    ctx.beginPath();
    ctx.moveTo(x,     y + sy);
    ctx.lineTo(x + w, y + sy);
    ctx.stroke();
  }

  // 엇갈린 세로 줄눈
  let row = 0;
  for (let sy = 0; sy < h; sy += bh) {
    const off = row % 2 === 0 ? 0 : bw * 0.5;
    for (let sx = off; sx < w + bw; sx += bw) {
      const jx = x + sx;
      ctx.beginPath();
      ctx.moveTo(jx, y + sy);
      ctx.lineTo(jx, Math.min(y + sy + bh, y + h));
      ctx.stroke();
    }
    row++;
  }

  // 상단 하이라이트 (빛이 위에서)
  const hl = ctx.createLinearGradient(x, y, x, y + Math.min(cs * 4, h));
  hl.addColorStop(0, "rgba(220,170,80,0.22)");
  hl.addColorStop(1, "rgba(220,170,80,0)");
  ctx.fillStyle = hl;
  ctx.fillRect(x, y, w, Math.min(cs * 4, h));
}

// ─── 바닥 채우기 ───────────────────────────────────────────────────────────────
function paintFloor(
  ctx: CanvasRenderingContext2D,
  rx: number, ry: number, roomW: number, roomH: number,
  ts: number, cs: number,
  ft: ReturnType<typeof getFloorTile>,
  floorTileId: string,
) {
  const plankH = PLANK_H * cs;

  if (floorTileId === "wood") {
    // ── 나무 마루판 (가로 결) ──────────────────────────────────────────────────
    let row = 0;
    for (let y = ry; y < ry + roomH; y += plankH) {
      const h = Math.min(plankH, ry + roomH - y);
      ctx.fillStyle = row % 2 === 0 ? "rgba(154,96,44,0.93)" : "rgba(126,74,28,0.93)";
      ctx.fillRect(rx, y, roomW, h);

      // 목재 결 하이라이트 (판자 위쪽)
      ctx.fillStyle = "rgba(210,148,72,0.08)";
      ctx.fillRect(rx, y, roomW, h * 0.38);

      // 이음새
      ctx.fillStyle = "rgba(48,22,6,0.88)";
      ctx.fillRect(rx, y, roomW, Math.max(1.5, cs * 1.8));

      row++;
    }
    // 가로 판자 사이 세로 이음새 (줄 사이에 끊김 효과)
    ctx.strokeStyle = "rgba(48,22,6,0.30)";
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    const segW = 96 * cs;
    let rowY = 0;
    for (let y = ry; y < ry + roomH; y += plankH * 2) {
      const offset = (rowY % 2 === 0) ? 0 : segW * 0.5;
      for (let x = rx + offset; x < rx + roomW; x += segW) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + plankH * 2, ry + roomH));
        ctx.stroke();
      }
      rowY++;
    }

  } else if (floorTileId === "stone") {
    // ── 돌 타일 ────────────────────────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = rx + tx * ts;
        const y = ry + ty * ts;
        const alt = (tx + ty) % 2 === 0;
        ctx.fillStyle = alt ? "rgba(98,86,70,0.93)" : "rgba(80,68,52,0.93)";
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        ctx.fillRect(x, y, ts, ts * 0.18);
        ctx.fillRect(x, y, ts * 0.08, ts);
        ctx.strokeStyle = "rgba(36,26,16,0.95)";
        ctx.lineWidth = Math.max(1.2, cs * 1.5);
        ctx.strokeRect(x + cs * 0.8, y + cs * 0.8, ts - cs * 1.6, ts - cs * 1.6);
      }
    }

  } else if (floorTileId === "cafe") {
    // ── 카페 체커보드 ──────────────────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = rx + tx * ts;
        const y = ry + ty * ts;
        const alt = (tx + ty) % 2 === 0;
        ctx.fillStyle = alt ? "rgba(228,200,152,0.93)" : "rgba(108,72,36,0.93)";
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fillRect(x, y, ts, ts * 0.18);
        ctx.strokeStyle = "rgba(96,68,32,0.92)";
        ctx.lineWidth = Math.max(1.2, cs * 1.5);
        ctx.strokeRect(x + cs * 0.8, y + cs * 0.8, ts - cs * 1.6, ts - cs * 1.6);
      }
    }

  } else if (floorTileId === "rug") {
    // ── 러그 ───────────────────────────────────────────────────────────────────
    ctx.fillStyle = "rgba(148,42,34,0.92)";
    ctx.fillRect(rx, ry, roomW, roomH);
    const bd1 = Math.max(cs * 14, 12);
    ctx.strokeStyle = "rgba(200,80,60,0.90)";
    ctx.lineWidth = Math.max(cs * 3.5, 4);
    ctx.strokeRect(rx + bd1, ry + bd1, roomW - bd1 * 2, roomH - bd1 * 2);
    const bd2 = bd1 + Math.max(cs * 5, 6);
    ctx.strokeStyle = "rgba(230,150,110,0.50)";
    ctx.lineWidth = Math.max(cs * 1.5, 2);
    ctx.strokeRect(rx + bd2, ry + bd2, roomW - bd2 * 2, roomH - bd2 * 2);

  } else if (floorTileId === "crystal") {
    // ── 수정 타일 ──────────────────────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = rx + tx * ts;
        const y = ry + ty * ts;
        const alt = (tx + ty) % 2 === 0;
        ctx.fillStyle = alt ? "rgba(72,136,218,0.87)" : "rgba(50,104,188,0.87)";
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = "rgba(190,230,255,0.14)";
        ctx.fillRect(x, y, ts * 0.13, ts);
        ctx.fillRect(x, y, ts, ts * 0.16);
        ctx.strokeStyle = "rgba(28,60,164,0.93)";
        ctx.lineWidth = Math.max(1.2, cs * 1.5);
        ctx.strokeRect(x + cs * 0.8, y + cs * 0.8, ts - cs * 1.6, ts - cs * 1.6);
      }
    }

  } else if (floorTileId === "dark") {
    // ── 어둠 대리석 ────────────────────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = rx + tx * ts;
        const y = ry + ty * ts;
        const alt = (tx + ty) % 2 === 0;
        ctx.fillStyle = alt ? "rgba(30,18,46,0.95)" : "rgba(20,10,32,0.95)";
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = "rgba(100,58,144,0.14)";
        ctx.fillRect(x + ts * 0.5, y, ts * 0.5, ts);
        ctx.fillRect(x, y, ts, ts * 0.13);
        ctx.strokeStyle = "rgba(70,40,100,0.93)";
        ctx.lineWidth = Math.max(1.2, cs * 1.5);
        ctx.strokeRect(x + cs * 0.8, y + cs * 0.8, ts - cs * 1.6, ts - cs * 1.6);
      }
    }

  } else {
    // ── 기본 (floorTile 색상 사용) ────────────────────────────────────────────
    for (let ty = 0; ty < ROOM_ROWS; ty++) {
      for (let tx = 0; tx < ROOM_COLS; tx++) {
        const x = rx + tx * ts;
        const y = ry + ty * ts;
        ctx.fillStyle = (tx + ty) % 2 === 0 ? ft.normalBg : ft.hoverBg;
        ctx.fillRect(x, y, ts, ts);
        ctx.strokeStyle = ft.normalOutline;
        ctx.lineWidth = Math.max(1, cs * 1.4);
        ctx.strokeRect(x, y, ts, ts);
      }
    }
  }
}
