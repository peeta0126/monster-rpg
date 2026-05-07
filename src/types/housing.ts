export type Rotation = 0 | 90 | 180 | 270;
export type WallSide = "left" | "right";

export interface IsoTilePosition {
  x: number;
  y: number;
}

export interface RoomSize {
  cols: number;
  rows: number;
}

export interface FurnitureSize {
  width: number;
  height: number;
}

export interface FurnitureVisual {
  asset?: string;
  /** 화면에 렌더링될 이미지 너비 (px) */
  width?: number;
  /** 화면에 렌더링될 이미지 높이 (px) */
  height?: number;
  /** 타일 기준 수평 오프셋 */
  offsetX?: number;
  /** 타일 기준 수직 오프셋 (음수 = 위로) */
  offsetY?: number;
  /** 회전(90°) 상태에서 사용할 이미지 경로 */
  rotatedAsset?: string;
  /** 회전 상태 이미지 너비 (없으면 width 사용) */
  rotatedWidth?: number;
  /** 회전 상태 이미지 높이 (없으면 height 사용) */
  rotatedHeight?: number;
  /** 회전 상태 수평 오프셋 (없으면 offsetX 사용) */
  rotatedOffsetX?: number;
  /** 회전 상태 수직 오프셋 (없으면 offsetY 사용) */
  rotatedOffsetY?: number;
}

export interface PlacedFurniture {
  instanceId: string;
  furnitureId: string;
  x: number;
  y: number;
  rotation: Rotation;
  placedAt?: number;
  variant?: string;
  roomId?: string;
}

/** 벽면에 배치된 장식품 */
export interface PlacedWallDecoration {
  instanceId: string;
  decorId: string;
  /** 배치된 벽면 */
  wall: WallSide;
  /** 벽 격자 열 (0 .. WALL_COLS-1) */
  col: number;
  /** 벽 격자 행 (0 .. WALL_ROWS-1, 0=하단) */
  row: number;
  placedAt?: number;
}
