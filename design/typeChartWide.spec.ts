import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 상성표가 8×8 이 된 뒤에도 화면 안에 들어오는가.
 *
 * 이 패널은 칸마다 `w-11`(44px)인데 「크리스탈」은 픽셀 폰트 12px 로 48px 이라 그 칸만
 * 넓어진다. 열이 하나 늘고 그 열이 제일 넓다 — 좁은 화면에서 표가 화면 밖으로 나가면
 * 전투 중에 상성을 못 본다. 코드로는 안 보이고 재 봐야 아는 종류다.
 */
const OUT = path.join("design", "screenshots", "current");

const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });
const SAVE = JSON.stringify({
  state: {
    party: [{ id: "gemguard", level: 30, uid: "t0" }],
    storage: [], dexSeen: [], dexCaught: [], materials: {}, potions: {},
    bestFloor: 0, storyFlags: {}, questStatus: {},
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {}, imprint: {},
  },
  version: 2,
});

for (const [w, h] of [[1440, 900], [1280, 720], [768, 1024]] as const) {
  test(`typechart: ${w}x${h} 안에 들어온다`, async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(([s, a]) => {
      window.localStorage.setItem("monster-rpg-auth", a as string);
      window.localStorage.setItem("monster-rpg-player", s as string);
    }, [SAVE, AUTH] as const);

    await page.goto("/battle");
    await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
    await page.keyboard.press("t");

    const chart = page.getByTestId("type-chart");
    await expect(chart).toBeVisible();

    // 여덟 열이 다 그려졌는가. 머리줄 셀은 속성 수 + 왼쪽 빈 칸 하나다
    await expect(chart.locator("thead th")).toHaveCount(9);
    await expect(chart.locator("[data-cell='crystal-crystal']")).toBeVisible();

    // 표가 화면 밖으로 안 나간다
    const box = (await chart.boundingBox())!;
    expect(box.x, "표 왼쪽이 화면 밖이다").toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, "표 오른쪽이 화면 밖이다").toBeLessThanOrEqual(w);
    expect(box.y + box.height, "표 아래가 화면 밖이다").toBeLessThanOrEqual(h);

    await page.screenshot({ path: path.join(OUT, `_type-chart-${w}.png`) });
  });
}
