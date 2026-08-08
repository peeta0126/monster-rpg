import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** 2단 커맨드 메뉴 조작 확인. npm run design:menu */
const OUT = path.resolve(process.cwd(), "design", "screenshots", "current");

test("fx: 커맨드 메뉴 2단", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.removeItem("monster-rpg-player");
  });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 1단
  await expect(page.getByTestId("cmd-attack")).toBeVisible();
  await expect(page.getByTestId("cmd-skill")).toBeVisible();
  await expect(page.getByTestId("cmd-bag")).toBeVisible();
  await expect(page.getByTestId("cmd-flee")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-root.png") });

  // 방향키로 커서 이동 → 스킬에서 확정
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-skill.png") });

  // ESC 로 1단 복귀
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cmd-attack")).toBeVisible();

  // 1단에서 ESC 는 아무 일도 없어야 한다
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cmd-attack")).toBeVisible();

  // 신규 게스트는 물약이 0개다 → 가방은 비활성이어야 하고 눌러도 안 열린다
  await expect(page.getByTestId("cmd-bag")).toBeDisabled();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cmd-attack")).toBeVisible();

  // 1층은 보스가 아니라 도망은 활성
  await expect(page.getByTestId("cmd-flee")).toBeEnabled();

  // 우클릭으로도 2단에서 뒤로 나온다
  await page.getByTestId("cmd-attack").click();
  await expect(page.getByTestId("cmd-back")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-attack.png") });
  await page.getByTestId("battle-command").click({ button: "right" });
  await expect(page.getByTestId("cmd-attack")).toBeVisible();
});
