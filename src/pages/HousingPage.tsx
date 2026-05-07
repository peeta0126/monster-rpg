import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import HousingBgCanvas from "./HousingBgCanvas";
import { usePlayerStore, isTileWalkable } from "../store/playerStore";
import {
  FURNITURE, getFurniture, countMaterials,
  MATERIAL_LABEL, RARITY_LABEL, RARITY_COLOR, MATERIAL_SET_TIERS,
} from "../data/furniture";
import type { FurnitureMaterial } from "../data/furniture";
import type { PlacedFurniture, PlacedWallDecoration, WallSide } from "../types/housing";
import { getMaterial } from "../data/items";
import {
  TILE_W, TILE_H, roomPixelSize, getTileKey,
  getFurnitureOccupiedTiles, getRotatedSize, buildOccupiedSet,
  canPlaceFurnitureAt, getFurnitureAtTile, getFurnitureRenderPosition,
} from "../utils/isometric";
import { ROOM_COLS, ROOM_ROWS, FARM_DOOR_TILE, EXIT_DOOR_TILE, PLAYER_INIT_TILE } from "../constants/housing";
import { WALLPAPERS, getWallpaper } from "../data/wallpapers";
import { FLOOR_TILES, getFloorTile } from "../data/floorTiles";
import { WALL_DECORATIONS, getWallDecoration } from "../data/wallDecorations";

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const WALL_H    = 160;
const MOLDING_H = 14;   // 상단 몰딩 두께 (SVG px)
const BASE_H    = 9;    // 하단 걸레받이 두께 (SVG px)

const roomSize = roomPixelSize(ROOM_COLS, ROOM_ROWS);
// roomSize.width = 880, roomSize.height = 440, roomSize.minX = -440, roomSize.minY = 0

/** rgba(r,g,b,a) 에서 alpha 를 1 로 바꿔 불투명 색 반환 */
function toOpaque(rgba: string): string {
  return rgba.replace(/[\d.]+\)$/, "1)");
}

// 벽 면 꼭짓점 헬퍼 (SVG 좌표계: SVG 원점 = 화면상 (offsetX, offsetY - WALL_H))
// 방 백코너 = SVG 내 (440, WALL_H), 방 왼쪽코너 = (0, WALL_H+220), 오른쪽코너 = (880, WALL_H+220)
const BACK_X = 440;
const LEFT_X = 0;
const RIGHT_X = 880;
const MID_Y = 220; // ROOM_ROWS * TILE_H / 2 = 10 * 22

// 방 타일 화면 좌표
function tileScreenPos(tx: number, ty: number, offsetX: number, offsetY: number) {
  const left = (tx - ty) * (TILE_W / 2);
  const top  = (tx + ty) * (TILE_H / 2);
  return { left: left - roomSize.minX + offsetX, top: top - roomSize.minY + offsetY };
}

// 벽면 파라메트릭 위치 → SVG 좌표
// left wall: P(u,v) = (440-440u, 220u + WALL_H*v)  [u=0:뒤, u=1:왼쪽]
// right wall: P(u,v) = (440+440u, 220u + WALL_H*v) [u=0:뒤, u=1:오른쪽]
function wallSlotSVGPos(wall: WallSide, u: number, v: number) {
  if (wall === "left") {
    return { x: BACK_X - BACK_X * u, y: MID_Y * u + WALL_H * v };
  }
  return { x: BACK_X + BACK_X * u, y: MID_Y * u + WALL_H * v };
}

// 6 슬롯 위치: 3열×2행
const SLOT_U = [0.18, 0.5, 0.82];
const SLOT_V = [0.22, 0.65];
function slotUV(slotIndex: number): { u: number; v: number } {
  const col = slotIndex % 3;
  const row = Math.floor(slotIndex / 3);
  return { u: SLOT_U[col], v: SLOT_V[row] };
}

// ─── 타일 컴포넌트 ────────────────────────────────────────────────────────────

type TileState = "normal" | "hover" | "preview_ok" | "preview_block" | "selected_furniture";

interface FloorStyle {
  normalBg: string;
  normalOutline: string;
  hoverBg: string;
  hoverOutline: string;
}

function IsoTile({
  tx, ty, offsetX, offsetY, state, floorStyle,
  onClick, onMouseEnter, onMouseLeave,
}: {
  tx: number; ty: number; offsetX: number; offsetY: number;
  state: TileState; floorStyle: FloorStyle;
  onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void;
}) {
  const { left, top } = tileScreenPos(tx, ty, offsetX, offsetY);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  const clip = `polygon(${hw}px 0px, ${TILE_W}px ${hh}px, ${hw}px ${TILE_H}px, 0px ${hh}px)`;

  // normal 상태는 투명 — FloorSVG 가 바닥 시각을 담당
  const styles: Record<TileState, { bg: string }> = {
    normal:            { bg: "transparent" },
    hover:             { bg: floorStyle.hoverBg },
    preview_ok:        { bg: "rgba(80,200,120,0.55)" },
    preview_block:     { bg: "rgba(220,60,60,0.55)" },
    selected_furniture:{ bg: "rgba(250,200,50,0.55)" },
  };
  const s = styles[state];

  return (
    <div
      style={{
        position: "absolute", left, top, width: TILE_W, height: TILE_H,
        clipPath: clip, background: s.bg,
        cursor: "pointer", zIndex: 1, transition: "background 0.08s",
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    />
  );
}

// ─── 벽면 SVG ────────────────────────────────────────────────────────────────

function WallSVG({
  offsetX, offsetY, wallpaperId,
  wallDecorations, editMode, selectedDecoId,
  onSlotClick,
}: {
  offsetX: number; offsetY: number; wallpaperId: string;
  wallDecorations: PlacedWallDecoration[];
  editMode: boolean; selectedDecoId: string | null;
  onSlotClick: (wall: WallSide, slotIndex: number) => void;
}) {
  const wp = getWallpaper(wallpaperId);
  const svgLeft = offsetX + TILE_W / 2;
  const svgTop  = offsetY - WALL_H;
  const svgW    = roomSize.width;          // 880
  const svgH    = WALL_H + MID_Y + 20;    // 여유 20px (shadow)

  // ── 벽 꼭짓점 ───────────────────────────────────────────────────────────────
  const leftWall   = `${BACK_X},0 ${LEFT_X},${MID_Y} ${LEFT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H}`;
  const rightWall  = `${BACK_X},0 ${RIGHT_X},${MID_Y} ${RIGHT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H}`;

  // ── 몰딩: 벽 최상단 MOLDING_H 두께 ─────────────────────────────────────────
  const leftMold   = `${BACK_X},0 ${LEFT_X},${MID_Y} ${LEFT_X},${MID_Y+MOLDING_H} ${BACK_X},${MOLDING_H}`;
  const rightMold  = `${BACK_X},0 ${RIGHT_X},${MID_Y} ${RIGHT_X},${MID_Y+MOLDING_H} ${BACK_X},${MOLDING_H}`;

  // ── 걸레받이: 벽 최하단 BASE_H 두께 ─────────────────────────────────────────
  const bs         = WALL_H - BASE_H;
  const leftBase   = `${BACK_X},${bs} ${LEFT_X},${MID_Y+bs} ${LEFT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H}`;
  const rightBase  = `${BACK_X},${bs} ${RIGHT_X},${MID_Y+bs} ${RIGHT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H}`;

  // ── 방 실루엣 (shadow용) ─────────────────────────────────────────────────────
  const silhouette = `${BACK_X},0 ${LEFT_X},${MID_Y} ${LEFT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H} ${RIGHT_X},${WALL_H+MID_Y} ${RIGHT_X},${MID_Y}`;

  // 슬롯 위치 맵
  const decoMap = new Map<string, PlacedWallDecoration>();
  for (const d of wallDecorations) {
    decoMap.set(`${d.wall}-${d.slotIndex}`, d);
  }

  return (
    <svg
      style={{
        position: "absolute",
        left: svgLeft, top: svgTop,
        width: svgW, height: svgH,
        pointerEvents: editMode ? "auto" : "none",
        zIndex: 2, overflow: "visible",
      }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      <defs>
        {/* 벽 기본 그라디언트 ─ 좌(어둠) / 우(밝음) */}
        <linearGradient id="gradLeft" x1={BACK_X} y1={0} x2={LEFT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wp.leftColor1}/>
          <stop offset="100%" stopColor={wp.leftColor2}/>
        </linearGradient>
        <linearGradient id="gradRight" x1={BACK_X} y1={0} x2={RIGHT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wp.rightColor1}/>
          <stop offset="100%" stopColor={wp.rightColor2}/>
        </linearGradient>

        {/* 좌벽: 코너에 가까울수록 약간 어둠 (입체감) */}
        <linearGradient id="depthLeft" x1={LEFT_X} y1={0} x2={BACK_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(0,0,0,0)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)"/>
        </linearGradient>
        {/* 우벽: 코너에 가까울수록 약간 어둠 */}
        <linearGradient id="depthRight" x1={RIGHT_X} y1={0} x2={BACK_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(0,0,0,0)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)"/>
        </linearGradient>

        {/* 상단 빛 하이라이트 (천장 근처가 살짝 밝음) */}
        <linearGradient id="topLit" x1={BACK_X} y1={0} x2={BACK_X} y2={WALL_H} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.14)"/>
          <stop offset="40%" stopColor="rgba(255,255,255,0)"/>
        </linearGradient>

        {/* 수평선 패턴 (벽지 결) */}
        <pattern id="wallGrain" x="0" y="0" width="1" height="13" patternUnits="userSpaceOnUse">
          <line x1="0" y1="12" x2="1000" y2="12" stroke="rgba(0,0,0,0.055)" strokeWidth="0.7"/>
        </pattern>

        {/* 몰딩 그라디언트 */}
        <linearGradient id="gradMold" x1={LEFT_X} y1={0} x2={RIGHT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor={wp.trimColor} stopOpacity="0.7"/>
          <stop offset="50%"  stopColor={wp.trimColor} stopOpacity="1"/>
          <stop offset="100%" stopColor={wp.trimColor} stopOpacity="0.7"/>
        </linearGradient>

        {/* 클립패스 (텍스처가 벽 밖으로 나가지 않게) */}
        <clipPath id="clipL"><polygon points={leftWall}/></clipPath>
        <clipPath id="clipR"><polygon points={rightWall}/></clipPath>

        {/* 실루엣 블러 (방 그림자) */}
        <filter id="silhouetteBlur" x="-10%" y="-10%" width="120%" height="130%">
          <feGaussianBlur stdDeviation="13"/>
        </filter>
      </defs>

      {/* ── 방 외곽 그림자 ─────────────────────────────────────────────── */}
      <polygon
        points={silhouette}
        fill="rgba(0,0,0,0.32)"
        transform="translate(6,16)"
        filter="url(#silhouetteBlur)"
      />

      {/* ── 좌측 벽 ───────────────────────────────────────────────────── */}
      <polygon points={leftWall} fill="url(#gradLeft)"/>
      <polygon points={leftWall} fill="url(#wallGrain)" clipPath="url(#clipL)"/>
      <polygon points={leftWall} fill="url(#depthLeft)"/>
      <polygon points={leftWall} fill="url(#topLit)"    clipPath="url(#clipL)"/>
      {/* 외곽선 */}
      <polygon points={leftWall} fill="none" stroke="#17090a" strokeWidth="2.2"/>

      {/* ── 우측 벽 ───────────────────────────────────────────────────── */}
      <polygon points={rightWall} fill="url(#gradRight)"/>
      <polygon points={rightWall} fill="url(#wallGrain)" clipPath="url(#clipR)"/>
      <polygon points={rightWall} fill="url(#depthRight)"/>
      <polygon points={rightWall} fill="url(#topLit)"    clipPath="url(#clipR)"/>
      {/* 우벽에 약한 밝기 추가 (빛이 오른쪽에서 반사) */}
      <polygon points={rightWall} fill="rgba(255,255,255,0.04)"/>
      {/* 외곽선 */}
      <polygon points={rightWall} fill="none" stroke="#17090a" strokeWidth="2.2"/>

      {/* ── 상단 능선 (몰딩 바로 위 날카로운 선) ───────────────────────── */}
      <polyline
        points={`${LEFT_X},${MID_Y} ${BACK_X},0 ${RIGHT_X},${MID_Y}`}
        fill="none" stroke="#17090a" strokeWidth="2.8"
      />

      {/* ── 상단 몰딩 ─────────────────────────────────────────────────── */}
      <polygon points={leftMold}  fill="url(#gradMold)" opacity="0.9"/>
      <polygon points={leftMold}  fill="rgba(255,255,255,0.1)"/>
      <polygon points={leftMold}  fill="none" stroke="#17090a" strokeWidth="1.3"/>
      <polygon points={rightMold} fill="url(#gradMold)" opacity="0.95"/>
      <polygon points={rightMold} fill="rgba(255,255,255,0.16)"/>
      <polygon points={rightMold} fill="none" stroke="#17090a" strokeWidth="1.3"/>

      {/* ── 하단 걸레받이 ─────────────────────────────────────────────── */}
      <polygon points={leftBase}  fill={wp.leftColor2}  opacity="0.92"/>
      <polygon points={leftBase}  fill="rgba(0,0,0,0.22)"/>
      <polygon points={leftBase}  fill="none" stroke="#17090a" strokeWidth="1.1"/>
      <polygon points={rightBase} fill={wp.rightColor2} opacity="0.92"/>
      <polygon points={rightBase} fill="rgba(0,0,0,0.18)"/>
      <polygon points={rightBase} fill="none" stroke="#17090a" strokeWidth="1.1"/>

      {/* ── 중앙 코너 기둥 ────────────────────────────────────────────── */}
      {/* 그림자 사이드 */}
      <line x1={BACK_X-1} y1={0} x2={BACK_X-1} y2={WALL_H} stroke="rgba(0,0,0,0.3)" strokeWidth="3"/>
      {/* 하이라이트 사이드 */}
      <line x1={BACK_X+1} y1={0} x2={BACK_X+1} y2={WALL_H} stroke="rgba(255,255,255,0.18)" strokeWidth="2"/>
      {/* 중심선 */}
      <line x1={BACK_X}   y1={0} x2={BACK_X}   y2={WALL_H} stroke={wp.trimColor} strokeWidth="1.4" opacity="0.85"/>

      {/* ── 벽-바닥 접합선 ────────────────────────────────────────────── */}
      <polyline
        points={`${LEFT_X},${WALL_H+MID_Y} ${BACK_X},${WALL_H} ${RIGHT_X},${WALL_H+MID_Y}`}
        fill="none" stroke="#17090a" strokeWidth="2"
      />

      {/* 벽 장식 슬롯 (편집 모드에서만 표시) */}
      {editMode && (["left", "right"] as WallSide[]).map((wall) =>
        Array.from({ length: 6 }, (_, i) => {
          const { u, v } = slotUV(i);
          const pos = wallSlotSVGPos(wall, u, v);
          const key = `${wall}-${i}`;
          const placed = decoMap.get(key);
          const hasSelected = selectedDecoId !== null;
          return (
            <g key={key}
              style={{ cursor: "pointer" }}
              onClick={() => onSlotClick(wall, i)}
            >
              <ellipse
                cx={pos.x} cy={pos.y}
                rx={22} ry={12}
                fill={placed ? "rgba(251,191,36,0.25)" : hasSelected ? "rgba(100,200,100,0.25)" : "rgba(255,255,255,0.08)"}
                stroke={placed ? "#fbbf24" : hasSelected ? "#4ade80" : "rgba(255,255,255,0.25)"}
                strokeWidth="1"
                strokeDasharray={placed ? "0" : "3,2"}
              />
            </g>
          );
        })
      )}

      {/* 배치된 벽 장식 (항상 표시) */}
      {wallDecorations.map((d) => {
        const { u, v } = slotUV(d.slotIndex);
        const pos = wallSlotSVGPos(d.wall, u, v);
        const wd = getWallDecoration(d.decorId);
        if (!wd) return null;
        return (
          <text
            key={d.instanceId}
            x={pos.x} y={pos.y + 5}
            textAnchor="middle"
            fontSize="20"
            style={{ pointerEvents: editMode ? "auto" : "none", cursor: editMode ? "pointer" : "default", userSelect: "none" }}
            onClick={(e) => { e.stopPropagation(); if (editMode) onSlotClick(d.wall, d.slotIndex); }}
          >
            {wd.emoji}
          </text>
        );
      })}
    </svg>
  );
}

// ─── 바닥 SVG ────────────────────────────────────────────────────────────────
// 불투명 아이소메트릭 바닥 + 타일 그리드 + 엣지 쉐이딩 + drop-shadow

function FloorSVG({
  offsetX, offsetY, floorStyle,
}: {
  offsetX: number; offsetY: number; floorStyle: FloorStyle;
}) {
  // WallSVG 와 같은 수평 기준점 사용
  const svgLeft = offsetX + TILE_W / 2;
  const svgTop  = offsetY;
  const svgW    = 880;
  const svgH    = 500; // 440 + 60 shadow room

  // 바닥 다이아몬드 (back, left, front, right)
  const FLOOR = "440,0 0,220 440,440 880,220";

  // 타일 그리드선 (k=1..9): tx 열선 + ty 행선
  const lines: ReactElement[] = [];
  const gc = toOpaque(floorStyle.normalOutline);
  for (let k = 1; k < ROOM_COLS; k++) {
    // tx=k 열선: (440+44k, 22k) → (44k, 220+22k)
    lines.push(
      <line key={`tx${k}`}
        x1={440+44*k} y1={22*k}   x2={44*k}     y2={220+22*k}
        stroke={gc} strokeWidth="0.85" strokeOpacity="0.38"
        clipPath="url(#floorClip)"/>,
    );
    // ty=k 행선: (440-44k, 22k) → (880-44k, 220+22k)
    lines.push(
      <line key={`ty${k}`}
        x1={440-44*k} y1={22*k}   x2={880-44*k} y2={220+22*k}
        stroke={gc} strokeWidth="0.85" strokeOpacity="0.38"
        clipPath="url(#floorClip)"/>,
    );
  }

  return (
    <svg
      style={{
        position: "absolute",
        left: svgLeft, top: svgTop,
        width: svgW, height: svgH,
        pointerEvents: "none", zIndex: 0,
        // 바닥 전체에 CSS drop-shadow (모양 따라 적용)
        filter: "drop-shadow(3px 18px 22px rgba(0,0,0,0.52))",
        overflow: "visible",
      }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      <defs>
        <clipPath id="floorClip">
          <polygon points={FLOOR}/>
        </clipPath>

        {/* 바닥 엣지 어둠 (가장자리가 살짝 어두워 입체감) */}
        <radialGradient id="floorEdge" cx="440" cy="220" r="310" gradientUnits="userSpaceOnUse">
          <stop offset="52%" stopColor="rgba(0,0,0,0)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.28)"/>
        </radialGradient>

        {/* 바닥 뒤쪽 하이라이트 (조명 방향: 좌상단) */}
        <radialGradient id="floorLight" cx="440" cy="20" r="260" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.13)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>

      {/* 1. 불투명 바닥 */}
      <polygon points={FLOOR} fill={toOpaque(floorStyle.normalBg)}/>

      {/* 2. 타일 그리드 */}
      {lines}

      {/* 3. 엣지 어둠 오버레이 */}
      <polygon points={FLOOR} fill="url(#floorEdge)"/>

      {/* 4. 뒤쪽 빛 하이라이트 */}
      <polygon points={FLOOR} fill="url(#floorLight)" clipPath="url(#floorClip)"/>

      {/* 5. 바닥 외곽선 (픽셀아트 스타일 진한 테두리) */}
      <polygon points={FLOOR} fill="none" stroke="#1a0e06" strokeWidth="2.8"/>
    </svg>
  );
}

// ─── 배치된 가구 스프라이트 ───────────────────────────────────────────────────

function PlacedFurnitureSprite({
  item, offsetX, offsetY, isSelected, editMode, onClick,
}: {
  item: PlacedFurniture; offsetX: number; offsetY: number;
  isSelected: boolean; editMode: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const f = getFurniture(item.furnitureId);
  if (!f) return null;

  const rSize = getRotatedSize(f.size, item.rotation);
  const rawPos = getFurnitureRenderPosition(item.x, item.y, f.size, item.rotation);
  const anchorLeft = rawPos.left - roomSize.minX + offsetX;
  const anchorTop  = rawPos.top  - roomSize.minY + offsetY;
  const zIndex = 10 + (item.y + rSize.height - 1) * ROOM_COLS + (item.x + rSize.width - 1);

  const v = f.visual;
  const isRotated = item.rotation !== 0;
  const imgSrc = isRotated && v.rotatedAsset ? v.rotatedAsset : v.asset;
  const imgW   = (isRotated ? v.rotatedWidth  : undefined) ?? v.width  ?? 80;
  const imgH   = (isRotated ? v.rotatedHeight : undefined) ?? v.height ?? 80;
  const oX     = (isRotated ? v.rotatedOffsetX : undefined) ?? v.offsetX ?? 0;
  const oY     = (isRotated ? v.rotatedOffsetY : undefined) ?? v.offsetY ?? 0;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        left: anchorLeft + oX,
        top:  anchorTop  + oY,
        transform: "translate(-50%, -100%)",
        zIndex,
        cursor: editMode ? "pointer" : "default",
        filter: isSelected
          ? "drop-shadow(0 0 8px #fbbf24) drop-shadow(0 0 14px #f59e0b)"
          : hovered && editMode
            ? "drop-shadow(0 2px 6px rgba(0,0,0,0.8))"
            : "drop-shadow(0 3px 8px rgba(0,0,0,0.6))",
        transition: "filter 0.15s",
        userSelect: "none", pointerEvents: "auto",
      }}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={f.name}
          style={{ width: imgW, height: imgH, imageRendering: "pixelated", display: "block" }}
          draggable={false}
        />
      ) : (
        <div style={{ fontSize: 32, lineHeight: 1, textAlign: "center",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.8))" }}>
          {f.emoji}
        </div>
      )}
      {(isSelected || (hovered && editMode)) && (
        <div style={{
          position: "absolute", bottom: "100%", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", color: "#fff",
          fontSize: 10, fontWeight: "bold",
          padding: "2px 7px", borderRadius: 4,
          whiteSpace: "nowrap", marginBottom: 2,
          border: `1px solid ${isSelected ? "#fbbf24" : "#555"}`,
        }}>
          {f.name}
          <span style={{ color: RARITY_COLOR[f.rarity], marginLeft: 4, fontSize: 8 }}>
            {RARITY_LABEL[f.rarity]}
          </span>
        </div>
      )}
      {isSelected && (
        <div style={{
          position: "absolute", top: -4, right: -4,
          width: 12, height: 12, borderRadius: "50%",
          background: "#fbbf24", border: "2px solid #fff",
        }} />
      )}
    </div>
  );
}

// ─── 아이소메트릭 방 그리드 ───────────────────────────────────────────────────

function IsoRoomGrid({
  offsetX, offsetY, editMode,
  hoveredTile, onTileHover, onTileLeave, onTileClick,
  placedFurniture, selectedInstanceId, selectedFurnitureId,
  onFurnitureClick, playerTile, floorStyle,
}: {
  offsetX: number; offsetY: number; editMode: boolean;
  hoveredTile: { x: number; y: number } | null;
  onTileHover: (x: number, y: number) => void;
  onTileLeave: () => void;
  onTileClick: (x: number, y: number) => void;
  placedFurniture: PlacedFurniture[];
  selectedInstanceId: string | null;
  selectedFurnitureId: string | null;
  onFurnitureClick: (instanceId: string) => void;
  playerTile: { x: number; y: number };
  floorStyle: FloorStyle;
}) {
  const selectedFD    = selectedFurnitureId ? getFurniture(selectedFurnitureId) : null;
  const selectedInst  = selectedInstanceId ? placedFurniture.find((p) => p.instanceId === selectedInstanceId) : null;
  const selectedInstFD = selectedInst ? getFurniture(selectedInst.furnitureId) : null;

  const previewTiles: Map<string, "ok" | "block"> = new Map();
  if (editMode && hoveredTile) {
    let furnitureId: string | null = null;
    let rotation: 0 | 90 | 180 | 270 = 0;
    let ignoreId: string | undefined;
    if (selectedFD) { furnitureId = selectedFD.id; }
    else if (selectedInstFD && selectedInst) {
      furnitureId = selectedInstFD.id; rotation = selectedInst.rotation; ignoreId = selectedInst.instanceId;
    }
    if (furnitureId) {
      const fd = getFurniture(furnitureId)!;
      const tiles = getFurnitureOccupiedTiles(hoveredTile.x, hoveredTile.y, fd.size, rotation);
      const canPlace = canPlaceFurnitureAt(furnitureId, hoveredTile.x, hoveredTile.y, rotation, placedFurniture, FURNITURE, ignoreId);
      tiles.forEach((t) => previewTiles.set(getTileKey(t.x, t.y), canPlace ? "ok" : "block"));
    }
  }

  const selectedInstTiles = new Set<string>();
  if (selectedInst && selectedInstFD) {
    getFurnitureOccupiedTiles(selectedInst.x, selectedInst.y, selectedInstFD.size, selectedInst.rotation)
      .forEach((t) => selectedInstTiles.add(getTileKey(t.x, t.y)));
  }

  void buildOccupiedSet(placedFurniture, FURNITURE);

  const tiles: ReactElement[] = [];
  for (let ty = 0; ty < ROOM_ROWS; ty++) {
    for (let tx = 0; tx < ROOM_COLS; tx++) {
      const key = getTileKey(tx, ty);
      let tileState: TileState = "normal";
      if (editMode) {
        if (previewTiles.has(key)) {
          tileState = previewTiles.get(key) === "ok" ? "preview_ok" : "preview_block";
        } else if (selectedInstTiles.has(key)) {
          tileState = "selected_furniture";
        } else if (hoveredTile?.x === tx && hoveredTile?.y === ty) {
          tileState = "hover";
        }
      }
      tiles.push(
        <IsoTile
          key={key} tx={tx} ty={ty} offsetX={offsetX} offsetY={offsetY}
          state={tileState} floorStyle={floorStyle}
          onClick={() => onTileClick(tx, ty)}
          onMouseEnter={editMode ? () => onTileHover(tx, ty) : () => {}}
          onMouseLeave={editMode ? onTileLeave : () => {}}
        />,
      );
    }
  }

  const sortedFurniture = [...placedFurniture].sort((a, b) => {
    const fa = getFurniture(a.furnitureId); const fb = getFurniture(b.furnitureId);
    const ra = getRotatedSize(fa?.size ?? { width: 1, height: 1 }, a.rotation);
    const rb = getRotatedSize(fb?.size ?? { width: 1, height: 1 }, b.rotation);
    return ((a.y + ra.height - 1) + (a.x + ra.width - 1)) - ((b.y + rb.height - 1) + (b.x + rb.width - 1));
  });

  const ghostFurniture = (() => {
    if (!editMode || !hoveredTile || !selectedFD) return null;
    const v = selectedFD.visual;
    const imgW = v.width ?? 80; const imgH = v.height ?? 80;
    const oX = v.offsetX ?? 0; const oY = v.offsetY ?? 0;
    const rawPos = getFurnitureRenderPosition(hoveredTile.x, hoveredTile.y, selectedFD.size, 0);
    const ghostLeft = rawPos.left - roomSize.minX + offsetX + oX;
    const ghostTop  = rawPos.top  - roomSize.minY + offsetY + oY;
    const canPlace = canPlaceFurnitureAt(selectedFD.id, hoveredTile.x, hoveredTile.y, 0, placedFurniture, FURNITURE);
    return (
      <div style={{
        position: "absolute", left: ghostLeft, top: ghostTop,
        transform: "translate(-50%, -100%)", zIndex: 200, opacity: 0.6, pointerEvents: "none",
        filter: canPlace ? "drop-shadow(0 0 6px #4ade80)" : "drop-shadow(0 0 6px #f87171)",
      }}>
        {v.asset ? (
          <img src={v.asset} alt={selectedFD.name}
            style={{ width: imgW, height: imgH, imageRendering: "pixelated", display: "block" }}
            draggable={false} />
        ) : <div style={{ fontSize: 32, lineHeight: 1 }}>{selectedFD.emoji}</div>}
      </div>
    );
  })();

  const playerPos = tileScreenPos(playerTile.x, playerTile.y, offsetX, offsetY);
  const playerZIndex = 10 + Math.floor(playerTile.y) * ROOM_COLS + Math.floor(playerTile.x) + 5;

  return (
    <>
      {tiles}
      {ghostFurniture}
      {sortedFurniture.map((item) => (
        <PlacedFurnitureSprite
          key={item.instanceId} item={item} offsetX={offsetX} offsetY={offsetY}
          isSelected={item.instanceId === selectedInstanceId}
          editMode={editMode}
          onClick={() => onFurnitureClick(item.instanceId)}
        />
      ))}
      {!editMode && (
        <PlayerSprite
          left={playerPos.left + TILE_W / 2}
          top={playerPos.top}
          zIndex={playerZIndex}
        />
      )}
    </>
  );
}

// ─── 플레이어 스프라이트 ──────────────────────────────────────────────────────

function PlayerSprite({ left, top, zIndex }: { left: number; top: number; zIndex: number }) {
  return (
    <div style={{
      position: "absolute", left, top,
      transform: "translate(-50%, -60%)",
      zIndex, imageRendering: "pixelated", pointerEvents: "none",
    }}>
      <img src="/assets/basecamp/player-down.png" alt="player"
        style={{ width: "32px", height: "48px", imageRendering: "pixelated", display: "block" }}
        draggable={false} />
    </div>
  );
}

// ─── 편집 패널 (Tiny Farm 스타일 하단 슬라이드) ──────────────────────────────

export const PANEL_H = 272; // 외부에서 레이아웃 계산용

type EditTab = "furniture" | "walldeco" | "wallpaper" | "floortile";

function EditPanel({
  open,
  onClose,
  selectedFurnitureId, onSelectFurniture,
  selectedInstanceId, selectedInstanceRotation, onRemoveFurniture, onRotate,
  selectedDecoId, onSelectDeco, onRemoveSelectedDeco,
  tab, onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  selectedFurnitureId: string | null;
  onSelectFurniture: (id: string | null) => void;
  selectedInstanceId: string | null;
  selectedInstanceRotation: 0 | 90 | 180 | 270;
  onRemoveFurniture: () => void;
  onRotate: () => void;
  selectedDecoId: string | null;
  onSelectDeco: (id: string | null) => void;
  onRemoveSelectedDeco: (instanceId: string) => void;
  tab: EditTab;
  onTabChange: (t: EditTab) => void;
}) {
  const {
    materials, furnitureInventory, craftFurniture, placedFurniture, getHousingBonuses,
    wallDecoInventory, craftWallDecoration, wallDecorations,
    wallpaperId, setWallpaper, unlockedWallpapers, craftWallpaper,
    floorTileId, setFloorTile, unlockedFloorTiles, craftFloorTile,
  } = usePlayerStore();
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);
  const bonuses = getHousingBonuses();
  const counts  = countMaterials(placedFurniture.map((p) => p.furnitureId));
  const inventory = FURNITURE.filter((f) => (furnitureInventory[f.id] ?? 0) > 0);

  const handleCraft = (id: string) => {
    if (craftFurniture(id)) { setLastCrafted(id); setTimeout(() => setLastCrafted(null), 1400); }
  };
  const handleCraftDeco = (id: string) => {
    if (craftWallDecoration(id)) { setLastCrafted(id); setTimeout(() => setLastCrafted(null), 1400); }
  };
  const handleCraftWallpaper = (id: string) => {
    if (craftWallpaper(id)) { setLastCrafted(id); setTimeout(() => setLastCrafted(null), 1400); }
  };
  const handleCraftFloorTile = (id: string) => {
    if (craftFloorTile(id)) { setLastCrafted(id); setTimeout(() => setLastCrafted(null), 1400); }
  };

  const matHues: Record<FurnitureMaterial, string> = {
    wood: "#fbbf24", iron: "#9ca3af", crystal: "#c084fc", leather: "#fb923c",
  };
  const matBg: Record<FurnitureMaterial, string> = {
    wood: "#92400e", iron: "#374151", crystal: "#4c1d95", leather: "#7c2d12",
  };
  const rarityColor: Record<string, string> = {
    common: "#9ca3af", rare: "#60a5fa", epic: "#c084fc", legendary: "#fbbf24",
  };

  const selectedFD = selectedFurnitureId ? getFurniture(selectedFurnitureId) : null;
  const instFD = selectedInstanceId
    ? getFurniture(placedFurniture.find((p) => p.instanceId === selectedInstanceId)?.furnitureId ?? "")
    : null;
  const instRotSize = instFD ? getRotatedSize(instFD.size, selectedInstanceRotation) : null;

  const tabs: { id: EditTab; label: string }[] = [
    { id: "furniture", label: "🪑 가구" },
    { id: "walldeco",  label: "🖼️ 벽장식" },
    { id: "wallpaper", label: "🎨 벽지" },
    { id: "floortile", label: "🟫 바닥" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: PANEL_H,
      background: "linear-gradient(180deg, #0e0804 0%, #150d07 100%)",
      borderTop: "2px solid #3a2510",
      display: "flex", flexDirection: "column", zIndex: 500,
      boxShadow: "0 -6px 32px rgba(0,0,0,0.7)",
      transform: open ? "translateY(0)" : "translateY(100%)",
      transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
    }}>

      {/* ── 탭 헤더 행 ── */}
      <div style={{
        display: "flex", alignItems: "stretch", height: 40,
        borderBottom: "1px solid #2a1a0a", flexShrink: 0,
      }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onTabChange(t.id)} style={{
            flex: 1, padding: "0 4px", fontSize: 10, fontWeight: "bold",
            color: tab === t.id ? "#fbbf24" : "#555",
            background: tab === t.id ? "rgba(251,191,36,0.08)" : "none",
            border: "none", borderBottom: `2px solid ${tab === t.id ? "#fbbf24" : "transparent"}`,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            padding: "0 16px", fontSize: 11, fontWeight: "bold",
            color: "#fbbf24", background: "rgba(251,191,36,0.1)",
            border: "none", borderLeft: "1px solid #3a2510", cursor: "pointer",
          }}
        >
          ✓ 완료
        </button>
      </div>

      {/* ── 선택 상태 액션 바 (가구/벽장식 선택 시) ── */}
      {tab === "furniture" && (selectedFD || selectedInstanceId) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, height: 36, flexShrink: 0,
          padding: "0 12px", borderBottom: "1px solid #2a1a0a",
          background: "rgba(251,191,36,0.06)",
        }}>
          {selectedFD && !selectedInstanceId && (
            <>
              <span style={{ fontSize: 16 }}>{selectedFD.emoji}</span>
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: "bold", flex: 1 }}>
                {selectedFD.name} 배치 중 — 타일 클릭
              </span>
              <button onClick={() => onSelectFurniture(null)} style={actionBtn("#9ca3af")}>✕ 취소</button>
            </>
          )}
          {selectedInstanceId && instFD && (
            <>
              <span style={{ fontSize: 16 }}>{instFD.emoji}</span>
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: "bold", flex: 1 }}>
                {instFD.name}
                <span style={{ color: "#888", fontSize: 10, marginLeft: 6 }}>{selectedInstanceRotation}°</span>
                {instRotSize && <span style={{ color: "#888", fontSize: 10, marginLeft: 4 }}>{instRotSize.width}×{instRotSize.height}</span>}
              </span>
              <button onClick={onRotate}          style={actionBtn("#60a5fa")}>↻ 회전</button>
              <button onClick={onRemoveFurniture} style={actionBtn("#f87171")}>↩ 회수</button>
            </>
          )}
        </div>
      )}

      {tab === "walldeco" && selectedDecoId && (
        <div style={{
          padding: "8px 12px", borderBottom: "1px solid #2a1a0a",
          background: "rgba(251,191,36,0.06)", flexShrink: 0,
        }}>
          {(() => {
            const wd = getWallDecoration(selectedDecoId);
            return wd ? (
              <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6 }}>
                <span style={{ fontSize: 18, marginRight: 6 }}>{wd.emoji}</span>
                <strong>{wd.name}</strong> 선택됨
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>벽의 슬롯을 클릭해 배치</div>
              </div>
            ) : null;
          })()}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onSelectDeco(null)} style={actionBtn("#9ca3af")}>취소 (ESC)</button>
          </div>
        </div>
      )}

      {/* 탭 컨텐츠 — 가로 스크롤 카드 */}
      <div style={{ flex: 1, display: "flex", overflowX: "auto", overflowY: "hidden", padding: "6px 10px", gap: 6, alignItems: "stretch" }}>

        {/* ══ 가구 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "furniture" && (<>
          {/* 보유 가구 */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>보유</div>
          {inventory.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 64, flexShrink: 0, color: "#444" }}>
              <div style={{ fontSize: 24 }}>🪑</div><div style={{ fontSize: 8, marginTop: 4 }}>없음</div>
            </div>
          ) : inventory.map((f) => {
            const isSelected = selectedFurnitureId === f.id;
            return (
              <button key={f.id} onClick={() => onSelectFurniture(isSelected ? null : f.id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 72, flexShrink: 0, padding: "8px 4px", gap: 4, borderRadius: 8, cursor: "pointer",
                border: `2px solid ${isSelected ? "#fbbf24" : "#2a1a0a"}`,
                background: isSelected ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.02)",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 26 }}>{f.emoji}</span>
                <span style={{ fontSize: 9, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{f.name}</span>
                <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: "bold" }}>×{furnitureInventory[f.id] ?? 0}</span>
              </button>
            );
          })}

          <div style={{ width: 1, background: "#2a1a0a", flexShrink: 0, margin: "0 4px" }} />

          {/* 가구 제작 */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>제작</div>
          {FURNITURE.map((f) => {
            const canCraft = Object.entries(f.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
            const crafted = lastCrafted === f.id;
            return (
              <div key={f.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
                width: 82, flexShrink: 0, padding: "8px 5px", gap: 3, borderRadius: 8,
                border: `1px solid ${crafted ? "#34d399" : canCraft ? "#d97706" : "#2a1a0a"}`,
                background: crafted ? "rgba(52,211,153,0.07)" : canCraft ? "rgba(217,119,6,0.05)" : "rgba(255,255,255,0.01)",
              }}>
                <span style={{ fontSize: 22 }}>{f.emoji}</span>
                <span style={{ fontSize: 8, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{f.name}</span>
                {(furnitureInventory[f.id] ?? 0) > 0 && (
                  <span style={{ fontSize: 7, color: "#fbbf24" }}>보유×{furnitureInventory[f.id]}</span>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                  {Object.entries(f.recipe).slice(0, 2).map(([mid, need]) => {
                    const have = materials[mid] ?? 0; const ok = have >= need;
                    const m = getMaterial(mid);
                    return (
                      <span key={mid} style={{ fontSize: 7, padding: "1px 3px", borderRadius: 6, border: `1px solid ${ok ? "#333" : "#7f1d1d"}`, color: ok ? "#999" : "#f87171", fontFamily: "monospace" }}>
                        {m?.emoji}{have}/{need}
                      </span>
                    );
                  })}
                </div>
                <button onClick={() => handleCraft(f.id)} disabled={!canCraft} style={{
                  padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid",
                  borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                  background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                  color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                  cursor: canCraft ? "pointer" : "not-allowed",
                }}>{crafted ? "완성! ✓" : "제작"}</button>
              </div>
            );
          })}

          <div style={{ width: 1, background: "#2a1a0a", flexShrink: 0, margin: "0 4px" }} />

          {/* 세트 효과 */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>세트</div>
          {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
            const tiers = MATERIAL_SET_TIERS[mat]; const cur = counts[mat]; const max = tiers[tiers.length - 1].count;
            return (
              <div key={mat} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                width: 84, flexShrink: 0, padding: "8px 6px", gap: 4, borderRadius: 8,
                border: `1px solid ${cur > 0 ? matHues[mat] + "44" : "#2a1a0a"}`,
                background: cur > 0 ? `${matHues[mat]}08` : "rgba(255,255,255,0.01)",
              }}>
                <span style={{ fontSize: 10, fontWeight: "bold", color: matHues[mat] }}>{MATERIAL_LABEL[mat]}</span>
                <div style={{ width: "100%", height: 3, borderRadius: 2, background: "#1a0e06" }}>
                  <div style={{ height: 3, borderRadius: 2, background: matHues[mat], width: `${Math.min(100, (cur / max) * 100)}%`, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 8, color: "#777", fontFamily: "monospace" }}>{cur}/{max}종</span>
                {tiers.map((tier) => (
                  <div key={tier.count} style={{ fontSize: 7, color: cur >= tier.count ? matHues[mat] : "#555", opacity: cur >= tier.count ? 1 : 0.5, textAlign: "center", lineHeight: 1.3 }}>
                    {cur >= tier.count ? "✅" : `${tier.count}종`} {tier.name}
                  </div>
                ))}
              </div>
            );
          })}
        </>)}

        {/* ══ 벽 장식 탭 ════════════════════════════════════════════════════════ */}
        {tab === "walldeco" && (<>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>보유</div>
          {WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 64, flexShrink: 0, color: "#444" }}>
              <div style={{ fontSize: 24 }}>🖼️</div><div style={{ fontSize: 8, marginTop: 4 }}>없음</div>
            </div>
          ) : WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).map((d) => {
            const isSelected = selectedDecoId === d.id;
            return (
              <button key={d.id} onClick={() => onSelectDeco(isSelected ? null : d.id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 72, flexShrink: 0, padding: "8px 4px", gap: 4, borderRadius: 8, cursor: "pointer",
                border: `2px solid ${isSelected ? "#fbbf24" : "#2a1a0a"}`,
                background: isSelected ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.02)",
                transition: "all 0.15s",
              }}>
                <span style={{ fontSize: 26 }}>{d.emoji}</span>
                <span style={{ fontSize: 9, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{d.name}</span>
                <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: "bold" }}>×{wallDecoInventory[d.id] ?? 0}</span>
              </button>
            );
          })}

          {wallDecorations.length > 0 && (<>
            <div style={{ width: 1, background: "#2a1a0a", flexShrink: 0, margin: "0 4px" }} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>배치</div>
            {wallDecorations.map((d) => {
              const wd = getWallDecoration(d.decorId);
              return wd ? (
                <div key={d.instanceId} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  width: 72, flexShrink: 0, padding: "8px 4px", gap: 4, borderRadius: 8,
                  border: "1px solid #2a1a0a", background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ fontSize: 24 }}>{wd.emoji}</span>
                  <span style={{ fontSize: 8, color: "#ccc", textAlign: "center" }}>{wd.name}</span>
                  <span style={{ fontSize: 7, color: "#666" }}>{d.wall === "left" ? "왼쪽" : "오른쪽"} {d.slotIndex + 1}번</span>
                  <button onClick={() => onRemoveSelectedDeco(d.instanceId)} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, border: "1px solid #f8717155", background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer" }}>↩ 회수</button>
                </div>
              ) : null;
            })}
          </>)}

          <div style={{ width: 1, background: "#2a1a0a", flexShrink: 0, margin: "0 4px" }} />

          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", width: 22, flexShrink: 0, color: "#444", fontSize: 8, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 1, userSelect: "none" }}>제작</div>
          {WALL_DECORATIONS.map((d) => {
            const canCraft = Object.entries(d.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
            const crafted = lastCrafted === d.id;
            return (
              <div key={d.id} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
                width: 82, flexShrink: 0, padding: "8px 5px", gap: 3, borderRadius: 8,
                border: `1px solid ${crafted ? "#34d399" : canCraft ? "#d97706" : "#2a1a0a"}`,
                background: crafted ? "rgba(52,211,153,0.07)" : canCraft ? "rgba(217,119,6,0.05)" : "rgba(255,255,255,0.01)",
              }}>
                <span style={{ fontSize: 22 }}>{d.emoji}</span>
                <span style={{ fontSize: 8, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{d.name}</span>
                {(wallDecoInventory[d.id] ?? 0) > 0 && (
                  <span style={{ fontSize: 7, color: "#fbbf24" }}>보유×{wallDecoInventory[d.id]}</span>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                  {Object.entries(d.recipe).slice(0, 2).map(([mid, need]) => {
                    const have = materials[mid] ?? 0; const ok = have >= need;
                    const m = getMaterial(mid);
                    return (
                      <span key={mid} style={{ fontSize: 7, padding: "1px 3px", borderRadius: 6, border: `1px solid ${ok ? "#333" : "#7f1d1d"}`, color: ok ? "#999" : "#f87171", fontFamily: "monospace" }}>
                        {m?.emoji}{have}/{need}
                      </span>
                    );
                  })}
                </div>
                <button onClick={() => handleCraftDeco(d.id)} disabled={!canCraft} style={{
                  padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid",
                  borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                  background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                  color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                  cursor: canCraft ? "pointer" : "not-allowed",
                }}>{crafted ? "완성! ✓" : "제작"}</button>
              </div>
            );
          })}
        </>)}

        {/* ══ 벽지 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "wallpaper" && WALLPAPERS.map((wp) => {
          const isUnlocked = unlockedWallpapers.includes(wp.id);
          const isActive   = wallpaperId === wp.id;
          const canCraft   = Object.keys(wp.recipe).length === 0 ? false : Object.entries(wp.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
          const crafted = lastCrafted === wp.id;
          return (
            <div key={wp.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              width: 88, flexShrink: 0, padding: "6px 5px", gap: 4, borderRadius: 8,
              border: `1px solid ${isActive ? "#fbbf24" : isUnlocked ? "#2a1a0a" : "#1a0e06"}`,
              background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
            }}>
              <div style={{ width: "100%", height: 28, borderRadius: 5, flexShrink: 0, opacity: isUnlocked ? 1 : 0.4, background: `linear-gradient(135deg, ${wp.leftColor1}, ${wp.leftColor2} 45%, ${wp.rightColor1} 55%, ${wp.rightColor2})`, border: `1px solid ${wp.trimColor}66` }} />
              <span style={{ fontSize: 14 }}>{wp.emoji}</span>
              <span style={{ fontSize: 8, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{wp.name}</span>
              {isActive && <span style={{ fontSize: 7, color: "#fbbf24", background: "rgba(251,191,36,0.15)", padding: "1px 5px", borderRadius: 3 }}>현재</span>}
              {isUnlocked ? (
                <button onClick={() => setWallpaper(wp.id)} disabled={isActive} style={{
                  padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid", marginTop: "auto",
                  borderColor: isActive ? "#fbbf2444" : "#d97706", background: isActive ? "transparent" : "rgba(217,119,6,0.2)",
                  color: isActive ? "#555" : "#fbbf24", cursor: isActive ? "default" : "pointer",
                }}>{isActive ? "사용 중" : "적용"}</button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: "auto", width: "100%" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                    {Object.entries(wp.recipe).slice(0, 2).map(([mid, need]) => {
                      const have = materials[mid] ?? 0; const ok = have >= need;
                      const m = getMaterial(mid);
                      return <span key={mid} style={{ fontSize: 7, padding: "1px 3px", borderRadius: 6, border: `1px solid ${ok ? "#333" : "#7f1d1d"}`, color: ok ? "#999" : "#f87171", fontFamily: "monospace" }}>{m?.emoji}{have}/{need}</span>;
                    })}
                  </div>
                  <button onClick={() => handleCraftWallpaper(wp.id)} disabled={!canCraft} style={{
                    padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid",
                    borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                    background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                    color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                    cursor: canCraft ? "pointer" : "not-allowed",
                  }}>{crafted ? "해금! ✓" : "🔒 해금"}</button>
                </div>
              )}
            </div>
          );
        })}

        {/* ══ 바닥 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "floortile" && FLOOR_TILES.map((ft) => {
          const isUnlocked = unlockedFloorTiles.includes(ft.id);
          const isActive   = floorTileId === ft.id;
          const canCraft   = Object.keys(ft.recipe).length === 0 ? false : Object.entries(ft.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
          const crafted = lastCrafted === ft.id;
          return (
            <div key={ft.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              width: 88, flexShrink: 0, padding: "6px 5px", gap: 4, borderRadius: 8,
              border: `1px solid ${isActive ? "#fbbf24" : isUnlocked ? "#2a1a0a" : "#1a0e06"}`,
              background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
            }}>
              <div style={{ width: "100%", height: 28, borderRadius: 5, flexShrink: 0, opacity: isUnlocked ? 1 : 0.4, background: ft.normalBg, border: `1px solid ${ft.normalOutline}` }} />
              <span style={{ fontSize: 14 }}>{ft.emoji}</span>
              <span style={{ fontSize: 8, color: "#ccc", textAlign: "center", lineHeight: 1.2 }}>{ft.name}</span>
              {isActive && <span style={{ fontSize: 7, color: "#fbbf24", background: "rgba(251,191,36,0.15)", padding: "1px 5px", borderRadius: 3 }}>현재</span>}
              {isUnlocked ? (
                <button onClick={() => setFloorTile(ft.id)} disabled={isActive} style={{
                  padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid", marginTop: "auto",
                  borderColor: isActive ? "#fbbf2444" : "#d97706", background: isActive ? "transparent" : "rgba(217,119,6,0.2)",
                  color: isActive ? "#555" : "#fbbf24", cursor: isActive ? "default" : "pointer",
                }}>{isActive ? "사용 중" : "적용"}</button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: "auto", width: "100%" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center" }}>
                    {Object.entries(ft.recipe).slice(0, 2).map(([mid, need]) => {
                      const have = materials[mid] ?? 0; const ok = have >= need;
                      const m = getMaterial(mid);
                      return <span key={mid} style={{ fontSize: 7, padding: "1px 3px", borderRadius: 6, border: `1px solid ${ok ? "#333" : "#7f1d1d"}`, color: ok ? "#999" : "#f87171", fontFamily: "monospace" }}>{m?.emoji}{have}/{need}</span>;
                    })}
                  </div>
                  <button onClick={() => handleCraftFloorTile(ft.id)} disabled={!canCraft} style={{
                    padding: "3px 0", width: "100%", borderRadius: 5, fontSize: 9, fontWeight: "bold", border: "1px solid",
                    borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                    background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                    color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                    cursor: canCraft ? "pointer" : "not-allowed",
                  }}>{crafted ? "해금! ✓" : "🔒 해금"}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10, fontWeight: "bold",
    border: `1px solid ${color}55`, background: `${color}18`, color, cursor: "pointer",
  };
}

// ─── 문/포탈 오버레이 ─────────────────────────────────────────────────────────

function DoorOverlay({ tile, offsetX, offsetY, label, color, nearPlayer }: {
  tile: { x: number; y: number }; offsetX: number; offsetY: number;
  label: string; color: string; nearPlayer: boolean;
}) {
  const { left, top } = tileScreenPos(tile.x, tile.y, offsetX, offsetY);
  return (
    <div style={{
      position: "absolute", left: left + TILE_W / 2, top: top - 52,
      transform: "translate(-50%, 0)", zIndex: 300, pointerEvents: "none",
      transition: "filter 0.3s",
      filter: nearPlayer ? `drop-shadow(0 0 10px ${color})` : "none",
    }}>
      <div style={{
        width: 32, height: 48,
        background: `linear-gradient(180deg, ${color}cc, ${color}88)`,
        border: `2px solid ${color}`, borderRadius: "4px 4px 0 0",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        boxShadow: nearPlayer ? `0 0 12px ${color}88` : "none", margin: "0 auto",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0c040" }} />
      </div>
      <div style={{
        textAlign: "center", fontSize: 9, color: nearPlayer ? "#fff" : "#999",
        fontWeight: "bold", marginTop: 2, whiteSpace: "nowrap",
        background: nearPlayer ? "rgba(0,0,0,0.8)" : "transparent",
        padding: nearPlayer ? "1px 5px" : 0, borderRadius: 3,
      }}>{label}</div>
      {nearPlayer && (
        <div style={{ textAlign: "center", fontSize: 9, color: "#fbbf24", fontWeight: "bold", marginTop: 1, whiteSpace: "nowrap" }}>
          [E] 이동
        </div>
      )}
    </div>
  );
}

// ─── HousingPage ─────────────────────────────────────────────────────────────

export default function HousingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const {
    placedFurniture, placeFurniture, moveFurniture, rotateFurniture, removeFurniture, getHousingBonuses,
    wallpaperId, floorTileId, wallDecorations, placeWallDecoration, removeWallDecoration,
  } = usePlayerStore();

  // ── 레이아웃 ───────────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const availW = containerSize.w;
  const availH = editMode ? containerSize.h - PANEL_H : containerSize.h;

  // 벽(WALL_H) + 방 바닥(roomSize.height) 전체를 화면에 맞게 중앙 정렬
  const totalH = WALL_H + roomSize.height; // 160 + 440 = 600
  const offsetX = (availW - roomSize.width) / 2;
  const offsetY = (availH - totalH) / 2 + WALL_H + 20;

  useEffect(() => {
    const update = () => setContainerSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── 선택 상태 ─────────────────────────────────────────────────────────────
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId]   = useState<string | null>(null);
  const [selectedDecoId, setSelectedDecoId]           = useState<string | null>(null);
  const [editTab, setEditTab] = useState<EditTab>("furniture");
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);

  const selectedInst = selectedInstanceId
    ? placedFurniture.find((p) => p.instanceId === selectedInstanceId)
    : null;
  const selectedInstRotation: 0 | 90 | 180 | 270 = selectedInst?.rotation ?? 0;

  // ── 플레이어 부드러운 이동 ─────────────────────────────────────────────────
  const initPos = { x: PLAYER_INIT_TILE.x + 0.5, y: PLAYER_INIT_TILE.y + 0.5 };
  const [playerTile, setPlayerTile] = useState(initPos);
  const playerPosRef     = useRef(initPos);
  const keysRef          = useRef<Set<string>>(new Set());
  const editModeRef      = useRef(editMode);
  useEffect(() => { editModeRef.current = editMode; }, [editMode]);

  const placedFurnitureRef = useRef(placedFurniture);
  useEffect(() => { placedFurnitureRef.current = placedFurniture; }, [placedFurniture]);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => keysRef.current.add(e.key.toLowerCase());
    const onUp   = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "e") {
        const pt = playerPosRef.current;
        if (pt.x <= 1.5) navigate("/farm", { state: { from: "housing" } });
        else if (pt.x >= ROOM_COLS - 1.5) navigate("/");
      }
      if (key === "h" && !editModeRef.current) { setEditMode(true); setEditTab("furniture"); }
      if (e.key === "Escape") {
        if (selectedDecoId) { setSelectedDecoId(null); return; }
        if (selectedFurnitureId || selectedInstanceId) {
          setSelectedFurnitureId(null); setSelectedInstanceId(null);
        } else {
          setEditMode(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, selectedFurnitureId, selectedInstanceId, selectedDecoId]);

  const lastRef = useRef(0);
  const animRef = useRef(0);

  const tick = useCallback((now: number) => {
    const dt = Math.min((now - lastRef.current) / 1000, 0.05);
    lastRef.current = now;
    if (!editModeRef.current) {
      const SPEED = 5;
      const keys = keysRef.current;
      let vx = 0, vy = 0;
      if (keys.has("arrowleft")  || keys.has("a")) vx = -1;
      else if (keys.has("arrowright") || keys.has("d")) vx = 1;
      if (keys.has("arrowup")    || keys.has("w")) vy = -1;
      else if (keys.has("arrowdown")  || keys.has("s")) vy = 1;
      if (vx !== 0 || vy !== 0) {
        const len = vx !== 0 && vy !== 0 ? Math.SQRT2 : 1;
        const move = SPEED * dt / len;
        const cur = playerPosRef.current;
        const tryMove = (nx: number, ny: number) => {
          const cx = Math.max(0.5, Math.min(ROOM_COLS - 0.5, nx));
          const cy = Math.max(0.5, Math.min(ROOM_ROWS - 0.5, ny));
          if (isTileWalkable(Math.floor(cx), Math.floor(cy), placedFurnitureRef.current)) {
            playerPosRef.current = { x: cx, y: cy }; setPlayerTile({ x: cx, y: cy }); return true;
          }
          return false;
        };
        if (!tryMove(cur.x + vx * move, cur.y + vy * move)) {
          if (!tryMove(cur.x + vx * move, cur.y)) tryMove(cur.x, cur.y + vy * move);
        }
      }
    }
    animRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    lastRef.current = performance.now();
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [tick]);

  // ── 타일 클릭 ─────────────────────────────────────────────────────────────
  const handleTileClick = (tx: number, ty: number) => {
    if (!editMode) return;
    const occupied = getFurnitureAtTile(tx, ty, placedFurniture, FURNITURE);
    if (selectedInstanceId) {
      if (occupied && occupied.instanceId !== selectedInstanceId) return;
      moveFurniture(selectedInstanceId, tx, ty); setSelectedInstanceId(null); return;
    }
    if (selectedFurnitureId) {
      if (occupied) return;
      placeFurniture(tx, ty, selectedFurnitureId); setSelectedFurnitureId(null); return;
    }
    if (occupied) { setSelectedInstanceId(occupied.instanceId); setSelectedFurnitureId(null); }
  };

  const handleFurnitureClick = (instanceId: string) => {
    if (!editMode) return;
    setSelectedFurnitureId(null);
    setSelectedInstanceId((prev) => prev === instanceId ? null : instanceId);
  };

  const handleRemoveFurniture = () => {
    if (!selectedInstanceId) return;
    removeFurniture(selectedInstanceId); setSelectedInstanceId(null);
  };

  const handleRotate = () => { if (selectedInstanceId) rotateFurniture(selectedInstanceId); };

  // ── 벽 장식 슬롯 클릭 ─────────────────────────────────────────────────────
  const handleSlotClick = (wall: WallSide, slotIndex: number) => {
    if (!editMode) return;
    const existing = wallDecorations.find((d) => d.wall === wall && d.slotIndex === slotIndex);
    if (selectedDecoId) {
      placeWallDecoration(wall, slotIndex, selectedDecoId);
      setSelectedDecoId(null);
    } else if (existing) {
      removeWallDecoration(existing.instanceId);
    }
  };

  const handleRemoveSelectedDeco = (instanceId: string) => {
    removeWallDecoration(instanceId);
  };

  // ── 문 근접 여부 ───────────────────────────────────────────────────────────
  const nearFarm = playerTile.x <= 1.5;
  const nearExit = playerTile.x >= ROOM_COLS - 1.5;

  const bonuses = getHousingBonuses();
  const floorStyle = getFloorTile(floorTileId);

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}
    >
      {/* ── 아이소메트릭 배경 캔버스 (z:0) ──────────────────────────────── */}
      <HousingBgCanvas
        offsetX={offsetX}
        offsetY={offsetY}
        width={containerSize.w}
        height={containerSize.h}
      />

      {/* ── 방 스테이지 (배경 위 z:2) ────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: 0, top: 0,
        width: containerSize.w,
        height: containerSize.h,
        overflow: "hidden",
        zIndex: 2,
      }}>
        {/* 바닥 SVG (벽보다 아래 레이어: DOM 순서 앞) */}
        <FloorSVG
          offsetX={offsetX} offsetY={offsetY}
          floorStyle={floorStyle}
        />

        {/* 벽 SVG */}
        <WallSVG
          offsetX={offsetX} offsetY={offsetY}
          wallpaperId={wallpaperId}
          wallDecorations={wallDecorations}
          editMode={editMode && editTab === "walldeco"}
          selectedDecoId={selectedDecoId}
          onSlotClick={handleSlotClick}
        />

        {/* 그리드 + 가구 + 플레이어 */}
        <div style={{ position: "absolute", inset: 0 }}>
          <IsoRoomGrid
            offsetX={offsetX} offsetY={offsetY}
            editMode={editMode && editTab === "furniture"}
            hoveredTile={hoveredTile}
            onTileHover={(x, y) => setHoveredTile({ x, y })}
            onTileLeave={() => setHoveredTile(null)}
            onTileClick={handleTileClick}
            placedFurniture={placedFurniture}
            selectedInstanceId={selectedInstanceId}
            selectedFurnitureId={selectedFurnitureId}
            onFurnitureClick={handleFurnitureClick}
            playerTile={playerTile}
            floorStyle={floorStyle}
          />
        </div>

        {/* 문 오버레이 */}
        <DoorOverlay tile={FARM_DOOR_TILE} offsetX={offsetX} offsetY={offsetY} label="🌾 농장" color="#4caf50" nearPlayer={nearFarm} />
        <DoorOverlay tile={EXIT_DOOR_TILE} offsetX={offsetX} offsetY={offsetY} label="🌲 바깥" color="#4fc3f7" nearPlayer={nearExit} />
      </div>

      {/* ── 상단 HUD ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, left: 0,
        right: 0,
        zIndex: 500, display: "flex", alignItems: "center",
        padding: "10px 14px",
        background: "linear-gradient(180deg, rgba(8,4,1,0.95) 0%, rgba(8,4,1,0) 100%)",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
          <button onClick={() => navigate("/")} style={topBtn("#3f3f46", "#a1a1aa")}>← 바깥</button>
          <button onClick={() => navigate("/farm", { state: { from: "housing" } })} style={topBtn("#14532d", "#4ade80")}>🌾 농장</button>
        </div>
        <div style={{ flex: 1, textAlign: "center", color: "#ffe4b5", fontSize: 15, fontWeight: "bold", textShadow: "0 2px 8px rgba(0,0,0,0.8)", pointerEvents: "none" }}>
          🏠 나의 집
        </div>
        <div style={{ minWidth: 120, textAlign: "right", pointerEvents: "auto" }}>
          {!editMode && bonuses.activeSets.length > 0 && (
            <span style={{ fontSize: 10, color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", padding: "3px 8px", borderRadius: 6 }}>
              ✨ 세트 {bonuses.activeSets.length}개 활성
            </span>
          )}
          {editMode && (
            <span style={{ fontSize: 10, color: "#fbbf24", background: "rgba(251,191,36,0.1)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(251,191,36,0.3)" }}>
              ✏️ 편집 모드
            </span>
          )}
        </div>
      </div>

      {/* ── 우하단: 꾸미기 버튼 ──────────────────────────────────────────── */}
      <div style={{
        position: "fixed", bottom: editMode ? PANEL_H + 12 : 16,
        right: 14,
        zIndex: 500, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
      }}>
        {!editMode && (
          <div style={{ fontSize: 10, color: "#666", background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: 6, border: "1px solid #2a1a0a" }}>
            WASD/방향키 이동 &nbsp;·&nbsp; H: 방 꾸미기
          </div>
        )}
        <button
          onClick={() => { setEditMode((v) => !v); setSelectedFurnitureId(null); setSelectedInstanceId(null); setSelectedDecoId(null); }}
          style={editMode ? bigBtn("#78350f", "#fbbf24", true) : bigBtn("#451a03", "#fb923c", false)}
        >
          {editMode ? "✓ 편집 완료" : "✏️ 방 꾸미기"}
        </button>
      </div>

      {/* ── 편집 패널 ────────────────────────────────────────────────────── */}
      <EditPanel
        open={editMode}
        onClose={() => { setEditMode(false); setSelectedFurnitureId(null); setSelectedInstanceId(null); setSelectedDecoId(null); }}
        selectedFurnitureId={selectedFurnitureId}
        onSelectFurniture={(id) => { setSelectedFurnitureId(id); setSelectedInstanceId(null); }}
        selectedInstanceId={selectedInstanceId}
        selectedInstanceRotation={selectedInstRotation}
        onRemoveFurniture={handleRemoveFurniture}
        onRotate={handleRotate}
        selectedDecoId={selectedDecoId}
        onSelectDeco={(id) => { setSelectedDecoId(id); if (id) setEditTab("walldeco"); }}
        onRemoveSelectedDeco={handleRemoveSelectedDeco}
        tab={editTab}
        onTabChange={setEditTab}
      />
    </div>
  );
}

function topBtn(bg: string, color: string): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: "bold",
    background: bg, color, border: `1px solid ${color}44`, cursor: "pointer",
  };
}

function bigBtn(bg: string, color: string, active: boolean): React.CSSProperties {
  return {
    padding: "9px 20px", borderRadius: 10, fontSize: 13, fontWeight: "bold",
    background: bg, color, border: `1px solid ${active ? color + "88" : color + "44"}`,
    cursor: "pointer",
    boxShadow: active ? `0 0 14px ${color}44` : "0 2px 8px rgba(0,0,0,0.5)",
    transition: "all 0.15s",
  };
}
