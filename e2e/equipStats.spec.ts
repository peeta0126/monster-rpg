import { test, expect, type Page } from "@playwright/test";
import { ARTIFACT_RECIPES } from "../src/workshop/craftingRecipes";
import {
  applyArtifactQualityStats, getEquipmentMaxLevel, rollBonusStats,
  MAX_EQUIPMENT_ENHANCEMENT,
} from "../src/shared/craftingUtils";

/**
 * 장착 화면이 말하는 숫자와 몬스터 요약이 세는 숫자가 같은지, 실제 화면에서 본다.
 *
 * 단위 테스트(tests/artifactStats.test.ts)는 두 계산이 같은 값을 내는지까지만 본다.
 * 화면이 그 계산을 안 부르고 제작 시점의 원본을 찍어도 거기서는 안 잡힌다 —
 * 실제로 그런 상태로 오래 있었다(화면 +14 / 실제 +52).
 */

/** 최대까지 키운 정예 한 벌. 배율이 붙지 않으면 화면과 요약이 3.7배 갈라진다. */
function maxedSet(uid: string) {
  const quality = "elite" as const;
  const level = getEquipmentMaxLevel(quality);
  return ARTIFACT_RECIPES.map((r, i) => ({
    instanceId:  `${uid}-${i}`,
    itemId:      r.resultItemId,
    name:        r.resultItemName,
    quality,
    description: r.description,
    statBonuses: applyArtifactQualityStats(r.baseStats ?? [], quality),
    createdAt:   0,
    level,
    enhancement: MAX_EQUIPMENT_ENHANCEMENT,
    source:      "crafting" as const,
    bonusStats:  rollBonusStats(r.resultItemId, 1, level, []),
  }));
}

async function seed(page: Page) {
  const equipped = maxedSet("eq-0");
  await page.addInitScript(({ equipped }) => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
    }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        party: [{ id: "flameling", level: 30, uid: "eq-0" }],
        storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
        materials: {}, potions: {}, bestFloor: 30,
        storyFlags: { met_orion: true }, questStatus: {},
        seenDialogues: ["orion_intro"],
        craftedItems: [], craftedArtifacts: [], craftedPotions: [],
        equippedArtifacts: { "eq-0": equipped },
        imprint: {},
      },
      version: 2,
    }));
  }, { equipped });
}

/** 장착 화면의 능력치 줄을 라벨 → 합계로 접는다 */
async function shownTotals(page: Page): Promise<Record<string, number>> {
  const rows = await page.locator('[data-testid="equipped-slots"] p').allInnerTexts();
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const m = row.replace(/\s+/g, " ").trim().match(/^(.+?) \+([\d.]+)%?$/);
    if (!m) continue;
    totals[m[1]] = (totals[m[1]] ?? 0) + Number(m[2]);
  }
  return totals;
}

test("장착 화면의 능력치가 몬스터 요약의 실제 합계와 같다", async ({ page }) => {
  await seed(page);
  await page.goto("/monsters");

  // 요약(상태창)이 세는 보너스
  await page.getByText("전투 파티").waitFor();
  await page.getByText("플레미").first().click();
  await expect(page.getByTestId("stat-공격-value").first()).toBeVisible();
  const summary: Record<string, number> = {};
  for (const [label, key] of [["공격", "공격력"], ["방어", "방어력"], ["속도", "속도"]] as const) {
    const el = page.getByTestId(`stat-${label}-bonus`).first();
    summary[key] = Number((await el.innerText()).replace("+", ""));
  }

  // 장착 화면이 말하는 값
  await page.getByRole("button", { name: "장착", exact: true }).first().click();
  await expect(page.getByText(/장착 중인 장비/)).toBeVisible();
  const shown = await shownTotals(page);

  for (const key of Object.keys(summary)) {
    expect(shown[key], `${key}: 화면 ${shown[key]} · 요약 ${summary[key]}`).toBe(summary[key]);
  }
  // 정예 목걸이의 공격력은 제작 직후 14, Lv.50 +5 면 52다. 배율이 빠지면 14가 찍힌다.
  expect(summary["공격력"], "레벨·강화 배율이 안 들어갔다").toBe(52);

  // 파티 카드도 같은 값을 말해야 한다 — 상태창만 맞고 카드가 틀린 적이 있다
  await page.keyboard.press("Escape");
  const card = (await page.getByText("전투 파티").locator("xpath=ancestor::*[3]").innerText()).replace(/s+/g, " ");
  expect(card, `파티 카드: ${card}`).toContain(`+${summary["공격력"]}`);
});
