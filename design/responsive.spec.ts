import { test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 같은 화면을 여러 해상도로 찍는다. npm run design:responsive
 * 결과: design/screenshots/responsive/<가로x세로>/<화면>.png
 *
 * 지금까지 1440x900 하나로만 확인했는데, 브라우저 게임이라 그것만으로는 모른다.
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";
const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

const VIEWPORTS = [
  { w: 1920, h: 1080, label: "데스크탑 대형" },
  { w: 1440, h: 900,  label: "기준" },
  { w: 1280, h: 720,  label: "노트북" },
  { w: 768,  h: 1024, label: "태블릿 세로" },
  { w: 390,  h: 844,  label: "모바일 세로" },
];

const SCREENS = [
  { name: "login",    path: "/",         auth: false, phaser: false },
  { name: "basecamp", path: "/",         auth: true,  phaser: true  },
  { name: "forest",   path: "/forest",   auth: true,  phaser: false },
  { name: "farm",     path: "/farm",     auth: true,  phaser: false },
  { name: "monsters", path: "/monsters", auth: true,  phaser: false },
  { name: "workshop", path: "/workshop", auth: true,  phaser: false },
  { name: "battle",   path: "/battle",   auth: true,  phaser: true  },
];

/** 가로 스크롤은 그 자체로 결함이라 수치로 남긴다 */
async function overflowReport(page: Page) {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
  }));
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.w}x${vp.h}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    for (const screen of SCREENS) {
      test(`responsive: ${vp.w}x${vp.h} ${screen.name}`, async ({ page }) => {
        const dir = path.resolve(process.cwd(), "design", "screenshots", "responsive", `${vp.w}x${vp.h}`);
        fs.mkdirSync(dir, { recursive: true });

        await page.addInitScript(
          ({ a, p, g, authed }) => {
            window.localStorage.removeItem(a);
            window.localStorage.removeItem(p);
            if (authed) window.localStorage.setItem(a, g);
          },
          { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, authed: screen.auth },
        );
        await page.goto(screen.path);
        await page.waitForLoadState("networkidle");
        await page.waitForFunction(() => document.fonts.status === "loaded");
        if (screen.phaser) {
          await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
        }
        await page.waitForTimeout(800);

        const o = await overflowReport(page);
        const hOverflow = o.scrollW - o.clientW;
        if (hOverflow > 1) {
          console.log(`  ⚠ ${vp.w}x${vp.h} ${screen.name}: 가로 스크롤 ${hOverflow}px`);
        }
        await page.screenshot({ path: path.join(dir, `${screen.name}.png`) });
      });
    }
  });
}
