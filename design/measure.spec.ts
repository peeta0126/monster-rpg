import { test, type Page } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";

/** 반응형 진단용 실측. 인상이 아니라 숫자로 남긴다. */
const GUEST = JSON.stringify({ state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });
const VPS = [[1920,1080],[1440,900],[1280,720],[768,1024],[390,844]] as const;

async function seed(page: Page) {
  await page.addInitScript(({ g, fresh }) => {
    localStorage.setItem("monster-rpg-auth", g);
    localStorage.setItem("monster-rpg-player", fresh);
  }, { g: GUEST, fresh: FRESH_SAVE });
}

for (const [w, h] of VPS) {
  test.describe(`${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`measure: ${w}x${h}`, async ({ page }) => {
      await seed(page);

      // 캔버스 실제 표시 크기 (Scale.FIT 결과)
      await page.goto("/");
      await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
      const cv = await page.locator("canvas").first().boundingBox();
      console.log(`${w}x${h} basecamp 캔버스 ${Math.round(cv!.width)}x${Math.round(cv!.height)} ` +
        `(화면의 ${Math.round((cv!.width * cv!.height) / (w * h) * 100)}%)`);

      // 몬스터 3열 각 폭
      await page.goto("/monsters");
      await page.waitForTimeout(700);
      const cols = await page.evaluate(() =>
        [...document.querySelectorAll("div.flex-1.overflow-hidden > div")]
          .map((e) => Math.round(e.getBoundingClientRect().width)));
      console.log(`${w}x${h} monsters 열 폭 ${cols.join(" / ")}`);

      // 전투 기술 버튼 폭.
      // 768px 미만은 SmallScreenNotice 가 화면을 덮는다. 잴 게 없는 게 아니라 못 논다
      if (w < 768) {
        console.log(`${w}x${h} 기술 버튼 — 화면이 작아 막힌 해상도다 (SmallScreenNotice)`);
        return;
      }
      await page.goto("/battle");
      await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
      await page.waitForTimeout(700);
      // 기술은 2단에 있다. 1단에서 "기술"을 먼저 열어야 셀이 나온다
      await page.getByTestId("cmd-moves").click();
      await page.waitForTimeout(300);
      const btn = await page.locator("button").filter({ hasText: "위력" }).first().boundingBox();
      console.log(`${w}x${h} 기술 버튼 ${Math.round(btn!.width)}x${Math.round(btn!.height)}`);
    });
  });
}
