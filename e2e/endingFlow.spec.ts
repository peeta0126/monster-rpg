import { test, expect, type Page } from "@playwright/test";

const PLAYER_KEY = "monster-rpg-player";
const AUTH = JSON.stringify({
  state: { token: null, username: "very_long_player_name_123", isGuest: true, isDev: false },
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
  await page.keyboard.press("Space");
  await expect(page.locator("img[alt='Orion']")).toBeVisible();
}

async function finishDialogue(page: Page, maxLines = 20) {
  for (let i = 0; i < maxLines; i++) {
    const portrait = page.locator("img[alt='Orion']");
    if (!(await portrait.isVisible().catch(() => false))) return;
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
  }
  throw new Error("오리온 대화가 제한 줄 안에 끝나지 않았다");
}

function readState(page: Page) {
  return page.evaluate((playerKey) => JSON.parse(localStorage.getItem(playerKey as string)!).state, PLAYER_KEY);
}

const ENDING_STORY = [
  { id: "reunion", first: "...여긴...", last: "처음부터 이야기해 드릴게요.", lineCount: 8 },
  { id: "the-beginning", first: "모든 건 그날부터 시작됐어요.", last: "어떻게 해야 어머니를 다시 깨울 수 있는지도...", lineCount: 5 },
  { id: "first-companion", first: "그때 촌장님이 저를 도와주셨어요.", last: "하지만 이 아이가 계속 제 곁에 있어 줬어요.", lineCount: 5 },
  { id: "the-journey", first: "그 뒤로 정말 많은 곳을 돌아다녔어요.", last: "그러면서 조금씩 강해졌어요.", lineCount: 7 },
  { id: "infinite-tower", first: "그리고 결국...", last: "꼭 어머니를 다시 만나고 싶었으니까.", lineCount: 12 },
  { id: "home-again", first: "...그런 일이 있었구나.", last: "다녀왔어요, 어머니.", lineCount: 7 },
] as const;

async function playEndingStory(page: Page) {
  const story = page.getByTestId("ending-scene-story");

  for (let sceneIndex = 0; sceneIndex < ENDING_STORY.length; sceneIndex++) {
    const expected = ENDING_STORY[sceneIndex];
    await expect(story).toHaveAttribute("data-story-id", expected.id, { timeout: 5_000 });
    await expect(story).toHaveAttribute("data-story-phase", "dialogue", { timeout: 3_000 });
    await expect(page.locator(".ending-dialogue-text")).toHaveText(expected.first);
    let firstAdvance = 0;

    if (sceneIndex === 0) {
      await expect(page.locator(".ending-dialogue-speaker")).toHaveText("어머니");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await expect(page.locator(".ending-dialogue-speaker")).toHaveText("very_long_player_name_123");
      await expect(page.locator(".ending-dialogue-speaker")).toHaveAttribute("title", "very_long_player_name_123");
      const layout = await page.evaluate(() => {
        const frame = document.querySelector<HTMLElement>(".ending-story-frame")!.getBoundingClientRect();
        const panel = document.querySelector<HTMLElement>(".ending-dialogue-panel")!.getBoundingClientRect();
        const speaker = document.querySelector<HTMLElement>(".ending-dialogue-speaker")!.getBoundingClientRect();
        const text = document.querySelector<HTMLElement>(".ending-dialogue-text")!.getBoundingClientRect();
        return {
          panelRatio: panel.height / frame.height,
          columnsDoNotOverlap: speaker.right <= text.left,
          pageDoesNotOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
      });
      expect(layout.panelRatio).toBeGreaterThanOrEqual(0.18);
      expect(layout.panelRatio).toBeLessThanOrEqual(0.24);
      expect(layout.columnsDoNotOverlap).toBe(true);
      expect(layout.pageDoesNotOverflow).toBe(true);
      firstAdvance = 1;
    }

    // 마지막 현재 장면은 최종 대사를 2.6초 보여 준 뒤 스스로 암전한다.
    const advances = sceneIndex === ENDING_STORY.length - 1
      ? expected.lineCount - 1
      : expected.lineCount;
    for (let line = firstAdvance; line < advances; line++) {
      if (line % 3 === 0) await page.keyboard.press("Enter");
      else if (line % 3 === 1) await page.keyboard.press("Space");
      else await story.click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(200);
    }

    if (sceneIndex === ENDING_STORY.length - 1) {
      await expect(page.locator(".ending-dialogue-text")).toHaveText(expected.last);
    }
  }

  await expect(page.getByTestId("ending-scene-end")).toBeVisible({ timeout: 5_000 });
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

test("치료약 전달 뒤 회상 엔딩 전체가 재생되고 캠프로 복귀한다", async ({ page }) => {
  test.setTimeout(90_000);
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
  await expect(page.getByTestId("ending-scene-story")).toHaveAttribute("data-story-id", "reunion", { timeout: 5_000 });
  await expect(page.locator(".ending-story-image")).toHaveAttribute("src", "/assets/ending/스토리 0장.png");
  expect((await readState(page)).storyFlags.tower_cleared).toBe(true);
  await playEndingStory(page);
  await expect(page.getByText("THE END")).toBeVisible();
  await expect(page.getByTestId("ending-scene-credits")).toBeVisible({ timeout: 6_000 });
  await expect(page.getByText("건국대학교 컴퓨터공학과 졸업작품")).toBeVisible();
  // 크레딧은 EndingPage 의 CREDITS_DURATION(34초) 동안 굴러간다. 늘렸으면 여기도 늘릴 것.
  await expect(page.getByText("THANK YOU FOR PLAYING")).toBeVisible({ timeout: 38_000 });
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
  await expect(page.getByTestId("ending-scene-story")).toHaveAttribute("data-story-id", "reunion", { timeout: 5_000 });
  await expect(page.getByText("...여긴...")).toBeVisible({ timeout: 3_000 });
  expect((await readState(page)).storyFlags.tower_cleared).toBe(true);
});
