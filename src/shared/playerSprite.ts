/** 플레이어 스프라이트의 방향과 프레임 고르기. 베이스캠프 씬과 공방이 같이 쓴다. */
export type Dir8 = "S" | "SE" | "E" | "NE" | "N" | "NW" | "W" | "SW";
export const DIRS_8: readonly Dir8[] = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];

export function dirFromVector(dx: number, dy: number): Dir8 {
  if (dx === 0 && dy === 0) return "S";
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return DIRS_8[Math.round(((90 - deg + 360) % 360) / 45) % 8];
}

export type MonsterSheetDir = "south" | "southeast" | "east" | "northeast" | "north";
export interface PlayerFrame { source: MonsterSheetDir; frame?: number; flipX: boolean; }

export const PLAYER_SHEET_KEYS: Record<MonsterSheetDir, string> = {
  south: "monster-south", southeast: "monster-southeast", east: "monster-east",
  northeast: "monster-northeast", north: "monster-north",
};
export const PLAYER_SHEET_PATHS: Record<MonsterSheetDir, string> = {
  south: "/assets/player/south.webp", southeast: "/assets/player/southeast.webp",
  east: "/assets/player/east.webp", northeast: "/assets/player/northeast.webp",
  north: "/assets/player/north.webp",
};

export const PLAYER_FRAME_WIDTH = 362;
export const PLAYER_FRAME_HEIGHT = 724;
/**
 * 북동만 칸이 작다. 원화가 다른 크기로 들어왔고 굳이 맞춰 늘리면 화질만 깎인다.
 *
 * 칸 폭은 **정수**여야 한다. 예전에 2048/6 = 341.33 이었는데, 칸 경계가 픽셀 사이에
 * 떨어지면 옆 칸 한 줄이 딸려 나온다. 마스터를 2052 로 맞춰 342 로 떨어뜨렸다.
 */
export const PLAYER_NORTHEAST_FRAME_WIDTH = 342;
export const PLAYER_NORTHEAST_FRAME_HEIGHT = 682;
/** 한 시트에 든 칸 수. 0번이 정지, 1~5번이 걷기다. 시트 폭은 이 수의 정수배여야 한다. */
export const PLAYER_SHEET_FRAMES = 6;
export const PLAYER_MONSTER_WALK_FRAMES = 5;
export const PLAYER_DISPLAY_HEIGHT = 192;
/** 화면에서만 키운다. 원화도 프레임 수도 그대로다. */
export const PLAYER_SPRITE_SCALE = 1.2;
export const PLAYER_RENDER_SCALE = PLAYER_DISPLAY_HEIGHT / PLAYER_FRAME_HEIGHT;
export const PLAYER_FOOT_INSET = 3;
export const PLAYER_FOOT_ANCHOR = (PLAYER_FRAME_HEIGHT - PLAYER_FOOT_INSET) / PLAYER_FRAME_HEIGHT;

/**
 * 방향 → 어느 시트를 쓰고 뒤집을지.
 *
 * 원화는 오른쪽을 보는 다섯 장(S·SE·E·NE·N)뿐이다. 서쪽 셋은 그걸 뒤집어 쓴다.
 * 예전 64px 아틀라스는 왼쪽을 보고 있어서 반대로 뒤집었는데, 그 시절 규칙이
 * resolveDir 이라는 이름으로 남아 있었다. 방향이 정반대라 둘을 같이 두면 어느
 * 화면이 무엇을 부르는지에 따라 인물이 반대쪽을 본다.
 */
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
