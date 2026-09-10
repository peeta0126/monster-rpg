/**
 * public/ 밑 정적 에셋 경로를 한 곳에 모아 둔다. 파일명이 바뀌면 여기만 고치면 됨.
 *
 * 배경은 WebP 한 장씩만 둔다. PNG 폴백은 걷어냈다. WebP 는 Safari 14(2020)부터
 * 되는데 이 게임은 React 19 + ES 모듈이라 그보다 낡은 브라우저면 애초에 안 돈다.
 * 아무도 안 받는 파일이 저장소만 3.4MB 불렸고, 폴백 해상도가 원본의 절반이라
 * 어쩌다 쓰이면 반쪽짜리가 나가는 구조이기도 했다.
 */
import type { TowerZone } from "./floorTable";
import type { ElementType } from "./game";

export const LOGIN_BACKGROUND_IMAGE = "/start-loading.webp";
export const LOGIN_BACKGROUND_ASPECT_RATIO = 2624 / 1632;

/** 베이스캠프 필드 배경. Phaser 씬이 읽는 원본(1536x2730) */
export const BASECAMP_BACKGROUND_IMAGE = "/assets/basecamp/basecamp-bg.webp";

/** 위 배경의 640px 축소본. 흐리게 깔아 쓰는 곳은 이걸로. 517KB → 140KB.
 *  blur(10~14px) + brightness(0.3) 먹이면 원본이랑 구분 안 된다 */
export const BASECAMP_BACKGROUND_BLURRED = "/assets/basecamp/basecamp-bg-blur.webp";

/** 공방 실내 배경 (2400x1792).
 *  좌표계는 이 이미지 기준 백분율. src/workshop/workshopLayout.ts 참고 */
export const WORKSHOP_BACKGROUND_IMAGE = "/assets/housing/housing_bg.webp";

/**
 * 숲 구역 배경 3종 (2603x1464, 16:9).
 *
 * 톤 보정이랑 카드 자리 스크림, 비네트까지 다 구워져 들어온 최종본이다.
 * 화면에서 brightness/saturate 를 덧씌우지 마라. 세 장의 밝기 차이가 곧 티어
 * 차이인데, 위에서 한 번 더 누르면 셋이 같은 어둠으로 뭉개진다.
 *
 * scripts/optimize-assets.mjs 는 이 디렉터리를 안 건드린다(PRESERVED_DIRS).
 */
export const FOREST_BG_SHALLOW = "/assets/forest/forest_shallow.webp";
export const FOREST_BG_DEEP    = "/assets/forest/forest_deep.webp";
export const FOREST_BG_ANCIENT = "/assets/forest/forest_ancient.webp";

/**
 * 무한의 탑 전투 배경 (960x540, 35장 = 구간 5 × 방 7).
 *
 * 벽·바닥·안개·비네트·먼지·켜진 창·바닥에 떨어지는 빛까지 다 구워진 최종본이다.
 * 위에 조명이나 그라디언트를 덧대지 마라. 비네트가 두 겹 되면 그냥 탁해진다.
 * 켜지는 창은 적 속성을 따라간다(왼쪽부터 불·전기·물·얼음·풀·독·노말).
 *
 * 이름을 안 나열하는 건 이름 자체가 규칙이라서다. 적어 두면 규칙이 두 벌 된다.
 *
 * ⚠️ **방은 일곱이고 속성은 여덟이다.** 수정 방 그림이 없다. 젬 계열 셋이 순수
 * 크리스탈이라 이 이름은 실제로 들어온다 — 37층(젬토)과 40층 이후의 랜덤 젬로드다.
 * 그래서 아래 표로 얼음 방에 세운다. 얼음인 이유는 그 방이 이 계열의 원화와 제일
 * 가깝기 때문이고, 여기서 임의로 다른 방을 고르면 같은 몬스터가 층마다 다른 방에
 * 선다. 수정 방을 그리면 이 표에서 crystal 줄만 지우면 된다.
 *
 * z50(탑 정상)만 normal 한 장뿐이다. 그 층 적은 오름 하나고 type 이 null 이라 늘
 * normal 로 떨어지는데, 마찬가지 이유로 고정해 둔다.
 */
const TOWER_ROOM_FALLBACK: Partial<Record<ElementType, ElementType>> = {
  crystal: "ice",
};

export function towerBattleBg(zone: TowerZone, element: ElementType): string {
  const room = TOWER_ROOM_FALLBACK[element] ?? element;
  const el = zone === "z50" ? "normal" : room;
  return `/assets/tower/${zone}_${el}.webp`;
}

/**
 * 아이템 아이콘 (64x64, 재료·물약·아티팩트).
 *
 * 이름은 안 적는다. 파일명이 곧 아이템 id 라서다(shared/items.ts 가 `icon` 을 `id` 와
 * 같게 둔다). 어느 id 에 그림이 있는지는 `shared/ui/rasterIcons.ts` 가 안다.
 * 그 표는 scripts/build-icons.mjs 가 art-src/icons/ 를 보고 써 준다.
 *
 * 그림이 없는 이름(상태이상·메뉴·공방 탭)은 여기 안 오고 SVG 로 그려진다.
 * 갈라 주는 건 PixelIcon.
 */
export function itemIconUrl(id: string): string {
  return `/assets/icons/${id}.webp`;
}
