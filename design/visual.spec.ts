import { test, expect, type Page } from "@playwright/test";

/**
 * 비주얼 리그레션. 의도치 않은 화면 변화를 잡는다.
 *
 *   npx playwright test --config design/playwright.config.ts visual
 *   … --update-snapshots      의도한 변경이면 기준 이미지 갱신
 *
 * 기준 이미지는 design/visual.spec.ts-snapshots/ 에 커밋한다.
 * maxDiffPixelRatio 0.02 — 폰트 힌팅이나 안티에일리어싱 차이로 매번 깨지지 않을 만큼
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
  { name: "battle",   path: "/battle",   auth: true,  phaser: true  },
];

async function settle(page: Page, phaser: boolean) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  if (phaser) await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(900);
}

for (const screen of SCREENS) {
  test(`visual: ${screen.name}`, async ({ page }) => {
    await page.addInitScript(
      ({ authKey, playerKey, authState, authed }) => {
        window.localStorage.removeItem(authKey);
        window.localStorage.removeItem(playerKey);
        if (authed) window.localStorage.setItem(authKey, authState);
      },
      { authKey: AUTH_STORAGE_KEY, playerKey: PLAYER_STORAGE_KEY, authState: GUEST_AUTH_STATE, authed: screen.auth },
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
