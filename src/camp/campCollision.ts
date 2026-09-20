import {
  PLAYER_FOOT_FROM_ORIGIN, PLAYER_RENDER_SCALE, PLAYER_SHEET_METRICS, PLAYER_SPRITE_SCALE,
  type MonsterSheetDir,
} from "../shared/playerSprite";

/**
 * 베이스캠프 충돌.
 *
 * 좌표는 basecamp-bg.webp 원본(1536×2730) 기준 픽셀이다.
 *
 * 형상은 걸을 수 있는 땅의 바깥 테두리다. 두꺼운 선분을 이어 광장을 두르고,
 * 그 안쪽이 걸어 다니는 곳이다(`CAMP_WALL_SEGMENTS`, 스물두 줄).
 *
 * 한동안 물체마다 사각형을 씌우는 방식을 썼다. 전경 레이어 알파에서 지형을 자동
 * 생성하고 그 위에 소품 박스를 손으로 얹는 식이었다. 사각형이 백 개 가까이 되면서
 * 어느 줄이 어디를 막는지 알 수 없게 됐고, 한 자리를 고치려면 생성기를 다시 돌려야
 * 했다. 테두리 스물두 줄로 되돌렸다.
 *
 * 선분은 씬에 들어가기 전에 축에 정렬된 사각형으로 펴진다(`segmentBoxes`).
 * 씬·테스트·오버레이가 보는 것은 그 사각형이라 '게임이 실제로 쓰는 것'과 같다.
 *
 * 고친 뒤에는 `npm run design:collision` 으로 배경 위에 겹쳐 찍어 봐라.
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
 * 플레이어 물리 바디(월드 px). 스프라이트는 한 칸을 통째로 그리지만 막히는 건 발밑뿐이다.
 * 탑다운 반투시 배경이라 머리는 물체 뒤로 지나가야 자연스럽다.
 */
export const PLAYER_BODY = { w: 60, h: 30 };

/**
 * 씬이 스프라이트에 먹이는 배율. 여기 두는 이유는 바디 오프셋 계산이 이 값에 걸려서다.
 */
export const PLAYER_SCALE = PLAYER_RENDER_SCALE * PLAYER_SPRITE_SCALE;

/**
 * 시트별 바디 오프셋. 씬의 `body.setOffset` 이 그대로 쓴다.
 *
 * 발밑 바디는 **발이 닿는 줄을 한가운데 놓는다.** 예전에는 칸 바닥에서 3px 띄운
 * 자리에 뒀는데, 원화가 칸을 안 채우니까 그 자리가 발보다 22px 아래였다. 그래서
 * 화면에서는 캐릭터가 화단·문턱을 넘어선 자리에 서 있는데 판정은 아직 안 닿은 상태가
 * 됐다 — 벽 위를 걷는 것처럼 보이던 이유다.
 *
 * `frameWidth`/`footY` 를 시트마다 다시 읽는 것이 핵심이다. 북동 시트만 칸이
 * 341×682 라, 한 벌로 계산해 두면 방향을 바꾸는 순간 바디가 7px 순간이동한다.
 */
export function playerBodyOffset(dir: MonsterSheetDir) {
  const m = PLAYER_SHEET_METRICS[dir];
  return {
    x: (m.frameWidth - PLAYER_BODY.w / PLAYER_SCALE) / 2,
    y: m.footY - PLAYER_BODY.h / PLAYER_SCALE / 2,
  };
}

/** 정면 기준값. 씬이 처음 바디를 만들 때 쓴다. */
export const PLAYER_BODY_OFFSET = playerBodyOffset("south");

/**
 * 스프라이트 기준점 y → 발이 닿는 줄.
 *
 * 이 한 줄이 세 가지를 같이 정한다 — 발밑 충돌 바디의 중심, depth 정렬 기준,
 * 그리고 오버레이 캡처가 사람을 세우는 자리. 상호작용 거리(`Space`)만 스프라이트
 * 기준점으로 재므로 두 좌표계를 오가는 변환을 여기 한 번만 적어 둔다.
 *
 * NPC 는 원점이 (0.5, 1) 이라 npc.y 가 곧 발끝이다. 플레이어도 같은 줄로 재야
 * 나란히 섰을 때 앞뒤가 뒤집히지 않는다.
 */
export function bodyYFromSpriteY(spriteY: number): number {
  return spriteY + PLAYER_FOOT_FROM_ORIGIN * PLAYER_SCALE;
}

/** 걸을 수 있는 땅의 테두리 한 줄. `t` 는 선 두께(px). */
export interface CampSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t?: number;
}

/** 기본 선 두께. 몸(60×30)보다 얇지만, 벽이 이어져 있으면 두께는 상관없다. */
const SEGMENT_THICKNESS = 16;

/**
 * 선분 → 축에 정렬된 사각형.
 *
 * Arcade 정적 바디는 기울인 사각형을 못 넣는다. 그래서 비스듬한 줄은 두께만 한
 * 정사각형을 두께 간격으로 늘어놓아 이어 붙인다. 가로·세로는 사각형 하나면 된다.
 */
export function segmentBoxes(segments: readonly CampSegment[]): CampBox[] {
  const out: CampBox[] = [];

  const push = (id: string, cx: number, cy: number, w: number, h: number) => {
    // 벽은 일부러 지도 가장자리 너머까지 긋는다(끝에 틈을 남기지 않으려고).
    // 사각형이 지도를 벗어난 채로 남으면 캡처랑 테스트가 헛것을 잰다. 여기서 자른다.
    const x1 = Math.max(0, cx - w / 2);
    const y1 = Math.max(0, cy - h / 2);
    const x2 = Math.min(CAMP_MAP_W, cx + w / 2);
    const y2 = Math.min(CAMP_MAP_H, cy + h / 2);
    if (x2 <= x1 || y2 <= y1) return;
    out.push({ id, x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
  };

  for (const s of segments) {
    const t = s.t ?? SEGMENT_THICKNESS;
    const dx = s.x2 - s.x1;
    const dy = s.y2 - s.y1;
    const cx = (s.x1 + s.x2) / 2;
    const cy = (s.y1 + s.y2) / 2;

    if (Math.abs(dy) <= 2) push(s.id, cx, cy, Math.abs(dx), t);
    else if (Math.abs(dx) <= 2) push(s.id, cx, cy, t, Math.abs(dy));
    else {
      const steps = Math.ceil(Math.hypot(dx, dy) / t);
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        push(`${s.id}-${i}`, s.x1 + dx * f, s.y1 + dy * f, t, t);
      }
    }
  }
  return out;
}

/**
 * 광장을 두르는 테두리.
 *
 * 순서는 지도를 도는 순서다. 탑 가는 길(북서)에서 시작해 집 앞마당·노점·동쪽 상점을
 * 지나 남쪽 아치로 내려온 뒤, 우물 앞마당(서쪽)으로 돌아온다. 줄을 지우면 그 자리로
 * 새어나가니까, 고칠 때는 지우지 말고 옮겨라.
 *
 * 몇 줄은 지도 밖(y 2900)까지 나간다. 끝을 딱 맞추면 모서리에 몇 px 짜리 틈이 남는데,
 * 그 틈 하나로 지붕 위까지 빠져나간 적이 있다.
 */
export const CAMP_WALL_SEGMENTS: CampSegment[] = [
  // ─── 탑 가는 길(북서 아치) ────────────────────────────────────────────────
  { id: "tower-arch-n", x1: 380, y1:  900, x2: 170, y2:  900 }, // 아치 안쪽 끝
  { id: "tower-path-e", x1: 380, y1:  900, x2: 380, y2: 1200 }, // 집 서쪽 굴뚝·화분
  { id: "tower-path-w", x1: 170, y1:  920, x2: 170, y2: 1400 }, // 서쪽 큰 나무

  // ─── 집 앞마당 ────────────────────────────────────────────────────────────
  { id: "house-yard-n", x1: 380, y1: 1200, x2: 690, y2: 1200 }, // 화단·정원 탁자 앞
  { id: "house-door-w", x1: 700, y1: 1100, x2: 700, y2: 1200 }, // 현관 주머니 서쪽
  { id: "house-door-n", x1: 700, y1: 1100, x2: 880, y2: 1100 }, // 문짝
  { id: "house-door-e", x1: 880, y1: 1100, x2: 880, y2: 1200 }, // 현관 주머니 동쪽
  { id: "house-steps-n", x1: 900, y1: 1200, x2: 1000, y2: 1200 }, // 돌계단 앞

  // ─── 노점 · 동쪽 상점 ─────────────────────────────────────────────────────
  { id: "stall-w",  x1: 1000, y1: 1200, x2: 1000, y2: 1480 },
  { id: "stall-s",  x1:  830, y1: 1480, x2: 1000, y2: 1480 },
  // 좌판 앞은 비스듬하다. 얇게(5px) 촘촘히 깔아 모서리를 따라간다.
  { id: "stall-sw", x1: 1030, y1: 1800, x2:  830, y2: 1480, t: 5 },
  { id: "shop-s",   x1: 1530, y1: 1800, x2: 1030, y2: 1800 }, // 동쪽 상점 앞 좌판·통

  // ─── 남동 숲 ──────────────────────────────────────────────────────────────
  { id: "se-woods-n", x1: 890, y1: 2430, x2: 1530, y2: 2430 },
  { id: "se-woods-w", x1: 890, y1: 2430, x2:  890, y2: 2900 },

  // ─── 남쪽 아치 통로 ───────────────────────────────────────────────────────
  { id: "south-arch-w", x1: 660, y1: 2300, x2: 660, y2: 2900 }, // 화단·통 쪽

  // ─── 남서 건물 ────────────────────────────────────────────────────────────
  { id: "sw-house-e", x1: 540, y1: 2290, x2: 540, y2: 1960 },
  { id: "sw-house-s", x1: 660, y1: 2290, x2: 540, y2: 2290 },

  // ─── 우물 앞마당(서쪽) ────────────────────────────────────────────────────
  { id: "well-yard-n", x1: 100, y1: 1850, x2: 580, y2: 1850 }, // 통·통나무·그루터기
  { id: "well-yard-w", x1: 100, y1: 1850, x2: 100, y2: 1960 },
  { id: "well-yard-s", x1: 540, y1: 1960, x2: 100, y2: 1960 },
  { id: "west-woods-e", x1: 580, y1: 1400, x2: 580, y2: 1850 },
  { id: "west-woods-s", x1: 170, y1: 1400, x2: 580, y2: 1400 }, // 우물 처마 밑
];

/** 씬·테스트·오버레이가 전부 이 배열 하나만 본다. */
export const CAMP_COLLISION_BOXES: CampBox[] = segmentBoxes(CAMP_WALL_SEGMENTS);

/** NPC 발밑 판정. 스프라이트 원점이 (0.5, 1) 이라 npc.y 가 곧 발끝이다. */
export const NPC_BODY = { w: 70, h: 28 };

// ═══════════════════════════════════════════════════════════════════════════════
// 상호작용 지점
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * E 로 들어가는 곳. 좌표는 스프라이트 중심 기준이다(거리를 player.x/y 로 잰다).
 *
 * 씬이랑 테스트가 이 표 하나만 본다. 원래는 BaseCampScene 에 상수로 있고 테스트에
 * 같은 숫자를 베껴 뒀는데, "여기 숫자를 고치면 씬도 고쳤는지 확인할 것"이라는 주석까지
 * 붙어 있었다. 그건 표가 두 벌이라는 뜻이다.
 *
 * `returnAt` 은 그 화면에서 돌아왔을 때 서는 자리다. 원래는 호출부마다
 * `FOREST_Y + 80` 처럼 즉석에서 더했는데, 숲은 그 결과가 수풀 한가운데라 벽 안에서
 * 시작했다. 이제 좌표를 적어 두고 테스트가 벽 밖인지 확인한다.
 */
export interface CampInteraction {
  id: "tower" | "forest" | "workshop";
  /** 근접 안내에 뜨는 문구 */
  label: string;
  x: number;
  y: number;
  radius: number;
  returnAt: { x: number; y: number };
}

export const CAMP_INTERACTIONS: CampInteraction[] = [
  {
    // 아치 통로 한가운데. 반경이 커도 바로스를 가리진 않는다. 씬이 NPC 가 더
    // 가까우면 NPC 를 고른다.
    id: "tower", label: "탑 입장",
    x: 285, y: 950, radius: 300,
    returnAt: { x: 285, y: 1130 },
  },
  {
    // 숲 어귀(동쪽 끝). 한동안 판정을 길 가운데(1240, 1980)로 당겨 반경 170 을 줬는데,
    // 그러면 오리온 바로 옆(90px)까지 숲 판정이 따라와 마을 한복판에서 "숲 입장"이 뜬다.
    // 나무 앞으로 돌려놨다. 오리온과 413px 떨어져 있어서 겹칠 일이 없다.
    id: "forest", label: "숲 입장",
    x: 1500, y: 1900, radius: 130,
    returnAt: { x: 1500, y: 1980 },
  },
  {
    // 광장 북쪽 집이 곧 제작 공방이다. 안내에 "집" 이라고 적어 두면 들어가 보기
    // 전에는 살림집으로 읽힌다 — 모루·연금술 제작대가 있는 곳이라고 먼저 말한다.
    id: "workshop", label: "공방 입장",
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
 * Arcade 정적 바디는 이미 겹쳐 있는 물체를 안 밀어낸다. 벽 안에서 시작하면
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
 * 벽을 눈으로 훑는 것만으로는 닫혀 있는지 확인이 안 된다. 틈 하나로 지붕 위까지
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
