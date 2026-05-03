import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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

const WALL_H = 160;
const roomSize = roomPixelSize(ROOM_COLS, ROOM_ROWS);
// roomSize.width = 880, roomSize.height = 440, roomSize.minX = -440, roomSize.minY = 0

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

  const styles: Record<TileState, { bg: string; outline: string }> = {
    normal:            { bg: floorStyle.normalBg,    outline: floorStyle.normalOutline },
    hover:             { bg: floorStyle.hoverBg,     outline: floorStyle.hoverOutline },
    preview_ok:        { bg: "rgba(80,200,120,0.6)", outline: "#4ade80" },
    preview_block:     { bg: "rgba(220,60,60,0.6)",  outline: "#f87171" },
    selected_furniture:{ bg: "rgba(250,200,50,0.65)",outline: "#fbbf24" },
  };
  const s = styles[state];

  return (
    <div
      style={{
        position: "absolute", left, top, width: TILE_W, height: TILE_H,
        clipPath: clip, background: s.bg,
        outline: `1.5px solid ${s.outline}`,
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
  // roomPixelSize 외곽 좌표는 타일 diamond의 "top point" 기준이므로
  // 실제 좌측 바닥 엣지는 TILE_W/2 만큼 오른쪽에 위치 → svgLeft 보정
  const svgLeft = offsetX + TILE_W / 2;
  const svgTop  = offsetY - WALL_H;
  const svgW    = roomSize.width;      // 880
  const svgH    = WALL_H + MID_Y;     // 160 + 220 = 380

  // 벽 꼭짓점 (SVG 좌표)
  const leftWall = [
    `${BACK_X},${0}`,
    `${LEFT_X},${MID_Y}`,
    `${LEFT_X},${WALL_H + MID_Y}`,
    `${BACK_X},${WALL_H}`,
  ].join(" ");
  const rightWall = [
    `${BACK_X},${0}`,
    `${RIGHT_X},${MID_Y}`,
    `${RIGHT_X},${WALL_H + MID_Y}`,
    `${BACK_X},${WALL_H}`,
  ].join(" ");

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
        zIndex: 2,
      }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      <defs>
        {/* 왼쪽 벽 그라디언트 */}
        <linearGradient id="gradLeft" x1={BACK_X} y1={0} x2={LEFT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wp.leftColor1} />
          <stop offset="100%" stopColor={wp.leftColor2} />
        </linearGradient>
        {/* 오른쪽 벽 그라디언트 */}
        <linearGradient id="gradRight" x1={BACK_X} y1={0} x2={RIGHT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wp.rightColor1} />
          <stop offset="100%" stopColor={wp.rightColor2} />
        </linearGradient>
        {/* 몰딩 (상단 테두리) 그라디언트 */}
        <linearGradient id="gradTrim" x1={LEFT_X} y1={0} x2={RIGHT_X} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={wp.trimColor} stopOpacity="0.6" />
          <stop offset="50%" stopColor={wp.trimColor} stopOpacity="1" />
          <stop offset="100%" stopColor={wp.trimColor} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* 왼쪽 벽 면 */}
      <polygon points={leftWall} fill="url(#gradLeft)" />
      {/* 오른쪽 벽 면 */}
      <polygon points={rightWall} fill="url(#gradRight)" />

      {/* 몰딩 (상단 능선) */}
      <polyline
        points={`${LEFT_X},${MID_Y} ${BACK_X},${0} ${RIGHT_X},${MID_Y}`}
        fill="none" stroke="url(#gradTrim)" strokeWidth="3"
      />
      {/* 중앙 세로 능선 (뒤 코너) */}
      <line x1={BACK_X} y1={0} x2={BACK_X} y2={WALL_H} stroke={wp.trimColor} strokeWidth="1.5" strokeOpacity="0.5" />
      {/* 바닥 수평선 */}
      <polyline
        points={`${LEFT_X},${WALL_H + MID_Y} ${BACK_X},${WALL_H} ${RIGHT_X},${WALL_H + MID_Y}`}
        fill="none" stroke={wp.trimColor} strokeWidth="1" strokeOpacity="0.35"
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

  const tiles: JSX.Element[] = [];
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

// ─── 편집 패널 ────────────────────────────────────────────────────────────────

type EditTab = "furniture" | "walldeco" | "wallpaper" | "floortile";

function EditPanel({
  selectedFurnitureId, onSelectFurniture,
  selectedInstanceId, selectedInstanceRotation, onRemoveFurniture, onRotate,
  selectedDecoId, onSelectDeco, onRemoveSelectedDeco,
  tab, onTabChange,
}: {
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
      position: "fixed", right: 0, top: 0, bottom: 0, width: 300,
      background: "linear-gradient(180deg, #100a04 0%, #150d07 100%)",
      borderLeft: "1px solid #3a2510",
      display: "flex", flexDirection: "column", zIndex: 50,
      boxShadow: "-4px 0 20px rgba(0,0,0,0.6)",
    }}>
      {/* 헤더 + 탭 */}
      <div style={{ padding: "12px 14px 0", borderBottom: "1px solid #2a1a0a", flexShrink: 0 }}>
        <div style={{ color: "#fbbf24", fontSize: 13, fontWeight: "bold", marginBottom: 10 }}>
          ✏️ 방 꾸미기
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => onTabChange(t.id)} style={{
              flex: 1, padding: "7px 2px", fontSize: 9.5, fontWeight: "bold",
              color: tab === t.id ? "#fbbf24" : "#555",
              background: tab === t.id ? "rgba(251,191,36,0.1)" : "none",
              border: "none", borderBottom: `2px solid ${tab === t.id ? "#fbbf24" : "transparent"}`,
              cursor: "pointer", borderRadius: "4px 4px 0 0", transition: "all 0.15s",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 선택 상태 표시 */}
      {tab === "furniture" && (selectedFD || selectedInstanceId) && (
        <div style={{
          padding: "8px 12px", borderBottom: "1px solid #2a1a0a",
          background: "rgba(251,191,36,0.06)", flexShrink: 0,
        }}>
          {selectedFD && !selectedInstanceId && (
            <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6 }}>
              <span style={{ fontSize: 16, marginRight: 6 }}>{selectedFD.emoji}</span>
              <strong>{selectedFD.name}</strong> 선택됨
            </div>
          )}
          {selectedInstanceId && instFD && (
            <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6 }}>
              <span style={{ fontSize: 16, marginRight: 6 }}>{instFD.emoji}</span>
              <strong>{instFD.name}</strong>
              <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>회전: {selectedInstanceRotation}°</span>
              {instRotSize && <span style={{ fontSize: 10, color: "#888", marginLeft: 6 }}>{instRotSize.width}×{instRotSize.height}</span>}
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            {selectedFD && !selectedInstanceId && (
              <button onClick={() => onSelectFurniture(null)} style={actionBtn("#9ca3af")}>취소 (ESC)</button>
            )}
            {selectedInstanceId && (
              <>
                <button onClick={onRotate}         style={actionBtn("#60a5fa")}>↻ 회전</button>
                <button onClick={onRemoveFurniture} style={actionBtn("#f87171")}>↩ 회수</button>
              </>
            )}
          </div>
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

      {/* 탭 컨텐츠 */}
      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>

        {/* 가구 탭 */}
        {tab === "furniture" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {/* 보유 가구 */}
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>보유 가구</div>
            {inventory.length === 0 ? (
              <div style={{ textAlign: "center", color: "#444", fontSize: 12, padding: "20px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🪑</div>
                <p>보유 가구 없음</p>
              </div>
            ) : inventory.map((f) => {
              const rSz = getRotatedSize(f.size, 0);
              const isSelected = selectedFurnitureId === f.id;
              return (
                <button key={f.id} onClick={() => onSelectFurniture(isSelected ? null : f.id)} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8,
                  border: `1px solid ${isSelected ? "#fbbf24" : "#2a1a0a"}`,
                  background: isSelected ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.02)",
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{f.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold" }}>{f.name}</span>
                      <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "rgba(0,0,0,0.4)", color: RARITY_COLOR[f.rarity] }}>{RARITY_LABEL[f.rarity]}</span>
                    </div>
                    <div style={{ color: "#666", fontSize: 9, marginTop: 2 }}>{MATERIAL_LABEL[f.material]} · {rSz.width}×{rSz.height}칸</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: "bold", fontFamily: "monospace" }}>×{furnitureInventory[f.id] ?? 0}</span>
                </button>
              );
            })}

            {/* 가구 제작 */}
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>가구 제작</div>
            {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => (
              <div key={mat} style={{ marginBottom: 8 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: "bold", padding: "2px 7px", borderRadius: 4, background: matBg[mat], color: "#fff" }}>{MATERIAL_LABEL[mat]}</span>
                </div>
                {FURNITURE.filter((f) => f.material === mat).map((f) => {
                  const canCraft = Object.entries(f.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
                  const crafted = lastCrafted === f.id;
                  return (
                    <div key={f.id} style={{
                      padding: 8, borderRadius: 8, marginBottom: 4,
                      border: `1px solid ${crafted ? "#34d399" : "#2a1a0a"}`,
                      background: crafted ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.02)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 16 }}>{f.emoji}</span>
                        <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold", flex: 1 }}>{f.name}</span>
                        {(furnitureInventory[f.id] ?? 0) > 0 && (
                          <span style={{ fontSize: 9, color: "#fbbf24" }}>보유×{furnitureInventory[f.id]}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
                        {Object.entries(f.recipe).map(([mid, need]) => {
                          const have = materials[mid] ?? 0; const ok = have >= need;
                          const m = getMaterial(mid);
                          return (
                            <span key={mid} style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 10,
                              border: `1px solid ${ok ? "#444" : "#7f1d1d"}`,
                              color: ok ? "#ccc" : "#f87171", fontFamily: "monospace",
                            }}>{m?.emoji} {m?.name ?? mid} {have}/{need}</span>
                          );
                        })}
                      </div>
                      <button onClick={() => handleCraft(f.id)} disabled={!canCraft} style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
                        borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                        background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                        color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                        cursor: canCraft ? "pointer" : "not-allowed",
                      }}>{crafted ? "완성! ✓" : "제작"}</button>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* 세트 효과 */}
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>세트 효과</div>
            {bonuses.activeSets.length > 0 && (
              <div style={{ padding: 10, borderRadius: 8, border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.06)", marginBottom: 8 }}>
                {bonuses.grassTypePower > 0    && <p style={{ color: "#86efac", fontSize: 11 }}>🌿 풀타입 +{bonuses.grassTypePower}%</p>}
                {bonuses.hpPercent > 0          && <p style={{ color: "#6ee7b7", fontSize: 11 }}>❤️ HP +{bonuses.hpPercent}%</p>}
                {bonuses.attackPercent > 0      && <p style={{ color: "#fca5a5", fontSize: 11 }}>⚔️ 공격 +{bonuses.attackPercent}%</p>}
                {bonuses.defensePercent > 0     && <p style={{ color: "#93c5fd", fontSize: 11 }}>🛡️ 방어 +{bonuses.defensePercent}%</p>}
                {bonuses.towerDropBonus > 0     && <p style={{ color: "#67e8f9", fontSize: 11 }}>🗼 드랍 +{bonuses.towerDropBonus}%</p>}
                {bonuses.catchRateBonus > 0     && <p style={{ color: "#fde047", fontSize: 11 }}>🎯 포획 +{bonuses.catchRateBonus}%</p>}
                {bonuses.potionBonusPercent > 0 && <p style={{ color: "#f9a8d4", fontSize: 11 }}>🧪 물약 +{bonuses.potionBonusPercent}%</p>}
                {bonuses.expBonusPercent > 0    && <p style={{ color: "#c4b5fd", fontSize: 11 }}>✨ 경험치 +{bonuses.expBonusPercent}%</p>}
              </div>
            )}
            {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
              const tiers = MATERIAL_SET_TIERS[mat]; const cur = counts[mat]; const max = tiers[tiers.length - 1].count;
              return (
                <div key={mat} style={{
                  padding: 8, borderRadius: 8, marginBottom: 4,
                  border: `1px solid ${cur > 0 ? matHues[mat] + "44" : "#2a1a0a"}`,
                  background: cur > 0 ? `${matHues[mat]}08` : "rgba(255,255,255,0.01)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: "bold", color: matHues[mat] }}>{MATERIAL_LABEL[mat]}</span>
                    <span style={{ fontSize: 9, color: "#777", fontFamily: "monospace" }}>{cur}/{max}종</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "#1a0e06", marginBottom: 5 }}>
                    <div style={{ height: 3, borderRadius: 2, background: matHues[mat], width: `${Math.min(100, (cur / max) * 100)}%`, transition: "width 0.3s" }} />
                  </div>
                  {tiers.map((tier) => (
                    <div key={tier.count} style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "2px 4px",
                      borderRadius: 4, marginBottom: 1,
                      background: cur >= tier.count ? `${matHues[mat]}18` : "transparent",
                      opacity: cur >= tier.count ? 1 : 0.35,
                    }}>
                      <span style={{ fontSize: 9 }}>{cur >= tier.count ? "✅" : `${tier.count}종`}</span>
                      <span style={{ fontSize: 9, color: cur >= tier.count ? matHues[mat] : "#777", fontWeight: "bold" }}>{tier.name}</span>
                      <span style={{ fontSize: 8, color: "#666", marginLeft: "auto" }}>{tier.description}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* 벽 장식 탭 */}
        {tab === "walldeco" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>보유 벽 장식</div>
            {WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).length === 0 ? (
              <div style={{ textAlign: "center", color: "#444", fontSize: 12, padding: "20px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
                <p>보유 장식 없음</p>
              </div>
            ) : (
              WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).map((d) => {
                const isSelected = selectedDecoId === d.id;
                return (
                  <button key={d.id} onClick={() => onSelectDeco(isSelected ? null : d.id)} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 8,
                    border: `1px solid ${isSelected ? "#fbbf24" : "#2a1a0a"}`,
                    background: isSelected ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.02)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  }}>
                    <span style={{ fontSize: 20 }}>{d.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold" }}>{d.name}</span>
                        <span style={{ fontSize: 8, color: rarityColor[d.rarity] }}>{d.rarity}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: "bold", fontFamily: "monospace" }}>×{wallDecoInventory[d.id] ?? 0}</span>
                  </button>
                );
              })
            )}

            {/* 배치된 벽 장식 목록 */}
            {wallDecorations.length > 0 && (
              <>
                <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>배치됨</div>
                {wallDecorations.map((d) => {
                  const wd = getWallDecoration(d.decorId);
                  return wd ? (
                    <div key={d.instanceId} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
                      border: "1px solid #2a1a0a", background: "rgba(255,255,255,0.02)",
                    }}>
                      <span style={{ fontSize: 18 }}>{wd.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: "#ccc", fontSize: 11 }}>{wd.name}</span>
                        <div style={{ color: "#666", fontSize: 9, marginTop: 1 }}>{d.wall === "left" ? "왼쪽 벽" : "오른쪽 벽"} · {d.slotIndex + 1}번 슬롯</div>
                      </div>
                      <button onClick={() => onRemoveSelectedDeco(d.instanceId)} style={{ padding: "3px 8px", borderRadius: 5, fontSize: 9, border: "1px solid #f8717155", background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer" }}>↩</button>
                    </div>
                  ) : null;
                })}
              </>
            )}

            <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>벽 장식 제작</div>
            {WALL_DECORATIONS.map((d) => {
              const canCraft = Object.entries(d.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
              const crafted = lastCrafted === d.id;
              return (
                <div key={d.id} style={{
                  padding: 8, borderRadius: 8, marginBottom: 4,
                  border: `1px solid ${crafted ? "#34d399" : "#2a1a0a"}`,
                  background: crafted ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.02)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 18 }}>{d.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold" }}>{d.name}</span>
                      <span style={{ fontSize: 8, color: rarityColor[d.rarity], marginLeft: 5 }}>{d.rarity}</span>
                    </div>
                    {(wallDecoInventory[d.id] ?? 0) > 0 && (
                      <span style={{ fontSize: 9, color: "#fbbf24" }}>×{wallDecoInventory[d.id]}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
                    {Object.entries(d.recipe).map(([mid, need]) => {
                      const have = materials[mid] ?? 0; const ok = have >= need;
                      const m = getMaterial(mid);
                      return (
                        <span key={mid} style={{
                          fontSize: 9, padding: "2px 6px", borderRadius: 10,
                          border: `1px solid ${ok ? "#444" : "#7f1d1d"}`,
                          color: ok ? "#ccc" : "#f87171", fontFamily: "monospace",
                        }}>{m?.emoji} {m?.name ?? mid} {have}/{need}</span>
                      );
                    })}
                  </div>
                  <button onClick={() => handleCraftDeco(d.id)} disabled={!canCraft} style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
                    borderColor: crafted ? "#34d399" : canCraft ? "#d97706" : "#333",
                    background: crafted ? "rgba(52,211,153,0.2)" : canCraft ? "rgba(217,119,6,0.2)" : "transparent",
                    color: crafted ? "#34d399" : canCraft ? "#fbbf24" : "#555",
                    cursor: canCraft ? "pointer" : "not-allowed",
                  }}>{crafted ? "완성! ✓" : "제작"}</button>
                </div>
              );
            })}
          </div>
        )}

        {/* 벽지 탭 */}
        {tab === "wallpaper" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {WALLPAPERS.map((wp) => {
              const isUnlocked = unlockedWallpapers.includes(wp.id);
              const isActive   = wallpaperId === wp.id;
              const canCraft   = Object.keys(wp.recipe).length === 0
                ? false
                : Object.entries(wp.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
              const crafted = lastCrafted === wp.id;
              return (
                <div key={wp.id} style={{
                  padding: 10, borderRadius: 10,
                  border: `1px solid ${isActive ? "#fbbf24" : isUnlocked ? "#2a1a0a" : "#1a0e06"}`,
                  background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
                }}>
                  {/* 미리보기 */}
                  <div style={{
                    height: 36, borderRadius: 6, marginBottom: 8, overflow: "hidden",
                    background: `linear-gradient(135deg, ${wp.leftColor1}, ${wp.leftColor2} 45%, ${wp.rightColor1} 55%, ${wp.rightColor2})`,
                    border: `1px solid ${wp.trimColor}66`,
                    opacity: isUnlocked ? 1 : 0.4,
                  }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{wp.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold" }}>{wp.name}</span>
                      <span style={{ fontSize: 8, color: rarityColor[wp.rarity], marginLeft: 5 }}>{wp.rarity}</span>
                    </div>
                    {isActive && <span style={{ fontSize: 9, color: "#fbbf24", background: "rgba(251,191,36,0.15)", padding: "2px 6px", borderRadius: 4 }}>현재</span>}
                  </div>
                  {isUnlocked ? (
                    <button onClick={() => setWallpaper(wp.id)} disabled={isActive} style={{
                      padding: "4px 14px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
                      borderColor: isActive ? "#fbbf2444" : "#d97706",
                      background: isActive ? "transparent" : "rgba(217,119,6,0.2)",
                      color: isActive ? "#555" : "#fbbf24",
                      cursor: isActive ? "default" : "pointer",
                    }}>{isActive ? "사용 중" : "적용"}</button>
                  ) : (
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
                        {Object.entries(wp.recipe).map(([mid, need]) => {
                          const have = materials[mid] ?? 0; const ok = have >= need;
                          const m = getMaterial(mid);
                          return (
                            <span key={mid} style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 10,
                              border: `1px solid ${ok ? "#444" : "#7f1d1d"}`,
                              color: ok ? "#ccc" : "#f87171", fontFamily: "monospace",
                            }}>{m?.emoji} {m?.name ?? mid} {have}/{need}</span>
                          );
                        })}
                      </div>
                      <button onClick={() => handleCraftWallpaper(wp.id)} disabled={!canCraft} style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
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
        )}

        {/* 바닥 탭 */}
        {tab === "floortile" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FLOOR_TILES.map((ft) => {
              const isUnlocked = unlockedFloorTiles.includes(ft.id);
              const isActive   = floorTileId === ft.id;
              const canCraft   = Object.keys(ft.recipe).length === 0
                ? false
                : Object.entries(ft.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
              const crafted = lastCrafted === ft.id;
              return (
                <div key={ft.id} style={{
                  padding: 10, borderRadius: 10,
                  border: `1px solid ${isActive ? "#fbbf24" : isUnlocked ? "#2a1a0a" : "#1a0e06"}`,
                  background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
                }}>
                  {/* 미리보기 */}
                  <div style={{
                    height: 28, borderRadius: 6, marginBottom: 8,
                    background: ft.normalBg,
                    border: `1px solid ${ft.normalOutline}`,
                    opacity: isUnlocked ? 1 : 0.4,
                  }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{ft.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: "#e5e5e5", fontSize: 11, fontWeight: "bold" }}>{ft.name}</span>
                      <span style={{ fontSize: 8, color: rarityColor[ft.rarity], marginLeft: 5 }}>{ft.rarity}</span>
                    </div>
                    {isActive && <span style={{ fontSize: 9, color: "#fbbf24", background: "rgba(251,191,36,0.15)", padding: "2px 6px", borderRadius: 4 }}>현재</span>}
                  </div>
                  {isUnlocked ? (
                    <button onClick={() => setFloorTile(ft.id)} disabled={isActive} style={{
                      padding: "4px 14px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
                      borderColor: isActive ? "#fbbf2444" : "#d97706",
                      background: isActive ? "transparent" : "rgba(217,119,6,0.2)",
                      color: isActive ? "#555" : "#fbbf24",
                      cursor: isActive ? "default" : "pointer",
                    }}>{isActive ? "사용 중" : "적용"}</button>
                  ) : (
                    <div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 5 }}>
                        {Object.entries(ft.recipe).map(([mid, need]) => {
                          const have = materials[mid] ?? 0; const ok = have >= need;
                          const m = getMaterial(mid);
                          return (
                            <span key={mid} style={{
                              fontSize: 9, padding: "2px 6px", borderRadius: 10,
                              border: `1px solid ${ok ? "#444" : "#7f1d1d"}`,
                              color: ok ? "#ccc" : "#f87171", fontFamily: "monospace",
                            }}>{m?.emoji} {m?.name ?? mid} {have}/{need}</span>
                          );
                        })}
                      </div>
                      <button onClick={() => handleCraftFloorTile(ft.id)} disabled={!canCraft} style={{
                        padding: "4px 12px", borderRadius: 6, fontSize: 10, fontWeight: "bold", border: "1px solid",
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
        )}
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
  const panelWidth = 300;
  const [editMode, setEditMode] = useState(false);
  const availW = editMode ? containerSize.w - panelWidth : containerSize.w;
  const availH = containerSize.h;

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
      {/* ── 방 배경 ───────────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(160deg, #3b2010 0%, #241408 45%, #160c05 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(200,120,40,0.15) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* 상단 창문 빛 효과 */}
        <div style={{
          position: "absolute",
          left: offsetX + roomSize.width / 2 - 80,
          top: offsetY - WALL_H - 10,
          width: 160, height: 60,
          background: "radial-gradient(ellipse at 50% 0%, rgba(255,220,100,0.12) 0%, transparent 80%)",
          pointerEvents: "none",
        }} />
      </div>

      {/* ── 방 스테이지 ───────────────────────────────────────────────────── */}
      <div style={{
        position: "absolute", left: 0, top: 0,
        width: editMode ? containerSize.w - panelWidth : containerSize.w,
        height: containerSize.h,
        overflow: "hidden",
      }}>
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
        right: editMode ? panelWidth : 0,
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
        position: "fixed", bottom: 16,
        right: editMode ? panelWidth + 14 : 14,
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
      {editMode && (
        <EditPanel
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
      )}
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
