// ─── 방 크기 상수 ────────────────────────────────────────────────────────────
export const ROOM_COLS = 10;
export const ROOM_ROWS = 10;

// ─── 타일 크기 ───────────────────────────────────────────────────────────────
export const TILE_W = 88;
export const TILE_H = 44;

// ─── 문 위치 ─────────────────────────────────────────────────────────────────
export const FARM_DOOR_TILE  = { x: 0, y: Math.floor(ROOM_ROWS / 2) - 1 };
export const EXIT_DOOR_TILE  = { x: ROOM_COLS - 1, y: Math.floor(ROOM_ROWS / 2) - 1 };

// ─── 캐릭터 초기 위치 (타일 좌표) ────────────────────────────────────────────
export const PLAYER_INIT_TILE = { x: Math.floor(ROOM_COLS / 2), y: Math.floor(ROOM_ROWS / 2) };
