/**
 * 플레이어 스프라이트의 단일 출처.
 *
 * 지금까지 BaseCampScene(Phaser)과 WorkshopPage(React <img>)가 각자 다른 방식으로
 * 파일명을 조립하고 있었다. 8방향 에셋으로 갈아끼울 때 두 곳을 따로 고치면 반드시
 * 한쪽이 어긋나므로 여기로 모은다.
 *
 * 현재 에셋은 4방향 3프레임 개별 PNG다. 8방향 아틀라스가 도착하면
 * ASSET_MODE 를 "atlas" 로 바꾸고 아래 아틀라스 경로만 맞추면 된다 —
 * 호출부는 손대지 않는다. 교체 절차는 docs/ASSET_HANDOFF.md 참고.
 */

export type Dir8 = "S" | "SE" | "E" | "NE" | "N" | "NW" | "W" | "SW";
export type Dir4 = "down" | "right" | "up" | "left";

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

/** 8방향 → 가장 가까운 4방향. 대각선은 세로를 우선한다(걷는 모습이 덜 어색하다). */
export const DIR8_TO_DIR4: Record<Dir8, Dir4> = {
  S: "down", SE: "down", E: "right", NE: "up",
  N: "up",   NW: "up",   W: "left",  SW: "down",
};

/**
 * 좌우 반전으로 대체 가능한 방향.
 * SW/W/NW 는 SE/E/NE 를 뒤집어 쓴다 — 에셋 작업량이 40% 줄어든다.
 */
const MIRROR: Partial<Record<Dir8, Dir8>> = { SW: "SE", W: "E", NW: "NE" };

export interface PlayerFrame {
  /** <img src> 또는 Phaser 텍스처 키 */
  source: string;
  /** true 면 좌우 반전해서 그린다 */
  flipX: boolean;
}

/** 현재 보유 에셋. 8방향 아틀라스를 넣으면 "atlas" 로 바꾼다. */
const ASSET_MODE: "legacy4" | "atlas" = "legacy4";

export const PLAYER_ATLAS_KEY = "player-atlas";
export const PLAYER_ATLAS_PNG = "/assets/player/player.png";
export const PLAYER_ATLAS_JSON = "/assets/player/player.json";

/** 아틀라스 프레임 이름 규칙. Aseprite 태그명과 일치해야 한다. */
export function atlasFrameName(dir: Dir8, frame: number): string {
  return frame === 0
    ? `idle_${dir}`
    : `walk_${dir}_${String(frame - 1).padStart(2, "0")}`;
}

/**
 * 방향과 프레임에 해당하는 스프라이트.
 * frame 0 = 정지, 1 이상 = 걷기 프레임.
 *
 * 4방향 에셋만 있는 지금은 가장 가까운 4방향으로 접어서 돌려준다. 그래서 8방향을
 * 요청해도 화면이 깨지지 않는다 — 에셋을 넣기 전에 호출부를 먼저 바꿔도 안전하다.
 */
export function getPlayerFrame(dir: Dir8, frame: number): PlayerFrame {
  if (ASSET_MODE === "atlas") {
    const mirrored = MIRROR[dir];
    return {
      source: atlasFrameName(mirrored ?? dir, frame),
      flipX: mirrored !== undefined,
    };
  }

  const d4 = DIR8_TO_DIR4[dir];
  // 4방향 에셋은 walk 프레임이 1, 2 두 장뿐이라 그 안에서 순환시킨다
  const legacyFrame = frame === 0 ? 0 : ((frame - 1) % 2) + 1;
  return {
    source: legacyFrame === 0
      ? `/assets/player/player-${d4}.png`
      : `/assets/player/player-${d4}-${legacyFrame}.png`,
    flipX: false,
  };
}

/** Phaser 텍스처 키(개별 PNG를 키로 미리 로드해 둔 경우). */
export function getPlayerTextureKey(dir: Dir8, frame: number): string {
  const d4 = DIR8_TO_DIR4[dir];
  const legacyFrame = frame === 0 ? 0 : ((frame - 1) % 2) + 1;
  return legacyFrame === 0 ? `player-${d4}` : `player-${d4}-${legacyFrame}`;
}
