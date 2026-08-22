import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { walkTo } from "./workshopNav";
import { CRAFTING_STATIONS } from "../src/workshop/workshopLayout";
import { MATERIALS, POTIONS } from "../src/shared/items";

/**
 * 아이템 아이콘이 실제 화면에서 어떻게 보이는지 남긴다. npm run design:shot
 *
 * capture.spec.ts 는 일부러 **빈 가방**을 찍는다("가장 휑한 화면이 문제를 제일 잘 보여준다").
 * 그래서 정작 아이콘이 한 칸도 안 나온다. 21종을 다 채운 세이브는 여기서만 심는다.
 *
 * 여기서 보는 것: 픽셀이 살아 있는가, 칸을 넘치지 않는가, 그림과 SVG 폴백이 섞인 줄이
 * 흔들리지 않는가, 배경이 투명한가(흰 네모가 보이면 실패다).
 */

const OUT = path.resolve(process.cwd(), "design", "screenshots", "current");

const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

const ARTIFACTS = [
  { itemId: "power_necklace", name: "힘의 목걸이",   quality: "rare" },
  // 등급은 세 가지뿐이다(normal·rare·elite). 예전에 epic·common 이 적혀 있었는데
  // 그런 등급이 없어서 캡처에 등급 줄이 통째로 비어 있었다.
  { itemId: "guard_bracelet", name: "수호의 팔찌",   quality: "elite" },
  { itemId: "spirit_amulet",  name: "정령의 부적",   quality: "normal" },
] as const;

/** 21종이 한 화면에 다 서는 세이브. 재료는 넉넉히 — 제작 창의 "보유"도 같이 보고 싶다. */
function fullBag() {
  return JSON.stringify({
    state: {
      party: [{ id: "flameling", level: 12, uid: "icons-0" }],
      storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
      materials: Object.fromEntries(MATERIALS.map((m, i) => [m.id, 12 + i * 3])),
      potions: Object.fromEntries(POTIONS.map((p) => [p.id, 4])),
      bestFloor: 12,
      storyFlags: { met_orion: true }, questStatus: {},
      craftedItems: [],
      craftedArtifacts: ARTIFACTS.map((a, i) => ({
        instanceId: `icons-art-${i}`, itemId: a.itemId, name: a.name, quality: a.quality,
        description: "", createdAt: 0, statBonuses: [{ stat: "attack", value: 6 + i }],
        level: 1 + i, enhancement: i, source: "crafting",
      })),
      craftedPotions: POTIONS.map((p) => ({
        stackId: `${p.id}_common`, itemId: p.id, name: p.name, quality: "common", quantity: 4,
      })),
      equippedArtifacts: {},
      imprint: {},
    },
    version: 1,
  });
}

async function seed(page: Page) {
  await page.addInitScript(([auth, save]) => {
    window.localStorage.setItem("monster-rpg-auth", auth as string);
    // addInitScript 는 네비게이션마다 돈다. 공방에서 만든 것이 사라지지 않게 없을 때만 심는다.
    if (!window.localStorage.getItem("monster-rpg-player")) {
      window.localStorage.setItem("monster-rpg-player", save as string);
    }
  }, [AUTH, fullBag()]);
}

async function settle(page: Page) {
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scene-transition"]') === null,
    undefined, { timeout: 10_000 },
  );
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.fonts.status === "loaded");
  // 아이콘이 하나라도 깨진 채로 찍히면 "픽셀이 뭉갰나" 를 볼 수가 없다.
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  await page.waitForTimeout(600);
}

/** 그림으로 나가야 할 아이콘이 정말 그림으로 나갔는지 — 화면을 보기 전에 못 박는다 */
async function expectRasterIcons(page: Page, atLeast: number) {
  const srcs = await page.locator("img").evaluateAll(
    (els) => els.map((e) => (e as HTMLImageElement).getAttribute("src") ?? ""));
  const raster = srcs.filter((s) => s.includes("/assets/icons/"));
  expect(raster.length, "그림 아이콘이 한 칸도 안 나왔다 — 폴백으로 떨어졌다").toBeGreaterThanOrEqual(atLeast);
  const broken = await page.locator('img[src*="/assets/icons/"]').evaluateAll(
    (els) => els.filter((e) => (e as HTMLImageElement).naturalWidth === 0)
      .map((e) => (e as HTMLImageElement).src));
  expect(broken, "못 읽은 아이콘 파일이 있다").toEqual([]);
}

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test("capture: icons-bag", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await expect(page.locator("#root")).not.toBeEmpty();
  await settle(page);
  await expectRasterIcons(page, 18);
  await page.screenshot({ path: path.join(OUT, "icons-bag.png"), fullPage: true });
});

test("capture: icons-battle-bag", async ({ page }) => {
  await seed(page);
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  // 커맨드 메뉴 → 가방. 물약을 심었으니 열린다(비었으면 버튼이 disabled 다).
  await page.getByTestId("cmd-bag").click();
  await settle(page);
  await expectRasterIcons(page, 4);
  await page.screenshot({ path: path.join(OUT, "icons-battle-bag.png") });
});

test.describe("공방", () => {
  // 걸어가는 데 시간이 걸린다. 기본 타임아웃으로는 모루까지 못 간다.
  test.slow();

  const APPROACH = 0.8;

  test("capture: icons-craft", async ({ page }) => {
    await seed(page);
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]')).toBeVisible();
    await page.waitForTimeout(300);
    const bench = CRAFTING_STATIONS.find((s) => s.id === "artifact-workbench")!;
    expect(await walkTo(page, bench, APPROACH * bench.radius)).toBe(true);
    await expect(page.getByText(`${bench.label} 사용하기`)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "아티팩트 제작대" })).toBeVisible();
    await settle(page);
    await expectRasterIcons(page, 3);
    await page.screenshot({ path: path.join(OUT, "icons-craft.png") });
  });

  test("capture: icons-anvil", async ({ page }) => {
    await seed(page);
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]')).toBeVisible();
    await page.waitForTimeout(300);
    const anvil = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;
    expect(await walkTo(page, anvil, APPROACH * anvil.radius)).toBe(true);
    await expect(page.getByText(`${anvil.label} 사용하기`)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();
    await settle(page);
    // 모루 탭(강화·분해…)은 그림 파일이 없어 SVG 로 나간다. 아티팩트와 강화석은 그림이다.
    await expectRasterIcons(page, 3);
    await page.screenshot({ path: path.join(OUT, "icons-anvil.png") });
  });
});
