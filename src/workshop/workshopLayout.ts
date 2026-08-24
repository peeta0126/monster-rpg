import type { CraftingStationType } from "../shared/crafting";

/**
 * 공방 레이아웃 — 좌표는 전부 배경 이미지 기준 백분율(0~100)이다.
 * x 는 왼쪽→오른쪽, y 는 위→아래.
 *
 * 좌표는 배경 이미지에서 직접 측정하고 BFS 도달성 검사로 검증한 값이다.
 * 스폰에서 제작대 3개 + 출입구 전부 도달 가능(tests/workshopLayout.test.ts).
 *
 * 고친 뒤에는 `npm run design:collision` 으로 원화 위에 겹쳐 찍어 눈으로 확인할 것.
 * 게임 안에서는 개발자 모드로 들어가면 같은 형상이 빨간 선으로 보인다(F9 로 껐다 켠다).
 */

// ─── 배경 규격 ───────────────────────────────────────────────────────────────
// 이전 배경은 835x714(≈1.1695)였다. 비율이 바뀌었으니 이 값을 쓰는 계산을 전부 갱신해야 한다.

export const BG_W = 2400;
export const BG_H = 1792;
export const BG_RATIO = BG_W / BG_H; // ≈ 1.3393

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface CollisionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 제작 스테이션 타입 + 모루. 모루는 제작 레시피가 아니라 장비 강화라 CraftingStationType 밖에 있다. */
export type WorkshopStationType = CraftingStationType | "anvil";

export interface StationDef {
  id: string;
  label: string;
  type: WorkshopStationType;
  x: number;
  y: number;
  /** 근접 판정 반경 (% 단위) */
  radius: number;
}

export interface ZoneDef {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
}

// ─── 플레이어 ────────────────────────────────────────────────────────────────

/** 출입구 매트 바로 위 */
export const INITIAL_POS: Point = { x: 50, y: 91 };

/** 스테이지 밖으로 나가지 못하게 하는 외곽 제한 */
export const PLAYER_BOUNDS = { minX: 5, maxX: 96.5, minY: 28, maxY: 96 };

/**
 * 플레이어 한 칸의 크기 — 무대 높이의 백분율이다.
 *
 * 고정 px 로 두면 창을 줄였을 때 방만 작아지고 사람은 그대로라 비율이 깨진다.
 * 값은 배경 원화(높이 1792px)에서 잰 것이다: 한 칸 441px, 그 안의 인물이 430px.
 */
export const PLAYER_DISPLAY_RATIO = 441 / BG_H;

// ─── 충돌 박스 ───────────────────────────────────────────────────────────────

/** 걸을 수 있는 바닥의 테두리 한 줄. 좌표는 % 다. `t` 는 선 두께(%). */
export interface WallSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t?: number;
}

/**
 * 기본 선 두께(%).
 *
 * 한 프레임에 움직이는 거리(SPEED 0.4%/16ms, dt 는 50ms 로 잘려 있으니 최대 1.25%)
 * 보다 얇아도 된다 — 발밑 상자(3.2×1.8%)가 선보다 크니 뚫고 지나가려면 한 프레임에
 * 2.8% 이상 움직여야 한다. 대신 선 위에 반, 아래에 반이 걸리므로 물건 경계보다
 * 0.5% 만큼 일찍 막힌다. 그 정도가 물건에 몸이 닿는 자리다.
 */
const SEGMENT_THICKNESS = 1;

/**
 * 방을 두르는 테두리.
 *
 * 베이스캠프(`campCollision.ts`)와 같은 방식이다 — 물체마다 사각형을 씌우지 않고
 * **걸을 수 있는 바닥의 바깥선**을 긋는다. 물체 스무 개를 따로 잡으면 어느 상자가
 * 어디를 막는지 알 수 없게 되고, 상자 사이에 낀 못 쓰는 틈이 생긴다.
 *
 * 방 바깥 테두리(위·좌·우)는 `PLAYER_BOUNDS` 가 이미 막고 있어 줄이 없다.
 * 아래쪽만 줄로 긋는다 — 출입구 틈(x 39~60)을 남겨야 하기 때문이다.
 *
 * 벽난로 앞(x 5~19.5, y 31~38.5)은 벽난로·모루·장작더미에 둘러싸여 들어갈 길이
 * 없다. 원화에서도 그렇다. 그래서 그 안쪽에는 줄을 긋지 않는다 — 못 가는 곳에
 * 벽을 세워 봐야 읽을 것만 늘어난다.
 */
export const WALL_SEGMENTS: WallSegment[] = [
  // ─── 아래쪽 벽과 출입구 ───────────────────────────────────────────────────
  // ⚠️ x 39~60 이 비어 있어야 출입구 매트까지 걸어 내려갈 수 있다. 두 줄을 하나로
  //    이으면 문 앞에서 막힌다. 문설주 두 줄이 그 틈의 좌우를 막는다.
  { id: "floor-s-w",  x1:   5, y1: 93, x2: 39,   y2: 93 },
  { id: "floor-s-e",  x1:  60, y1: 93, x2: 96.5, y2: 93 },
  { id: "door-jamb-w", x1: 39, y1: 93, x2: 39,   y2: 96 },
  { id: "door-jamb-e", x1: 60, y1: 93, x2: 60,   y2: 96 },

  // ─── 서쪽 덩어리: 벽난로 · 모루 · 장작더미 · 통 무더기 · 아티팩트 제작대 ──
  // 위에서 아래로 한 줄기다. 모루 위 복도(y 27~30.5)는 열어 둔다 — 벽을 따라
  // 걸을 수 있는 바닥이고, 서쪽 끝은 벽난로가 막는다.
  { id: "fireplace-e",     x1: 22,   y1: 27,   x2: 22,   y2: 31 },
  { id: "anvil-n",         x1: 19.5, y1: 30.5, x2: 31.5, y2: 30.5 },
  { id: "anvil-e",         x1: 31.5, y1: 30.5, x2: 31.5, y2: 44 },
  { id: "anvil-s",         x1: 31.5, y1: 44,   x2: 26.5, y2: 44 },
  // 통 무더기는 직사각형이 아니다. 오른쪽으로 한 줄 튀어나와 있어 두 번 꺾인다.
  { id: "barrels-right-e", x1: 26.5, y1: 44,   x2: 26.5, y2: 66 },
  { id: "barrels-right-s", x1: 26.5, y1: 66,   x2: 20.5, y2: 66 },
  { id: "barrels-e",       x1: 20.5, y1: 66,   x2: 20.5, y2: 73 },
  { id: "barrels-s",       x1: 20.5, y1: 73,   x2: 13,   y2: 73 },
  { id: "barrel-single-e", x1: 13,   y1: 73,   x2: 13,   y2: 76 },
  { id: "bench-n",         x1: 13,   y1: 76,   x2: 36,   y2: 76 }, // 아티팩트 제작대
  { id: "bench-e",         x1: 36,   y1: 76,   x2: 36,   y2: 93 },

  // ─── 북쪽 벽에 붙은 것 ────────────────────────────────────────────────────
  // 책장은 벽선(y 27) 아래로 5% 튀어나와 있다. 없으면 책장 하단을 뚫고 지나간다.
  { id: "bookshelf-w", x1: 42.5, y1: 27,   x2: 42.5, y2: 32 },
  { id: "bookshelf-s", x1: 42.5, y1: 32,   x2: 58,   y2: 32 },
  { id: "bookshelf-e", x1: 58,   y1: 32,   x2: 58,   y2: 27 },
  // 연금술 제작대는 책장과 달리 상판이 깊어 y 41 까지 내려온다. 상판 앞(남쪽)이
  // 바닥이므로 아랫변으로 긋는다 — 윗변으로 그으면 탁자 위를 걸어 다닌다.
  { id: "alchemy-w",   x1: 67.5, y1: 27, x2: 67.5, y2: 41 },
  { id: "alchemy-s",   x1: 67.5, y1: 41, x2: 87.5, y2: 41 },
  { id: "alchemy-e",   x1: 87.5, y1: 41, x2: 87.5, y2: 27 },

  // ─── 동쪽 덩어리: 침대 · 화분 둘 · 궤짝 ───────────────────────────────────
  { id: "bed-n",       x1: 96.5, y1: 48, x2: 84,   y2: 48 },
  { id: "bed-pot-w",   x1: 84,   y1: 48, x2: 84,   y2: 74 }, // 침대 + 나무 화분
  { id: "lavender-n",  x1: 84,   y1: 74, x2: 79.5, y2: 74 },
  { id: "lavender-w",  x1: 79.5, y1: 74, x2: 79.5, y2: 91 },
  { id: "lavender-s",  x1: 79.5, y1: 91, x2: 78,   y2: 91 }, // 궤짝과의 1.5% 틈을 막는다
  { id: "chest-e",     x1: 78,   y1: 91, x2: 78,   y2: 80 },
  { id: "chest-n",     x1: 78,   y1: 80, x2: 68,   y2: 80 },
  { id: "chest-w",     x1: 68,   y1: 80, x2: 68,   y2: 93 },

  // ⚠️ 러그(대략 x 35~64, y 42~62) 위에는 아무 줄도 없다. 통과 가능해야 한다.
];

/**
 * 선분 → 축에 정렬된 사각형. 이동 판정과 디버그 표시가 보는 것은 이쪽이다.
 *
 * 비스듬한 줄은 아직 없다. 생기면 베이스캠프의 `segmentBoxes` 처럼 두께만 한
 * 정사각형을 늘어놓아야 한다 — 여기서는 그때 가서 늘릴 것.
 */
function segmentBoxes(segments: readonly WallSegment[]): CollisionBox[] {
  return segments.map((s) => {
    const t = s.t ?? SEGMENT_THICKNESS;
    const x1 = Math.min(s.x1, s.x2), x2 = Math.max(s.x1, s.x2);
    const y1 = Math.min(s.y1, s.y2), y2 = Math.max(s.y1, s.y2);
    const horizontal = x2 - x1 >= y2 - y1;
    return horizontal
      ? { id: s.id, x: x1, y: y1 - t / 2, width: x2 - x1, height: t }
      : { id: s.id, x: x1 - t / 2, y: y1, width: t, height: y2 - y1 };
  });
}

/** 페이지·테스트·오버레이가 전부 이 배열 하나만 본다. */
export const COLLISION_BOXES: CollisionBox[] = segmentBoxes(WALL_SEGMENTS);

/**
 * 플레이어 발밑 판정 상자의 반지름(스테이지 % 기준).
 *
 * 예전에는 좌표 한 점으로만 충돌을 봤다. 스프라이트는 128px(스테이지 폭의 약 7%)라,
 * 점이 박스 밖이면 몸통 절반이 통 안에 들어가 있어도 통과했다. 발밑을 작은 상자로
 * 잡으면 스프라이트가 가구에 파묻히지 않는다.
 *
 * x/y 비율이 다른 이유: 스테이지가 4:3 이라 1% 의 실제 길이가 가로세로 다르다.
 */
export const PLAYER_FOOT = { halfW: 1.6, halfH: 0.9 };

// ─── 제작대 ──────────────────────────────────────────────────────────────────

export const CRAFTING_STATIONS: StationDef[] = [
  { id: "anvil",              label: "장비 모루",       type: "anvil",    x: 26, y: 38, radius: 11 },
  // ⚠️ 중심을 제작대 오른쪽으로 밀어 뒀다. 한가운데(x 25)에 두면 오른쪽 빈 바닥에서
  //    닿지 않아, 제작대와 통 무더기 사이 1% 짜리 틈으로 비집고 들어가야만 쓸 수 있다.
  { id: "artifact-workbench", label: "아티팩트 제작대", type: "artifact", x: 30, y: 79, radius: 11 },
  { id: "alchemy-workbench",  label: "연금술 제작대",   type: "potion",   x: 76, y: 36, radius: 12 },
];

// ─── 출입구 ──────────────────────────────────────────────────────────────────

/** 배경 아래 중앙의 돌 문턱 + 도어매트 */
export const EXIT_ZONE: ZoneDef = { id: "exit", label: "밖으로 나가기", x: 50, y: 95, radius: 7 };

// ─── 디버그 ──────────────────────────────────────────────────────────────────

/**
 * 개발자 모드가 아니어도 충돌 박스를 강제로 켜는 스위치.
 * 평소에는 개발자 코드로 들어와 F9 로 켜는 쪽을 쓴다(`shared/collisionDebug.ts`).
 */
export const SHOW_COLLISION_DEBUG = false;
/** true 로 켜면 마우스 좌표 십자선 표시 */
export const SHOW_INTERACTION_DEBUG = false;

// ─── 유틸 ────────────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

export function isInsideBox(pt: Point, box: CollisionBox): boolean {
  return (
    pt.x >= box.x &&
    pt.x <= box.x + box.width &&
    pt.y >= box.y &&
    pt.y <= box.y + box.height
  );
}

/** 점 하나가 박스 안인지. 박스 형상 자체를 검사할 때 쓴다. */
export function isBlocked(pt: Point): boolean {
  return COLLISION_BOXES.some((box) => isInsideBox(pt, box));
}

/**
 * 플레이어가 그 자리에 설 수 있는지 — 점이 아니라 발밑 상자로 본다.
 * 이동 루프와 경로 탐색은 전부 이걸 써야 한다. `isBlocked` 를 쓰면 몸통이
 * 가구를 파고든 채로도 통과해 버린다.
 */
export function isPlayerBlocked(pt: Point): boolean {
  const { halfW, halfH } = PLAYER_FOOT;
  return COLLISION_BOXES.some(
    (b) =>
      pt.x + halfW > b.x && pt.x - halfW < b.x + b.width &&
      pt.y + halfH > b.y && pt.y - halfH < b.y + b.height,
  );
}

export function distanceTo(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export interface Interactable {
  kind: "station" | "exit";
  def: StationDef | ZoneDef;
  dist: number;
}

/**
 * 지금 위치에서 상호작용할 대상. 제작대가 우선이고, 없을 때만 출입구를 본다.
 * 제작대끼리 겹치는 경우는 없지만(테스트로 지킨다) 그래도 가장 가까운 것을 고른다.
 *
 * 호출부는 이 함수만 쓰고 제작대/출입구를 따로 분기하지 않는다 — 우선순위 규칙이
 * 여러 군데로 흩어지면 한쪽만 고쳐서 어긋난다.
 */
export function findInteractable(pos: Point): Interactable | null {
  let best: Interactable | null = null;
  for (const s of CRAFTING_STATIONS) {
    const dist = distanceTo(pos, s);
    if (dist <= s.radius && (!best || dist < best.dist)) best = { kind: "station", def: s, dist };
  }
  if (best) return best;

  const exitDist = distanceTo(pos, EXIT_ZONE);
  if (exitDist <= EXIT_ZONE.radius) return { kind: "exit", def: EXIT_ZONE, dist: exitDist };

  return null;
}
