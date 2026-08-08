/**
 * ⚠️ 배포 전 반드시 교체 — public/assets/player/player-*.png 는 포켓몬 리핑 에셋이다.
 * 닌텐도는 팬게임에 예외를 두지 않는다. 이 상태로 공개 배포하면 안 된다.
 * 교체 절차: docs/ASSET_HANDOFF.md
 */
/** public/ 밑의 정적 에셋 경로를 한 곳에서 관리한다. 파일명이 바뀌면 여기만 고치면 된다. */
export const LOGIN_BACKGROUND_IMAGE = "/start-loading.png";
export const LOGIN_BACKGROUND_IMAGE_WEBP = "/start-loading.webp";
export const LOGIN_BACKGROUND_ASPECT_RATIO = 2624 / 1632;

/** 베이스캠프 필드 배경. Phaser 씬이 로드하는 원본(1536x2730). */
export const BASECAMP_BACKGROUND_IMAGE = "/assets/basecamp/basecamp-bg.webp";

/** 위 배경의 640px 축소본. 흐리게 깔아 쓰는 곳은 이걸 쓴다 — 517KB → 140KB.
 *  blur(10~14px) + brightness(0.3) 을 먹이면 원본과 구분되지 않는다. */
export const BASECAMP_BACKGROUND_BLURRED = "/assets/basecamp/basecamp-bg-blur.webp";
