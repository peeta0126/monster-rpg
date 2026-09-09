import { test, expect, type Page } from "@playwright/test";

/**
 * 가방에서 버리기.
 *
 *   npx playwright test e2e/bagDiscard.spec.ts
 *
 * 예전 방식(「−1」·「전체」 + 그 자리에서 "확인?")이 남긴 문제를 둘 다 본다.
 *  - 개수를 고르는 것이 실제로 그 개수만 지우는가. 슬라이더를 끌지 않고 **방향키로**
 *    맞춘다 — 사람에게 "미세 조정은 좌우키"라고 약속한 경로가 그것이라서다.
 *  - 취소 버튼이 없다. 상자 밖을 누르는 것이 취소인데, 그 규칙이 "다른 칸의 삭제를
 *    눌러 옮겨 열기"까지 잡아먹으면 안 된다.
 *  - 장비는 확인창을 지나야만 나가는가. 취소가 진짜 취소인지도 같이 본다.
 */

const HERB_START = 9;
const ARTIFACT_COUNT = 2;

async function seed(page: Page) {
  await page.addInitScript(({ herb, artifacts }) => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
    }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        party: [{ id: "mossevo", level: 20, uid: "u0" }],
        storage: [], dexSeen: ["mossevo"], dexCaught: ["mossevo"],
        materials: { herb, magic_dust: 4 },
        potions: { potion: 5 },
        craftedPotions: [
          { stackId: "potion_normal", itemId: "potion", name: "회복 물약", quality: "normal", quantity: 5 },
        ],
        craftedArtifacts: Array.from({ length: artifacts }, (_, i) => ({
          instanceId: `a${i}`,
          itemId: "power_necklace",
          name: "힘의 목걸이",
          quality: "normal",
          description: "",
          statBonuses: [{ stat: "attack", value: 5 }],
          createdAt: 0,
          level: 1,
          enhancement: 0,
          source: "crafting",
        })),
        bestFloor: 5,
        storyFlags: { met_orion: true }, questStatus: {}, seenDialogues: ["orion_intro"],
        craftedItems: [], equippedArtifacts: {}, imprint: {},
      },
      version: 2,
    }));
  }, { herb: HERB_START, artifacts: ARTIFACT_COUNT });
}

/** 저장된 세이브에서 재료 개수를 읽는다. 화면의 숫자가 아니라 실제로 남은 값을 본다 */
const materialCount = (page: Page, id: string) => page.evaluate((k) => {
  const raw = JSON.parse(localStorage.getItem("monster-rpg-player") ?? "{}");
  return raw?.state?.materials?.[k] ?? 0;
}, id);

test("가방: 개수를 골라 재료를 버린다 (방향키로 맞춘다)", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "재료" }).first().click();

  await expect(page.getByText("×9")).toBeVisible();
  await page.getByTestId("discard-trigger").first().click();

  // 열리면 손잡이가 이미 잡혀 있어야 한다. 그래야 방향키가 바로 듣는다
  const slider = page.getByRole("slider");
  await expect(slider).toBeFocused();
  await expect(slider).toHaveValue("1");

  // 1 → 4. 오른쪽 세 번
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("4");

  await page.getByTestId("discard-amount-apply").click();

  // 한 번 눌러 넷이 나간다. 확인 창도, 네 번의 클릭도 없다
  await expect(page.getByText(`×${HERB_START - 4}`)).toBeVisible();
  expect(await materialCount(page, "herb")).toBe(HERB_START - 4);
  await expect(page.getByRole("slider")).toHaveCount(0);
});

test("가방: 다른 데를 누르면 개수 상자가 닫히고 아무것도 안 나간다", async ({ page }) => {
  // 취소 버튼은 없다. 상자 밖을 누르는 것이 취소다
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "재료" }).first().click();
  await page.getByTestId("discard-trigger").first().click();
  await page.keyboard.press("ArrowRight");

  await page.getByText("MATERIALS").click();

  await expect(page.getByRole("slider")).toHaveCount(0);
  expect(await materialCount(page, "herb")).toBe(HERB_START);
});

test("가방: 다른 칸의 삭제를 누르면 그 칸으로 옮겨 열린다", async ({ page }) => {
  // 밖을 누르면 닫히는 규칙이 "다른 칸 열기"를 잡아먹으면 안 된다.
  // 닫기가 먼저(pointerdown) 지나가고 여는 것이 뒤(click)에 와야 한다
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "재료" }).first().click();

  await page.getByTestId("discard-trigger").first().click();
  await expect(page.getByRole("slider")).toHaveCount(1);

  await page.getByTestId("discard-trigger").nth(1).click();
  await expect(page.getByRole("slider")).toHaveCount(1);
  await expect(page.getByRole("slider")).toHaveValue("1");

  // 두 번째 칸은 마법 가루 4개다. 상한이 그 칸의 개수를 따라와야 한다
  await expect(page.getByRole("slider")).toHaveAttribute("max", "4");
});

test("가방: 같은 삭제를 다시 누르면 닫힌다", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "재료" }).first().click();

  await page.getByTestId("discard-trigger").first().click();
  await expect(page.getByRole("slider")).toHaveCount(1);
  await page.getByTestId("discard-trigger").first().click();
  await expect(page.getByRole("slider")).toHaveCount(0);
  expect(await materialCount(page, "herb")).toBe(HERB_START);
});

test("가방: 물약도 개수를 골라 버린다", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "물약" }).first().click();
  await page.getByTestId("discard-trigger").first().click();

  const slider = page.getByRole("slider");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("2");
  await page.getByTestId("discard-amount-apply").click();

  // 가방 표시 스택과 전투 재고는 딴 필드다. 한쪽만 줄면 개수가 어긋난다
  const left = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("monster-rpg-player") ?? "{}").state;
    return { bag: s.craftedPotions?.[0]?.quantity ?? 0, battle: s.potions?.potion ?? 0 };
  });
  expect(left).toEqual({ bag: 3, battle: 3 });
});

test("가방: 장비는 확인 창을 지나야 나간다", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "아티팩트" }).first().click();

  const cards = () => page.evaluate(() =>
    JSON.parse(localStorage.getItem("monster-rpg-player") ?? "{}").state?.craftedArtifacts?.length ?? 0);

  // 취소는 진짜 취소다
  await page.getByRole("button", { name: "버리기" }).first().click();
  await expect(page.getByText("정말 삭제하시겠습니까?")).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  expect(await cards()).toBe(ARTIFACT_COUNT);

  // ESC 로 닫아도 가방 화면까지 나가진 않는다
  await page.getByRole("button", { name: "버리기" }).first().click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/farm$/);
  expect(await cards()).toBe(ARTIFACT_COUNT);

  // 확인을 누르면 그 하나만 나간다
  await page.getByRole("button", { name: "버리기" }).first().click();
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByTestId("confirm-dialog")).toHaveCount(0);
  expect(await cards()).toBe(ARTIFACT_COUNT - 1);
});
