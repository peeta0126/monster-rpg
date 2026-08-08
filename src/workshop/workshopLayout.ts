import type { CraftingStationType } from "../shared/crafting";

/**
 * 공방 레이아웃 — 좌표는 전부 배경 이미지 기준 백분율(0~100)이다.
 * x 는 왼쪽→오른쪽, y 는 위→아래.
 *
 * 좌표는 배경 이미지에서 직접 측정하고 BFS 도달성 검사로 검증한 값이다.
 * 검증 결과: 걸을 수 있는 영역의 97.2% 가 하나로 연결. 스폰에서 제작대 3개 + 출입구 전부 도달 가능.
 * 수정 시 SHOW_COLLISION_DEBUG 를 켜고 반드시 눈으로 확인할 것.
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
export const PLAYER_BOUNDS = { minX: 5, maxX: 95, minY: 28, maxY: 96 };

/** 64x64 스프라이트의 정확히 2배. 비정수 배율은 픽셀을 깨뜨린다 */
export const PLAYER_DISPLAY = 128;

// ─── 충돌 박스 ───────────────────────────────────────────────────────────────

export const COLLISION_BOXES: CollisionBox[] = [
  { id: "top-wall",        x:  0, y:  0, width: 100, height: 27 },
  { id: "left-wall",       x:  0, y:  0, width:   5, height: 100 },
  { id: "right-wall",      x: 95, y:  0, width:   5, height: 100 },

  // ⚠️ 아래쪽 벽이 L/R 두 조각인 것은 의도다. x 39~60 이 비어 있어야 출입구까지
  //    걸어갈 수 있다. 하나로 합치면 문 앞에서 막힌다.
  { id: "bottom-wall-L",   x:  0, y: 93, width:  39, height:   7 },
  { id: "bottom-wall-R",   x: 60, y: 93, width:  40, height:   7 },

  { id: "fireplace",       x:  4, y:  0, width:  18, height:  31 },
  { id: "anvil",           x: 20, y: 30, width:  11, height:  14 },
  { id: "log-pile",        x:  4, y: 31, width:  17, height:  21 },
  { id: "barrels",         x:  4, y: 46, width:  21, height:  32 },
  { id: "barrel-single",   x:  4, y: 77, width:   9, height:  16 },
  { id: "artifact-bench",  x: 14, y: 76, width:  22, height:  17 },
  { id: "alchemy-table",   x: 66, y: 28, width:  22, height:  13 },
  { id: "bed",             x: 84, y: 48, width:  12, height:  14 },
  { id: "tree-pot",        x: 84, y: 58, width:  13, height:  30 },
  { id: "lavender-pot",    x: 79, y: 73, width:   9, height:  15 },
  { id: "chest",           x: 67, y: 78, width:  12, height:  15 },

  // ⚠️ 러그(대략 x 35~64, y 42~62)에는 충돌 박스가 없다. 통과 가능해야 한다.
];

// ─── 제작대 ──────────────────────────────────────────────────────────────────

export const CRAFTING_STATIONS: StationDef[] = [
  { id: "anvil",              label: "장비 모루",       type: "anvil",    x: 26, y: 38, radius: 11 },
  { id: "artifact-workbench", label: "아티팩트 제작대", type: "artifact", x: 25, y: 80, radius: 11 },
  { id: "alchemy-workbench",  label: "연금술 제작대",   type: "potion",   x: 76, y: 36, radius: 12 },
];

// ─── 출입구 ──────────────────────────────────────────────────────────────────

/** 배경 아래 중앙의 돌 문턱 + 도어매트 */
export const EXIT_ZONE: ZoneDef = { id: "exit", label: "밖으로 나가기", x: 50, y: 95, radius: 7 };

// ─── 디버그 ──────────────────────────────────────────────────────────────────

/** true 로 켜면 충돌 박스 + 판정 원 표시 */
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

/** COLLISION_BOXES 중 하나라도 포함하면 true */
export function isBlocked(pt: Point): boolean {
  return COLLISION_BOXES.some((box) => isInsideBox(pt, box));
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
