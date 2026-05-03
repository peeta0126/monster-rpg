import { TILE_W, TILE_H, ROOM_COLS, ROOM_ROWS } from "../constants/housing";
import type { PlacedFurniture, FurnitureSize, Rotation, IsoTilePosition } from "../types/housing";
import type { Furniture } from "../data/furniture";

export { TILE_W, TILE_H };

// ─── 좌표 변환 ───────────────────────────────────────────────────────────────

/** 타일 그리드 좌표 → 화면 픽셀 좌표 (오프셋 적용 전) */
export function isoToScreen(x: number, y: number) {
  return {
    left: (x - y) * (TILE_W / 2),
    top:  (x + y) * (TILE_H / 2),
  };
}

/** 그리드 전체 픽셀 크기 계산 */
export function roomPixelSize(cols: number, rows: number) {
  const corners = [
    isoToScreen(0,    0),
    isoToScreen(cols, 0),
    isoToScreen(0,    rows),
    isoToScreen(cols, rows),
  ];
  const allX = corners.map((c) => c.left);
  const allY = corners.map((c) => c.top);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/** 타일 고유 키 */
export function getTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** 인스턴스 ID 생성 */
export function makeInstanceId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── 회전/크기 헬퍼 ──────────────────────────────────────────────────────────

/** 회전이 적용된 실제 width/height 반환 (90/270도 → swap) */
export function getRotatedSize(size: FurnitureSize, rotation: Rotation): FurnitureSize {
  if (rotation === 90 || rotation === 270) {
    return { width: size.height, height: size.width };
  }
  return { width: size.width, height: size.height };
}

/** 가구가 점유하는 모든 타일 목록 반환 */
export function getFurnitureOccupiedTiles(
  x: number,
  y: number,
  size: FurnitureSize,
  rotation: Rotation,
): IsoTilePosition[] {
  const { width, height } = getRotatedSize(size, rotation);
  const tiles: IsoTilePosition[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      tiles.push({ x: x + dx, y: y + dy });
    }
  }
  return tiles;
}

/** 타일 목록이 모두 방 안에 있는지 확인 */
export function isInsideRoomArea(
  tiles: IsoTilePosition[],
  cols: number = ROOM_COLS,
  rows: number = ROOM_ROWS,
): boolean {
  return tiles.every((t) => t.x >= 0 && t.x < cols && t.y >= 0 && t.y < rows);
}

/** 타일 목록 중 하나라도 다른 가구와 겹치는지 확인 */
export function isTileOccupiedByOtherFurniture(
  tiles: IsoTilePosition[],
  placedFurniture: PlacedFurniture[],
  furnitureData: Furniture[],
  ignoreInstanceId?: string,
): boolean {
  const tileKeys = new Set(tiles.map((t) => getTileKey(t.x, t.y)));
  for (const pf of placedFurniture) {
    if (pf.instanceId === ignoreInstanceId) continue;
    const fd = furnitureData.find((f) => f.id === pf.furnitureId);
    const size: FurnitureSize = fd?.size ?? { width: 1, height: 1 };
    const occupied = getFurnitureOccupiedTiles(pf.x, pf.y, size, pf.rotation);
    for (const t of occupied) {
      if (tileKeys.has(getTileKey(t.x, t.y))) return true;
    }
  }
  return false;
}

/** 가구를 특정 위치에 배치 가능한지 종합 검사 */
export function canPlaceFurnitureAt(
  furnitureId: string,
  x: number,
  y: number,
  rotation: Rotation,
  placedFurniture: PlacedFurniture[],
  furnitureData: Furniture[],
  ignoreInstanceId?: string,
): boolean {
  const fd = furnitureData.find((f) => f.id === furnitureId);
  const size: FurnitureSize = fd?.size ?? { width: 1, height: 1 };
  const tiles = getFurnitureOccupiedTiles(x, y, size, rotation);
  if (!isInsideRoomArea(tiles)) return false;
  if (isTileOccupiedByOtherFurniture(tiles, placedFurniture, furnitureData, ignoreInstanceId)) return false;
  return true;
}

/** 주어진 타일 좌표가 어떤 배치 가구에 속하는지 반환 */
export function getFurnitureAtTile(
  tx: number,
  ty: number,
  placedFurniture: PlacedFurniture[],
  furnitureData: Furniture[],
): PlacedFurniture | undefined {
  for (const pf of placedFurniture) {
    const fd = furnitureData.find((f) => f.id === pf.furnitureId);
    const size: FurnitureSize = fd?.size ?? { width: 1, height: 1 };
    const tiles = getFurnitureOccupiedTiles(pf.x, pf.y, size, pf.rotation);
    if (tiles.some((t) => t.x === tx && t.y === ty)) return pf;
  }
  return undefined;
}

/** 모든 배치 가구의 점유 타일 Set 반환 */
export function buildOccupiedSet(
  placedFurniture: PlacedFurniture[],
  furnitureData: Furniture[],
  ignoreInstanceId?: string,
): Set<string> {
  const set = new Set<string>();
  for (const pf of placedFurniture) {
    if (pf.instanceId === ignoreInstanceId) continue;
    const fd = furnitureData.find((f) => f.id === pf.furnitureId);
    const size: FurnitureSize = fd?.size ?? { width: 1, height: 1 };
    const tiles = getFurnitureOccupiedTiles(pf.x, pf.y, size, pf.rotation);
    tiles.forEach((t) => set.add(getTileKey(t.x, t.y)));
  }
  return set;
}

/**
 * 가구 이미지 렌더링 앵커 좌표 반환 (roomSize 보정 전 raw iso 좌표)
 *
 * 앵커 의미:
 *  - left : 점유 영역의 수평 중앙 (가로 center)
 *  - top  : 점유 영역 "앞면 바닥" 꼭짓점 (이소메트릭 우하단 타일의 바닥 꼭짓점)
 *
 * 사용법: 이미지를 이 좌표에 `transform: translate(-50%, -100%)` 으로 배치하면
 * 이미지 하단 중앙이 타일의 앞면 바닥에 맞아 자연스럽게 올라간다.
 * offsetX / offsetY 는 이 앵커 기준의 미세 조정에만 사용한다.
 */
export function getFurnitureRenderPosition(
  x: number,
  y: number,
  size: FurnitureSize,
  rotation: Rotation,
): { left: number; top: number } {
  const rSize = getRotatedSize(size, rotation);
  // 수평: 점유 영역의 가로 중앙
  const left = isoToScreen(x + rSize.width / 2, y + rSize.height / 2).left + TILE_W / 2;
  // 수직: 점유 영역 우하단 타일의 바닥 꼭짓점 + TILE_H/2
  //       이미지 하단을 타일 "앞면" 안으로 약 반 타일 내려 자연스럽게 앉혀줌
  const top = isoToScreen(x + rSize.width, y + rSize.height).top + TILE_H / 2;
  return { left, top };
}

// ─── 하위 호환 (isTileOccupied) ──────────────────────────────────────────────
export function isTileOccupied(
  placed: { x: number; y: number }[],
  x: number,
  y: number,
  excludeInstanceId?: string,
  excludeList?: { instanceId: string; x: number; y: number }[],
): boolean {
  const list = excludeList ?? placed;
  return list.some(
    (p) =>
      p.x === x &&
      p.y === y &&
      (excludeInstanceId == null || (p as { instanceId?: string }).instanceId !== excludeInstanceId),
  );
}
