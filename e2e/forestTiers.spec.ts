import { test, expect, type Page } from "@playwright/test";

/**
 * 구역 선택 화면 회귀 테스트.
 *
 * 배경을 원화 3종으로 갈아끼우면서 카드가 통째로 다시 쓰였다. 여기서 지키는 건
 * 겉모습이 아니라 그 아래 규칙이다 — 어디까지 열려 있는지, 잠긴 곳에 들어가지는
 * 않는지, 해금 조건이 맞는 층수를 말하는지. 이게 어긋나면 화면은 멀쩡해 보이는데
 * 플레이어만 못 들어간다.
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";

const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

const save = (bestFloor: number, potions: Record<string, number> = {}) =>
  JSON.stringify({
    state: {
      party: [{ id: "mossyfinal", level: 60, uid: "e2e-1", currentHp: 9999 }],
      storage: [], dexSeen: [], dexCaught: [],
      materials: {}, potions, bestFloor,
      storyFlags: {}, questStatus: {},
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    },
    version: 1,
  });

async function open(page: Page, bestFloor: number, potions?: Record<string, number>) {
  await page.addInitScript(({ a, p, g, s }) => {
    localStorage.setItem(a, g);
    localStorage.setItem(p, s);
  }, { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, s: save(bestFloor, potions) });
  await page.goto("/forest");
  await expect(page.locator('[data-testid="forest-tier-shallow"]')).toBeVisible();
}

const card = (page: Page, id: string) => page.locator(`[data-testid="forest-tier-${id}"]`);

/** 기본 선택은 갈 수 있는 가장 높은 구역이다. 이미 뚫어 놓은 곳을 다시 찾게 하지 않는다. */
const DEFAULT_TIER: [number, string][] = [
  [0,  "shallow"],
  [10, "shallow"],
  [11, "deep"],
  [20, "deep"],
  [21, "ancient"],
  [99, "ancient"],
];

for (const [bestFloor, expected] of DEFAULT_TIER) {
  test(`기본 선택 — ${bestFloor}층이면 ${expected}`, async ({ page }) => {
    await open(page, bestFloor);
    await expect(card(page, expected)).toHaveAttribute("data-selected", "1");
  });
}

test("해금 상태 — 층수 기준이 그대로다", async ({ page }) => {
  await open(page, 11);
  await expect(card(page, "shallow")).toHaveAttribute("data-locked", "0");
  await expect(card(page, "deep")).toHaveAttribute("data-locked", "0");
  await expect(card(page, "ancient")).toHaveAttribute("data-locked", "1");
});

test("잠긴 구역 — 눌러도 안 들어가고 해금 조건을 정확히 말한다", async ({ page }) => {
  await open(page, 0);

  const ancient = card(page, "ancient");
  await ancient.click();                       // 잠긴 카드의 클릭은 '보기'까지만
  await expect(ancient).toHaveAttribute("data-selected", "1");
  await expect(ancient).toContainText("무한의 탑 21층 도달 시 해금");
  await expect(ancient).toContainText("현재 최고 층: 0층");
  // 죽은 버튼을 남기지 않는다 — 해금 조건이 그 자리를 대신한다
  await expect(ancient).not.toContainText("탐험하기");

  await expect(card(page, "deep")).toContainText("무한의 탑 11층 도달 시 해금");

  // 화면을 벗어나지 않았다
  await expect(page).toHaveURL(/\/forest$/);
  await expect(page.locator('[data-testid^="forest-node-"]')).toHaveCount(0);
});

test("선택된 카드만 부가 정보와 탐험 버튼을 가진다", async ({ page }) => {
  await open(page, 0);

  const shallow = card(page, "shallow");
  await expect(shallow).toHaveAttribute("data-selected", "1");
  await expect(shallow).toContainText("SHALLOW WOODS");
  await expect(shallow).toContainText("랜덤 생성");
  await expect(shallow).toContainText("탐험하기");

  // 물러난 카드에는 영문 부제·플레이버·랜덤 생성 라벨이 없다
  const deep = card(page, "deep");
  await expect(deep).not.toContainText("DEEP FOREST");
  await expect(deep).not.toContainText("랜덤 생성");

  // 호버하면 그 카드로 넘어간다
  await deep.hover();
  await expect(deep).toHaveAttribute("data-selected", "1");
  await expect(shallow).toHaveAttribute("data-selected", "0");
  await expect(shallow).not.toContainText("SHALLOW WOODS");
});

test("속성 칩 — 고대 숲만 가려져 있다", async ({ page }) => {
  await open(page, 0);
  await expect(card(page, "shallow")).toContainText("불꽃");
  await expect(card(page, "deep")).toContainText("얼음");

  const ancient = card(page, "ancient");
  await expect(ancient).toContainText("?");
  await expect(ancient).not.toContainText("풀");
});

test("배경 3종이 호버 전에 이미 받아져 있다", async ({ page }) => {
  await open(page, 0);

  // 아직 아무것도 호버하지 않은 시점. 세 장 다 디코딩까지 끝나 있어야
  // 첫 호버에 흰 프레임이 스치지 않는다.
  const loaded = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>(".forest-backdrop-layer"))
      .map((img) => ({ src: new URL(img.src).pathname, ok: img.complete && img.naturalWidth > 0 })),
  );

  expect(loaded.map((l) => l.src).sort()).toEqual([
    "/assets/forest/forest_ancient.webp",
    "/assets/forest/forest_deep.webp",
    "/assets/forest/forest_shallow.webp",
  ]);
  expect(loaded.every((l) => l.ok), `아직 안 받아진 배경이 있다: ${JSON.stringify(loaded)}`).toBe(true);
});

test("prefers-reduced-motion 이면 크로스페이드 없이 즉시 바뀐다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 0);

  const transitions = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".forest-backdrop-layer"))
      .map((el) => getComputedStyle(el).transitionDuration));
  expect(transitions.every((d) => d === "0s"), `배경이 아직 애니메이션한다: ${transitions}`).toBe(true);

  const card = await page.evaluate(() => {
    const el = document.querySelector(".tier-card");
    return el ? getComputedStyle(el).transitionDuration : null;
  });
  expect(card).toBe("0s");
});

test("얕은 숲 진입 · 상단 UI 가 그대로다", async ({ page }) => {
  await open(page, 0, { small: 3 });

  // 상단 우측 재화 표시
  await expect(page.getByText("×3")).toBeVisible();
  // 베이스캠프로 나가는 길
  await expect(page.getByRole("button", { name: /베이스캠프/ })).toBeVisible();

  await card(page, "shallow").click();
  await expect(page.locator('[data-testid^="forest-node-"]').first()).toBeVisible({ timeout: 20_000 });
  // 들어간 뒤에도 재화는 그대로 보인다
  await expect(page.getByText("×3")).toBeVisible();
});
