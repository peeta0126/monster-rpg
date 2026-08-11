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

/** 보이면 누른다. 눌렀으면 true */
async function clickIfVisible(page: Page, name: RegExp): Promise<boolean> {
  const btn = page.getByRole("button", { name });
  if ((await btn.count()) === 0) return false;
  const first = btn.first();
  if (!(await first.isVisible())) return false;
  await first.click();
  return true;
}

const AREAS: { id: string; name: string; bestFloor: number }[] = [
  { id: "shallow", name: "얕은 숲", bestFloor: 0 },
  { id: "deep",    name: "깊은 숲", bestFloor: 11 },
  { id: "ancient", name: "고대 숲", bestFloor: 21 },
];

test.describe("measureForest:", () => {
  for (const area of AREAS) {
    test(`${area.name} 한 판 시간`, async ({ page }) => {
      await page.addInitScript(({ a, p, g, s }) => {
        localStorage.setItem(a as string, g as string);
        localStorage.setItem(p as string, s as string);
      }, { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, s: save(area.bestFloor) });

      await page.goto("/forest");
      // 카드 자체가 버튼이다 — 잠겨 있지 않으면 누르는 순간 그 구역으로 들어간다
      await page.locator(`[data-testid="forest-tier-${area.id}"]`).click();

      const started = Date.now();
      let nodes = 0;
      let alertPeak = 0;
      let stuck = 0;

      // 한 판이 끝날 때까지: 끝은 완주·강제 퇴각 둘 중 하나다
      for (let guard = 0; guard < 400; guard++) {
        const meter = page.locator('[data-testid="forest-alert"]');
        if (await meter.count()) {
          const v = Number(await meter.first().getAttribute("data-alert"));
          if (Number.isFinite(v)) alertPeak = Math.max(alertPeak, v);
        }

        if ((await page.getByText("DUNGEON CLEARED").count()) > 0) break;
        if ((await page.locator('[data-testid="forced-retreat-exit"]').count()) > 0) break;

        // 갈림길이면 한 칸 나아간다
        const move = page.locator('[data-testid^="forest-move-"]');
        if (await move.count()) {
          await move.first().click();
          nodes++;
          stuck = 0;
          continue;
        }

        if (await clickIfVisible(page, /진입하기|몸을 숨긴다|계속 탐험하기/)) continue;
        if (await clickIfVisible(page, /도망가기/)) continue;   // 포획은 운이라 도망으로 통일
        if (await clickIfVisible(page, /계속 탐험/)) continue;

        stuck++;
        if (stuck === 20) {
          const names = await page.getByRole("button").allInnerTexts();
          console.log(`[measureForest] ${area.name} 멈춤 — 화면의 버튼: ${JSON.stringify(names)}`);
        }
        await page.waitForTimeout(150);
      }

      const seconds = (Date.now() - started) / 1000;
      console.log(
        `[measureForest] ${area.name}: ${seconds.toFixed(1)}초 / 노드 ${nodes}개 ` +
        `(노드당 ${(seconds / Math.max(nodes, 1)).toFixed(1)}초, 최고 소란 ${alertPeak})`,
      );
    });
  }
});
