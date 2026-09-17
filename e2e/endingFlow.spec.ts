import { test, expect, type Page } from "@playwright/test";

const PLAYER_KEY = "monster-rpg-player";
const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

const ALL_ORION_STORY_BEFORE_END = [
  "orion_intro", "orion_after_baros", "orion_first_capture", "orion_quest_medicine",
  "orion_floor_10", "orion_floor_20", "orion_floor_40", "orion_floor_50",
];

function save(overrides: Record<string, unknown>) {
  return JSON.stringify({
    state: {
      party: [{ id: "flameling", level: 50, uid: "ending-e0" }],
      storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
      materials: {}, potions: {}, bestFloor: 50,
      storyFlags: {
        met_orion: true, met_baros: true, first_capture: true,
        quest_baros_done: true, quest_orion_done: true, tower_cleared: false,
      },
      questStatus: {}, seenDialogues: ALL_ORION_STORY_BEFORE_END,
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      imprint: {},
      ...overrides,
    },
    version: 2,
  });
}

async function open(page: Page, saveJson: string, path = "/") {
  await page.addInitScript(([player, auth, playerKey]) => {
    localStorage.setItem(playerKey as string, player as string);
    localStorage.setItem("monster-rpg-auth", auth as string);
  }, [saveJson, AUTH, PLAYER_KEY] as const);
  await page.goto(path);
}

async function waitForCamp(page: Page) {
  await page.waitForFunction(() => {
    const game = (window as unknown as { __phaserGame?: { scene?: { getScene?: (key: string) => unknown } } }).__phaserGame;
    const scene = game?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | undefined;
    return Boolean(scene?.player);
  }, undefined, { timeout: 30_000 });
}

async function talkToOrion(page: Page) {
  await waitForCamp(page);
  await page.evaluate(() => {
    const game = (window as unknown as {
      __phaserGame: { scene: { getScene: (key: string) => { player: { setPosition: (x: number, y: number) => void } } } };
    }).__phaserGame;
    game.scene.getScene("BaseCampScene").player.setPosition(1090, 2010);
  });
  await page.waitForTimeout(150);
  await page.keyboard.press("x");
  await expect(page.locator("img[alt='Orion']")).toBeVisible();
}

async function finishDialogue(page: Page, maxLines = 20) {
  for (let i = 0; i < maxLines; i++) {
    const portrait = page.locator("img[alt='Orion']");
    if (!(await portrait.isVisible().catch(() => false))) return;
    await page.keyboard.press("x");
    await page.waitForTimeout(100);
  }
  throw new Error("오리온 대화가 제한 줄 안에 끝나지 않았다");
}

function readState(page: Page) {
  return page.evaluate((playerKey) => JSON.parse(localStorage.getItem(playerKey as string)!).state, PLAYER_KEY);
}

test("50층 클리어만으로 /ending에 직접 들어갈 수 없다", async ({ page }) => {
  await open(page, save({ materials: { ormr_essence: 1 }, seenDialogues: [] }), "/ending");
  await expect(page).toHaveURL(/\/$/);
});

test("치료약을 제작했어도 전달 전에는 /ending에 직접 들어갈 수 없다", async ({ page }) => {
  await open(page, save({
    potions: { mothers_cure_potion: 1 },
    craftedPotions: [{
      stackId: "mothers_cure_potion_rare", itemId: "mothers_cure_potion",
      name: "어머니의 치료약", quality: "rare", quantity: 1,
    }],
    questStatus: { orion_mothers_cure: "in_progress" },
  }), "/ending");
  await expect(page).toHaveURL(/\/$/);
});

test("치료약 전달의 마지막 대사 뒤에만 엔딩이 시작되고 캠프로 복귀한다", async ({ page }) => {
  await open(page, save({
    potions: { mothers_cure_potion: 1 },
    craftedPotions: [{
      stackId: "mothers_cure_potion_rare", itemId: "mothers_cure_potion",
      name: "어머니의 치료약", quality: "rare", quantity: 1,
    }],
    questStatus: { orion_mothers_cure: "in_progress" },
  }));

  await talkToOrion(page);
  await expect(page.getByText("…완성했구나.")).toBeVisible();
  const handedOver = await readState(page);
  expect(handedOver.potions.mothers_cure_potion).toBe(0);
  expect(handedOver.questStatus.orion_mothers_cure).toBe("completed");
  expect(handedOver.storyFlags.tower_cleared).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page.locator("img[alt='Orion']")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await finishDialogue(page);
  await expect(page.getByTestId("ending-fade")).toBeVisible();
  const delivered = await readState(page);
  expect(delivered.potions.mothers_cure_potion).toBe(0);
  expect(delivered.craftedPotions).toHaveLength(0);
  expect(delivered.questStatus.orion_mothers_cure).toBe("completed");
  expect(delivered.storyFlags.tower_cleared).toBe(false);

  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByText("THE END")).toBeVisible();
  expect((await readState(page)).storyFlags.tower_cleared).toBe(true);
  await expect(page.getByTestId("ending-scene-credits")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("SPECIAL THANKS")).toBeVisible();
  await expect(page.getByText("THANK YOU FOR PLAYING")).toBeVisible({ timeout: 13_000 });
  await expect(page).toHaveURL(/\/$/, { timeout: 6_000 });

  await talkToOrion(page);
  await finishDialogue(page);
  await page.waitForTimeout(1600);
  await expect(page).toHaveURL(/\/$/);
  const afterReplayCheck = await readState(page);
  expect(afterReplayCheck.potions.mothers_cure_potion).toBe(0);
});

test("tower_cleared 세이브는 엔딩 다시보기에 바로 들어갈 수 있다", async ({ page }) => {
  await open(page, save({
    storyFlags: {
      met_orion: true, met_baros: true, first_capture: true,
      quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
    },
  }), "/ending");
  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByText("THE END")).toBeVisible();
});
