import { test, expect } from "@playwright/test";

/**
 * 첫 실행 경험 진단. 사전지식 없는 게스트가 무엇을 볼 수 있는지 텍스트로 훑는다.
 * npm run design:onboarding
 */
test("fx: 첫 실행 진단", async ({ page }) => {
  // 1) 로그인 화면. 무엇을 눌러야 하는지 보이는가
  // 첫 진입에서만 초기화한다. addInitScript 는 매 네비게이션마다 도니까
  // 그냥 지우면 뒤 페이지에서 게스트 세션까지 날아간다.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("diag-started")) return;
    sessionStorage.setItem("diag-started", "1");
    localStorage.removeItem("monster-rpg-auth");
    localStorage.removeItem("monster-rpg-player");
  });
  await page.goto("/");
  await page.waitForTimeout(800);
  const loginButtons = await page.locator("button").allInnerTexts();
  console.log("[로그인] 버튼:", loginButtons.map((t) => t.replace(/\s+/g, " ").trim()).join(" | "));

  // 2) 게스트로 진입
  await page.getByRole("button", { name: /게스트로 시작/ }).click();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  const campText = (await page.locator("#root").innerText()).replace(/\s+/g, " ").trim();
  console.log("[베이스캠프] 화면 텍스트:", campText.slice(0, 300));
  const campButtons = await page.locator("button").allInnerTexts();
  console.log("[베이스캠프] 버튼:", campButtons.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean).join(" | "));

  // 3) 다음 목표가 어디 적혀 있는가. 숲/탑/공방 안내가 화면에 있는지
  for (const hint of ["숲", "탑", "공방", "몬스터"]) {
    console.log(`[베이스캠프] "${hint}" 언급:`, campText.includes(hint));
  }

  // 4) 각 화면의 첫 인상 (빈 상태에서 다음 행동이 적혀 있는가)
  for (const [name, path] of [["몬스터", "/monsters"], ["가방", "/farm"], ["숲", "/forest"]] as const) {
    await page.goto(path);
    await page.waitForTimeout(700);
    const t = (await page.locator("#root").innerText()).replace(/\s+/g, " ").trim();
    console.log(`[${name}] ${t.slice(0, 220)}`);
  }
  expect(true).toBe(true);
});
