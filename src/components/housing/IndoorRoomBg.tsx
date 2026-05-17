import { useRef, useEffect } from "react";
import { ROOM_COLS, ROOM_ROWS, TILE_SIZE } from "../../constants/housing";
import { getFloorTile } from "../../data/floorTiles";

// ─── 레이아웃 상수 (export: HousingPage 레이아웃 계산에 사용) ────────────────────
export const ROOM_WALL_H = 104; // 후면 석조 벽 높이 (scale 1 기준 px)

const PLANK_H = 14;  // 나무 마루판 높이 (scale 1 px)
const SIDE_W  = 22;  // 좌우 벽 두께   (scale 1 px)

// 문 위치 (타일 인덱스)
const FARM_X1 = 4; const FARM_X2 = 6; // 남쪽 (농장문)
const EXIT_Y1 = 4; const EXIT_Y2 = 6; // 동쪽 (출구문)

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

    const ts    = TILE_SIZE  * cs;
    const roomW = ROOM_COLS  * ts;
    const roomH = ROOM_ROWS  * ts;
    const wh    = ROOM_WALL_H * cs;   // 후면 벽 높이 (스케일 적용)
    const sw    = SIDE_W     * cs;    // 좌우 벽 너비 (스케일 적용)

    const rx = stageLeft;          // 바닥 좌측 x
    const ry = stageTop;           // 바닥 상단 y  (= 후면 벽 하단)
    const rx2 = rx + roomW;
    const ry2 = ry + roomH;
    const wallTop = ry - wh;       // 후면 벽 상단 y

    // 문 절대 좌표
    const fdX1 = rx + FARM_X1 * ts, fdX2 = rx + FARM_X2 * ts;
    const edY1 = ry + EXIT_Y1 * ts, edY2 = ry + EXIT_Y2 * ts;

    // ── 1. 외부 배경 (방 밖) ─────────────────────────────────────────────
    ctx.fillStyle = "#0C0804";
    ctx.fillRect(0, 0, width, height);

    // ── 2. 후면 석조 벽 ──────────────────────────────────────────────────
    // 벽 기본 색
    const wallG = ctx.createLinearGradient(0, wallTop, 0, ry);
    wallG.addColorStop(0,   "#22160A");
    wallG.addColorStop(0.5, "#2E1E10");
    wallG.addColorStop(1,   "#3E2A16");
    ctx.fillStyle = wallG;
    ctx.fillRect(rx - sw, wallTop, roomW + sw * 2, wh);

    // 벽돌 텍스처
    drawBricks(ctx, rx - sw, wallTop, roomW + sw * 2, wh, cs);

    // 걸레받이 (wall–floor 경계)
    const skH = Math.max(cs * 10, 9);
    const skG = ctx.createLinearGradient(0, ry - skH, 0, ry);
    skG.addColorStop(0, "#7A4820"); skG.addColorStop(1, "#3A2010");
    ctx.fillStyle = skG;
    ctx.fillRect(rx - sw, ry - skH, roomW + sw * 2, skH);
    ctx.fillStyle = "rgba(220,160,60,0.42)";
    ctx.fillRect(rx - sw, ry - skH, roomW + sw * 2, Math.max(1.5, cs * 2.2));

    // 창문 (후면 벽 중앙)
    drawWindow(ctx, rx + roomW * 0.5, wallTop + wh * 0.46, wh * 0.64, wh * 0.54, cs);

    // 횃불 (창문 좌우)
    drawTorch(ctx, rx + roomW * 0.17, wallTop + wh * 0.54, cs);
    drawTorch(ctx, rx + roomW * 0.83, wallTop + wh * 0.54, cs);

    // 횃불 빛 바닥으로
    for (const tx of [rx + roomW * 0.17, rx + roomW * 0.83]) {
      const tg = ctx.createRadialGradient(tx, ry, 0, tx, ry, ts * 2.8);
      tg.addColorStop(0, "rgba(255,148,28,0.11)");
      tg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = tg; ctx.fillRect(rx, ry, roomW, ts * 3);
    }

    // ── 3. 좌우 석조 벽 ──────────────────────────────────────────────────
    drawBricks(ctx, rx - sw, ry, sw, roomH, cs);                 // 서쪽
    drawBricks(ctx, rx2, ry, sw, edY1 - ry, cs);                 // 동쪽 상단
    drawBricks(ctx, rx2, edY2, sw, ry2 - edY2, cs);              // 동쪽 하단

    // ── 4. 바닥 ──────────────────────────────────────────────────────────
    drawFloor(ctx, rx, ry, roomW, roomH, ts, cs, getFloorTile(floorTileId), floorTileId);

    // ── 5. 출구문 개구부 (동쪽) ──────────────────────────────────────────
    ctx.fillStyle = "#040202";
    ctx.fillRect(rx2, edY1, sw, edY2 - edY1);
    // 바깥 초록빛
    const exG = ctx.createLinearGradient(rx2, 0, rx2 + sw, 0);
    exG.addColorStop(0, "rgba(80,140,60,0.0)");
    exG.addColorStop(1, "rgba(80,140,60,0.28)");
    ctx.fillStyle = exG; ctx.fillRect(rx2, edY1, sw, edY2 - edY1);
    // 문틀
    ctx.strokeStyle = "#7A4A18"; ctx.lineWidth = Math.max(1.8, cs * 2.2);
    ctx.beginPath();
    ctx.moveTo(rx2, edY1); ctx.lineTo(rx2 + sw, edY1);
    ctx.moveTo(rx2, edY2); ctx.lineTo(rx2 + sw, edY2);
    ctx.stroke();

    // ── 6. 농장문 문지방 (남쪽) ──────────────────────────────────────────
    const thG = ctx.createLinearGradient(0, ry2 - ts * 0.22, 0, ry2);
    thG.addColorStop(0, "rgba(0,0,0,0)");
    thG.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = thG;
    ctx.fillRect(fdX1, ry2 - ts * 0.22, fdX2 - fdX1, ts * 0.22);

    // ── 7. 방 내부 주변광 ────────────────────────────────────────────────
    const ambG = ctx.createRadialGradient(
      rx + roomW * 0.5, ry + roomH * 0.38, 0,
      rx + roomW * 0.5, ry + roomH * 0.38, Math.max(roomW, roomH) * 0.70,
    );
    ambG.addColorStop(0,   "rgba(230,155,45,0.10)");
    ambG.addColorStop(0.5, "rgba(180,95,18,0.04)");
    ambG.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = ambG; ctx.fillRect(rx, ry, roomW, roomH);

    // ── 8. 벽면 내부 그림자 ──────────────────────────────────────────────
    // 북쪽 (후면 벽 아래 그림자)
    const shN = ctx.createLinearGradient(0, ry, 0, ry + ts * 0.75);
    shN.addColorStop(0, "rgba(0,0,0,0.60)"); shN.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shN; ctx.fillRect(rx, ry, roomW, ts * 0.75);
    // 서쪽
    const shW = ctx.createLinearGradient(rx, 0, rx + ts * 0.65, 0);
    shW.addColorStop(0, "rgba(0,0,0,0.42)"); shW.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shW; ctx.fillRect(rx, ry, ts * 0.65, roomH);
    // 동쪽
    const shE = ctx.createLinearGradient(rx2, 0, rx2 - ts * 0.5, 0);
    shE.addColorStop(0, "rgba(0,0,0,0.30)"); shE.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shE; ctx.fillRect(rx2 - ts * 0.5, ry, ts * 0.5, roomH);

    // ── 9. 바닥 외곽선 + 내부 몰딩 ──────────────────────────────────────
    ctx.strokeStyle = "#1C0C06"; ctx.lineWidth = Math.max(2.5, cs * 3.5);
    ctx.strokeRect(rx, ry, roomW, roomH);
    ctx.strokeStyle = "rgba(190,130,45,0.28)"; ctx.lineWidth = Math.max(1, cs * 1.5);
    const mo = Math.max(4, cs * 5.5);
    ctx.strokeRect(rx + mo, ry + mo, roomW - mo * 2, roomH - mo * 2);

  }, [width, height, stageLeft, stageTop, cs, floorTileId]);

  return (
    <canvas ref={ref}
      style={{ position: "absolute", inset: 0, zIndex: 0, display: "block" }}
    />
  );
}

// ─── 벽돌 텍스처 ───────────────────────────────────────────────────────────────
function drawBricks(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, cs: number,
) {
  if (w <= 0 || h <= 0) return;

  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, "#4C3C26"); g.addColorStop(0.4, "#3A2C16"); g.addColorStop(1, "#261A0A");
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

  const bh = Math.max(cs * 9, 9);
  const bw = Math.max(cs * 21, 19);
  ctx.strokeStyle = "rgba(14,7,2,0.72)";
  ctx.lineWidth = Math.max(0.8, cs * 1.05);

  for (let sy = bh; sy < h; sy += bh) {
    ctx.beginPath(); ctx.moveTo(x, y + sy); ctx.lineTo(x + w, y + sy); ctx.stroke();
  }
  let row = 0;
  for (let sy = 0; sy < h; sy += bh) {
    const off = row % 2 === 0 ? 0 : bw * 0.5;
    for (let sx = off; sx < w + bw; sx += bw) {
      const jx = x + sx;
      ctx.beginPath(); ctx.moveTo(jx, y + sy); ctx.lineTo(jx, Math.min(y + sy + bh, y + h)); ctx.stroke();
    }
    row++;
  }

  // 상단 하이라이트
  const hl = ctx.createLinearGradient(x, y, x, y + Math.min(cs * 5, h));
  hl.addColorStop(0, "rgba(215,165,75,0.24)"); hl.addColorStop(1, "rgba(215,165,75,0)");
  ctx.fillStyle = hl; ctx.fillRect(x, y, w, Math.min(cs * 5, h));
}

// ─── 창문 ──────────────────────────────────────────────────────────────────────
function drawWindow(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number, cs: number,
) {
  const hw = w / 2, hh = h / 2;

  // 외부 테두리 (돌 리세스)
  ctx.fillStyle = "#100806";
  ctx.fillRect(cx - hw - cs * 3.5, cy - hh - cs * 3.5, w + cs * 7, h + cs * 7);

  // 아치형 상단
  ctx.fillStyle = "#1E1008";
  ctx.beginPath();
  ctx.arc(cx, cy - hh, hw + cs * 2.5, Math.PI, 0);
  ctx.fill();

  // 4분할 유리
  const gap = Math.max(cs * 2.5, 3);
  const pw  = (w - gap * 3) / 2;
  const ph  = (h - gap * 3) / 2;
  const panes: [number, number][] = [
    [cx - gap / 2 - pw, cy - gap / 2 - ph],
    [cx + gap / 2,       cy - gap / 2 - ph],
    [cx - gap / 2 - pw, cy + gap / 2],
    [cx + gap / 2,       cy + gap / 2],
  ];
  for (const [px, py] of panes) {
    const gg = ctx.createLinearGradient(px, py, px + pw, py + ph);
    gg.addColorStop(0, "#AADAF2"); gg.addColorStop(0.5, "#7CBEDD"); gg.addColorStop(1, "#5AA4C8");
    ctx.fillStyle = gg; ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "rgba(255,255,255,0.24)";
    ctx.fillRect(px, py, pw * 0.44, ph * 0.44);
  }

  // 창틀
  ctx.strokeStyle = "#2A1808"; ctx.lineWidth = Math.max(cs * 2.4, 3);
  ctx.strokeRect(cx - hw, cy - hh, w, h);
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh); ctx.lineTo(cx, cy + hh);
  ctx.moveTo(cx - hw, cy); ctx.lineTo(cx + hw, cy);
  ctx.stroke();

  // 창틀 황금 하이라이트
  ctx.strokeStyle = "rgba(190,130,50,0.42)"; ctx.lineWidth = Math.max(cs * 0.9, 1.2);
  ctx.strokeRect(cx - hw + cs * 2, cy - hh + cs * 2, w - cs * 4, h - cs * 4);
}

// ─── 횃불 ──────────────────────────────────────────────────────────────────────
function drawTorch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, cs: number,
) {
  // 후광
  const gw = ctx.createRadialGradient(x, y - cs * 9, 0, x, y - cs * 9, cs * 17);
  gw.addColorStop(0,    "rgba(255,158,38,0.58)");
  gw.addColorStop(0.38, "rgba(255,100,10,0.22)");
  gw.addColorStop(1,    "rgba(255,60,0,0)");
  ctx.fillStyle = gw;
  ctx.fillRect(x - cs * 17, y - cs * 26, cs * 34, cs * 32);

  // 브래킷
  ctx.fillStyle = "#6A3C10";
  ctx.fillRect(x - cs * 1.8, y - cs * 10, cs * 3.6, cs * 10);
  ctx.fillRect(x - cs * 3.5, y - cs * 1.8, cs * 7, cs * 3.6);

  // 불꽃 외부 (주황)
  ctx.fillStyle = "#FF5C08";
  ctx.beginPath();
  ctx.moveTo(x, y - cs * 20);
  ctx.quadraticCurveTo(x + cs * 4.5, y - cs * 15, x + cs * 3.5, y - cs * 10);
  ctx.lineTo(x - cs * 3.5, y - cs * 10);
  ctx.quadraticCurveTo(x - cs * 4.5, y - cs * 15, x, y - cs * 20);
  ctx.fill();

  // 불꽃 내부 (노랑)
  ctx.fillStyle = "#FFC030";
  ctx.beginPath();
  ctx.moveTo(x, y - cs * 18);
  ctx.quadraticCurveTo(x + cs * 2, y - cs * 13.5, x + cs * 1.8, y - cs * 10);
  ctx.lineTo(x - cs * 1.8, y - cs * 10);
  ctx.quadraticCurveTo(x - cs * 2, y - cs * 13.5, x, y - cs * 18);
  ctx.fill();
}

// ─── 바닥 텍스처 ───────────────────────────────────────────────────────────────
function drawFloor(
  ctx: CanvasRenderingContext2D,
  rx: number, ry: number, roomW: number, roomH: number,
  ts: number, cs: number,
  ft: ReturnType<typeof getFloorTile>,
  id: string,
) {
  const ph = PLANK_H * cs;

  if (id === "wood") {
    // ── 나무 마루 (가로 결) ──────────────────────────────────────────────
    let row = 0;
    for (let y = ry; y < ry + roomH; y += ph) {
      const h = Math.min(ph, ry + roomH - y);
      ctx.fillStyle = row % 2 === 0 ? "rgba(155,96,42,0.96)" : "rgba(126,74,24,0.96)";
      ctx.fillRect(rx, y, roomW, h);
      ctx.fillStyle = "rgba(215,152,68,0.07)";
      ctx.fillRect(rx, y, roomW, h * 0.42);
      ctx.fillStyle = "rgba(42,18,4,0.92)";
      ctx.fillRect(rx, y, roomW, Math.max(1.5, cs * 1.8));
      row++;
    }
    // 세로 이음새
    ctx.strokeStyle = "rgba(42,18,4,0.30)";
    ctx.lineWidth = Math.max(0.6, cs * 0.8);
    const segW = cs * 88;
    let ri = 0;
    for (let y = ry; y < ry + roomH; y += ph * 2) {
      const off = ri % 2 === 0 ? 0 : segW * 0.5;
      for (let x = rx + off; x < rx + roomW; x += segW) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Math.min(y + ph * 2, ry + roomH)); ctx.stroke();
      }
      ri++;
    }

  } else if (id === "stone") {
    for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = rx + tx * ts, y = ry + ty * ts;
      ctx.fillStyle = (tx+ty)%2===0 ? "rgba(102,90,74,0.96)" : "rgba(80,68,52,0.96)";
      ctx.fillRect(x, y, ts, ts);
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fillRect(x, y, ts, ts*0.18); ctx.fillRect(x, y, ts*0.08, ts);
      ctx.strokeStyle = "rgba(34,24,12,0.96)"; ctx.lineWidth = Math.max(1.2, cs*1.5);
      ctx.strokeRect(x+cs*0.8, y+cs*0.8, ts-cs*1.6, ts-cs*1.6);
    }

  } else if (id === "cafe") {
    for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = rx + tx * ts, y = ry + ty * ts;
      ctx.fillStyle = (tx+ty)%2===0 ? "rgba(232,204,156,0.96)" : "rgba(112,76,38,0.96)";
      ctx.fillRect(x, y, ts, ts);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x, y, ts, ts*0.18);
      ctx.strokeStyle = "rgba(96,68,32,0.93)"; ctx.lineWidth = Math.max(1.2, cs*1.5);
      ctx.strokeRect(x+cs*0.8, y+cs*0.8, ts-cs*1.6, ts-cs*1.6);
    }

  } else if (id === "rug") {
    ctx.fillStyle = "rgba(152,42,34,0.96)"; ctx.fillRect(rx, ry, roomW, roomH);
    const b1 = Math.max(cs*14, 13);
    ctx.strokeStyle = "rgba(208,80,60,0.94)"; ctx.lineWidth = Math.max(cs*3.5, 4.5);
    ctx.strokeRect(rx+b1, ry+b1, roomW-b1*2, roomH-b1*2);
    const b2 = b1 + Math.max(cs*5, 6);
    ctx.strokeStyle = "rgba(238,152,110,0.52)"; ctx.lineWidth = Math.max(cs*1.5, 2);
    ctx.strokeRect(rx+b2, ry+b2, roomW-b2*2, roomH-b2*2);

  } else if (id === "crystal") {
    for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = rx + tx * ts, y = ry + ty * ts;
      ctx.fillStyle = (tx+ty)%2===0 ? "rgba(72,138,222,0.92)" : "rgba(50,106,194,0.92)";
      ctx.fillRect(x, y, ts, ts);
      ctx.fillStyle = "rgba(192,232,255,0.14)";
      ctx.fillRect(x, y, ts*0.13, ts); ctx.fillRect(x, y, ts, ts*0.16);
      ctx.strokeStyle = "rgba(28,60,170,0.94)"; ctx.lineWidth = Math.max(1.2, cs*1.5);
      ctx.strokeRect(x+cs*0.8, y+cs*0.8, ts-cs*1.6, ts-cs*1.6);
    }

  } else if (id === "dark") {
    for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = rx + tx * ts, y = ry + ty * ts;
      ctx.fillStyle = (tx+ty)%2===0 ? "rgba(30,18,46,0.97)" : "rgba(18,10,30,0.97)";
      ctx.fillRect(x, y, ts, ts);
      ctx.fillStyle = "rgba(102,60,148,0.14)";
      ctx.fillRect(x+ts*0.5, y, ts*0.5, ts); ctx.fillRect(x, y, ts, ts*0.13);
      ctx.strokeStyle = "rgba(72,42,104,0.94)"; ctx.lineWidth = Math.max(1.2, cs*1.5);
      ctx.strokeRect(x+cs*0.8, y+cs*0.8, ts-cs*1.6, ts-cs*1.6);
    }

  } else {
    for (let ty = 0; ty < ROOM_ROWS; ty++) for (let tx = 0; tx < ROOM_COLS; tx++) {
      const x = rx + tx * ts, y = ry + ty * ts;
      ctx.fillStyle = (tx+ty)%2===0 ? ft.normalBg : ft.hoverBg;
      ctx.fillRect(x, y, ts, ts);
      ctx.strokeStyle = ft.normalOutline; ctx.lineWidth = Math.max(1, cs*1.4);
      ctx.strokeRect(x, y, ts, ts);
    }
  }
}
