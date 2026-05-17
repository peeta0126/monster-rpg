import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { IndoorRoomBg, ROOM_WALL_H, ROOM_BASE_H, ROOM_MOL_H } from "../components/housing/IndoorRoomBg";
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
import { ROOM_COLS, ROOM_ROWS, PLAYER_INIT_TILE, WALL_COLS, WALL_ROWS } from "../constants/housing";
import { WALLPAPERS, getWallpaper } from "../data/wallpapers";
import { FLOOR_TILES, getFloorTile } from "../data/floorTiles";
import { WALL_DECORATIONS, getWallDecoration } from "../data/wallDecorations";

// ─── 상수 ──────────────────────────────────────────────────────────────────────

const roomSize = roomPixelSize(ROOM_COLS, ROOM_ROWS);
// roomSize.width = 880, roomSize.height = 440, minX = -440, minY = 0

// ROOM_WALL_H, ROOM_BASE_H, ROOM_MOL_H → IndoorRoomBg에서 import

// 방 타일 화면 좌표 (스테이지 내부 좌표: offsetX=0, offsetY=0 기준)
function tileScreenPos(tx: number, ty: number, offsetX: number, offsetY: number) {
  const left = (tx - ty) * (TILE_W / 2);
  const top  = (tx + ty) * (TILE_H / 2);
  return { left: left - roomSize.minX + offsetX, top: top - roomSize.minY + offsetY };
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

  // normal 상태는 투명 — 배경 이미지가 바닥 시각을 담당
  const styles: Record<TileState, { bg: string }> = {
    normal:            { bg: "transparent" },
    hover:             { bg: floorStyle.hoverBg },
    preview_ok:        { bg: "rgba(72,210,96,0.52)" },
    preview_block:     { bg: "rgba(210,44,44,0.60)" },
    selected_furniture:{ bg: "rgba(244,169,54,0.55)" },  // 금빛 선택
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

// ─── 편집 모드 그리드 오버레이 ───────────────────────────────────────────────

function GridOverlay() {
  const lines: ReactElement[] = [];
  for (let k = 0; k <= ROOM_COLS; k++) {
    lines.push(
      <line key={`tx${k}`} x1={440+44*k} y1={22*k} x2={44*k} y2={220+22*k}
            stroke="rgba(244,169,54,0.32)" strokeWidth="1.1" />,
      <line key={`ty${k}`} x1={440-44*k} y1={22*k} x2={880-44*k} y2={220+22*k}
            stroke="rgba(244,169,54,0.32)" strokeWidth="1.1" />,
    );
  }
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, width: 880, height: 440, pointerEvents: "none", zIndex: 1 }}
         viewBox="0 0 880 440">
      {lines}
      <polygon points="440,0 880,220 440,440 0,220"
               fill="none" stroke="rgba(244,169,54,0.58)" strokeWidth="2.0" />
    </svg>
  );
}

// (WallSVG removed — housing area is outdoor, no walls)
// (FloorSVG removed — background image provides floor visuals)

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
  onFurnitureClick, playerTile, playerSprite, floorStyle,
  placementRotation,
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
  playerSprite: string;
  floorStyle: FloorStyle;
  /** 배치 모드에서 R키로 설정한 회전각 */
  placementRotation: 0 | 90;
}) {
  const selectedFD    = selectedFurnitureId ? getFurniture(selectedFurnitureId) : null;
  const selectedInst  = selectedInstanceId ? placedFurniture.find((p) => p.instanceId === selectedInstanceId) : null;
  const selectedInstFD = selectedInst ? getFurniture(selectedInst.furnitureId) : null;

  const previewTiles: Map<string, "ok" | "block"> = new Map();
  if (editMode && hoveredTile) {
    let furnitureId: string | null = null;
    let rotation: 0 | 90 | 180 | 270 = 0;
    let ignoreId: string | undefined;
    if (selectedFD) { furnitureId = selectedFD.id; rotation = placementRotation; }
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
    // placementRotation을 반영한 이미지/크기/오프셋 선택
    const isRotated = placementRotation !== 0;
    const imgSrc = isRotated && v.rotatedAsset ? v.rotatedAsset : v.asset;
    const imgW   = (isRotated ? v.rotatedWidth  : undefined) ?? v.width  ?? 80;
    const imgH   = (isRotated ? v.rotatedHeight : undefined) ?? v.height ?? 80;
    const oX     = (isRotated ? v.rotatedOffsetX : undefined) ?? v.offsetX ?? 0;
    const oY     = (isRotated ? v.rotatedOffsetY : undefined) ?? v.offsetY ?? 0;
    const rawPos = getFurnitureRenderPosition(hoveredTile.x, hoveredTile.y, selectedFD.size, placementRotation);
    const ghostLeft = rawPos.left - roomSize.minX + offsetX + oX;
    const ghostTop  = rawPos.top  - roomSize.minY + offsetY + oY;
    const canPlace = canPlaceFurnitureAt(selectedFD.id, hoveredTile.x, hoveredTile.y, placementRotation, placedFurniture, FURNITURE);
    return (
      <div style={{
        position: "absolute", left: ghostLeft, top: ghostTop,
        transform: "translate(-50%, -100%)", zIndex: 200, opacity: 0.6, pointerEvents: "none",
        filter: canPlace ? "drop-shadow(0 0 6px #4ade80)" : "drop-shadow(0 0 6px #f87171)",
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={selectedFD.name}
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
          top={playerPos.top + TILE_H / 2}
          zIndex={playerZIndex}
          sprite={playerSprite}
        />
      )}
    </>
  );
}

// ─── 플레이어 스프라이트 ──────────────────────────────────────────────────────

function PlayerSprite({ left, top, zIndex, sprite }: { left: number; top: number; zIndex: number; sprite: string }) {
  return (
    <div style={{
      position: "absolute", left, top,
      transform: "translate(-50%, -100%)",
      zIndex, pointerEvents: "none",
    }}>
      <img src={`/assets/basecamp/${sprite}.png`} alt="player"
        style={{ width: "56px", height: "56px", imageRendering: "pixelated", display: "block" }}
        draggable={false} />
    </div>
  );
}

// ─── 벽 격자 오버레이 (SVG) ──────────────────────────────────────────────────

function WallGridOverlay({
  leX, leY, tpX, tpY, riX, riY, BH, inH,
  screenW, screenH,
  wallDecorations, selectedDecoId,
  onCellClick,
}: {
  leX: number; leY: number;
  tpX: number; tpY: number;
  riX: number; riY: number;
  BH: number; inH: number;
  screenW: number; screenH: number;
  wallDecorations: PlacedWallDecoration[];
  selectedDecoId: string | null;
  onCellClick: (wall: WallSide, col: number, row: number) => void;
}) {
  const [hovered, setHovered] = useState<{ wall: WallSide; col: number; row: number } | null>(null);

  const cells: ReactElement[] = [];
  for (const wall of ["left", "right"] as const) {
    const ax = wall === "left" ? leX : tpX;
    const ay = wall === "left" ? leY : tpY;
    const bx = wall === "left" ? tpX : riX;
    const by = wall === "left" ? tpY : riY;

    for (let row = 0; row < WALL_ROWS; row++) {
      for (let col = 0; col < WALL_COLS; col++) {
        const u0 = col / WALL_COLS, u1 = (col + 1) / WALL_COLS;
        const h0 = BH + row * inH / WALL_ROWS;
        const h1 = BH + (row + 1) * inH / WALL_ROWS;

        const x0 = ax + u0 * (bx - ax), y0 = ay + u0 * (by - ay);
        const x1 = ax + u1 * (bx - ax), y1 = ay + u1 * (by - ay);

        const pts = [
          `${x0},${y0 - h0}`, `${x1},${y1 - h0}`,
          `${x1},${y1 - h1}`, `${x0},${y0 - h1}`,
        ].join(" ");

        const isHov = hovered?.wall === wall && hovered.col === col && hovered.row === row;
        const occupied = wallDecorations.find((d) => d.wall === wall && d.col === col && d.row === row);

        cells.push(
          <polygon
            key={`${wall}-${col}-${row}`}
            points={pts}
            fill={
              occupied
                ? "rgba(251,191,36,0.18)"
                : isHov && selectedDecoId
                  ? "rgba(74,222,128,0.28)"
                  : isHov
                    ? "rgba(255,255,255,0.12)"
                    : "transparent"
            }
            stroke={
              occupied
                ? "#f59e0b"
                : isHov
                  ? (selectedDecoId ? "#4ade80" : "rgba(255,255,255,0.70)")
                  : "rgba(255,255,255,0.22)"
            }
            strokeWidth={isHov || occupied ? 1.5 : 0.9}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onMouseEnter={() => setHovered({ wall, col, row })}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onCellClick(wall, col, row)}
          />,
        );
      }
    }
  }

  return (
    <svg
      style={{ position: "absolute", inset: 0, zIndex: 15, pointerEvents: "none" }}
      width={screenW} height={screenH}
    >
      {cells}
    </svg>
  );
}

// ─── 편집 패널 (Tiny Farm 스타일 하단 슬라이드) ──────────────────────────────

export const PANEL_W = 280; // 우측 패널 너비 (외부에서 레이아웃 계산용)

type EditTab = "furniture" | "walldeco" | "wallpaper" | "floortile";

function EditPanel({
  open,
  onClose,
  selectedFurnitureId, onSelectFurniture,
  selectedInstanceId, selectedInstanceRotation, onRemoveFurniture, onRotate,
  selectedDecoId, onSelectDeco, onRemoveSelectedDeco,
  tab, onTabChange,
  placementRotation, onRotatePlacement,
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
  placementRotation: 0 | 90;
  onRotatePlacement: () => void;
}) {
  const {
    materials, furnitureInventory, craftFurniture, placedFurniture,
    wallDecoInventory, craftWallDecoration, wallDecorations,
    wallpaperId, setWallpaper, unlockedWallpapers, craftWallpaper,
    floorTileId, setFloorTile, unlockedFloorTiles, craftFloorTile,
  } = usePlayerStore();
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);
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
      position: "fixed", right: 0, top: 0, bottom: 0, width: PANEL_W,
      background: "linear-gradient(180deg, #100804 0%, #1C0E06 100%)",
      borderLeft: "2px solid #6A3810",
      display: "flex", flexDirection: "column", zIndex: 500,
      boxShadow: "-8px 0 36px rgba(0,0,0,0.90)",
      transform: open ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
    }}>

      {/* ── 탭 헤더 (2×2 그리드) + 닫기 ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        borderBottom: "1px solid #5C3010", flexShrink: 0,
      }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onTabChange(t.id)} style={{
            padding: "8px 4px", fontSize: 10, fontWeight: "bold",
            color: tab === t.id ? "#F4A936" : "#5C3A14",
            background: tab === t.id ? "rgba(244,169,54,0.10)" : "none",
            border: "none", borderBottom: `2px solid ${tab === t.id ? "#F4A936" : "transparent"}`,
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
        <button
          onClick={onClose}
          style={{
            gridColumn: "1 / -1", padding: "6px 0", fontSize: 11, fontWeight: "bold",
            color: "#F4A936", background: "rgba(244,169,54,0.08)",
            border: "none", borderTop: "1px solid #6A3810", cursor: "pointer",
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
          background: "rgba(244,169,54,0.06)",
        }}>
          {selectedFD && !selectedInstanceId && (
            <>
              <span style={{ fontSize: 16 }}>{selectedFD.emoji}</span>
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: "bold", flex: 1 }}>
                {selectedFD.name}
                <span style={{ color: "#888", fontSize: 10, marginLeft: 5 }}>{placementRotation}°</span>
                <span style={{ color: "#555", fontSize: 9, marginLeft: 4 }}>R: 회전</span>
              </span>
              <button onClick={onRotatePlacement} style={actionBtn("#60a5fa")}>↻ 회전</button>
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
          background: "rgba(244,169,54,0.06)", flexShrink: 0,
        }}>
          {(() => {
            const wd = getWallDecoration(selectedDecoId);
            return wd ? (
              <div style={{ fontSize: 11, color: "#fbbf24", marginBottom: 6 }}>
                <span style={{ fontSize: 18, marginRight: 6 }}>{wd.emoji}</span>
                <strong>{wd.name}</strong> 선택됨
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>벽 칸을 클릭해 배치</div>
              </div>
            ) : null;
          })()}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onSelectDeco(null)} style={actionBtn("#9ca3af")}>취소 (ESC)</button>
          </div>
        </div>
      )}

      {/* 탭 컨텐츠 — 세로 스크롤 */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 10px" }}>

        {/* ══ 가구 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "furniture" && (<>
          {/* 보유 가구 */}
          <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>보유</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {inventory.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 64, color: "#444" }}>
              <div style={{ fontSize: 24 }}>🪑</div><div style={{ fontSize: 8, marginTop: 4 }}>없음</div>
            </div>
          ) : inventory.map((f) => {
            const isSelected = selectedFurnitureId === f.id;
            return (
              <button key={f.id} onClick={() => onSelectFurniture(isSelected ? null : f.id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 72, padding: "8px 4px", gap: 4, borderRadius: 8, cursor: "pointer",
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
          </div>

          <div style={{ height: 1, background: "#5C3010", margin: "2px 0 8px" }} />

          {/* 가구 제작 */}
          <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>제작</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
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
          </div>

          <div style={{ height: 1, background: "#5C3010", margin: "2px 0 8px" }} />

          {/* 세트 효과 */}
          <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>세트</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
            const tiers = MATERIAL_SET_TIERS[mat]; const cur = counts[mat]; const max = tiers[tiers.length - 1].count;
            return (
              <div key={mat} style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                width: 120, padding: "8px 6px", gap: 4, borderRadius: 8,
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
          </div>
        </>)}

        {/* ══ 벽 장식 탭 ════════════════════════════════════════════════════════ */}
        {tab === "walldeco" && (<>
          <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>보유</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 64, color: "#444" }}>
              <div style={{ fontSize: 24 }}>🖼️</div><div style={{ fontSize: 8, marginTop: 4 }}>없음</div>
            </div>
          ) : WALL_DECORATIONS.filter((d) => (wallDecoInventory[d.id] ?? 0) > 0).map((d) => {
            const isSelected = selectedDecoId === d.id;
            return (
              <button key={d.id} onClick={() => onSelectDeco(isSelected ? null : d.id)} style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                width: 72, padding: "8px 4px", gap: 4, borderRadius: 8, cursor: "pointer",
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
          </div>

          {wallDecorations.length > 0 && (<>
            <div style={{ height: 1, background: "#5C3010", margin: "2px 0 8px" }} />
            <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>배치</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {wallDecorations.map((d) => {
              const wd = getWallDecoration(d.decorId);
              return wd ? (
                <div key={d.instanceId} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  width: 72, padding: "8px 4px", gap: 4, borderRadius: 8,
                  border: "1px solid #2a1a0a", background: "rgba(255,255,255,0.02)",
                }}>
                  <span style={{ fontSize: 24 }}>{wd.emoji}</span>
                  <span style={{ fontSize: 8, color: "#ccc", textAlign: "center" }}>{wd.name}</span>
                  <span style={{ fontSize: 7, color: "#666" }}>{d.wall === "left" ? "왼쪽" : "오른쪽"} ({d.col},{d.row})</span>
                  <button onClick={() => onRemoveSelectedDeco(d.instanceId)} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, border: "1px solid #f8717155", background: "rgba(248,113,113,0.1)", color: "#f87171", cursor: "pointer" }}>↩ 회수</button>
                </div>
              ) : null;
            })}
            </div>
          </>)}

          <div style={{ height: 1, background: "#5C3010", margin: "2px 0 8px" }} />
          <div style={{ color: "#444", fontSize: 8, textTransform: "uppercase", letterSpacing: 1, userSelect: "none", marginBottom: 4 }}>제작</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
          </div>
        </>)}

        {/* ══ 벽지 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "wallpaper" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {WALLPAPERS.map((wp) => {
          const isUnlocked = unlockedWallpapers.includes(wp.id);
          const isActive   = wallpaperId === wp.id;
          const canCraft   = Object.keys(wp.recipe).length === 0 ? false : Object.entries(wp.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
          const crafted = lastCrafted === wp.id;
          return (
            <div key={wp.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              width: 120, padding: "6px 5px", gap: 4, borderRadius: 8,
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
          </div>
        )}

        {/* ══ 바닥 탭 ══════════════════════════════════════════════════════════ */}
        {tab === "floortile" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {FLOOR_TILES.map((ft) => {
          const isUnlocked = unlockedFloorTiles.includes(ft.id);
          const isActive   = floorTileId === ft.id;
          const canCraft   = Object.keys(ft.recipe).length === 0 ? false : Object.entries(ft.recipe).every(([id, n]) => (materials[id] ?? 0) >= n);
          const crafted = lastCrafted === ft.id;
          return (
            <div key={ft.id} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              width: 120, padding: "6px 5px", gap: 4, borderRadius: 8,
              border: `1px solid ${isActive ? "#fbbf24" : isUnlocked ? "#2a1a0a" : "#1a0e06"}`,
              background: isActive ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
            }}>
              <div style={{ width: "100%", height: 28, borderRadius: 5, opacity: isUnlocked ? 1 : 0.4, background: ft.normalBg, border: `1px solid ${ft.normalOutline}` }} />
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

// ─── 문 타일 레이어 (흰색 아이소메트릭 타일 + 라벨) ────────────────────────

function DoorTilesLayer({ nearFarm, nearExit }: { nearFarm: boolean; nearExit: boolean }) {
  const farmTiles = [{ x: 4, y: 9 }, { x: 5, y: 9 }];
  const exitTiles = [{ x: 9, y: 4 }, { x: 9, y: 5 }];
  const hw = TILE_W / 2;
  const clip = `polygon(${hw}px 0px, ${TILE_W}px ${TILE_H / 2}px, ${hw}px ${TILE_H}px, 0px ${TILE_H / 2}px)`;

  const renderGroup = (tiles: { x: number; y: number }[], near: boolean, label: string) => {
    const positions = tiles.map((t) => tileScreenPos(t.x, t.y, 0, 0));
    // Canvas draws the tile top-vertex at pos.left; HTML bounding box needs to start hw left of that.
    const centerX = positions.reduce((s, p) => s + p.left, 0) / positions.length;
    const bottomY = Math.max(...positions.map((p) => p.top + TILE_H));
    return (
      <>
        {positions.map((pos, i) => (
          <div key={i} style={{
            position: "absolute", left: pos.left - hw, top: pos.top,
            width: TILE_W, height: TILE_H,
            clipPath: clip,
            background: near ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.38)",
            zIndex: 5, pointerEvents: "none",
            boxShadow: near ? "0 0 14px rgba(255,255,255,0.9)" : "none",
            transition: "background 0.3s, box-shadow 0.3s",
          }} />
        ))}
        <div style={{
          position: "absolute", left: centerX, top: bottomY + 5,
          transform: "translateX(-50%)", textAlign: "center",
          pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap",
          color: near ? "#ffffff" : "#cccccc",
          fontSize: 11, fontWeight: "bold",
          textShadow: "0 1px 5px rgba(0,0,0,0.95)",
          transition: "color 0.3s",
        }}>{label}</div>
        {near && (
          <div style={{
            position: "absolute", left: centerX, top: bottomY + 19,
            transform: "translateX(-50%)", textAlign: "center",
            pointerEvents: "none", zIndex: 6, whiteSpace: "nowrap",
            color: "#fbbf24", fontSize: 10, fontWeight: "bold",
            textShadow: "0 1px 4px rgba(0,0,0,0.9)",
          }}>[E] 이동</div>
        )}
      </>
    );
  };

  return (
    <>
      {renderGroup(farmTiles, nearFarm, "🌾 농장")}
      {renderGroup(exitTiles, nearExit, "🌲 바깥")}
    </>
  );
}

// ─── HousingPage ─────────────────────────────────────────────────────────────

export default function HousingPage() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  const {
    placedFurniture, placeFurniture, moveFurniture, rotateFurniture, removeFurniture, getHousingBonuses,
    wallDecorations, placeWallDecoration, removeWallDecoration,
    grantAllHousingItems,
    wallpaperId, floorTileId,
  } = usePlayerStore();

  // ── 레이아웃: housing_bg.png 다이아몬드 영역에 스테이지 정렬 ───────────────
  const [editMode, setEditMode] = useState(false);

  // 실내 방 전체 (벽+바닥) 크기: 가로 880, 세로 (440 + ROOM_WALL_H)
  const totalStageH = roomSize.height + ROOM_WALL_H;
  const availW = containerSize.w - (editMode ? PANEL_W : 0);
  const contentScale = Math.min(
    (availW - 40) / roomSize.width,
    (containerSize.h - 40) / totalStageH,
  );
  const stageLeft = (availW - roomSize.width  * contentScale) / 2;
  const stageTop  = (containerSize.h - totalStageH * contentScale) / 2 + ROOM_WALL_H * contentScale;

  useEffect(() => {
    const update = () => setContainerSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => { grantAllHousingItems(); }, []);

  // ── 선택 상태 ─────────────────────────────────────────────────────────────
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId]   = useState<string | null>(null);
  const [selectedDecoId, setSelectedDecoId]           = useState<string | null>(null);
  // 배치 모드(selectedFurnitureId)에서 R키로 토글되는 회전 각도
  const [placementRotation, setPlacementRotation]     = useState<0 | 90>(0);
  const [editTab, setEditTab] = useState<EditTab>("furniture");
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);

  const selectedInst = selectedInstanceId
    ? placedFurniture.find((p) => p.instanceId === selectedInstanceId)
    : null;
  const selectedInstRotation: 0 | 90 | 180 | 270 = selectedInst?.rotation ?? 0;

  // 가구 선택 해제(배치 완료/취소) 시 회전각 초기화
  useEffect(() => {
    if (!selectedFurnitureId) setPlacementRotation(0);
  }, [selectedFurnitureId]);

  // ── 플레이어 이동 + 애니메이션 ────────────────────────────────────────────
  const initPos = { x: PLAYER_INIT_TILE.x + 0.5, y: PLAYER_INIT_TILE.y + 0.5 };
  const [playerTile, setPlayerTile] = useState(initPos);
  const [playerSprite, setPlayerSprite] = useState("player-down");
  const playerPosRef    = useRef(initPos);
  const keysRef         = useRef<Set<string>>(new Set());
  const facingRef       = useRef<"up" | "down" | "left" | "right">("down");
  const walkFrameRef    = useRef<1 | 2>(1);
  const walkTimerRef    = useRef(0);
  const editModeRef     = useRef(editMode);
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
        const isFarm = pt.y >= ROOM_ROWS - 1.5 && pt.x >= 3.5 && pt.x <= 6.5;
        const isExit = pt.x >= ROOM_COLS - 1.5 && pt.y >= 3.5 && pt.y <= 6.5;
        if (isFarm) navigate("/farm", { state: { from: "housing" } });
        else if (isExit) navigate("/");
      }
      if (key === "h" && !editModeRef.current) { setEditMode(true); setEditTab("furniture"); }
      // R키: 배치 중이면 배치 회전 토글, 선택된 배치 가구가 있으면 그 가구 회전
      if (key === "r" && editModeRef.current) {
        if (selectedFurnitureId) { setPlacementRotation((r) => (r === 0 ? 90 : 0)); return; }
        if (selectedInstanceId)  { rotateFurniture(selectedInstanceId); return; }
      }
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
      const isMoving = vx !== 0 || vy !== 0;

      // ── 방향 + 애니메이션 프레임 ──────────────────────────────────────────
      if (vx < 0) facingRef.current = "left";
      else if (vx > 0) facingRef.current = "right";
      if (vy < 0) facingRef.current = "up";
      else if (vy > 0) facingRef.current = "down";

      if (isMoving) {
        walkTimerRef.current += dt * 1000;
        if (walkTimerRef.current >= 160) {
          walkTimerRef.current = 0;
          walkFrameRef.current = walkFrameRef.current === 1 ? 2 : 1;
        }
        setPlayerSprite(`player-${facingRef.current}-${walkFrameRef.current}`);
      } else {
        walkTimerRef.current = 0;
        setPlayerSprite(`player-${facingRef.current}`);
      }

      if (isMoving) {
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
      placeFurniture(tx, ty, selectedFurnitureId, placementRotation); setSelectedFurnitureId(null); return;
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

  const handleRemoveSelectedDeco = (instanceId: string) => {
    removeWallDecoration(instanceId);
  };

  // ── 벽 격자 셀 클릭 ───────────────────────────────────────────────────────
  const handleWallCellClick = (wall: WallSide, col: number, row: number) => {
    if (!editMode) return;
    const existing = wallDecorations.find((d) => d.wall === wall && d.col === col && d.row === row);
    if (selectedDecoId) {
      placeWallDecoration(wall, col, row, selectedDecoId);
      setSelectedDecoId(null);
    } else if (existing) {
      removeWallDecoration(existing.instanceId);
    }
  };

  // ── 벽 격자 기하 값 ────────────────────────────────────────────────────────
  const _WH  = ROOM_WALL_H * contentScale;
  const _BH  = ROOM_BASE_H * contentScale;
  const _MH  = ROOM_MOL_H  * contentScale;
  const _inH = _WH - _BH - _MH;
  const wallLeX = stageLeft;
  const wallLeY = stageTop + 220 * contentScale;
  const wallTpX = stageLeft + 440 * contentScale;
  const wallTpY = stageTop;
  const wallRiX = stageLeft + 880 * contentScale;
  const wallRiY = stageTop + 220 * contentScale;

  // ── 문 근접 여부 ───────────────────────────────────────────────────────────
  const nearFarm = playerTile.y >= ROOM_ROWS - 1.5 && playerTile.x >= 3.5 && playerTile.x <= 6.5;
  const nearExit = playerTile.x >= ROOM_COLS - 1.5 && playerTile.y >= 3.5 && playerTile.y <= 6.5;

  const bonuses = getHousingBonuses();
  const _ft = getFloorTile(floorTileId);
  const floorStyle = { normalBg: "transparent", normalOutline: "transparent", hoverBg: _ft.hoverBg, hoverOutline: _ft.normalOutline };

  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative", backgroundColor: "#0a0705" }}
    >
      {/* ── 실내 방 캔버스 배경 ──────────────────────────────────────────── */}
      <IndoorRoomBg
        width={containerSize.w}
        height={containerSize.h}
        stageLeft={stageLeft}
        stageTop={stageTop}
        cs={contentScale}
        wallDecorations={wallDecorations}
        wallpaperId={wallpaperId}
        floorTileId={floorTileId}
      />

      {/* ── 벽 격자 오버레이 (편집 모드) ────────────────────────────────── */}
      {editMode && editTab === "walldeco" && (
        <WallGridOverlay
          leX={wallLeX} leY={wallLeY}
          tpX={wallTpX} tpY={wallTpY}
          riX={wallRiX} riY={wallRiY}
          BH={_BH} inH={_inH}
          screenW={containerSize.w} screenH={containerSize.h}
          wallDecorations={wallDecorations}
          selectedDecoId={selectedDecoId}
          onCellClick={handleWallCellClick}
        />
      )}

      {/* ── 아이소메트릭 스테이지 (배경 다이아몬드에 정렬) ─────────────────── */}
      <div style={{
        position: "absolute",
        left: stageLeft,
        top: stageTop,
        width: roomSize.width,
        height: roomSize.height,
        transform: `scale(${contentScale})`,
        transformOrigin: "0 0",
        zIndex: 2,
      }}>
        {/* 편집 모드 그리드 오버레이 */}
        {editMode && <GridOverlay />}

        {/* 타일 + 가구 + 플레이어 */}
        <IsoRoomGrid
          offsetX={0} offsetY={0}
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
          playerSprite={playerSprite}
          floorStyle={floorStyle}
          placementRotation={placementRotation}
        />

        {/* 문 타일 */}
        <DoorTilesLayer nearFarm={nearFarm} nearExit={nearExit} />
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
        <div style={{ flex: 1 }} />
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
        right: editMode ? PANEL_W + 14 : 14,
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
        placementRotation={placementRotation}
        onRotatePlacement={() => setPlacementRotation((r) => (r === 0 ? 90 : 0))}
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
