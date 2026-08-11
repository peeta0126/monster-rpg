import { test, expect, type Page } from "@playwright/test";

/**
 * 숲 원정 회귀 테스트.
 *
 * 목적은 밸런스가 아니라 "걷다가 막다른 화면에 갇히지 않는가"다. 걸음마다 다른
 * 사건 패널이 뜨는데 그중 하나라도 다음 버튼을 안 내주면 플레이어가 갇힌다.
 * 끝나는 길은 둘뿐이다 — 자진 귀환과 강제 퇴각.
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";

const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

const SAVE = JSON.stringify({
  state: {
    party: [{ id: "mossyfinal", level: 60, uid: "e2e-1", currentHp: 9999 }],
    storage: [], dexSeen: [], dexCaught: [],
    materials: {}, potions: {}, bestFloor: 0,
    storyFlags: {}, questStatus: {},
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
  },
  version: 1,
});

async function seed(page: Page) {
  await page.addInitScript(({ a, p, g, s }) => {
    localStorage.setItem(a, g);
    localStorage.setItem(p, s);
  }, { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, s: SAVE });
}

async function clickIfVisible(page: Page, testId: string): Promise<boolean> {
  const btn = page.locator(`[data-testid="${testId}"]`);
  if ((await btn.count()) === 0) return false;
  const first = btn.first();
  if (!(await first.isVisible())) return false;
  await first.click();
  await page.waitForTimeout(120);
  return true;
}

async function enterShallow(page: Page) {
  await seed(page);
  await page.goto("/forest");
  const card = page.locator('[data-testid="forest-tier-shallow"]');
  await expect(card).toBeVisible();
  await card.click();
  // 첫 걸음이 갈림길일 수도 있다 — 둘 중 하나가 뜨면 원정이 시작된 것이다
  await expect(
    page.locator('[data-testid="forest-step-panel"], [data-testid="forest-fork"]').first(),
  ).toBeVisible({ timeout: 20_000 });
}

/** 한 걸음을 끝까지 처리한다. 사건 종류에 따라 거쳐야 하는 화면이 다르다 */
async function walkOneStep(page: Page): Promise<void> {
  for (let i = 0; i < 30; i++) {
    if ((await page.locator('[data-testid="forest-settle"]').count()) > 0) return;

    if (await clickIfVisible(page, "forest-fork-0")) continue;         // 갈림길이면 한쪽을 고른다
    if (await clickIfVisible(page, "forest-step-action")) return;      // 사건 진입 또는 마무리
    if (await clickIfVisible(page, "forest-nest-pick-0")) continue;    // 둥지에서 한 마리 고른다
    if (await clickIfVisible(page, "forest-rps-rock")) continue;       // 포획 시도
    if (await clickIfVisible(page, "forest-rps-done")) continue;       // 결과 확인
    await page.waitForTimeout(200);
  }
  // 막히면 무엇이 떠 있었는지까지 남긴다 — 빈 화면이면 크래시고, 버튼이 있으면 흐름 문제다
  const buttons = await page.getByRole("button").allInnerTexts();
  const body = (await page.locator("body").innerText()).slice(0, 300);
  throw new Error(
    `걸음에서 다음으로 넘어갈 방법을 찾지 못했습니다 (막다른 화면)
` +
    `  버튼: ${JSON.stringify(buttons)}
  본문: ${body}`,
  );
}

test("숲 원정 — 걷다가 갇히지 않는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await enterShallow(page);

  const alert = page.locator('[data-testid="forest-alert"]');
  await expect(alert).toBeVisible();
  const startAlert = Number(await alert.getAttribute("data-alert"));

  let steps = 0;
  for (; steps < 12; steps++) {
    if ((await page.locator('[data-testid="forest-settle"]').count()) > 0) break;
    await walkOneStep(page);
    await walkOneStep(page);   // 진입 → 마무리로 두 번 눌러야 한 걸음이 끝난다
  }

  expect(steps, "한 걸음도 진행하지 못했습니다").toBeGreaterThan(0);

  // 소란은 걷는 동안 움직여야 한다 — 안 움직이면 다이얼이 죽은 것이다
  if ((await alert.count()) > 0) {
    const now = Number(await alert.getAttribute("data-alert"));
    expect(now, "여러 걸음을 걸었는데 소란도가 그대로다").not.toBe(startAlert);
  }

  expect(errors, `원정 중 예외: ${errors.join(" / ")}`).toHaveLength(0);
});

test("자진 귀환 — 100% 회수로 정산된다", async ({ page }) => {
  await enterShallow(page);

  // 한 걸음은 걸어서 가방에 뭔가 담길 기회를 준다
  await walkOneStep(page);
  await walkOneStep(page);

  await page.locator('[data-testid="forest-go-home"]').click();

  const settle = page.locator('[data-testid="forest-settle"]');
  await expect(settle).toBeVisible();
  await expect(settle).toHaveAttribute("data-reason", "voluntary");

  await page.locator('[data-testid="forest-settle-confirm"]').click();
  // 정산이 끝나면 구역 선택으로 돌아온다
  await expect(page.locator('[data-testid="forest-tier-shallow"]')).toBeVisible();
});

test("돌아가기 버튼 옆에 지금 확정될 수확이 늘 적혀 있다", async ({ page }) => {
  await enterShallow(page);
  // 뱅킹은 정보가 있어야 결정이 된다
  await expect(page.locator('[data-testid="forest-banked"]')).toBeVisible();
  await expect(page.locator('[data-testid="forest-scout"]')).toBeVisible();
});
