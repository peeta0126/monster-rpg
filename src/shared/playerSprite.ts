/** Shared direction and frame selection for the player renderer. */
export type Dir8 = "S" | "SE" | "E" | "NE" | "N" | "NW" | "W" | "SW";
export const DIRS_8: readonly Dir8[] = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];

export function dirFromVector(dx: number, dy: number): Dir8 {
  if (dx === 0 && dy === 0) return "S";
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return DIRS_8[Math.round(((90 - deg + 360) % 360) / 45) % 8];
}

// Only right-facing diagonal/side art is supplied; left directions are mirrored.
const MIRROR: Partial<Record<Dir8, Dir8>> = { SE: "SW", E: "W", NE: "NW" };
export function resolveDir(dir: Dir8): { dir: Dir8; flipX: boolean } {
  const mirrored = MIRROR[dir];
  return { dir: mirrored ?? dir, flipX: mirrored !== undefined };
}

export type MonsterSheetDir = "south" | "southeast" | "east" | "northeast" | "north";
export interface PlayerFrame { source: MonsterSheetDir; frame?: number; flipX: boolean; }

export const PLAYER_SHEET_KEYS: Record<MonsterSheetDir, string> = {
  south: "monster-south", southeast: "monster-southeast", east: "monster-east",
  northeast: "monster-northeast", north: "monster-north",
};
export const PLAYER_SHEET_PATHS: Record<MonsterSheetDir, string> = {
  south: "/assets/player/남.png", southeast: "/assets/player/남동.png",
  east: "/assets/player/동.png", northeast: "/assets/player/북동.png", north: "/assets/player/북.png",
};

export const PLAYER_FRAME_WIDTH = 362;
export const PLAYER_FRAME_HEIGHT = 724;
// 북동.png is supplied as 2048×682; retain it and use its exact per-frame size.
export const PLAYER_NORTHEAST_FRAME_WIDTH = 2048 / 6;
export const PLAYER_NORTHEAST_FRAME_HEIGHT = 682;
export const PLAYER_SHEET_FRAMES = 6;
export const PLAYER_MONSTER_WALK_FRAMES = 5;
// Kept for consumers/tests of the retired 64px atlas API.
export const PLAYER_WALK_FRAMES = 4;
export const PLAYER_FRAME_SIZE = 64;
export const PLAYER_ATLAS_ROW_DIRS: readonly Dir8[] = ["S", "SW", "W", "NW", "N"];
export const PLAYER_DISPLAY_HEIGHT = 192;
/** Runtime-only visual enlargement; source assets and animation frames are unchanged. */
export const PLAYER_SPRITE_SCALE = 1.2;
export const PLAYER_RENDER_SCALE = PLAYER_DISPLAY_HEIGHT / PLAYER_FRAME_HEIGHT;
export const PLAYER_FOOT_INSET = 3;
export const PLAYER_FOOT_ANCHOR = (PLAYER_FRAME_HEIGHT - PLAYER_FOOT_INSET) / PLAYER_FRAME_HEIGHT;

export function monsterDirection(dir: Dir8): { direction: MonsterSheetDir; flipX: boolean } {
  const mirrored: Partial<Record<Dir8, Dir8>> = { NW: "NE", W: "E", SW: "SE" };
  const mirroredDir = mirrored[dir];
  const resolved = { dir: mirroredDir ?? dir, flipX: mirroredDir !== undefined };
  const direction: MonsterSheetDir = resolved.dir === "S" ? "south" : resolved.dir === "SE" ? "southeast" :
    resolved.dir === "E" ? "east" : resolved.dir === "NE" ? "northeast" : "north";
  return { direction, flipX: resolved.flipX };
}

export function getMonsterFrame(dir: Dir8, frame: number): PlayerFrame {
  const { direction, flipX } = monsterDirection(dir);
  return { source: direction, frame: frame === 0 ? 0 : ((frame - 1) % PLAYER_MONSTER_WALK_FRAMES) + 1, flipX };
}

// Legacy atlas helpers remain source-compatible for non-rendering tooling.
export const PLAYER_ATLAS_KEY = "player-atlas";
export const PLAYER_ATLAS_PNG = "/assets/player/player.png";
export const PLAYER_ATLAS_JSON = "/assets/player/player.json";
export const PLAYER_ATLAS_COLS = 5;
export const PLAYER_ATLAS_ROWS = 5;
export function atlasFrameName(dir: Dir8, frame: number): string {
  return frame === 0 ? `idle_${dir}` : `walk_${dir}_${String((frame - 1) % PLAYER_WALK_FRAMES).padStart(2, "0")}`;
}
export function atlasFrameCell(source: string): { col: number; row: number } {
  const m = /^(idle|walk)_([A-Z]+)(?:_(\d+))?$/.exec(source);
  if (!m) throw new Error(`invalid atlas frame: ${source}`);
  const row = PLAYER_ATLAS_ROW_DIRS.indexOf(m[2] as Dir8);
  if (row < 0) throw new Error(`unsupported atlas direction: ${source}`);
  return { col: m[1] === "idle" ? 0 : Number(m[3]) + 1, row };
}
export function getPlayerFrame(dir: Dir8, frame: number): PlayerFrame {
  const resolved = resolveDir(dir);
  return { source: atlasFrameName(resolved.dir, frame) as unknown as MonsterSheetDir, flipX: resolved.flipX };
}
