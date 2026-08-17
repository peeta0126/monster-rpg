/**
 * ⚠️ 배포 전 반드시 교체 — public/assets/player/player-*.png 는 포켓몬 리핑 에셋이다.
 * 닌텐도는 팬게임에 예외를 두지 않는다. 이 상태로 공개 배포하면 안 된다.
 * 교체 절차: docs/ASSET_HANDOFF.md
 */
/**
 * public/ 밑의 정적 에셋 경로를 한 곳에서 관리한다. 파일명이 바뀌면 여기만 고치면 된다.
 *
 * 배경은 전부 WebP 하나만 둔다. PNG 폴백은 걷어냈다 — WebP 는 Safari 14(2020) 부터
 * 지원되는데 이 게임은 React 19 + ES 모듈이라 그보다 오래된 브라우저에서는 애초에
 * 실행되지 않는다. 아무도 받지 않는 파일이 저장소만 3.4MB 불리고 있었고, 게다가 폴백
 * 해상도가 원본의 절반이라 만에 하나 쓰이면 반쪽짜리가 나가는 구조였다.
 */
import type { TowerZone } from "./floorTable";
import type { ElementType } from "./game";

export const LOGIN_BACKGROUND_IMAGE = "/start-loading.webp";
export const LOGIN_BACKGROUND_ASPECT_RATIO = 2624 / 1632;

/** 베이스캠프 필드 배경. Phaser 씬이 로드하는 원본(1536x2730). */
export const BASECAMP_BACKGROUND_IMAGE = "/assets/basecamp/basecamp-bg.webp";

/** 위 배경의 640px 축소본. 흐리게 깔아 쓰는 곳은 이걸 쓴다 — 517KB → 140KB.
 *  blur(10~14px) + brightness(0.3) 을 먹이면 원본과 구분되지 않는다. */
export const BASECAMP_BACKGROUND_BLURRED = "/assets/basecamp/basecamp-bg-blur.webp";

/** 공방 실내 배경 (2400x1792).
 *  좌표계는 이 이미지 기준 백분율 — src/workshop/workshopLayout.ts 참고. */
export const WORKSHOP_BACKGROUND_IMAGE = "/assets/housing/housing_bg.webp";
export const WORKSHOP_BACKGROUND_ASPECT_RATIO = 2400 / 1792;

/**
 * 숲 구역 배경 3종 (2603x1464, 16:9).
 *
 * 톤 보정·카드 영역 스크림·비네트가 이미 구워져 있는 최종본이다. 화면에서 brightness /
 * saturate 를 덧씌우지 말 것 — 세 장의 밝기 차이가 곧 티어 차이라, 위에서 한 번 더
 * 누르면 셋이 같은 어둠으로 뭉개진다.
 *
 * scripts/optimize-assets.mjs 는 이 디렉터리를 건드리지 않는다(PRESERVED_DIRS).
 */
export const FOREST_BG_SHALLOW = "/assets/forest/forest_shallow.webp";
export const FOREST_BG_DEEP    = "/assets/forest/forest_deep.webp";
export const FOREST_BG_ANCIENT = "/assets/forest/forest_ancient.webp";
export const FOREST_BACKGROUND_ASPECT_RATIO = 2603 / 1464;

/**
 * 무한의 탑 전투 배경 (960x540, 35장 = 구간 5 × 속성 7).
 *
 * 벽·바닥·안개·비네트·먼지·켜진 창·바닥에 떨어지는 빛까지 전부 구워진 최종본이다.
 * 위에 조명이나 그라디언트를 덧대지 말 것 — 비네트가 두 겹이 되면 그냥 탁해진다.
 * 켜지는 창은 적 속성에 따라 달라진다(왼쪽부터 불·전기·물·얼음·풀·독·노말).
 *
 * 나열하지 않는 이유: 이름이 규칙이라 나열하면 그 규칙이 두 벌이 된다.
 *
 * z50(탑 정상)만 normal 한 장뿐이다. 그 층의 적은 오름 하나이고 type 이 null 이라
 * 언제나 normal 로 떨어지지만, 층을 라우트 state 로 넘기는 구조라 이론상 다른 속성의
 * 적과 50층이 만날 수는 있다. 그때 없는 파일을 요청해 방이 통째로 비는 대신 고정한다.
 */
export function towerBattleBg(zone: TowerZone, element: ElementType): string {
  const el = zone === "z50" ? "normal" : element;
  return `/assets/tower/${zone}_${el}.webp`;
}

/**
 * 아이템 아이콘 (64x64, 재료·물약·아티팩트).
 *
 * 이름을 나열하지 않는다 — 파일명이 곧 아이템 id 다(shared/items.ts 가 `icon` 을 `id` 와
 * 같게 둔다). 어느 id 에 그림이 있는지는 `shared/ui/rasterIcons.ts` 가 안다. 그 표는
 * scripts/build-icons.mjs 가 art-src/icons/ 를 보고 쓴다.
 *
 * 그림이 없는 이름(상태이상·메뉴·공방 탭)은 여기 오지 않고 SVG 로 그려진다 —
 * PixelIcon 이 갈라 준다.
 */
export function itemIconUrl(id: string): string {
  return `/assets/icons/${id}.webp`;
}
