/**
 * 전투 화면의 배치 표.
 *
 * 배경 이미지(960x540)가 이 좌표에 맞춰 그려져 있다. 벽은 y 0~248, 바닥 평행사변형이
 * y 248~486 이고 발끝은 반드시 그 사이에 둬야 한다.
 *
 * 씬이 아니라 여기 있는 이유: 겹침 테스트가 이 숫자를 읽어야 하는데 BattleScene 은
 * Phaser 를 import 해서 node 테스트에서 못 불러온다. 씬에 숫자를 다시 적으면 표가
 * 두 벌이 되고, 그러면 테스트는 통과하는데 화면만 겹치는 상태가 만들어진다.
 */

import { MAX_TOWER_FLOOR } from "../shared/floorTable";

export const W = 960;
export const H = 540;

/** 배경 이미지 안의 바닥 범위. 발끝이 이 밖으로 나가면 공중에 뜬 것처럼 보인다 */
export const FLOOR_TOP = 248;
export const FLOOR_BOTTOM = 486;

// ── 몬스터 ────────────────────────────────────────────────────────────────────
// 아군이 앞(왼쪽·아래·크게), 적이 뒤(오른쪽·위·작게). 플레이어가 탑을 올라와
// 적에게 도전하는 그림이다. 크기 차이가 곧 거리 차이라 원근이 생긴다.
export const PLAYER_X = 250;
export const PLAYER_FEET = 440;
export const PLAYER_SIZE = 170;

export const ENEMY_X = 700;
export const ENEMY_FEET = 330;
export const ENEMY_SIZE = 140;

// 탑 정상의 오름만 다른 자리에 다른 크기로 선다. 최종보스가 잡몹과 같은 크기면
// 50층까지 올라온 것이 화면에서 아무 일도 아니게 된다.
export const ORMR_X = 655;
export const ORMR_FEET = 340;
export const ORMR_SIZE = 256;
export const ORMR_PANEL_CY = 386;

/** 스프라이트 원점은 한가운데다. 기준은 발끝이므로 중심 Y 는 파생값으로만 쓴다. */
export const PLAYER_CY = PLAYER_FEET - PLAYER_SIZE / 2;
export const ENEMY_CY  = ENEMY_FEET  - ENEMY_SIZE  / 2;

/**
 * 마주보기.
 *
 * 몬스터 원화 15장 중 12장이 왼쪽을 보고, 3장(크리샤·프로스톨·리피)이 정면을 본다.
 * 오른쪽을 보는 그림은 하나도 없다. 그래서 왼쪽에 선 쪽만 뒤집으면 둘은 늘 마주본다.
 * 정면 3장은 뒤집어도 정면이라 예외를 두지 않는다.
 *
 * 아군에 `setFlipX(true)` 를 박아 두던 시절엔 자리를 옮길 때마다 서로 등졌다. 좌우 배치는
 * 층마다 다르고(50층 오름은 x 가 다르다) 앞으로도 바뀌므로, 상수가 아니라 좌표에서 나온다.
 */
export function shouldFlipX(selfX: number, opponentX: number): boolean {
  return selfX < opponentX;
}

// ── HP 패널 ───────────────────────────────────────────────────────────────────
// ⚠️ 패널 X 를 몬스터 X 에서 파생시키지 않는다. 예전에 그렇게 뒀다가 패널이 몬스터를
// 따라다니며 겹쳤다. 각자 자기 발밑에 놓인 별도 상수다.
export const PANEL_W = 220;
export const PANEL_H = 64;
export const P_PANEL_CX = 250;
export const P_PANEL_CY = 478;
export const E_PANEL_CX = 700;
export const E_PANEL_CY = 378;

// 패널 안쪽 HP 바
export const BAR_H = 10;
export const BAR_X_INNER = 10;
export const BAR_Y_IN_PANEL = PANEL_H - 22;
export const BAR_W_INNER = PANEL_W - 20;

export const P_BAR_X = P_PANEL_CX - PANEL_W / 2 + BAR_X_INNER;
export const P_BAR_Y = P_PANEL_CY - PANEL_H / 2 + BAR_Y_IN_PANEL;

// ── 층별 적 배치 ──────────────────────────────────────────────────────────────

export interface EnemyLayout {
  x: number; feet: number; size: number; cy: number;
  panelCx: number; panelCy: number;
  barX: number; barY: number;
}

/**
 * 그 층의 적이 어디에 얼마만 하게 서는가. 층으로 갈리는 배치값은 여기서만 갈린다.
 * 씬 여기저기에 `if (floor === 50)` 을 흩뿌리면 등장 트윈은 고쳤는데 교체 트윈은
 * 안 고친 식으로 반드시 어긋난다(setDisplaySize 호출부가 셋이다).
 */
export function getEnemyLayout(floor: number): EnemyLayout {
  const isOrmr = floor >= MAX_TOWER_FLOOR;
  const x    = isOrmr ? ORMR_X : ENEMY_X;
  const feet = isOrmr ? ORMR_FEET : ENEMY_FEET;
  const size = isOrmr ? ORMR_SIZE : ENEMY_SIZE;
  const panelCx = E_PANEL_CX;                      // 패널 X 는 오름도 같다
  const panelCy = isOrmr ? ORMR_PANEL_CY : E_PANEL_CY;
  return {
    x, feet, size,
    cy: feet - size / 2,
    panelCx, panelCy,
    barX: panelCx - PANEL_W / 2 + BAR_X_INNER,
    barY: panelCy - PANEL_H / 2 + BAR_Y_IN_PANEL,
  };
}

// ── 로그 알림 박스 ────────────────────────────────────────────────────────────
// 화면을 가로지르던 것을 오른쪽 아래로 몰았다. 아군 HP 패널이 왼쪽 아래에 있어서
// 예전 자리(20,414~940,518)와 정면으로 겹쳤다.
export const LOG_BOX = { x: 372, y: 420, w: 568, h: 104 } as const;
/** 로그 상자 안쪽 여백. 텍스트 시작점이랑 wordWrap 폭이 같은 값에서 나온다 */
export const LOG_PAD_X = 28;
export const LOG_PAD_Y = 20;

// ── 겹침 검사용 상자 ──────────────────────────────────────────────────────────

export interface Box { x: number; y: number; w: number; h: number }

const centered = (cx: number, cy: number, w: number, h: number): Box =>
  ({ x: cx - w / 2, y: cy - h / 2, w, h });

export const PLAYER_SPRITE_BOX: Box = centered(PLAYER_X, PLAYER_CY, PLAYER_SIZE, PLAYER_SIZE);
export const PLAYER_PANEL_BOX:  Box = centered(P_PANEL_CX, P_PANEL_CY, PANEL_W, PANEL_H);
export const LOG_BOX_RECT:      Box = { x: LOG_BOX.x, y: LOG_BOX.y, w: LOG_BOX.w, h: LOG_BOX.h };

export function enemySpriteBox(floor: number): Box {
  const e = getEnemyLayout(floor);
  return centered(e.x, e.cy, e.size, e.size);
}

export function enemyPanelBox(floor: number): Box {
  const e = getEnemyLayout(floor);
  return centered(e.panelCx, e.panelCy, PANEL_W, PANEL_H);
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
