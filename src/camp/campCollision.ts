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
 * 스프라이트 중심 y → 발끝 y. depth 정렬 기준이다.
 *
 * NPC 는 원점이 (0.5, 1) 이라 npc.y 가 곧 발끝이다. 플레이어만 스프라이트 중심을
 * 쓰면 기준이 어긋난다 — 스프라이트 아래 6px(=월드 15px)이 빈 여백이라, 아래쪽 끝을
 * depth 로 쓰면 발이 NPC 뒤에 있는데도 앞으로 그려진다.
 */
export function footYFromSpriteY(spriteY: number): number {
  return spriteY + (32 - PLAYER_FOOT_INSET) * PLAYER_SCALE;
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
  // 큰 통(x 178~278)까지 포함한다. 예전에는 x 275 에서 시작해 통을 통째로 빼먹었다.
  { id: "yard-clutter",  x: 175, y: 1694, w:  410, h:  166 }, // 큰 통 · 통나무 · 그루터기 · 도끼

  // ─── 노점(Village Provisions) ─────────────────────────────────────────────
  // 차양은 머리 위지만 배경 레이어라 가려 주지 않는다. 좌판째로 막는다.
  // 앞쪽은 한 덩어리가 아니다 — 하나로 덮으면 바구니 왼쪽(x 878~956, y 1708~1800)의
  // 멀쩡한 길까지 막힌다. 물건이 땅에 닿는 자리대로 세 조각으로 나눈다.
  { id: "stall-back",    x: 900, y: 1330, w:  250, h:  145 },
  { id: "stall-mid",     x: 818, y: 1475, w:  332, h:  175 },
  { id: "stall-basket-l",x: 878, y: 1650, w:   78, h:   58 }, // 채소 바구니
  { id: "stall-basket-r",x: 948, y: 1650, w:   88, h:  106 }, // 앞쪽 바구니
  { id: "stall-sign",    x:1018, y: 1650, w:  120, h:  164 }, // VILLAGE PROVISIONS 칠판 + 다리

  // ─── 동쪽 상점 앞 ─────────────────────────────────────────────────────────
  { id: "shop-front",    x:1150, y: 1560, w:  386, h:  250 }, // 화분대 · 통 · 바구니 · 문

  // ─── 남쪽 아치 아래 ───────────────────────────────────────────────────────
  // 여기는 통째로 비어 있었다. 원화의 바닥 구멍이 소품을 안 피하고 큼직하게 잘려 있어
  // 지형 마스크가 열어 주는데, 화단·통은 배경 레이어라 플레이어가 그 위에 올라선다.
  // 남는 통로는 x 688~888 로, 몸(60px)이 지나가기에 넉넉하다.
  { id: "south-planter",      x: 528, y: 2384, w: 160, h:  240 }, // 델피니움 화단 + 나무 틀
  { id: "south-planter-foot", x: 528, y: 2624, w: 132, h:   44 }, // 화단 밑 가로대 + 기대 놓은 삽
  { id: "south-foliage",      x: 888, y: 2384, w: 312, h:  308 }, // 라벤더 화단 · 통 두 개 · 그늘 수풀
  { id: "south-bush",         x:1104, y: 2674, w:  96, h:   56 }, // 남동 구석 덤불
];

/** 지형 + 소품. 씬·테스트·오버레이가 전부 이 배열 하나만 본다. */
export const CAMP_COLLISION_BOXES: CampBox[] = [
  ...CAMP_GROUND_RECTS.map((r, i) => ({ id: `ground-${i}`, ...r })),
  ...CAMP_PROP_BOXES,
];

/** NPC 발밑 판정. 스프라이트 원점이 (0.5, 1) 이라 npc.y 가 곧 발끝이다. */
export const NPC_BODY = { w: 70, h: 28 };

// ═══════════════════════════════════════════════════════════════════════════════
// 상호작용 지점
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * E 로 들어가는 곳. 좌표는 **스프라이트 중심** 기준이다(거리를 player.x/y 로 잰다).
 *
 * 씬과 테스트가 이 표 하나만 본다. 예전에는 BaseCampScene 에 상수로 있고 테스트에
 * 같은 숫자를 베껴 뒀는데, "여기 숫자를 고치면 씬도 고쳤는지 확인할 것"이라는 주석이
 * 붙어 있었다 — 그건 표가 두 벌이라는 뜻이다.
 *
 * `returnAt` 은 그 화면에서 돌아왔을 때 서는 자리다. 예전에는 호출부마다
 * `FOREST_Y + 80` 처럼 즉석에서 더했는데, 숲은 그 결과가 수풀 한가운데라 **벽 안에서
 * 시작**했다. 이제 좌표를 적어 두고 테스트가 벽 밖인지 확인한다.
 */
export interface CampInteraction {
  id: "tower" | "forest" | "house";
  /** 근접 안내에 뜨는 문구 */
  label: string;
  x: number;
  y: number;
  radius: number;
  returnAt: { x: number; y: number };
}

export const CAMP_INTERACTIONS: CampInteraction[] = [
  {
    // 아치 통로 한가운데. 반경이 커도 바로스를 가리지는 않는다 — 씬이 NPC 가 더
    // 가까우면 NPC 를 고른다.
    id: "tower", label: "탑 입장",
    x: 285, y: 950, radius: 300,
    returnAt: { x: 285, y: 1130 },
  },
  {
    // 숲은 캐노피 안쪽에 설 자리가 없다. 예전 (1500, 1900) 은 수풀 한가운데였고
    // 복귀 좌표 (1500, 1980) 은 아예 벽 안이었다. 판정을 길가로 내린다.
    id: "forest", label: "숲 입장",
    x: 1240, y: 1980, radius: 170,
    returnAt: { x: 1150, y: 1980 },
  },
  {
    id: "house", label: "집 입장",
    x: 794, y: 1215, radius: 90,
    returnAt: { x: 794, y: 1290 },
  },
];

/** 사각형 하나라도 발밑 바디와 겹치면 true. (x, y) 는 바디 중심이다. */
export function hitsWall(x: number, y: number, boxes: CampBox[] = CAMP_COLLISION_BOXES): boolean {
  const hw = PLAYER_BODY.w / 2;
  const hh = PLAYER_BODY.h / 2;
  return boxes.some(
    (b) => x + hw > b.x && x - hw < b.x + b.w && y + hh > b.y && y - hh < b.y + b.h,
  );
}

/**
 * 벽 밖으로 밀어낸 시작 좌표(스프라이트 중심 기준, 들어온 값과 같은 좌표계).
 *
 * Arcade 정적 바디는 **이미 겹쳐 있는** 물체를 밀어내지 않는다. 벽 안에서 시작하면
 * 사방이 막힌 것으로 판정되어 그대로 갇힌다. 저장된 좌표가 옛 형상에서 온 것일 수
 * 있으니 씬이 들어올 때 한 번 확인한다. 나선으로 가장 가까운 빈자리를 찾는다.
 */
export function safeSpawn(pos: { x: number; y: number }, maxRadius = 240): { x: number; y: number } {
  if (!hitsWall(pos.x, bodyYFromSpriteY(pos.y))) return pos;
  for (let r = 10; r <= maxRadius; r += 10) {
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      const x = pos.x + Math.cos(t) * r;
      const y = pos.y + Math.sin(t) * r;
      if (!hitsWall(x, bodyYFromSpriteY(y))) return { x: Math.round(x), y: Math.round(y) };
    }
  }
  return pos;
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
