import { CAMP_GROUND_RECTS } from "./campGroundMask";

/**
 * 베이스캠프 충돌.
 *
 * 좌표는 basecamp-bg.webp 원본(1536×2730) 기준 픽셀이고, 사각형은 왼쪽 위 모서리
 * 기준이다(공방 `workshopLayout.ts` 와 같은 규약).
 *
 * ── 두 벌로 나뉘어 있다 ──────────────────────────────────────────────────────
 *
 * 1. **지형** (`campGroundMask.ts`, 자동 생성)
 *    배경이 두 장이다. `basecamp-bg`(depth 0)가 장면 전체고, `basecamp-bg-1`
 *    (depth 3000)은 바닥만 도려낸 같은 그림이라 플레이어 위에 덮인다. 그래서 나무·
 *    처마·아치 쪽으로 들어가면 그 뒤로 가려진다 — 이미지 위를 지나가는 게 아니라
 *    안으로 들어가는 것처럼 보인다. 그 범위를 손으로 적으면 반드시 어긋나므로
 *    전경 레이어의 알파에서 뽑는다. `node scripts/gen-camp-collision.mjs`.
 *
 * 2. **소품** (아래 `CAMP_PROP_BOXES`, 손으로 잰 값)
 *    바닥 구멍 안에 있는 물건들 — 작업대·화단·좌판 바구니·통나무. 이것들은 전경이
 *    아니라 배경 레이어에 있어서 플레이어가 그 위에 그려진다. 가려지지 않으니
 *    올라서면 어색하다. 알파로는 구분이 안 되므로 여기서 덮는다.
 *
 * 고친 뒤에는 `npm run design:collision` 으로 배경 위에 겹쳐 찍어 확인할 것.
 * 게임 안에서는 개발자 모드로 들어가면 같은 형상이 빨간 선으로 보인다(F9 토글).
 */

export const CAMP_MAP_W = 1536;
export const CAMP_MAP_H = 2730;

export interface CampBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 플레이어 물리 바디(월드 px). 스프라이트는 160×160 이지만 막히는 건 발밑뿐이다 —
 * 탑다운 반투시 배경이라 머리는 물체 뒤로 지나가야 자연스럽다.
 */
export const PLAYER_BODY = { w: 60, h: 30 };

/** 64px 스프라이트 아래쪽의 빈 여백(texture px). 발끝은 y=58 이라 6px 이 남는다. */
export const PLAYER_FOOT_INSET = 6;

/** 씬이 스프라이트에 먹이는 배율. 여기 두는 이유는 바디 오프셋 계산이 이 값에 걸려서다. */
export const PLAYER_SCALE = 2.5;

/** 64×64 원본 기준 바디 오프셋. 씬의 `body.setOffset` 이 그대로 쓴다. */
export const PLAYER_BODY_OFFSET = {
  x: (64 - PLAYER_BODY.w / PLAYER_SCALE) / 2,
  y: 64 - PLAYER_BODY.h / PLAYER_SCALE - PLAYER_FOOT_INSET,
};

/**
 * 스프라이트 중심 y → 발밑 바디 중심 y.
 *
 * 상호작용 거리(`E`)는 스프라이트 중심으로 재고 충돌은 발밑으로 잰다. 두 좌표계를
 * 오갈 일이 테스트·오버레이 양쪽에 있어서 변환을 여기 한 번만 적어 둔다.
 */
export function bodyYFromSpriteY(spriteY: number): number {
  return spriteY + (PLAYER_BODY_OFFSET.y + PLAYER_BODY.h / PLAYER_SCALE / 2 - 32) * PLAYER_SCALE;
}

/**
 * 바닥 구멍 안에 서 있는 물건들.
 *
 * 판단 기준은 하나다 — **플레이어가 그 위에 그려지는가.** 전경 레이어에 있는 것
 * (건물·나무·우물 구조물·아치 기둥)은 플레이어를 가려 주므로 여기 없다. 지형
 * 마스크가 알아서 막고, 가장자리 40px 은 일부러 열어 둬서 그 뒤로 걸어 들어갈 수 있다.
 *
 * 반대로 여기 적힌 것들은 배경 레이어라 플레이어가 위에 얹힌다. 작업대 위에 서 있는
 * 그림이 되므로 막아야 한다.
 */
export const CAMP_PROP_BOXES: CampBox[] = [
  // ─── 집 앞마당 ────────────────────────────────────────────────────────────
  // 집 정면 벽·문짝은 구멍 안이라 마스크가 안 막는다. 문 앞 잔디(y≥1237)까지만 걷는다.
  // ⚠️ 왼쪽 끝을 x 470 까지 늘리면 안 된다. 굴뚝 박스와 맞물려 탑 가는 길에서 광장으로
  //    나오는 통로가 5px 로 좁아진다 — 사실상 막힌다.
  { id: "house-front",   x: 560, y:  790, w:  350, h:  447 },
  { id: "house-corner",  x: 430, y:  760, w:  140, h:  200 }, // 집 서쪽 벽돌 굴뚝·돌축대
  { id: "stone-steps",   x: 880, y:  860, w:  175, h:  390 },
  { id: "garden-pots",   x: 350, y:  895, w:  200, h:  165 }, // 델피니움 화분 + 장미 화분
  // 기대 놓은 삽은 일부러 뺐다. 얇은 소품 하나 때문에 탑 가는 길이 57px 로 좁아진다.
  { id: "garden-table",  x: 344, y: 1035, w:  158, h:  110 },
  { id: "garden-planter",x: 498, y: 1073, w:  150, h:  132 }, // 라벤더 화단

  // ─── 우물 앞마당 ──────────────────────────────────────────────────────────
  { id: "well-chimney",  x: 336, y: 1252, w:   90, h:  105 },
  { id: "well-barrel",   x: 462, y: 1462, w:  115, h:  195 },
  { id: "yard-clutter",  x: 275, y: 1698, w:  310, h:  162 }, // 통나무 · 그루터기 · 도끼

  // ─── 노점(Village Provisions) ─────────────────────────────────────────────
  // 차양은 머리 위지만 배경 레이어라 가려 주지 않는다. 좌판째로 막는다.
  { id: "stall-back",    x: 900, y: 1330, w:  250, h:  145 },
  { id: "stall-mid",     x: 818, y: 1475, w:  332, h:  150 },
  { id: "stall-front",   x: 878, y: 1625, w:  332, h:  175 },

  // ─── 동쪽 상점 앞 ─────────────────────────────────────────────────────────
  { id: "shop-front",    x:1150, y: 1560, w:  386, h:  250 }, // 화분대 · 통 · 바구니 · 문
];

/** 지형 + 소품. 씬·테스트·오버레이가 전부 이 배열 하나만 본다. */
export const CAMP_COLLISION_BOXES: CampBox[] = [
  ...CAMP_GROUND_RECTS.map((r, i) => ({ id: `ground-${i}`, ...r })),
  ...CAMP_PROP_BOXES,
];

/** NPC 발밑 판정. 스프라이트 원점이 (0.5, 1) 이라 npc.y 가 곧 발끝이다. */
export const NPC_BODY = { w: 70, h: 28 };

/** 사각형 하나라도 발밑 바디와 겹치면 true. (x, y) 는 바디 중심이다. */
export function hitsWall(x: number, y: number, boxes: CampBox[] = CAMP_COLLISION_BOXES): boolean {
  const hw = PLAYER_BODY.w / 2;
  const hh = PLAYER_BODY.h / 2;
  return boxes.some(
    (b) => x + hw > b.x && x - hw < b.x + b.w && y + hh > b.y && y - hh < b.y + b.h,
  );
}

/**
 * 스폰에서 걸어서 닿을 수 있는 칸. `step` px 격자 · 4방향.
 *
 * 벽을 눈으로 훑는 것만으로는 "닫혀 있다"를 확인할 수 없다 — 틈 하나로 지붕 위까지
 * 새어나간다. 실제로 그랬다. 그래서 도달 영역을 직접 칠해 본다.
 */
export function reachableCells(
  start: { x: number; y: number },
  step = 20,
  boxes: CampBox[] = CAMP_COLLISION_BOXES,
): Set<string> {
  const key = (x: number, y: number) => `${x},${y}`;
  const inMap = (x: number, y: number) =>
    x >= PLAYER_BODY.w / 2 && x <= CAMP_MAP_W - PLAYER_BODY.w / 2 &&
    y >= PLAYER_BODY.h / 2 && y <= CAMP_MAP_H - PLAYER_BODY.h / 2;

  const sx = Math.round(start.x / step) * step;
  const sy = Math.round(start.y / step) * step;
  const seen = new Set([key(sx, sy)]);
  const queue: Array<[number, number]> = [[sx, sy]];

  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(key(nx, ny)) || !inMap(nx, ny) || hitsWall(nx, ny, boxes)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
}
