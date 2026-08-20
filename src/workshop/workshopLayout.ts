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

export const COLLISION_BOXES: CollisionBox[] = [
  { id: "top-wall",        x:  0, y:    0, width: 100, height: 27 },
  { id: "left-wall",       x:  0, y:    0, width:   5, height: 100 },
  { id: "right-wall",      x: 96.5, y:  0, width: 3.5, height: 100 },

  // ⚠️ 아래쪽 벽이 L/R 두 조각인 것은 의도다. x 39~60 이 비어 있어야 출입구까지
  //    걸어갈 수 있다. 하나로 합치면 문 앞에서 막힌다.
  { id: "bottom-wall-L",   x:  0, y:   93, width:  39, height:   7 },
  { id: "bottom-wall-R",   x: 60, y:   93, width:  40, height:   7 },

  { id: "fireplace",       x:  4, y:    0, width:  18, height:  31 },
  // 책장은 벽선(y 27) 아래로 4.5% 튀어나와 있다. 없으면 책장 하단을 뚫고 지나간다.
  { id: "bookshelf",       x: 42.5, y:  26, width:  15.5, height: 6 },
  { id: "anvil",           x: 19.5, y: 30.5, width: 12, height: 13.5 },

  // 장작더미와 벽난로 사이(y 31~38.5)는 실제로 비어 있는 바닥이다. 예전엔 여기까지
  // 막혀 있어서 벽난로 앞에 설 수 없었다.
  { id: "log-pile",        x:  4, y: 38.5, width: 15.5, height: 10 },
  { id: "barrels",         x:  4, y: 46.5, width: 16.5, height: 26.5 },
  // 통 무더기는 직사각형이 아니다. 오른쪽으로 튀어나온 한 줄만 따로 덮는다 —
  // 하나로 합치면 그 아래(x 20~26, y 64~74)의 빈 바닥까지 막힌다.
  { id: "barrels-right",   x: 18.5, y: 46, width: 8, height: 20 },
  { id: "barrel-single",   x:  4, y:   77, width:   9, height:  16 },
  { id: "artifact-bench",  x: 14, y:   76, width:  22, height:  17 },
  { id: "alchemy-table",   x: 67.5, y: 29.5, width: 20, height: 11.5 },
  { id: "bed",             x: 84, y:   48, width:  12, height:  14 },
  // 화분은 아래쪽 테두리까지 막아야 한다. 예전엔 y 88 에서 끊겨 화분 밑동을 밟았다.
  { id: "tree-pot",        x: 84, y:   60, width:  13, height: 31.5 },
  { id: "lavender-pot",    x: 79.5, y:  74, width:   9, height:  17 },
  { id: "chest",           x: 68, y:   80, width:  10, height: 11.5 },

  // ⚠️ 러그(대략 x 35~64, y 42~62)에는 충돌 박스가 없다. 통과 가능해야 한다.
];

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
