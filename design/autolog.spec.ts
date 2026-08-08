import { test, expect } from "@playwright/test";

/**
 * 자동 진행이 실제로 Q 없이 굴러가는지. npm run design:autolog
 * 켜기 전/후로 같은 시간 동안 진행된 로그 수를 비교한다.
 */
const GUEST = JSON.stringify({ state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });

test("fx: 로그 자동 진행", async ({ page }) => {
  await page.addInitScript((g) => {
    localStorage.setItem("monster-rpg-auth", g);
    localStorage.removeItem("monster-rpg-player");
    localStorage.removeItem("monster-rpg-battle-settings");
  }, GUEST);
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 기본은 수동
  await expect(page.getByTestId("log-auto")).toContainText("수동");
  await expect(page.getByTestId("log-speed")).toHaveCount(0);

  // 수동일 때: 기술을 쓰고 3초를 그냥 두면 로그에서 멈춰 있다 (커맨드가 안 돌아온다)
  await page.getByTestId("cmd-attack").click();
  await page.locator('[data-testid^="move-"]').first().click();
  await page.waitForTimeout(3000);
  // 메뉴는 항상 떠 있고 disabled 로만 막힌다 — 존재 여부가 아니라 활성 여부를 본다
  await expect(page.getByTestId("cmd-attack")).toBeDisabled();

  // 자동으로 바꾸면 Q 없이 흘러가 커맨드가 돌아온다
  await page.keyboard.press("q");            // 멈춰 있던 줄 하나만 수동으로 넘기고
  await page.waitForTimeout(200);
  await page.getByTestId("log-auto").click();
  await expect(page.getByTestId("log-auto")).toContainText("자동");
  await expect(page.getByTestId("log-speed")).toBeVisible();

  await expect(page.getByTestId("cmd-attack")).toBeEnabled({ timeout: 30_000 });

  // 속도 버튼이 순환한다
  const before = await page.getByTestId("log-speed").innerText();
  await page.getByTestId("log-speed").click();
  await expect(page.getByTestId("log-speed")).not.toHaveText(before);
});
