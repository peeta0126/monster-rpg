import { test, type Page } from "@playwright/test";

/**
 * 숲 탐험 한 판의 실제 소요 시간.
 *
 * 노드 수로는 길이를 알 수 없다 — 노드마다 이동 연출(exploreTime)과 포획 연출이
 * 붙는다. 브라우저 게임이라 한 판이 10분을 넘어가면 안 되므로 초로 잰다.
 *
 * 여기서 나오는 건 **기계 시간**이다. 버튼이 뜨자마자 누르므로 사람이 화면을 읽는
 * 시간은 빠져 있다. 보고할 때 화면당 읽기 시간을 따로 더해서 본다.
 *
 * 실행: npx playwright test --config design/playwright.config.ts -g "measureForest:"
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";

const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

const save = (bestFloor: number) => JSON.stringify({
  state: {
    party: [{ id: "mossyfinal", level: 60, uid: "m-1", currentHp: 9999 }],
    storage: [], dexSeen: [], dexCaught: [],
    materials: {}, potions: {}, bestFloor,
    storyFlags: {}, questStatus: {},
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
  },
  version: 1,
});

const AREAS: { id: string; name: string; bestFloor: number }[] = [
  { id: "shallow", name: "얕은 숲", bestFloor: 0 },
  { id: "deep",    name: "깊은 숲", bestFloor: 11 },
  { id: "ancient", name: "고대 숲", bestFloor: 21 },
];

async function clickTestId(page: Page, id: string): Promise<boolean> {
  const btn = page.locator(`[data-testid="${id}"]`);
  if ((await btn.count()) === 0) return false;
  const first = btn.first();
  if (!(await first.isVisible())) return false;
  await first.click();
  return true;
}

test.describe("measureForest:", () => {
  for (const area of AREAS) {
    test(`${area.name} 한 판 시간`, async ({ page }) => {
      await page.addInitScript(({ a, p, g, s }) => {
        localStorage.setItem(a as string, g as string);
        localStorage.setItem(p as string, s as string);
      }, { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, s: save(area.bestFloor) });

      await page.goto("/forest");
      await page.locator(`[data-testid="forest-tier-${area.id}"]`).click();

      const started = Date.now();
      let steps = 0;
      let alertPeak = 0;

      /**
       * 회피 전략으로 걷는다 — 갈림길에서 소란이 덜 오르는 쪽을 고른다.
       * 회피가 가장 오래 걷는 전략이라 여기서 나온 시간이 상한이다.
       */
      for (let guard = 0; guard < 600; guard++) {
        const meter = page.locator('[data-testid="forest-alert"]');
        if (await meter.count()) {
          const v = Number(await meter.first().getAttribute("data-alert"));
          if (Number.isFinite(v)) alertPeak = Math.max(alertPeak, v);
        }
        if ((await page.locator('[data-testid="forest-settle"]').count()) > 0) break;

        // 갈림길 — 소란 증감이 적어 보이는 쪽을 고른다. 정찰이 가려도 왼쪽을 잡는다
        if (await clickTestId(page, "forest-fork-0")) continue;
        if (await clickTestId(page, "forest-step-action")) { steps++; continue; }
        if (await clickTestId(page, "forest-nest-pick-0")) continue;
        if (await clickTestId(page, "forest-rps-rock")) continue;
        if (await clickTestId(page, "forest-rps-done")) continue;
        await page.waitForTimeout(120);
      }

      const seconds = (Date.now() - started) / 1000;
      console.log(
        `[measureForest] ${area.name}: ${seconds.toFixed(1)}초 / 화면 전환 ${steps}회 ` +
        `(최고 소란 ${alertPeak})`,
      );
    });
  }
});
