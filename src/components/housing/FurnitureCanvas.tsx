import { useRef, useEffect } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 4) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 6) {
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  rr(ctx, x + 5, y + 7, w, h, r);
  ctx.fill();
}

// ── Wooden Bed (2×3) ──────────────────────────────────────────────────────────
function drawBed(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 2, 2, W - 8, H - 8);
  ctx.fillStyle = "#4A2810"; rr(ctx, 2, 2, W - 4, H - 4, 8); ctx.fill();
  ctx.fillStyle = "#C48A50"; rr(ctx, 10, 10, W - 20, H - 20, 4); ctx.fill();
  // Headboard
  ctx.fillStyle = "#7A4828"; rr(ctx, 2, 2, W - 4, H * 0.23, 8); ctx.fill();
  ctx.fillStyle = "#A06840"; rr(ctx, 10, 8, W - 20, H * 0.17 - 2, 4); ctx.fill();
  ctx.strokeStyle = "#5A3018"; ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) { const sx = 12 + (W - 24) * i / 4; ctx.beginPath(); ctx.moveTo(sx, 8); ctx.lineTo(sx, H * 0.20); ctx.stroke(); }
  // Pillow
  ctx.fillStyle = "#F0E4CC"; rr(ctx, 18, H * 0.26, W - 36, H * 0.13, 9); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.32)"; rr(ctx, 22, H * 0.28, (W - 44) * 0.48, H * 0.06, 5); ctx.fill();
  ctx.strokeStyle = "rgba(160,120,80,0.45)"; ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 2]); rr(ctx, 20, H * 0.27, W - 40, H * 0.11, 7); ctx.stroke(); ctx.setLineDash([]);
  // Blanket
  ctx.fillStyle = "#8A1E1E"; rr(ctx, 10, H * 0.41, W - 20, H * 0.43, 4); ctx.fill();
  ctx.strokeStyle = "#B43030"; ctx.lineWidth = 2.5;
  for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(12, H * (0.41 + 0.43 * i / 5)); ctx.lineTo(W - 12, H * (0.41 + 0.43 * i / 5)); ctx.stroke(); }
  ctx.strokeStyle = "#D05050"; ctx.lineWidth = 1.5; rr(ctx, 14, H * 0.43, W - 28, H * 0.39, 3); ctx.stroke();
  ctx.fillStyle = "rgba(200,50,50,0.22)"; rr(ctx, 10, H * 0.41, W - 20, H * 0.10, 4); ctx.fill();
  // Footboard
  ctx.fillStyle = "#7A4828"; rr(ctx, 2, H * 0.87, W - 4, H * 0.11, 5); ctx.fill();
  ctx.fillStyle = "#9A6040"; rr(ctx, 10, H * 0.89, W - 20, H * 0.08, 3); ctx.fill();
  ctx.strokeStyle = "#1C0A04"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 8); ctx.stroke();
  ctx.fillStyle = "rgba(230,160,80,0.09)"; rr(ctx, 4, 4, W - 8, H * 0.42, 5); ctx.fill();
}

// ── Wooden Desk (2×1) ─────────────────────────────────────────────────────────
function drawDesk(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 2, 2, W - 8, H - 8);
  ctx.fillStyle = "#6B3A18"; rr(ctx, 2, 2, W - 4, H - 4, 6); ctx.fill();
  ctx.fillStyle = "#9A5828"; rr(ctx, 6, 6, W - 12, H * 0.50, 4); ctx.fill();
  ctx.strokeStyle = "rgba(60,28,8,0.25)"; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(8, 8 + H * 0.42 * i / 5); ctx.lineTo(W - 8, 8 + H * 0.42 * i / 5); ctx.stroke(); }
  // Candle
  const cX = W * 0.73;
  ctx.fillStyle = "#E8D858"; ctx.fillRect(cX - 4, H * 0.12, 7, H * 0.22);
  ctx.fillStyle = "#FF6020"; ctx.beginPath(); ctx.ellipse(cX, H * 0.12, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#FFC820"; ctx.beginPath(); ctx.ellipse(cX, H * 0.10, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  const cg = ctx.createRadialGradient(cX, H * 0.12, 0, cX, H * 0.12, 20);
  cg.addColorStop(0, "rgba(255,200,60,0.38)"); cg.addColorStop(1, "rgba(255,120,0,0)");
  ctx.fillStyle = cg; ctx.fillRect(cX - 20, 0, 40, H * 0.40);
  // Inkwell + quill
  ctx.fillStyle = "#0C0402"; ctx.beginPath(); ctx.arc(W * 0.28, H * 0.26, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2A1808"; ctx.beginPath(); ctx.arc(W * 0.28, H * 0.26, 7, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#D8C020"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W * 0.30, H * 0.22); ctx.lineTo(W * 0.28 + 14, H * 0.08); ctx.stroke();
  // Drawer
  ctx.fillStyle = "#804020"; ctx.fillRect(6, H * 0.56, W - 12, H * 0.37);
  ctx.strokeStyle = "#401808"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2, H * 0.56); ctx.lineTo(W / 2, H * 0.93); ctx.stroke();
  ctx.fillStyle = "#C8A030";
  [W * 0.30, W * 0.70].forEach(kx => { ctx.beginPath(); ctx.arc(kx, H * 0.74, 3.5, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "#3A1A08";
  [[6, H - 10, 8, 10], [W - 14, H - 10, 8, 10]].forEach(([lx, ly, lw, lh]) => ctx.fillRect(lx, ly, lw, lh));
  ctx.strokeStyle = "#1C0A04"; ctx.lineWidth = 2; rr(ctx, 2, 2, W - 4, H - 4, 6); ctx.stroke();
  ctx.fillStyle = "rgba(220,150,60,0.10)"; rr(ctx, 4, 4, W - 8, H * 0.44, 4); ctx.fill();
}

// ── Wooden Chair (1×1) ────────────────────────────────────────────────────────
function drawChair(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, W * 0.10, 4, W * 0.80, H - 10);
  ctx.fillStyle = "#5A3018"; rr(ctx, W * 0.14, 2, W * 0.72, H * 0.50, 6); ctx.fill();
  ctx.fillStyle = "#7A4828"; rr(ctx, W * 0.20, 6, W * 0.60, H * 0.42, 4); ctx.fill();
  ctx.strokeStyle = "#4A2010"; ctx.lineWidth = 1.5;
  [1, 2].forEach(i => { ctx.beginPath(); ctx.moveTo(W * 0.22, 8 + H * 0.38 * i / 3); ctx.lineTo(W * 0.78, 8 + H * 0.38 * i / 3); ctx.stroke(); });
  // Seat
  ctx.fillStyle = "#6B3A18"; rr(ctx, 4, H * 0.48, W - 8, H * 0.45, 6); ctx.fill();
  ctx.fillStyle = "#9A5828"; rr(ctx, 10, H * 0.52, W - 20, H * 0.36, 4); ctx.fill();
  ctx.fillStyle = "#7A4030"; rr(ctx, 14, H * 0.55, W - 28, H * 0.30, 8); ctx.fill();
  ctx.fillStyle = "rgba(180,110,50,0.35)"; rr(ctx, 18, H * 0.58, (W - 36) * 0.5, H * 0.12, 4); ctx.fill();
  ctx.strokeStyle = "rgba(120,70,30,0.40)"; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]);
  rr(ctx, 16, H * 0.57, W - 32, H * 0.26, 6); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#3A1A08";
  [[6, H * 0.91], [W - 14, H * 0.91]].forEach(([lx, ly]) => ctx.fillRect(lx, ly, 8, H * 0.09));
  ctx.strokeStyle = "#1C0A04"; ctx.lineWidth = 2;
  rr(ctx, W * 0.14, 2, W * 0.72, H * 0.50, 6); ctx.stroke();
  rr(ctx, 4, H * 0.48, W - 8, H * 0.45, 6); ctx.stroke();
  ctx.fillStyle = "rgba(220,150,60,0.10)"; rr(ctx, 6, H * 0.50, W - 12, H * 0.18, 4); ctx.fill();
}

// ── Wooden Table (2×2) ────────────────────────────────────────────────────────
function drawTable(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 4, 6, W - 10, H - 10);
  ctx.fillStyle = "#5A3018"; rr(ctx, 2, 2, W - 4, H - 4, 7); ctx.fill();
  ctx.fillStyle = "#9A5828"; rr(ctx, 10, 10, W - 20, H * 0.58, 5); ctx.fill();
  ctx.strokeStyle = "rgba(55,24,6,0.20)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(12, 14 + H * 0.50 * i / 3); ctx.lineTo(W - 12, 14 + H * 0.50 * i / 3); ctx.stroke(); }
  // Tablecloth oval
  const tg = ctx.createRadialGradient(W / 2, H * 0.34, 0, W / 2, H * 0.34, W * 0.34);
  tg.addColorStop(0, "rgba(180,36,36,0.90)"); tg.addColorStop(0.65, "rgba(148,20,20,0.75)"); tg.addColorStop(1, "rgba(120,10,10,0)");
  ctx.fillStyle = tg; rr(ctx, 8, 8, W - 16, H * 0.64, 5); ctx.fill();
  ctx.strokeStyle = "rgba(220,70,40,0.75)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.33, W * 0.27, H * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(240,130,80,0.50)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.33, W * 0.20, H * 0.13, 0, 0, Math.PI * 2); ctx.stroke();
  // Legs
  ctx.fillStyle = "#3A1A08";
  [[10, H * 0.63], [W - 20, H * 0.63], [10, H * 0.84], [W - 20, H * 0.84]].forEach(([lx, ly]) => {
    ctx.fillRect(lx, ly, 10, H * 0.13);
    ctx.fillStyle = "#5A2E10"; ctx.fillRect(lx, ly, 10, 4); ctx.fillStyle = "#3A1A08";
  });
  ctx.fillStyle = "#7A4828"; ctx.fillRect(10, H * 0.60, W - 20, H * 0.05);
  ctx.strokeStyle = "#1C0A04"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 7); ctx.stroke();
  ctx.fillStyle = "rgba(220,150,60,0.10)"; rr(ctx, 4, 4, W - 8, H * 0.52, 5); ctx.fill();
}

// ── Iron Floor Lamp (1×1) ─────────────────────────────────────────────────────
function drawLamp(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, W * 0.10, H * 0.60, W * 0.80, H * 0.35);
  const glow = ctx.createRadialGradient(W / 2, H * 0.20, 0, W / 2, H * 0.20, W * 0.70);
  glow.addColorStop(0, "rgba(255,210,90,0.55)"); glow.addColorStop(0.5, "rgba(255,150,30,0.20)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H * 0.65);
  // Shade
  ctx.fillStyle = "#30220C";
  ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.28); ctx.lineTo(W * 0.92, H * 0.28); ctx.lineTo(W * 0.76, H * 0.07); ctx.lineTo(W * 0.24, H * 0.07); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "rgba(255,220,90,0.30)";
  ctx.beginPath(); ctx.moveTo(W * 0.28, H * 0.28); ctx.lineTo(W * 0.60, H * 0.28); ctx.lineTo(W * 0.52, H * 0.08); ctx.lineTo(W * 0.30, H * 0.08); ctx.closePath(); ctx.fill();
  // Bulb
  const bg = ctx.createRadialGradient(W / 2, H * 0.17, 0, W / 2, H * 0.17, W * 0.14);
  bg.addColorStop(0, "rgba(255,248,180,0.98)"); bg.addColorStop(1, "rgba(255,160,40,0.22)");
  ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(W / 2, H * 0.17, W * 0.11, W * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  // Pole
  const pg = ctx.createLinearGradient(W * 0.44, 0, W * 0.56, 0);
  pg.addColorStop(0, "#4A4058"); pg.addColorStop(0.4, "#7A7088"); pg.addColorStop(1, "#4A4058");
  ctx.fillStyle = pg; ctx.fillRect(W * 0.42, H * 0.28, W * 0.16, H * 0.58);
  // Base
  ctx.fillStyle = "#3A3048"; rr(ctx, W * 0.12, H * 0.84, W * 0.76, H * 0.13, 5); ctx.fill();
  ctx.fillStyle = "#6A6080"; rr(ctx, W * 0.18, H * 0.84, W * 0.64, H * 0.06, 3); ctx.fill();
  ctx.fillStyle = "#2A2838"; rr(ctx, W * 0.10, H * 0.89, W * 0.80, H * 0.08, 4); ctx.fill();
  ctx.strokeStyle = "#181018"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.28); ctx.lineTo(W * 0.92, H * 0.28); ctx.lineTo(W * 0.76, H * 0.07); ctx.lineTo(W * 0.24, H * 0.07); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = "rgba(200,160,60,0.60)"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.28); ctx.lineTo(W * 0.92, H * 0.28); ctx.stroke();
}

// ── Iron Bookshelf (1×2) ──────────────────────────────────────────────────────
function drawBookshelf(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 3, 4, W - 4, H - 6);
  ctx.fillStyle = "#24222E"; rr(ctx, 2, 2, W - 4, H - 4, 5); ctx.fill();
  ctx.fillStyle = "#18161E"; ctx.fillRect(8, 8, W - 16, H - 16);
  const SHELVES = 3;
  const secH = (H - 20) / SHELVES;
  const colors = [
    ["#8B1A1A", "#C83030", "#2A1A6B", "#4A3A9A", "#1A5A2A"],
    ["#6B4020", "#C88030", "#4A1A6B", "#8B5020", "#2A5A3A"],
    ["#2A5A1A", "#A84020", "#5A3A1A", "#1A4A6B", "#7A2A4A"],
  ];
  for (let s = 0; s < SHELVES; s++) {
    const sY = 10 + s * secH;
    let bX = 10;
    colors[s].forEach((color, i) => {
      const bW = 10 + (i % 2) * 4;
      const bH = secH - 14;
      ctx.fillStyle = color; ctx.fillRect(bX, sY + 6, bW, bH);
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(bX, sY + 6, bW, bH * 0.30);
      ctx.strokeStyle = "rgba(0,0,0,0.55)"; ctx.lineWidth = 0.8; ctx.strokeRect(bX, sY + 6, bW, bH);
      bX += bW + 2;
    });
    ctx.fillStyle = "#42405A"; ctx.fillRect(6, sY + secH - 6, W - 12, 8);
    ctx.fillStyle = "#62607A"; ctx.fillRect(6, sY + secH - 6, W - 12, 3);
  }
  ctx.strokeStyle = "#0A0810"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 5); ctx.stroke();
  ctx.fillStyle = "#7A7090";
  [[6, 6], [W - 10, 6], [6, H - 10], [W - 10, H - 10]].forEach(([rx, ry]) => {
    ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#A8A0C0"; ctx.beginPath(); ctx.arc(rx - 0.8, ry - 0.8, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#7A7090";
  });
  ctx.fillStyle = "rgba(180,170,215,0.10)"; ctx.fillRect(4, 4, W * 0.35, H - 8);
}

// ── Magic Forge / Fireplace (2×1) ────────────────────────────────────────────
function drawFireplace(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 4, 6, W - 8, H - 8);
  ctx.fillStyle = "#38302A"; rr(ctx, 2, 2, W - 4, H - 4, 5); ctx.fill();
  ctx.strokeStyle = "rgba(80,70,52,0.45)"; ctx.lineWidth = 1;
  [[2, H * 0.32, W - 2, H * 0.32], [2, H * 0.54, W - 2, H * 0.54],
   [W * 0.38, 2, W * 0.38, H * 0.32], [W * 0.64, H * 0.32, W * 0.64, H - 2]].forEach(([x1, y1, x2, y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  // Fire chamber
  ctx.fillStyle = "#060402"; rr(ctx, W * 0.12, H * 0.09, W * 0.76, H * 0.67, 4); ctx.fill();
  const fg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, W * 0.42);
  fg.addColorStop(0, "rgba(255,130,20,0.65)"); fg.addColorStop(0.5, "rgba(200,60,10,0.32)"); fg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fg; rr(ctx, W * 0.12, H * 0.09, W * 0.76, H * 0.67, 4); ctx.fill();
  [[W * 0.24, H * 0.38], [W * 0.50, H * 0.46], [W * 0.76, H * 0.38]].forEach(([fx, fh], i) => {
    ctx.fillStyle = i % 2 === 0 ? "#FF5010" : "#FF8020";
    ctx.beginPath(); ctx.moveTo(fx, H * 0.73); ctx.quadraticCurveTo(fx - W * 0.06, H * 0.56, fx, H * 0.73 - fh); ctx.quadraticCurveTo(fx + W * 0.06, H * 0.56, fx, H * 0.73); ctx.fill();
    ctx.fillStyle = "#FFC030";
    ctx.beginPath(); ctx.moveTo(fx, H * 0.73); ctx.quadraticCurveTo(fx - W * 0.03, H * 0.63, fx, H * 0.73 - fh * 0.52); ctx.quadraticCurveTo(fx + W * 0.03, H * 0.63, fx, H * 0.73); ctx.fill();
  });
  const eg = ctx.createLinearGradient(0, H * 0.68, 0, H * 0.76);
  eg.addColorStop(0, "rgba(255,80,0,0.70)"); eg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = eg; ctx.fillRect(W * 0.15, H * 0.68, W * 0.70, H * 0.08);
  ctx.fillStyle = "#504838"; rr(ctx, 2, 2, W - 4, H * 0.12, 4); ctx.fill();
  ctx.fillStyle = "rgba(200,180,120,0.22)"; rr(ctx, 4, 4, W - 8, H * 0.08, 3); ctx.fill();
  ctx.fillStyle = "#201A14";
  [[W * 0.06, H * 0.80], [W * 0.84, H * 0.80]].forEach(([lx, ly]) => { rr(ctx, lx, ly, W * 0.10, H * 0.18, 3); ctx.fill(); });
  ctx.strokeStyle = "#0C0806"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 5); ctx.stroke();
  ctx.fillStyle = "rgba(255,160,40,0.08)"; rr(ctx, 4, 4, W - 8, H * 0.70, 4); ctx.fill();
}

// ── Crystal Cabinet (2×1) ────────────────────────────────────────────────────
function drawCabinet(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 4, 5, W - 8, H - 8);
  ctx.fillStyle = "#3A2050"; rr(ctx, 2, 2, W - 4, H - 4, 6); ctx.fill();
  ctx.fillStyle = "#5A3878"; rr(ctx, 2, 2, W - 4, H * 0.19, 6); ctx.fill();
  ctx.fillStyle = "rgba(180,120,255,0.25)"; rr(ctx, 8, 5, W - 16, H * 0.10, 3); ctx.fill();
  const gg = ctx.createLinearGradient(W * 0.12, 0, W * 0.88, H);
  gg.addColorStop(0, "rgba(140,200,255,0.28)"); gg.addColorStop(0.5, "rgba(80,140,220,0.14)"); gg.addColorStop(1, "rgba(40,80,180,0.22)");
  ctx.fillStyle = gg; rr(ctx, W * 0.10, H * 0.21, W * 0.80, H * 0.63, 4); ctx.fill();
  ctx.fillStyle = "rgba(210,245,255,0.24)"; rr(ctx, W * 0.12, H * 0.23, W * 0.26, H * 0.24, 3); ctx.fill();
  const gems = [
    { x: W * 0.26, y: H * 0.43, r: 7, c: "#FF4080" }, { x: W * 0.50, y: H * 0.38, r: 8, c: "#40E0D0" },
    { x: W * 0.74, y: H * 0.45, r: 6, c: "#A040FF" }, { x: W * 0.38, y: H * 0.63, r: 5, c: "#40C0FF" },
    { x: W * 0.62, y: H * 0.63, r: 5, c: "#FF8040" },
  ];
  gems.forEach(({ x, y, r, c }) => {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.90)"); g.addColorStop(0.3, c); g.addColorStop(1, "rgba(0,0,0,0.30)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.strokeStyle = "rgba(120,70,200,0.70)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W * 0.12, H * 0.56); ctx.lineTo(W * 0.88, H * 0.56); ctx.stroke();
  ctx.fillStyle = "#2A1840";
  [[W * 0.08, H * 0.85], [W * 0.80, H * 0.85]].forEach(([lx, ly]) => ctx.fillRect(lx, ly, W * 0.12, H * 0.13));
  ctx.strokeStyle = "#C080FF"; ctx.lineWidth = 1.5; rr(ctx, W * 0.10, H * 0.21, W * 0.80, H * 0.63, 4); ctx.stroke();
  ctx.strokeStyle = "#1A0C2A"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 6); ctx.stroke();
  ctx.fillStyle = "rgba(180,100,255,0.06)"; rr(ctx, 4, 4, W - 8, H * 0.55, 5); ctx.fill();
}

// ── Crystal Plant Pot (1×1) ───────────────────────────────────────────────────
function drawPlant(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, W * 0.15, H * 0.50, W * 0.70, H * 0.44);
  // Pot
  ctx.fillStyle = "#6A3818"; rr(ctx, W * 0.18, H * 0.50, W * 0.64, H * 0.43, 6); ctx.fill();
  ctx.fillStyle = "#8A5030"; rr(ctx, W * 0.22, H * 0.52, W * 0.56, H * 0.36, 4); ctx.fill();
  ctx.fillStyle = "#7A4020"; rr(ctx, W * 0.12, H * 0.47, W * 0.76, H * 0.09, 4); ctx.fill();
  ctx.fillStyle = "#9A6042"; rr(ctx, W * 0.15, H * 0.47, W * 0.70, H * 0.06, 3); ctx.fill();
  ctx.fillStyle = "#2A1A0A"; rr(ctx, W * 0.22, H * 0.51, W * 0.56, H * 0.08, 2); ctx.fill();
  // Leaves
  const leafAngles: [number, number][] = [[0, 1.0], [0.78, 0.85], [1.57, 1.0], [2.36, 0.80], [3.14, 0.92], [3.93, 1.0], [4.71, 0.82], [5.50, 0.95]];
  const lColors = ["#1A6A18", "#228A20", "#2A9828", "#186018", "#1A7A20", "#20801A", "#18601A", "#269022"];
  leafAngles.forEach(([angle, rs], i) => {
    const radius = W * 0.22 * rs;
    const lx = W * 0.5 + Math.cos(angle) * radius;
    const ly = H * 0.37 + Math.sin(angle) * radius * 0.42;
    ctx.fillStyle = lColors[i];
    ctx.beginPath(); ctx.ellipse(lx, ly, W * 0.13, H * 0.09, angle, 0, Math.PI * 2); ctx.fill();
  });
  // Stems
  [0, Math.PI / 3, (Math.PI * 2) / 3].forEach(a => {
    ctx.strokeStyle = "#1A6018"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.5, H * 0.46);
    ctx.quadraticCurveTo(W * 0.5 + Math.cos(a) * W * 0.16, H * 0.32, W * 0.5 + Math.cos(a) * W * 0.28, H * 0.18);
    ctx.stroke();
    ctx.fillStyle = "#2A9828"; ctx.beginPath(); ctx.ellipse(W * 0.5 + Math.cos(a) * W * 0.28, H * 0.18, W * 0.09, H * 0.06, a, 0, Math.PI * 2); ctx.fill();
  });
  // Crystal sparkles
  [{ x: W * 0.34, y: H * 0.50, c: "#A040FF" }, { x: W * 0.50, y: H * 0.55, c: "#60C0FF" }, { x: W * 0.66, y: H * 0.51, c: "#FF60A0" }].forEach(({ x, y, c }) => {
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.stroke();
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  });
  const og = ctx.createRadialGradient(W * 0.5, H * 0.38, 0, W * 0.5, H * 0.38, W * 0.32);
  og.addColorStop(0, "rgba(160,80,255,0.28)"); og.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = og; ctx.fillRect(0, 0, W, H * 0.52);
  ctx.strokeStyle = "#4A2010"; ctx.lineWidth = 2; rr(ctx, W * 0.18, H * 0.50, W * 0.64, H * 0.43, 6); ctx.stroke();
}

// ── Leather Rug (3×2) ────────────────────────────────────────────────────────
function drawRug(ctx: CanvasRenderingContext2D, W: number, H: number) {
  shadow(ctx, 4, 6, W - 8, H - 8);
  ctx.fillStyle = "#721A1A"; rr(ctx, 2, 2, W - 4, H - 4, 7); ctx.fill();
  // Weave texture
  ctx.strokeStyle = "rgba(100,20,20,0.40)"; ctx.lineWidth = 1.5;
  for (let y = 10; y < H - 8; y += 5) { ctx.beginPath(); ctx.moveTo(4, y); ctx.lineTo(W - 4, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(120,30,30,0.25)"; ctx.lineWidth = 1;
  for (let x = 10; x < W - 8; x += 8) { ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H - 4); ctx.stroke(); }
  // Outer border
  ctx.strokeStyle = "#C84030"; ctx.lineWidth = 5.5; rr(ctx, 9, 9, W - 18, H - 18, 5); ctx.stroke();
  ctx.strokeStyle = "#E89050"; ctx.lineWidth = 2.5; rr(ctx, 18, 18, W - 36, H - 36, 3); ctx.stroke();
  ctx.strokeStyle = "rgba(245,165,90,0.55)"; ctx.lineWidth = 1.2; rr(ctx, 23, 23, W - 46, H - 46, 2); ctx.stroke();
  // Corner diamonds
  const dSize = Math.min(W, H) * 0.065;
  [[22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]].forEach(([dx, dy]) => {
    ctx.fillStyle = "#E88030";
    ctx.beginPath(); ctx.moveTo(dx, dy - dSize); ctx.lineTo(dx + dSize, dy); ctx.lineTo(dx, dy + dSize); ctx.lineTo(dx - dSize, dy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#C85820"; ctx.beginPath(); ctx.arc(dx, dy, dSize * 0.38, 0, Math.PI * 2); ctx.fill();
  });
  // Center medallion
  const mg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.24);
  mg.addColorStop(0, "rgba(195,55,35,0.90)"); mg.addColorStop(0.55, "rgba(155,26,18,0.65)"); mg.addColorStop(1, "rgba(100,8,8,0)");
  ctx.fillStyle = mg; ctx.fillRect(W * 0.18, H * 0.08, W * 0.64, H * 0.84);
  ctx.strokeStyle = "#D05030"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.18, H * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#E87040"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, W * 0.12, H * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
  // 8-pointed star
  const starR = Math.min(W, H) * 0.085;
  ctx.fillStyle = "#F09050";
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? starR : starR * 0.44;
    i === 0 ? ctx.moveTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.72)
            : ctx.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.72);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#C85820"; ctx.beginPath(); ctx.ellipse(W / 2, H / 2, starR * 0.32, starR * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#3A0808"; ctx.lineWidth = 2.5; rr(ctx, 2, 2, W - 4, H - 4, 7); ctx.stroke();
}

// ─── Dispatch ──────────────────────────────────────────────────────────────────
type DrawFn = (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
const DRAW_FNS: Record<string, DrawFn> = {
  wooden_bed:      drawBed,
  wooden_desk:     drawDesk,
  wooden_dummy:    drawChair,
  ancient_altar:   drawTable,
  iron_stand:      drawLamp,
  iron_trainer:    drawBookshelf,
  magic_forge:     drawFireplace,
  crystal_display: drawCabinet,
  ancient_orb:     drawPlant,
  leather_mat:     drawRug,
};

// ─── Component ─────────────────────────────────────────────────────────────────
export function FurnitureCanvas({
  furnitureId, rotation = 0, W, H,
}: {
  furnitureId: string;
  rotation?: 0 | 90 | 180 | 270;
  W: number;
  H: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);

    const fn = DRAW_FNS[furnitureId];
    if (!fn) {
      ctx.fillStyle = "#4A2810"; rr(ctx, 2, 2, W - 4, H - 4, 6); ctx.fill(); return;
    }
    ctx.save();
    if (rotation === 90) {
      ctx.translate(W, 0); ctx.rotate(Math.PI / 2); fn(ctx, H, W);
    } else if (rotation === 180) {
      ctx.translate(W, H); ctx.rotate(Math.PI); fn(ctx, W, H);
    } else if (rotation === 270) {
      ctx.translate(0, H); ctx.rotate(-Math.PI / 2); fn(ctx, H, W);
    } else {
      fn(ctx, W, H);
    }
    ctx.restore();
  }, [furnitureId, rotation, W, H]);

  return <canvas ref={ref} style={{ display: "block", imageRendering: "pixelated" }} />;
}
