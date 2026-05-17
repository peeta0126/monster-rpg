// ─── 방 크기 상수 ────────────────────────────────────────────────────────────
export const ROOM_COLS = 10;
export const ROOM_ROWS = 10;

// ─── 타일 크기 ───────────────────────────────────────────────────────────────
export const TILE_W = 88;
export const TILE_H = 44;
export const TILE_SIZE = 64; // 탑다운 정사각 타일 크기 (픽셀, scale 1 기준)

// ─── 문 위치 (바닥면 중앙 2칸: 4칸-2칸-4칸) ──────────────────────────────────
export const FARM_DOOR_TILES = [{ x: 4, y: ROOM_ROWS - 1 }, { x: 5, y: ROOM_ROWS - 1 }];
export const EXIT_DOOR_TILES = [{ x: ROOM_COLS - 1, y: 4 }, { x: ROOM_COLS - 1, y: 5 }];
export const FARM_DOOR_TILE  = FARM_DOOR_TILES[0];
export const EXIT_DOOR_TILE  = EXIT_DOOR_TILES[0];

// ─── 벽면 격자 크기 ──────────────────────────────────────────────────────────
export const WALL_COLS = 10;   // 벽면 가로 분할 수 (바닥 타일과 동일)
export const WALL_ROWS = 6;    // 벽면 세로 분할 수 (타일 높이 기준 ~22px/행)

// ─── 캐릭터 초기 위치 (타일 좌표) ────────────────────────────────────────────
export const PLAYER_INIT_TILE = { x: Math.floor(ROOM_COLS / 2), y: Math.floor(ROOM_ROWS / 2) };
