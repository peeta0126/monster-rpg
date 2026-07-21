'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ─── Minimal PNG encoder ──────────────────────────────────────────────────────
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function mkchunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const x = Buffer.alloc(4); x.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, x]);
}
function toPNG(w, h, buf) {
  const hdr = Buffer.alloc(13);
  hdr.writeUInt32BE(w, 0); hdr.writeUInt32BE(h, 4);
  hdr[8] = 8; hdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    buf.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    mkchunk('IHDR', hdr),
    mkchunk('IDAT', zlib.deflateSync(raw)),
    mkchunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Canvas ────────────────────────────────────────────────────────────────────
class CV {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.d = Buffer.alloc(w * h * 4, 0); // transparent
  }
  px(x, y, col, a = 255) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) << 2;
    this.d[i] = col[0]; this.d[i+1] = col[1]; this.d[i+2] = col[2]; this.d[i+3] = a;
  }
  rect(x, y, w, h, col, a = 255) {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++)
        this.px(px, py, col, a);
  }
  circle(cx, cy, r, col, a = 255) {
    for (let py = Math.ceil(cy - r); py <= Math.floor(cy + r); py++)
      for (let px = Math.ceil(cx - r); px <= Math.floor(cx + r); px++)
        if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r)
          this.px(px, py, col, a);
  }
  // 1px dark outline around all opaque pixels
  outline(col) {
    const orig = Buffer.from(this.d);
    const DX = [-1, 1, 0, 0];
    const DY = [0, 0, -1, 1];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (orig[(y * this.w + x) * 4 + 3] > 0) continue;
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (nx >= 0 && nx < this.w && ny >= 0 && ny < this.h
              && orig[(ny * this.w + nx) * 4 + 3] > 0) {
            this.px(x, y, col); break;
          }
        }
      }
    }
  }
  png() { return toPNG(this.w, this.h, this.d); }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const OUT = [26,  26,  46 ]; // dark outline
const SK  = [200, 149, 108]; // skin
const SKD = [168, 112, 80 ]; // skin shadow
const EYE = [35,  30,  30 ]; // eye
const HH  = [155, 155, 155]; // helmet steel
const HHD = [100, 100, 100]; // helmet dark
const HHL = [205, 205, 205]; // helmet highlight
const RD  = [138, 30,  30 ]; // red tabard
const RDD = [98,  18,  18 ]; // red dark
const CR  = [218, 200, 152]; // cream
const CRD = [188, 168, 122]; // cream dark
const AR  = [178, 178, 178]; // armor plate
const ARD = [128, 128, 128]; // armor dark
const PNT = [48,  68,  52 ]; // pants
const PND = [32,  48,  38 ]; // pants dark
const BT  = [94,  58,  28 ]; // boot
const BTD = [60,  36,  14 ]; // boot dark/sole
const WD  = [138, 104, 20 ]; // wood
const WDD = [92,  72,  10 ]; // wood dark
const MT  = [195, 195, 195]; // metal blade
const MTD = [145, 145, 145]; // metal dark
const GL  = [200, 158, 68 ]; // gold
const GRH = [182, 182, 178]; // gray hair
const GRD = [138, 136, 132]; // gray hair dark
const GRN = [44,  92,  44 ]; // green scarf
const GND = [28,  62,  28 ]; // green dark
const BEL = [78,  56,  38 ]; // belt
const BLD = [54,  36,  18 ]; // belt dark
const LV  = [98,  68,  38 ]; // leather/staff knob
const BR  = [110, 72,  32 ]; // beard brown (dark brown)

// ═══════════════════════════════════════════════════════════════════════════════
// BAROS – Tower Guard
//   투구, 빨간+크림 갑옷, 할버드
// ═══════════════════════════════════════════════════════════════════════════════
function makeBaros() {
  const c = new CV(64, 64);

  // ── Halberd shaft (drawn first, behind character) ──────────────
  c.rect(43, 8, 2, 50, WD);
  c.rect(44, 8, 1, 50, WDD);

  // Halberd axe head
  c.rect(40, 4, 7, 3, MT);
  c.rect(41, 2, 5, 3, MT);
  c.rect(42, 0, 3, 3, MT);
  c.rect(41, 5, 4, 2, MTD);
  // Crossguard
  c.rect(38, 8, 9, 2, MTD);
  // Axe hook (lower blade)
  c.rect(45, 10, 3, 2, MT);
  c.rect(46, 12, 2, 2, MT);

  // ── Boots ──────────────────────────────────────────────────────
  c.rect(24, 50, 7, 7, BT);
  c.rect(24, 55, 8, 2, BTD);
  c.rect(33, 50, 7, 7, BT);
  c.rect(33, 55, 8, 2, BTD);

  // ── Legs (pants) ───────────────────────────────────────────────
  c.rect(25, 41, 6, 11, PNT);
  c.rect(25, 41, 1, 11, PND);
  c.rect(33, 41, 6, 11, PNT);
  c.rect(38, 41, 1, 11, PND);

  // ── Belt ───────────────────────────────────────────────────────
  c.rect(24, 40, 16, 2, BEL);
  c.rect(30, 39, 4, 4, BLD);
  c.rect(31, 40, 2, 2, GL); // buckle

  // ── Torso ──────────────────────────────────────────────────────
  // Shoulder armor plates
  c.rect(20, 22, 5, 6, AR);
  c.rect(20, 22, 1, 6, ARD);
  c.rect(20, 27, 5, 1, ARD);
  c.rect(39, 22, 5, 6, AR);
  c.rect(43, 22, 1, 6, ARD);
  c.rect(39, 27, 5, 1, ARD);

  // Body base (cream surcoat)
  c.rect(24, 21, 16, 21, CR);

  // Red tabard sides
  c.rect(24, 21, 4, 21, RD);
  c.rect(24, 21, 1, 21, RDD);
  c.rect(36, 21, 4, 21, RD);
  c.rect(39, 21, 1, 21, RDD);

  // Red collar strip
  c.rect(28, 21, 8, 4, RD);

  // Castle emblem (gold) on cream center
  c.rect(29, 26, 6, 12, CRD);
  c.rect(30, 26, 4, 2, GL);    // battlements
  c.px(30, 26, CRD);
  c.px(32, 26, CRD);
  c.rect(31, 28, 2, 8, GL);   // tower shaft
  c.rect(29, 30, 2, 6, GL);   // left buttress
  c.rect(33, 30, 2, 6, GL);   // right buttress

  // ── Face ───────────────────────────────────────────────────────
  // Skin (visible between helmet brim and beard)
  c.rect(26, 19, 12, 8, SK);
  c.rect(26, 19, 1, 8, SKD);
  c.rect(37, 19, 1, 8, SKD);

  // Eyes (two dark pixels each)
  c.px(29, 21, EYE); c.px(30, 21, EYE);
  c.px(34, 21, EYE); c.px(35, 21, EYE);

  // Nose bridge
  c.px(32, 23, SKD);

  // Brown beard – sides + chin
  c.rect(24, 24, 4, 5, BR);    // left beard
  c.rect(36, 24, 4, 5, BR);    // right beard
  c.rect(27, 26, 10, 3, BR);   // chin beard
  c.rect(28, 25, 8,  1, SK);   // gap (mouth/lips line)
  c.rect(29, 24, 6,  2, BR);   // mustache

  // ── Helmet ─────────────────────────────────────────────────────
  // Main dome
  c.circle(32, 13, 9, HH);
  // Brim band
  c.rect(23, 17, 18, 3, HH);
  c.rect(23, 17, 1,  3, HHD);
  c.rect(40, 17, 1,  3, HHD);
  // Cheek guards
  c.rect(22, 17, 3, 8, HHD);
  c.rect(39, 17, 3, 8, HHD);
  // Nasal guard
  c.rect(31, 19, 2, 7, HHD);
  // Brow shadow line
  c.rect(23, 19, 18, 1, HHD);
  // Highlights
  c.rect(26, 9, 5, 3, HHL);
  c.rect(27, 7, 3, 2, HHL);

  c.outline(OUT);
  return c.png();
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORION – Village Guard / Elder
//   회색 머리+수염, 어두운 빨간 로브, 지팡이, 금 메달리온
// ═══════════════════════════════════════════════════════════════════════════════
function makeOrion() {
  const c = new CV(64, 64);

  // ── Staff (drawn first, behind character) ──────────────────────
  c.rect(19, 10, 2, 48, WD);
  c.rect(20, 10, 1, 48, WDD);
  // Wooden knob at top
  c.circle(19, 9, 3, LV);
  c.px(19, 8, [128, 96, 56]);
  c.px(18, 8, [128, 96, 56]);

  // ── Boots ──────────────────────────────────────────────────────
  c.rect(24, 50, 7, 7, BT);
  c.rect(24, 55, 8, 2, BTD);
  c.rect(33, 50, 7, 7, BT);
  c.rect(33, 55, 8, 2, BTD);

  // ── Robe lower hem (wider, elder style) ────────────────────────
  c.rect(21, 42, 22, 11, RD);
  c.rect(21, 42, 1,  11, RDD);
  c.rect(42, 42, 1,  11, RDD);
  // Inner cream visible at robe hem
  c.rect(28, 44, 8, 9, CR);
  c.rect(28, 44, 1, 9, CRD);
  c.rect(35, 44, 1, 9, CRD);

  // ── Belt + Pouches ─────────────────────────────────────────────
  c.rect(22, 40, 20, 3, BEL);
  // Left pouch
  c.rect(22, 38, 4, 5, LV);
  c.rect(22, 38, 1, 5, WDD);
  // Right pouch / keys
  c.rect(38, 38, 4, 5, LV);
  c.rect(41, 38, 1, 5, WDD);
  c.px(39, 40, GL); c.px(39, 41, GL); // key glint
  // Belt buckle
  c.rect(29, 40, 6, 3, BLD);
  c.rect(31, 40, 2, 3, GL);

  // ── Torso ──────────────────────────────────────────────────────
  // Outer dark-red robe
  c.rect(22, 21, 20, 21, RD);
  c.rect(22, 21, 1,  21, RDD);
  c.rect(41, 21, 1,  21, RDD);

  // Inner cream robe center stripe
  c.rect(27, 23, 10, 19, CR);
  c.rect(27, 23, 1,  19, CRD);
  c.rect(36, 23, 1,  19, CRD);

  // Green scarf / hood collar
  c.rect(22, 21, 20, 5, GRN);
  c.rect(22, 21, 1,  5, GND);
  c.rect(41, 21, 1,  5, GND);
  c.rect(28, 23, 8,  3, GND); // inner shadow fold

  // Gold medallion (circular pendant on cream)
  c.circle(32, 30, 3, GL);
  c.px(31, 29, [225, 192, 105]); // highlight
  c.px(32, 29, [225, 192, 105]);

  // Subtle leaf embroidery (decorative marks)
  c.rect(29, 35, 2, 4, CRD);
  c.rect(33, 35, 2, 4, CRD);

  // ── Face ───────────────────────────────────────────────────────
  c.rect(26, 17, 12, 10, SK);
  c.rect(26, 17, 1,  10, SKD);
  c.rect(37, 17, 1,  10, SKD);

  // Eyes
  c.px(29, 20, EYE); c.px(30, 20, EYE);
  c.px(34, 20, EYE); c.px(35, 20, EYE);

  // Gray eyebrows (older character)
  c.rect(28, 18, 4, 1, GRH);
  c.rect(33, 18, 4, 1, GRH);

  // Nose
  c.px(31, 22, SKD); c.px(32, 22, SKD);

  // Gray mustache + beard
  c.rect(29, 23, 6, 2, [130, 128, 124]); // mustache (slightly darker gray)
  c.rect(25, 25, 4, 6, GRH);             // left beard
  c.rect(35, 25, 4, 6, GRH);             // right beard
  c.rect(27, 27, 10, 4, GRH);            // chin beard
  c.rect(28, 27, 8,  2, SK);             // mouth area (skin)
  c.rect(29, 26, 6,  1, [72, 52, 42]);   // lips line

  // ── Gray hair ──────────────────────────────────────────────────
  // Main hair dome
  c.circle(32, 13, 9, GRH);
  // Side hair (longer, past cheeks)
  c.rect(23, 13, 4, 10, GRH);
  c.rect(23, 13, 1, 10, GRD);
  c.rect(37, 13, 4, 10, GRH);
  c.rect(40, 13, 1, 10, GRD);
  // Hair highlights
  c.rect(27, 8, 4, 3, [208, 208, 205]);
  c.rect(28, 7, 3, 2, [220, 220, 217]);
  // Center part shadow
  c.rect(31, 8, 2, 4, GRD);

  c.outline(OUT);
  return c.png();
}

// ─── Write output files ────────────────────────────────────────────────────────
const outDir = path.resolve(__dirname, '..', 'public', 'assets', 'player');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'npc-baros-sprite.png'), makeBaros());
console.log('✓  npc-baros-sprite.png');

fs.writeFileSync(path.join(outDir, 'npc-orion-sprite.png'), makeOrion());
console.log('✓  npc-orion-sprite.png');
