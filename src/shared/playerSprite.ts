/** Shared direction and frame selection for the player renderer. */
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
  south: "/assets/player/남.png", southeast: "/assets/player/남동.png",
  east: "/assets/player/동.png", northeast: "/assets/player/북동.png", north: "/assets/player/북.png",
};

export const PLAYER_SHEET_FRAMES = 6;
export const PLAYER_MONSTER_WALK_FRAMES = 5;

/**
 * 시트 한 벌의 치수. 원본 PNG 에서 잰 값이다 — `node scripts/measure-player-sheets.mjs`
 * 가 이 표를 그대로 찍어 준다. 원화를 갈아끼웠으면 돌려서 고칠 것.
 *
 * 두 가지가 시트마다 다르고, 둘 다 예전에 사고를 냈다.
 *
 * · **한 칸 크기.** 북동만 2048×682 다. Phaser 는 `displayOrigin` 을 칸 크기에서
 *   뽑으므로, 텍스처만 갈아끼우면 물리 바디가 그 차이만큼 순간이동한다. 집 문 위
 *   벽으로 7px 밀려 들어갔다가 밖으로 튕겨 나가서, 벽을 뚫고 나간 뒤에는 반대편에서
 *   막혀 다시 못 돌아왔다. 그래서 `spriteOriginY` 로 그리는 기준을 같이 옮긴다.
 *
 * · **발이 닿는 줄(`footY`).** 원화는 칸을 꽉 채우지 않는다 — 발밑에 80~130px 씩
 *   빈 자리가 남고 그 크기가 방향마다 다르다. 칸 아래를 발로 치면 캐릭터가 그만큼
 *   공중에 뜬 채로 걷고(공방에서 38px), 방향을 바꿀 때마다 위아래로 튄다.
 *
 * `footY` 는 정지 프레임(0번) 기준이다. 걷는 동안 몇 px 더 내려가는 것은 원화에
 * 구워진 상하 반동이라 평평하게 펴지 말 것 — 그게 걷는 느낌을 만든다.
 */
export interface PlayerSheetMetrics {
  /** 한 칸 폭. 시트 폭을 여섯으로 나눈 몫이다(나머지는 칸마다 남는 투명 여백으로 간다) */
  frameWidth: number;
  frameHeight: number;
  /** 칸 위에서 신발 바닥까지(원본 px) */
  footY: number;
}

export const PLAYER_SHEET_METRICS: Record<MonsterSheetDir, PlayerSheetMetrics> = {
  south:     { frameWidth: 361, frameHeight: 725, footY: 597 },
  southeast: { frameWidth: 362, frameHeight: 724, footY: 640 },
  east:      { frameWidth: 362, frameHeight: 724, footY: 631 },
  northeast: { frameWidth: 341, frameHeight: 682, footY: 593 },
  north:     { frameWidth: 362, frameHeight: 724, footY: 626 },
};

/** 화면에 그리는 크기를 정하는 기준 칸. 다른 시트도 이 배율로 같이 커진다. */
export const PLAYER_FRAME_WIDTH = PLAYER_SHEET_METRICS.south.frameWidth;
export const PLAYER_FRAME_HEIGHT = PLAYER_SHEET_METRICS.south.frameHeight;

/** 씬이 한 칸을 이 높이로 그린다. 시트 원본 높이를 여기에 맞추는 배율이 PLAYER_RENDER_SCALE. */
export const PLAYER_DISPLAY_HEIGHT = 192;
/** Runtime-only visual enlargement; source assets and animation frames are unchanged. */
export const PLAYER_SPRITE_SCALE = 1.2;
export const PLAYER_RENDER_SCALE = PLAYER_DISPLAY_HEIGHT / PLAYER_FRAME_HEIGHT;

/**
 * 스프라이트 기준점에서 발까지(원본 px). 정면 시트가 기준이고 방향이 바뀌어도 안 변한다.
 *
 * 이 한 값이 그리는 자리(`spriteOriginY`)와 발밑 판정(`campCollision.playerBodyOffset`)
 * 을 같이 정한다. 두 곳에 따로 적으면 그림과 판정이 어긋나고, 그게 벽 위를 걷는
 * 것처럼 보이는 고장이다.
 */
export const PLAYER_FOOT_FROM_ORIGIN =
  PLAYER_SHEET_METRICS.south.footY - PLAYER_SHEET_METRICS.south.frameHeight / 2;

/**
 * 시트마다 다른 그리기 기준점(세로). 정면은 정확히 한가운데(0.5)고, 나머지는 자기
 * 발이 같은 자리에 오도록 밀린다. 칸 크기가 달라도 이 값이 흡수한다.
 */
export function spriteOriginY(dir: MonsterSheetDir): number {
  const m = PLAYER_SHEET_METRICS[dir];
  return (m.footY - PLAYER_FOOT_FROM_ORIGIN) / m.frameHeight;
}

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
