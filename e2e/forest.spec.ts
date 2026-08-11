import { test, expect, type Page } from "@playwright/test";

/**
 * 숲 탐험 회귀 테스트.
 *
 * 목적은 밸런스가 아니라 "노드 맵을 돌다가 막다른 곳에 빠지지 않는가"다.
 * 노드 타입마다 다른 화면이 뜨는데(전투·채집·이벤트·휴식·강적·보스) 그중 하나라도
 * 다음 버튼을 안 내주면 플레이어가 갇힌다. 지금까지 이 경로에는 자동 검증이 없었다.
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";

const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

/** 숲에서 만나는 야생 몬스터를 이길 수 있을 만큼만 키워둔다 */
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

/** 화면에 보이면 누른다. 눌렀으면 true. */
async function clickIfVisible(page: Page, name: RegExp): Promise<boolean> {
  const btn = page.getByRole("button", { name });
  if ((await btn.count()) === 0) return false;
  const first = btn.first();
  if (!(await first.isVisible())) return false;
  await first.click();
  await page.waitForTimeout(250);
  return true;
}

/**
 * 노드 도착 이후 어떤 화면이 떠도 다음으로 넘어간다.
 *
 * 노드를 누르면 이동 연출이 먼저 돌고 그 뒤에 도착 화면이 뜬다. 한 번만 훑고
 * 빠져나오면 아직 안 뜬 버튼을 놓치므로, 맵으로 돌아오거나 전투로 넘어갈 때까지 기다린다.
 */
async function resolveNodeScreen(page: Page, timeoutMs = 25_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (page.url().includes("/battle")) return;              // 전투는 호출부가 처리
    if (await clickIfVisible(page, /진입하기|몸을 숨긴다/)) continue;
    if (await clickIfVisible(page, /도망가기/)) continue;      // 포획은 운이라 도망으로 통일
    if (await clickIfVisible(page, /계속|돌아가기|확인/)) continue;
    // 구역을 다 돌면 클리어 화면이 뜬다. 이것도 정상 종료다.
    if ((await page.getByText("DUNGEON CLEARED").count()) > 0) return;
    // 소란 100 이면 숲이 등을 떠민다. 여기서 멈추는 것도 정상 종료다
    if ((await page.locator('[data-testid="forced-retreat-exit"]').count()) > 0) return;
    // 맵으로 돌아왔으면 이 노드는 끝난 것이다
    if ((await page.locator('[data-testid^="forest-node-"]').count()) > 0) return;
    await page.waitForTimeout(300);
  }
  throw new Error("노드 화면에서 다음으로 넘어갈 방법을 찾지 못했습니다 (막다른 화면)");
}

test("숲 탐험 — 노드를 돌다가 갇히지 않는다", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await seed(page);
  await page.goto("/forest");

  // 얕은 숲 진입
  const enter = page.getByRole("button", { name: /탐험하기/ }).first();
  await expect(enter).toBeEnabled();
  await enter.click();

  // 노드 맵이 뜰 때까지 (탐험 연출이 잠깐 돈다)
  const anyNode = page.locator('[data-testid^="forest-node-"]');
  await expect(anyNode.first()).toBeVisible({ timeout: 20_000 });

  let visited = 0;
  let cleared = false;
  // 런이 8~10 노드라 넉넉하게 돈다. 소란 100 에 걸려 중간에 쫓겨나는 판도 정상 종료다
  for (let step = 0; step < 12; step++) {
    if (page.url().includes("/battle")) break;

    const reachable = page.locator('[data-testid^="forest-node-"][data-reachable="1"]');
    const count = await reachable.count();
    if (count === 0) break;

    await reachable.first().click();
    visited += 1;
    await page.waitForTimeout(400);
    await resolveNodeScreen(page);

    // 노드 맵으로 돌아왔거나, 전투로 넘어갔거나, 구역을 다 돈 것이어야 한다.
    if (page.url().includes("/battle")) break;
    if ((await page.locator('[data-testid="forced-retreat-exit"]').count()) > 0) break;
    if ((await page.getByText("DUNGEON CLEARED").count()) > 0) {
      cleared = true;
      break;
    }
    await expect(
      anyNode.first(),
      `노드 ${visited}개째에서 맵으로 못 돌아왔습니다 — 막다른 화면이 있습니다`,
    ).toBeVisible({ timeout: 15_000 });
  }

  expect(visited, "노드를 하나도 진행하지 못했습니다").toBeGreaterThan(0);
  expect(errors, `숲 탐험 중 예외: ${errors.join(" / ")}`).toHaveLength(0);

  // 구역을 다 돌았으면 베이스캠프로 나가는 길이 있어야 한다
  if (cleared) {
    const back = page.getByRole("button", { name: /베이스캠프로 귀환/ });
    await expect(back, "클리어 화면에 나가는 버튼이 없습니다").toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  }
});
