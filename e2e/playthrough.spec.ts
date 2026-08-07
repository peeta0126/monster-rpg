import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playFloor, winOverlay } from "./autoBattle";

/**
 * 무한의 탑 1층 → 50층(오름) → 엔딩까지의 자동 플레이.
 *
 * 목적은 밸런스 검증이 아니라 "메인 진행선이 코드상 엔딩까지 끊기지 않는가"의 회귀 확인이다.
 * 게임 코드는 전혀 건드리지 않고, 세이브(localStorage)만 주입한 뒤 실제 UI를 클릭한다.
 * (밸런스 쪽 검증은 devPresetBoss.spec.ts가 담당한다.)
 *
 * 자세한 배경은 Handoff.md 5장 참고.
 */

const MAX_FLOOR = 50;

/**
 * 테스트 파티 레벨. 의도적으로 높게 잡았다 —
 * 50층 오름은 실효 HP 1870 / 공격 498 / 방어 319라, 정규 난이도로는 아티팩트 파밍이 전제다.
 * (Handoff.md 4장 참고) 밸런스를 보고 싶으면 이 값을 낮춰서 어디서 막히는지 확인하면 된다.
 */
const PARTY_LEVEL = 250;

/** 세이브의 몬스터는 id + level만 신뢰되고 능력치는 로드 시 재계산된다(normalizeOwnedMonster) */
const PARTY_SPECIES = ["mossyfinal", "aquavern", "toxadon"];

const ARTIFACT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");

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
            party: species.map((id, i) => ({ id, level, uid: `e2e-${i}` })),
            storage: [],
            dexSeen: [],
            dexCaught: [],
            materials: {},
            potions: { max_potion: 30, super_potion: 20, antidote: 10 },
            bestFloor: 0,
            storyFlags: {},
            questStatus: {},
            craftedItems: [],
            craftedArtifacts: [],
            craftedPotions: [],
            equippedArtifacts: {},
          },
          version: 1,
        }),
      );
    },
    { level: PARTY_LEVEL, species: PARTY_SPECIES },
  );
}

test("무한의 탑 1층 → 50층 → 엔딩 완주", async ({ page }) => {
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

  await seedSave(page);

  // /battle 직접 진입은 라우터 state가 없으므로 항상 1층에서 시작한다
  await page.goto("/battle");

  for (let floor = 1; floor <= MAX_FLOOR; floor++) {
    await playFloor(page, floor);

    // 승리 오버레이 확인
    await expect(winOverlay(page)).toBeVisible();
    console.log(`✔ ${floor}층 클리어`);

    if (floor % 10 === 0) {
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `floor-${floor}.png`) });
    }

    if (floor < MAX_FLOOR) {
      await page.locator("button").filter({ hasText: `다음층 (${floor + 1}F)` }).click();
    }
  }

  // 50층 승리 화면에서만 나오는 엔딩 진입 버튼
  const toEnding = page.locator("button").filter({ hasText: "정수를 들고 마을로" });
  await expect(toEnding).toBeVisible();
  await toEnding.click();

  await expect(page).toHaveURL(/\/ending$/);
  await expect(page.getByText("THE END")).toBeVisible();
  await expect(page.getByText("오리온: …고맙다. 네가 해냈다.")).toBeVisible();

  await page.screenshot({ path: path.join(ARTIFACT_DIR, "ending.png"), fullPage: true });
});
