import { test, expect, type Page } from "@playwright/test";

/**
 * 도감 목록이 실제로 굴러가는지 본다.
 *
 * 이 게임은 스크롤바를 전역에서 숨긴다(index.css). 그래서 스크롤이 죽어도 화면은
 * 멀쩡해 보이고, 첫 화면에 들어온 몬스터만 있는 것처럼 읽힌다. 실제로 오래 그랬다.
 * 눈으로 안 잡히는 고장이라 굴려 보는 수밖에 없다.
 *
 * 실행: npx playwright test e2e/dexScroll.spec.ts
 */

const PLAYER_KEY = "monster-rpg-player";
const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

const SAVE = JSON.stringify({
  state: {
    party: [{ id: "flameling", level: 20, uid: "e0" }],
    storage: [],
    dexSeen: ["flameling"], dexCaught: ["flameling"],
    materials: {}, potions: {}, bestFloor: 0,
    storyFlags: { met_orion: true }, questStatus: {}, seenDialogues: ["orion_intro"],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    imprint: {},
  },
  version: 2,
});

async function openDex(page: Page) {
  await page.addInitScript(
    ([pk, pv, ak, av]) => {
      window.localStorage.setItem(ak as string, av as string);
      window.localStorage.setItem(pk as string, pv as string);
    },
    [PLAYER_KEY, SAVE, "monster-rpg-auth", AUTH] as const,
  );
  await page.goto("/");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __phaserGame?: { scene?: { getScene?: (k: string) => unknown } } }).__phaserGame;
    const s = g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null;
    return Boolean(s?.player);
  }, undefined, { timeout: 30_000 });
  await page.locator("button", { hasText: "메뉴" }).first().click();
  await page.locator("button").filter({ hasText: /^도감$/ }).first().click();
  await expect(page.getByText("몬스터 도감")).toBeVisible();
}

/** 목록을 감싼 스크롤 칸 */
const scroller = (page: Page) =>
  page.locator("div.overflow-y-auto").filter({ has: page.locator("div.grid") }).first();

/**
 * 넘치는 크기에서 본다. 넓고 높은 화면에서는 14종이 여섯 열로 서서 스크롤이 아예 안 생긴다.
 * 그건 정상이고, 여기서 보려는 건 넘칠 때 굴러가느냐다. 세로를 낮춰 넘치는 상태를 만든다.
 */
test("도감 목록은 넘치는 만큼 굴러간다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await openDex(page);

  const box = scroller(page);
  // 넘칠 게 있어야 시험이 성립한다. 칸이 넓어지거나 종이 줄어 다 들어오면 여기서 알린다
  const { clientH, scrollH } = await box.evaluate((el) => ({
    clientH: el.clientHeight, scrollH: el.scrollHeight,
  }));
  expect(scrollH, `이 크기에서도 도감이 한 화면에 다 들어온다 (${scrollH} ≤ ${clientH}) — 시험 크기를 다시 잡을 것`)
    .toBeGreaterThan(clientH);

  await box.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);

  // 끝까지 굴러 마지막 줄이 실제로 나온다
  await box.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => box.evaluate((el) => el.scrollTop + el.clientHeight)).toBe(scrollH);
});

test("좁은 화면에서도 굴러간다", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await openDex(page);

  const box = scroller(page);
  await box.hover();
  await page.mouse.wheel(0, 800);
  await expect.poll(() => box.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
