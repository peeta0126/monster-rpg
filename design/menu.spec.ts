import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FRESH_SAVE } from "./freshSave";

/** 2단 커맨드 메뉴 조작 확인. npm run design:menu */
const OUT = path.resolve(process.cwd(), "design", "screenshots", "current");

/**
 * 기술 셀에 예측이 다 들어가고도 읽히는지 보기 위한 최악 조건 캡처.
 *
 * 신규 게스트(플레미 Lv.1)는 기술이 2개뿐이라 셀이 두 칸밖에 안 차서, 정작 확인하고 싶은
 * "이름·배율·예상 데미지·명중·치명·쓰러뜨림 표시가 한 셀에 다 들어간 상태"를 못 본다.
 * 그래서 특수기 4개 + 치명타 장비를 심어 4칸을 가득 채운다.
 */
const DENSE_MOVES = [
  { id: "overheat",   name: "오버히트",     type: "fire",    power: 90, accuracy: 90, category: "special" },
  { id: "hydro-pump", name: "하이드로펌프", type: "water",   power: 95, accuracy: 80, category: "special" },
  { id: "solar-beam", name: "광합성포",     type: "grass",   power: 90, accuracy: 90, category: "special" },
  { id: "blizzard",   name: "설풍",         type: "ice",     power: 85, accuracy: 85, category: "special" },
];

async function seedDenseParty(page: import("@playwright/test").Page, level: number) {
  await page.addInitScript(({ moves, level }) => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        party: [{ id: "flameling", level, uid: "dense-0", moves }],
        storage: [], dexSeen: [], dexCaught: [], materials: {},
        potions: {}, bestFloor: 0, storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [],
        equippedArtifacts: {
          "dense-0": [{
            instanceId: "dense-crit", itemId: "hunter_ring", name: "사냥꾼의 반지",
            quality: "rare", description: "", createdAt: 0,
            statBonuses: [{ stat: "critRate", value: 12 }],
            bonusStats: [{ type: "critDamage", value: 20, label: "치명타 데미지 +20%" }],
          }],
        },
      },
      version: 1,
    }));
  }, { moves: DENSE_MOVES, level });
}

/** 층은 라우트 state 로만 정해진다. history 에 심고 다시 읽힌다 (capture.spec.ts 와 같은 수법) */
async function enterFloor(page: import("@playwright/test").Page, floor: number) {
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate((f) => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: f } }, "");
  }, floor);
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);
}

test("fx: 커맨드 메뉴 기술 예측", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });

  // ① 1층 물속성 적. 배율(▲×2 / ▼×0.5)과 "쓰러뜨린다"가 같이 뜨는 화면
  await seedDenseParty(page, 30);
  await enterFloor(page, 1);
  await page.getByTestId("cmd-moves").click();
  await expect(page.locator('[data-testid^="move-"]')).toHaveCount(4);
  await expect(page.getByText("쓰러뜨린다").first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-preview-ko.png") });

  // ② 50층 오름. type 이 null 이라 배율이 없고, 한 방에 안 죽는다
  await enterFloor(page, 50);
  await page.getByTestId("cmd-moves").click();
  await expect(page.locator('[data-testid^="move-"]')).toHaveCount(4);
  await expect(page.getByText("쓰러뜨린다")).toHaveCount(0);
  await page.screenshot({ path: path.join(OUT, "_menu-preview-tough.png") });
});

test("fx: 커맨드 메뉴 2단", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript((fresh) => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.setItem("monster-rpg-player", fresh);
  }, FRESH_SAVE);
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 1단. 기술 하나로 합쳤다(예전엔 공격/스킬로 갈려 있었고, 특수기가 없는 몬스터는
  // "스킬"이 영구 비활성이었다). 시작 몬스터도 회색 버튼을 보지 않는다.
  await expect(page.getByTestId("cmd-moves")).toBeEnabled();
  await expect(page.getByTestId("cmd-bag")).toBeVisible();
  await expect(page.getByTestId("cmd-flee")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-root.png") });

  // 방향키(위)로 기술 칸에 올라가 확정
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-skill.png") });

  // ESC 로 1단 복귀
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cmd-moves")).toBeVisible();

  // 1단에서 ESC 는 아무 일도 없어야 한다
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cmd-moves")).toBeVisible();

  // 신규 게스트는 물약이 0개다 → 가방은 비활성이어야 하고 눌러도 안 열린다
  await expect(page.getByTestId("cmd-bag")).toBeDisabled();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cmd-moves")).toBeVisible();

  // 1층은 보스가 아니라 도망은 활성
  await expect(page.getByTestId("cmd-flee")).toBeEnabled();

  // 우클릭으로도 2단에서 뒤로 나온다
  await page.getByTestId("cmd-moves").click();
  await expect(page.getByTestId("cmd-back")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_menu-attack.png") });
  await page.getByTestId("battle-command").click({ button: "right" });
  await expect(page.getByTestId("cmd-moves")).toBeVisible();
});
