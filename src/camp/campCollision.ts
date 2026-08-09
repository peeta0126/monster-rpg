/**
 * 베이스캠프 충돌 형상.
 *
 * 좌표는 전부 basecamp-bg.webp 원본(1536×2730) 기준 픽셀이고, 사각형은 왼쪽 위 모서리
 * 기준이다(공방 `workshopLayout.ts` 와 같은 규약).
 *
 * 씬이 아니라 여기 둔 이유는 두 가지다 — 씬 코드를 열지 않고 숫자만 고칠 수 있고,
 * 테스트와 오버레이 캡처가 같은 배열을 읽어 "게임이 실제로 쓰는 것"을 그대로 잰다.
 *
 * ⚠️ 예전에는 선분(polyline)으로 두께 16px 벽을 깔았다. 그 방식은 물체의 발밑이
 * 아니라 물체 한가운데를 지나가서, 플레이어가 화단·좌판·우물 안으로 반쯤 파고들었다.
 * 지금은 배경에서 잰 "물체가 땅에 닿는 자리"를 사각형으로 덮는다.
 *
 * 고친 뒤에는 `npm run design:collision` 으로 배경 위에 겹쳐 찍어 눈으로 확인할 것.
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
 * 씬의 `setSize`/`setOffset` 이 이 값에서 나온다.
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
 * 막히는 자리.
 *
 * 큰 덩어리(숲·건물)는 지도 가장자리까지 통째로 덮는다. 경계선만 얇게 깔면 그 바깥이
 * 걸어 다닐 수 있는 땅으로 남아, 틈 하나만 있어도 지붕 위로 새어나간다. 실제로 그랬다.
 */
export const CAMP_COLLISION_BOXES: CampBox[] = [
  // ─── 서쪽 숲 (탑 가는 길의 왼쪽) ───────────────────────────────────────────
  // 수풀 경계가 아래로 갈수록 오른쪽으로 불룩해진다. 계단으로 따라간다.
  { id: "west-woods-1",  x:   0, y:    0, w:  215, h: 1000 },
  { id: "west-woods-2",  x:   0, y: 1000, w:  235, h:  150 },
  { id: "west-woods-3",  x:   0, y: 1150, w:  265, h:  200 },

  // ─── 탑(서쪽 아치) ────────────────────────────────────────────────────────
  // 아치 기둥이 땅에 닿는 선. 여기서 멈춰 서서 E 를 누른다.
  { id: "tower-arch",    x: 200, y:  820, w:  250, h:   95 },

  // 아치 오른쪽 굴뚝·바위. 없으면 아치와 집 사이 110px 틈으로 지붕 위까지 나간다.
  { id: "house-roof-w", x: 430, y:  640, w:  140, h:  275 },

  // ─── 집 앞마당의 정원 소품 ─────────────────────────────────────────────────
  // 위쪽 y 820 까지 올린 건 아치와 집 사이를 막기 위해서다 — 화분 자체는 y 895 부터다.
  { id: "garden-pots",   x: 350, y:  820, w:  220, h:  240 }, // 델피니움 화분 + 장미 화분
  // 기대 놓은 삽은 일부러 빼뒀다. 얇은 소품 하나 때문에 탑 가는 길이 57px 로 좁아진다.
  { id: "garden-table",  x: 344, y: 1035, w:  158, h:  110 },
  { id: "garden-planter",x: 498, y: 1073, w:  150, h:  132 }, // 라벤더 화단

  // ─── 집 · 시계탑 · 동쪽 건물 ───────────────────────────────────────────────
  // 문짝 위에는 올라서지 못한다. "E: 집 입장" 은 문 앞 잔디(y≈1250)에서 뜬다.
  { id: "house",         x: 560, y:    0, w:  350, h: 1237 },
  { id: "stone-steps",   x: 880, y:    0, w:  175, h: 1257 },
  { id: "east-roof",     x:1040, y:    0, w:  496, h: 1292 },
  { id: "east-wall-1",   x:1050, y: 1292, w:  486, h:  115 },
  { id: "east-wall-2",   x:1150, y: 1407, w:  386, h:  345 },

  // ─── 노점(Village Provisions) ─────────────────────────────────────────────
  // 좌판이 왼쪽 아래로 비스듬히 퍼져 있어 세 토막으로 따라간다.
  { id: "stall-back",    x: 900, y: 1330, w:  250, h:  145 },
  { id: "stall-mid",     x: 818, y: 1475, w:  332, h:  150 },
  { id: "stall-front",   x: 878, y: 1625, w:  332, h:  175 }, // 칠판 + 돌 화분대

  // ─── 우물 · 장작 (서쪽) ───────────────────────────────────────────────────
  { id: "well-chimney",  x: 325, y: 1252, w:  102, h:  105 },
  { id: "well-yard",     x:   0, y: 1345, w:  430, h:  515 },
  { id: "well-barrel",   x: 440, y: 1395, w:  137, h:  262 }, // 덤불 + 큰 나무통
  { id: "yard-clutter",  x: 275, y: 1698, w:  310, h:  162 }, // 통나무 · 그루터기 · 도끼
  { id: "alley-west",    x:   0, y: 1810, w:  105, h:  160 },

  // ─── 남서쪽 건물 ──────────────────────────────────────────────────────────
  { id: "sw-roof",       x:   0, y: 1963, w:  528, h:  334 },
  { id: "sw-front",      x:   0, y: 2295, w:  660, h:  435 },

  // ─── 남쪽 아치 (통로는 x 660~860) ─────────────────────────────────────────
  { id: "arch-west",     x: 528, y: 2120, w:  132, h:  610 },
  { id: "arch-east",     x: 860, y: 2118, w:  190, h:  612 },

  // ─── 남동쪽 숲 (숲 입구는 이 위쪽 흙바닥에서 E) ────────────────────────────
  { id: "forest-1",      x:1040, y: 2045, w:  496, h:  240 },
  { id: "forest-2",      x: 988, y: 2285, w:  548, h:  445 },
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
