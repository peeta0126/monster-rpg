import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "design", "screenshots", "current");

// 연출 도중 레이아웃이 흔들리지 않는지 보는 용도. npm run design:fx

test("fx: 타격 연출 중/후", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.removeItem("monster-rpg-player");
  });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  await page.locator("button").filter({ hasText: "위력" }).first().click();
  // 기술명 로그를 Q로 넘기면 곧바로 타격 연출이 시작된다
  await page.waitForTimeout(300);
  await page.keyboard.press("q");
  await page.waitForTimeout(170);
  await page.screenshot({ path: path.join(OUT, "_fx-during.png") });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "_fx-after.png") });
});
