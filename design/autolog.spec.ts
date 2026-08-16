import { test, expect } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";

/**
 * 자동 진행이 실제로 Q 없이 굴러가는지. npm run design:autolog
 * 기본이 자동이므로 수동으로 바꿔 "멈추는" 것까지 반대 방향으로 확인한다.
 *
 * 한 전투 안에서 두세 턴 이상 굴리지 않는다 — 1층 적의 한 방이 60 이라 신규 파티(120)는
 * 세 턴째에 쓰러진다. 쓰러지면 커맨드가 영영 안 돌아와 엉뚱한 실패로 보인다.
 */
const GUEST = JSON.stringify({ state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });

test("fx: 로그 자동 진행", async ({ page }) => {
  await page.addInitScript(({ g, fresh }) => {
    localStorage.setItem("monster-rpg-auth", g);
    localStorage.setItem("monster-rpg-player", fresh);
    localStorage.removeItem("monster-rpg-battle-settings");
  }, { g: GUEST, fresh: FRESH_SAVE });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  /** 하단 고정 줄 — 지금 보이는 로그 한 줄 */
  const line = () => page.getByTestId("battle-log-line").innerText();

  // 기본은 자동 — 설정을 찾아 켠 사람만 편한 상태로 두지 않는다
  await expect(page.getByTestId("log-auto")).toContainText("자동");
  await expect(page.getByTestId("log-speed")).toBeVisible();

  // 속도 버튼이 순환한다
  const speed = await page.getByTestId("log-speed").innerText();
  await page.getByTestId("log-speed").click();
  await expect(page.getByTestId("log-speed")).not.toHaveText(speed);

  // 수동으로 바꾸면 로그가 한 줄에서 멈춘다
  await page.getByTestId("log-auto").click();
  await expect(page.getByTestId("log-auto")).toContainText("수동");
  await expect(page.getByTestId("log-speed")).toHaveCount(0);

  await page.getByTestId("cmd-moves").click();
  await page.locator('[data-testid^="move-"]').first().click();
  await page.waitForTimeout(1200);
  const stalled = await line();
  await page.waitForTimeout(2000);
  expect(await line()).toBe(stalled);
  // 메뉴는 항상 떠 있고 disabled 로만 막힌다 — 존재 여부가 아니라 활성 여부를 본다
  await expect(page.getByTestId("cmd-moves")).toBeDisabled();

  // 키를 누르고 있으면 남은 줄이 알아서 흘러간다 (연타가 아니라 keydown 한 번이다).
  // 바로 위에서 2초를 그냥 뒀을 때는 같은 자리였으니, 이 3초는 홀드가 민 것이다.
  await page.keyboard.down("q");
  await expect(page.getByTestId("cmd-moves")).toBeEnabled({ timeout: 3000 });
  await page.keyboard.up("q");

  // 자동으로 되돌리면 아무 키 없이 다음 줄로 넘어간다
  await page.getByTestId("log-auto").click();
  await expect(page.getByTestId("log-auto")).toContainText("자동");
  await page.getByTestId("cmd-moves").click();
  await page.locator('[data-testid^="move-"]').first().click();
  await page.waitForTimeout(300);
  const firstLine = await line();
  await expect.poll(line, { timeout: 10_000 }).not.toBe(firstLine);
});
