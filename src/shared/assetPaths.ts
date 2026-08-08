/**
 * ⚠️ 배포 전 반드시 교체 — public/assets/player/player-*.png 는 포켓몬 리핑 에셋이다.
 * 닌텐도는 팬게임에 예외를 두지 않는다. 이 상태로 공개 배포하면 안 된다.
 * 교체 절차: docs/ASSET_HANDOFF.md
 */
/** public/ 밑의 정적 에셋 경로를 한 곳에서 관리한다. 파일명이 바뀌면 여기만 고치면 된다. */
export const LOGIN_BACKGROUND_IMAGE = "/start-loading.png";
export const LOGIN_BACKGROUND_IMAGE_WEBP = "/start-loading.webp";
export const LOGIN_BACKGROUND_ASPECT_RATIO = 2624 / 1632;

/** 베이스캠프 필드 배경. Phaser 씬이 로드하는 것과 같은 파일이라, 다른 화면에서
 *  흐린 배경으로 재활용하면 대개 캐시에서 바로 나온다. */
export const BASECAMP_BACKGROUND_IMAGE = "/assets/basecamp/basecamp-bg.png";
