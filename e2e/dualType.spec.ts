import { test, expect, type Page } from "@playwright/test";

/**
 * 이중 속성이 **실제 전투까지** 살아 오는가.
 *
 * 유닛 시험(tests/dualType.test.ts)은 `getTypeMultiplier` 만 본다. 그런데 이 기능이
 * 깨질 수 있는 자리는 계산이 아니라 **전달 경로**다 — 세이브에서 꺼낼 때, 진화할 때,
 * 전투 상태로 옮길 때 `type2` 한 칸만 빠뜨리면 화면은 칩을 둘 그리는데 계산은 하나로 한다.
 * 실제로 진화가 그걸 빠뜨리고 있었다.
 *
 * 그래서 화면이 적는 배율을 읽는다. 상대 카드의 「받는 피해」는 이 게임에서 부속성이
 * 눈에 보이는 유일한 자리다.
 *
 * 실행: npx playwright test e2e/dualType.spec.ts
 */

const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });

function save(party: object[]) {
  return JSON.stringify({
    state: {
      party, storage: [], dexSeen: [], dexCaught: [], materials: {}, potions: {},
      bestFloor: 50, storyFlags: {}, questStatus: {},
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {}, imprint: {},
    },
    version: 2,
  });
}

async function enterFloor(page: Page, party: object[], floor: number) {
  await page.addInitScript(([s, a]) => {
    window.localStorage.setItem("monster-rpg-auth", a as string);
    window.localStorage.setItem("monster-rpg-player", s as string);
  }, [save(party), AUTH] as const);
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate((f) => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: f } }, "");
  }, floor);
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await expect(page.getByTestId("enemy-card")).toBeVisible();
}

/**
 * 24층은 톡사룡(독)이다. 크리샤는 얼음/크리스탈이라 독을 부속성 쪽에서 2배로 받는다
 * (독 → 얼음 1배 · 독 → 크리스탈 2배). `type2` 가 어디서든 빠지면 이 줄이 ×1 이 된다 —
 * 순수 얼음으로 계산했다는 뜻이고, 그게 정확히 잡으려는 고장이다.
 *
 * 젬 계열을 쓰지 않는 것은 그쪽이 순수 크리스탈이라서다. 받는 피해는 똑같이 ×2 라
 * `type2` 를 통째로 잃어도 이 줄이 안 움직인다 — 시험이 아무것도 안 재게 된다.
 */
test("얼음/크리스탈은 독을 2배로 받는다 — 세이브에서 꺼낸 개체도", async ({ page }) => {
  await enterFloor(page, [{ id: "crystafox", level: 30, uid: "d0" }], 24);

  await expect(page.getByTestId("enemy-threat")).toHaveText("받는 피해 ×2");
  // 얼음 → 독도 2배다. 두 속성이 각자 제 몫을 하는지 같이 본다
  await expect(page.getByTestId("enemy-advice")).toHaveText("내 공격 ×2");
});

/** 상대 칩도 둘이어야 한다. 화면과 계산이 같은 말을 하는지가 이 시험의 반쪽이다 */
test("이중 속성 상대는 칩이 둘 뜬다", async ({ page }) => {
  // 43층은 포자무스(풀/독)가 서 있는 층이다
  await enterFloor(page, [{ id: "burnox", level: 45, uid: "d0" }], 43);

  const card = page.getByTestId("enemy-card");
  await expect(card.getByText("풀", { exact: true })).toBeVisible();
  await expect(card.getByText("독", { exact: true })).toBeVisible();
  // 불꽃 → 풀 2배 · 불꽃 → 독 1배 = 2배. 곱이 살아 있는지 본다
  await expect(page.getByTestId("enemy-advice")).toHaveText("내 공격 ×2");
});

/**
 * 반대쪽. 젬 계열은 순수 크리스탈이라 칩이 **하나**여야 한다. 이 줄이 없으면
 * 부속성을 되붙이는 실수가 시험 어디에도 안 걸린다 — 화면은 칩을 둘 그리는데
 * 표에는 한 줄만 있는 상태로 조용히 지나간다.
 */
test("젬 계열은 칩이 하나다 — 순수 크리스탈", async ({ page }) => {
  // 37층은 젬토가 서 있는 층이다
  await enterFloor(page, [{ id: "burnox", level: 40, uid: "d0" }], 37);

  const card = page.getByTestId("enemy-card");
  await expect(card.getByText("크리스탈", { exact: true })).toBeVisible();
  await expect(card.getByText("얼음", { exact: true })).toHaveCount(0);
  // 불꽃 → 크리스탈은 1배다. 얼음이 붙어 있으면 여기가 ×2 로 뜬다
  await expect(page.getByTestId("enemy-advice")).toHaveText("내 공격 ×1");
});

/**
 * 「내 몬스터」도 칩을 둘 그리는가. 이 화면은 전투와 다른 표를 보고 있었으므로
 * (자기 사본 TYPE_KO 를 들고 있었다) 전투에서 맞다고 여기서도 맞은 것이 아니다.
 *
 * 진화가 부속성을 옮기는지는 tests/dualType.test.ts 가 본다 — 화면 없이 재는 게 맞다.
 */
test("「내 몬스터」도 이중 속성을 둘로 적는다", async ({ page }) => {
  await page.addInitScript(([s, a]) => {
    window.localStorage.setItem("monster-rpg-auth", a as string);
    window.localStorage.setItem("monster-rpg-player", s as string);
  }, [save([{ id: "bubldon", level: 40, uid: "d0" }]), AUTH] as const);

  await page.goto("/monsters");
  const card = page.getByTestId("party-card-d0");
  await expect(card).toBeVisible();
  await expect(card.getByText("물", { exact: true })).toBeVisible();
  await expect(card.getByText("독", { exact: true })).toBeVisible();
});
