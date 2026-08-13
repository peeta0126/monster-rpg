import { test, expect, type Page } from "@playwright/test";
import { playFloor, winOverlay, loseOverlay } from "./autoBattle";

/**
 * 밸런스용 완주. playthrough.spec.ts 와 같은 길을 걷지만 목적이 다르다.
 *
 * playthrough 쪽은 "엔딩까지 코드가 끊기지 않는가"를 보는 회귀 테스트라 파티를 Lv250 으로
 * 세워 둔다 — 그러면 모든 전투가 한 대에 끝나서 밸런스가 안 보인다. 여기서는 **실제로
 * 도달할 법한 레벨**로 낮춰 걷고, 지면 회복하고 다시 도전하며 층마다 재도전 횟수를 센다.
 * 어디가 벽인지는 이 숫자로만 보인다.
 *
 * 파티는 **처음 시작할 때 그대로**다 — 시작 몬스터 모시와 초반에 잡을 만한 두 마리를
 * Lv5 로 세운다. 레벨은 탑이 올려 준다. 처음엔 시뮬의 도달 레벨(40층 46.5 / 50층 57)을
 * 따라 Lv45 로 잡았는데, 그러면 앞쪽 50층이 통째로 무의미해진다. 45 · 30 · 20 · 5 를
 * 차례로 돌려 봤고 넷 다 재도전 0회로 완주했다 — 즉 지금 벽은 레벨이 아니라 없다.
 *
 * ⚠️ 이 자동 플레이어는 사람보다 잘한다. 매 턴 예상 데미지가 가장 큰 기술을 고르고,
 *    HP 40% 아래로 떨어지면 반드시 물약을 마신다. 여기서 0회가 나온다고 사람도 0회는
 *    아니다. 반대로 여기서 막히면 그건 진짜 벽이다.
 *
 * 실행: npx playwright test e2e/balanceRun.spec.ts
 * (평소 회귀에서는 제외한다 — 오래 걸리고, 재도전을 허용하므로 실패로 잡히는 일이 드물다)
 */

const MAX_FLOOR = 50;
const PARTY_LEVEL = 5;
const PARTY_SPECIES = ["mossy", "aquabe", "leafy"];
/** 한 층에서 이만큼 지면 벽으로 보고 멈춘다 */
const MAX_RETRIES = 6;

async function seedSave(page: Page) {
  await page.addInitScript(
    ({ level, species }: { level: number; species: string[] }) => {
      localStorage.setItem(
        "monster-rpg-auth",
        JSON.stringify({
          state: { token: null, username: null, isGuest: true, isDev: false },
          version: 0,
        }),
      );
      localStorage.setItem(
        "monster-rpg-player",
        JSON.stringify({
          state: {
            party: species.map((id, i) => ({ id, level, uid: `bal-${i}` })),
            storage: [], dexSeen: [], dexCaught: [], materials: {},
            // 정식 플레이라면 물약을 무한정 들고 다니지 않는다. 층당 한두 개 쓸 만큼만.
            potions: { super_potion: 12, potion: 12, antidote: 5 },
            bestFloor: 0, storyFlags: {}, questStatus: {},
            craftedItems: [], craftedArtifacts: [], craftedPotions: [],
            equippedArtifacts: {},
          },
          version: 1,
        }),
      );
    },
    { level: PARTY_LEVEL, species: PARTY_SPECIES },
  );
}

test("밸런스: 실제 도달 레벨로 1층 → 50층", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await seedSave(page);
  await page.goto("/battle");

  const retries: Record<number, number> = {};

  for (let floor = 1; floor <= MAX_FLOOR; floor++) {
    let tries = 0;
    for (;;) {
      try {
        await playFloor(page, floor);
        break;
      } catch (err) {
        if (!(await loseOverlay(page).first().isVisible().catch(() => false))) throw err;
        tries++;
        retries[floor] = tries;
        if (tries > MAX_RETRIES) {
          throw new Error(`${floor}층에서 ${MAX_RETRIES}번 지고 못 넘어갔다 — 여기가 벽이다`);
        }
        // 결과 화면에서 회복하고 다시 도전 (게임이 실제로 주는 선택지 그대로)
        await page.locator("button").filter({ hasText: "파티 HP 전회복" }).click();
        await page.locator("button").filter({ hasText: `재도전 (${floor}F)` }).click();
      }
    }

    await expect(winOverlay(page)).toBeVisible();
    console.log(`✔ ${floor}층 클리어${retries[floor] ? ` (재도전 ${retries[floor]}회)` : ""}`);

    if (floor < MAX_FLOOR) {
      await page.locator("button").filter({ hasText: `다음층 (${floor + 1}F)` }).click();
    }
  }

  const total = Object.values(retries).reduce((a, b) => a + b, 0);
  console.log(`\n── 재도전 합계 ${total}회 ──`);
  for (const [floor, n] of Object.entries(retries)) console.log(`  ${floor}층: ${n}회`);
});
