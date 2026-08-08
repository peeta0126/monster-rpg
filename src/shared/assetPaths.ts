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
