/**
 * 플레이어 스프라이트의 단일 출처.
 *
 * BaseCampScene(Phaser)과 WorkshopPage(React)가 각자 프레임을 고르면 반드시
 * 한쪽이 어긋난다. 방향·반전·프레임 번호를 여기서만 정한다.
 *
 * 에셋은 8방향 아틀라스 한 장이다. 실제로 그려진 방향은 다섯 줄(S·SE·E·NE·N)이고
 * 서쪽 셋은 좌우 반전으로 만든다. 규격은 docs/ASSET_HANDOFF.md 참고.
 */

export type Dir8 = "S" | "SE" | "E" | "NE" | "N" | "NW" | "W" | "SW";

/** 시계 방향. dirFromVector 의 각도 버킷 순서와 같아야 한다. */
export const DIRS_8: readonly Dir8[] = ["S", "SE", "E", "NE", "N", "NW", "W", "SW"];

/**
 * 이동 벡터 → 8방향.
 *
 * 화면 좌표계라 +y 가 아래(남쪽)다. atan2(dy, dx) 는 동쪽이 0°, 남쪽이 +90° 이므로
 * 남쪽을 0번 버킷에 맞춰 45° 단위로 반올림한다.
 * 벡터가 0이면 방향을 정할 수 없으므로 정면(S)을 준다.
 */
export function dirFromVector(dx: number, dy: number): Dir8 {
  if (dx === 0 && dy === 0) return "S";
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;   // E=0, S=+90, W=±180, N=-90
  // DIRS_8 는 S에서 시작해 SE→E→NE 순, 즉 각도가 줄어드는 방향으로 나열돼 있다.
  // (deg - 90)으로 잡으면 순서가 뒤집혀 SE와 SW가 바뀐다.
  const idx = Math.round(((90 - deg + 360) % 360) / 45) % 8;
  return DIRS_8[idx];
}

/**
 * 좌우 반전으로 대체 가능한 방향.
 * SW/W/NW 는 SE/E/NE 를 뒤집어 쓴다 — 에셋 작업량이 40% 줄어든다.
 */
const MIRROR: Partial<Record<Dir8, Dir8>> = { SW: "SE", W: "E", NW: "NE" };

/**
 * 그릴 때 실제로 쓸 방향과 반전 여부.
 *
 * Phaser 는 프레임 이름 대신 애니메이션 키가 필요해서 `getPlayerFrame` 만으로는
 * 부족하다. 반전 규칙이 두 벌이 되지 않도록 여기 한 번만 적는다.
 */
export function resolveDir(dir: Dir8): { dir: Dir8; flipX: boolean } {
  const mirrored = MIRROR[dir];
  return { dir: mirrored ?? dir, flipX: mirrored !== undefined };
}

export interface PlayerFrame {
  /** 아틀라스 프레임 이름 */
  source: string;
  /** true 면 좌우 반전해서 그린다 */
  flipX: boolean;
}

export const PLAYER_ATLAS_KEY = "player-atlas";
export const PLAYER_ATLAS_PNG = "/assets/player/player.png";
export const PLAYER_ATLAS_JSON = "/assets/player/player.json";

/** 아틀라스 한 칸(px). 바디 오프셋·발끝 계산이 전부 이 값에 걸려 있다. */
export const PLAYER_FRAME_SIZE = 80;

/**
 * 프레임 아래쪽의 빈 여백(texture px). 인물이 칸에 꽉 차 있어서 발끝은 아래에서
 * 두 번째 줄이다. 발밑 충돌 박스와 그림자가 이 값에 걸려 있다.
 */
export const PLAYER_FOOT_INSET = 2;

/** 프레임 위에서 발끝이 있는 높이(0~1). 발밑을 좌표 기준점으로 삼을 때 쓴다. */
export const PLAYER_FOOT_ANCHOR = (PLAYER_FRAME_SIZE - PLAYER_FOOT_INSET) / PLAYER_FRAME_SIZE;

/** 걷기 프레임 수. 아틀라스 한 줄은 idle 1 + walk 4 칸이다. */
export const PLAYER_WALK_FRAMES = 4;

/** 아틀라스 격자. 줄 순서가 곧 방향 순서다(반전으로 만드는 3방향은 없다). */
export const PLAYER_ATLAS_ROW_DIRS: readonly Dir8[] = ["S", "SE", "E", "NE", "N"];
export const PLAYER_ATLAS_COLS = 1 + PLAYER_WALK_FRAMES;
export const PLAYER_ATLAS_ROWS = PLAYER_ATLAS_ROW_DIRS.length;

/** 아틀라스 프레임 이름 규칙. Aseprite 태그명과 일치해야 한다. */
export function atlasFrameName(dir: Dir8, frame: number): string {
  return frame === 0
    ? `idle_${dir}`
    : `walk_${dir}_${String(frame - 1).padStart(2, "0")}`;
}

/** 걷기 프레임 번호를 아틀라스가 가진 4장 안으로 접는다. 0(정지)은 그대로 둔다. */
export function walkFrameIndex(frame: number): number {
  return frame === 0 ? 0 : ((frame - 1) % PLAYER_WALK_FRAMES) + 1;
}

/**
 * 프레임 이름 → 아틀라스 격자 칸.
 *
 * <img> 로 그리는 공방은 Phaser 처럼 이름으로 프레임을 찾을 수 없어서 좌표가 필요하다.
 * 이름에서 되짚는 이유는, 이미 반전까지 적용된 `getPlayerFrame().source` 를 그대로
 * 넘겨 받기 위해서다 — 방향을 두 번 해석하면 한쪽만 어긋난다.
 */
export function atlasFrameCell(source: string): { col: number; row: number } {
  const m = /^(idle|walk)_([A-Z]+)(?:_(\d+))?$/.exec(source);
  if (!m) throw new Error(`아틀라스 프레임 이름이 아니다: ${source}`);
  const row = PLAYER_ATLAS_ROW_DIRS.indexOf(m[2] as Dir8);
  if (row < 0) throw new Error(`아틀라스에 없는 방향이다: ${source}`);
  return { col: m[1] === "idle" ? 0 : Number(m[3]) + 1, row };
}

/**
 * 방향과 프레임에 해당하는 아틀라스 프레임.
 * frame 0 = 정지, 1 이상 = 걷기 프레임(네 장을 순환한다).
 */
export function getPlayerFrame(dir: Dir8, frame: number): PlayerFrame {
  const resolved = resolveDir(dir);
  return {
    source: atlasFrameName(resolved.dir, walkFrameIndex(frame)),
    flipX: resolved.flipX,
  };
}
