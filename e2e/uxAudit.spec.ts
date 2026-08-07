import { test, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * UX 점검용 스크린샷 수집.
 * 검증(assert)이 목적이 아니라 각 화면을 눈으로 확인하기 위한 것이라 실패하지 않는다.
 */
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "ux");

async function seed(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
    }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        party: [
          { id: "mossyfinal", level: 40, uid: "u0" },
          { id: "aquavern", level: 36, uid: "u1" },
          { id: "frostorb", level: 33, uid: "u2" },
        ],
        storage: [
          { id: "burno", level: 20, uid: "s0" },
          { id: "crystafox", level: 18, uid: "s1" },
        ],
        dexSeen: ["flameling", "burno", "aquabe", "aquavern", "mossyfinal"],
        dexCaught: ["flameling", "burno", "aquavern", "mossyfinal"],
        materials: {
          herb: 12, berry: 8, root: 9, crystal: 6, wood_plank: 10,
          iron_fragment: 7, leather: 5, monster_essence: 3,
          slime_extract: 4, magic_dust: 3, enhancement_stone: 40,
        },
        potions: { potion: 6, super_potion: 3, max_potion: 2, antidote: 2, attack_buff: 1 },
        bestFloor: 39,
        storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      },
      version: 1,
    }));
  });
}

const shot = async (page: Page, name: string) =>
  page.screenshot({ path: path.join(DIR, `${name}.png`) });

test("주요 화면 스크린샷", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page);

  await page.goto("/");
  await page.waitForTimeout(3500);
  await shot(page, "01-basecamp");

  await page.goto("/monsters");
  await page.waitForTimeout(1500);
  // 상태창(성장 정보 포함)은 몬스터를 클릭해야 나온다
  await page.locator("button").filter({ hasText: "Lv.40" }).first().click();
  await page.waitForTimeout(600);
  await shot(page, "02-monsters");

  await page.goto("/farm");
  await page.waitForTimeout(1500);
  await shot(page, "03-farm");

  await page.goto("/workshop");
  await page.waitForTimeout(2500);
  await shot(page, "04-workshop");

  await page.goto("/forest");
  await page.waitForTimeout(1500);
  await shot(page, "05-forest");

  await page.goto("/battle");
  await page.waitForTimeout(4000);
  await shot(page, "06-battle");

  // 메뉴에서 바로 여는 탑 층 선택 (걸어갈 필요 없음) + 회복 버튼
  await page.goto("/");
  await page.waitForTimeout(3500);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  await page.locator("button").filter({ hasText: "무한의 탑" }).first().click();
  await page.waitForTimeout(600);
  await shot(page, "07-tower-modal");
});
