import { test, expect, type Page } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";

/**
 * 비주얼 리그레션. 의도치 않은 화면 변화를 잡는다.
 *
 *   npx playwright test --config design/playwright.config.ts visual
 *   … --update-snapshots      의도한 변경이면 기준 이미지 갱신
 *
 * 기준 이미지는 design/visual.spec.ts-snapshots/ 에 커밋한다.
 * maxDiffPixelRatio 0.02. 폰트 힌팅이나 안티에일리어싱 차이로 매번 깨지지 않을 만큼
 * 느슨하되, 레이아웃이 밀리면 잡히는 값이다.
 */

const AUTH_STORAGE_KEY = "monster-rpg-auth";
const PLAYER_STORAGE_KEY = "monster-rpg-player";

const GUEST_AUTH_STATE = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

const SCREENS = [
  { name: "login",    path: "/",         auth: false, phaser: false },
  { name: "basecamp", path: "/",         auth: true,  phaser: true  },
  { name: "forest",   path: "/forest",   auth: true,  phaser: false },
  { name: "farm",     path: "/farm",     auth: true,  phaser: false },
  { name: "monsters", path: "/monsters", auth: true,  phaser: false },
  { name: "workshop", path: "/workshop", auth: true,  phaser: false },
  // 2026-09-01: 하단 경험치 줄을 걷어냈다. 전투 중에 볼 값이 아니고(레벨업은 전면 카드가
  // 알린다), 상대에게도 있는 줄로 오해받았다. 그만큼 캔버스가 다시 길어졌다.
  //
  // 2026-08-14: 하단 패널에 경험치 줄이 한 줄 늘면서 캔버스가 그만큼 짧아졌다. 몬스터
  // 방향은 그대로다. 뒤집기를 좌표에서 계산하도록 바꿨지만 지금 배치에서는 결과가 같다.
  //
  // battle 기준 이미지를 2026-08-12 에 다시 갱신했다. 배경이 Graphics 로 그리던 벽돌방에서
  // 층 구간 × 적 속성으로 고르는 이미지 한 장으로 바뀌었고, 배치도 아군 앞(왼쪽·아래·크게)·
  // 적 뒤(오른쪽·위·작게)로 다시 잡았다. HP 패널은 각자 발밑, 로그 상자는 오른쪽 아래다.
  { name: "battle",   path: "/battle",   auth: true,  phaser: true  },
];

async function settle(page: Page, phaser: boolean) {
  // 전환 커버가 걷힐 때까지 기다린다. 안 그러면 중간 프레임이 찍혀
  // 비주얼 리그레션이 무작위로 깨진다.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scene-transition"]') === null,
    undefined, { timeout: 10_000 },
  );
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  if (phaser) await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(900);
}

for (const screen of SCREENS) {
  test(`visual: ${screen.name}`, async ({ page }) => {
    await page.addInitScript(
      ({ authKey, playerKey, authState, authed, fresh }) => {
        window.localStorage.removeItem(authKey);
        window.localStorage.removeItem(playerKey);
        if (authed) {
          window.localStorage.setItem(authKey, authState);
          // 새 세이브는 파티가 비어 있고 첫 몬스터를 이장에게서 받는다. 그대로 두면
          // /battle 이 베이스캠프로 되돌려져 전투 대신 마을이 찍힌다.
          window.localStorage.setItem(playerKey, fresh);
        }
      },
      { authKey: AUTH_STORAGE_KEY, playerKey: PLAYER_STORAGE_KEY, authState: GUEST_AUTH_STATE,
        authed: screen.auth, fresh: FRESH_SAVE },
    );
    await page.goto(screen.path);
    await settle(page, screen.phaser);

    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      maxDiffPixelRatio: 0.02,
      // 횃불·입자·안개는 계속 움직인다. 애니메이션을 멈춰 세우고 찍는다.
      animations: "disabled",
    });
  });
}
