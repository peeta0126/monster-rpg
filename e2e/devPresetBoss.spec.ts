import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARTIFACT_RECIPES,
} from "../src/workshop/craftingRecipes";
import {
  applyArtifactQualityStats,
  getEquipmentMaxLevel,
  MAX_EQUIPMENT_ENHANCEMENT,
  rollBonusStats,
} from "../src/shared/craftingUtils";
import { playFloor, winOverlay } from "./autoBattle";

/**
 * 개발자 프리셋(loadDevPreset)이 실제로 50층 오름을 이길 수 있는지 검증한다.
 *
 * 프리셋은 "50층 테스트 대응"을 표방하므로, 레벨 50 파티 + 만렙 엘리트 아티팩트 +
 * 물약이라는 프리셋과 동일한 구성으로 최종 보스전만 치른다.
 * 이 테스트가 깨지면 프리셋이 목적을 잃었거나 50층 밸런스가 바뀐 것이다.
 */

const ARTIFACT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");

const DEV_PARTY_LEVEL = 50;
const DEV_PARTY_SPECIES = ["mossyfinal", "aquavern", "frostorb"]; // playerStore의 DEV_PARTY_IDS와 동일

/** loadDevPreset이 만드는 것과 동일한 만렙 엘리트 아티팩트 세트 */
function devArtifacts(seed: string) {
  const quality = "elite" as const;
  const level = getEquipmentMaxLevel(quality);
  return ARTIFACT_RECIPES.map((r, i) => ({
    instanceId: `${seed}-${i}`,
    itemId: r.resultItemId,
    name: r.resultItemName,
    quality,
    description: r.description,
    statBonuses: applyArtifactQualityStats(r.baseStats ?? [], quality),
    createdAt: 0,
    level,
    enhancement: MAX_EQUIPMENT_ENHANCEMENT,
    source: "crafting" as const,
    bonusStats: rollBonusStats(r.resultItemId, 1, level, []),
  }));
}

async function seedDevPreset(page: Page) {
  const party = DEV_PARTY_SPECIES.map((id, i) => ({ id, level: DEV_PARTY_LEVEL, uid: `dev-${i}` }));
  const equippedArtifacts: Record<string, unknown[]> = {};
  for (const m of party) equippedArtifacts[m.uid] = devArtifacts(m.uid);

  await page.addInitScript(
    ({ party, equippedArtifacts }: { party: unknown[]; equippedArtifacts: Record<string, unknown[]> }) => {
      localStorage.setItem(
        "monster-rpg-auth",
        JSON.stringify({
          state: { token: null, username: null, isGuest: true, isDev: true },
          version: 0,
        }),
      );
      localStorage.setItem(
        "monster-rpg-player",
        JSON.stringify({
          state: {
            party,
            storage: [],
            dexSeen: [],
            dexCaught: [],
            materials: {},
            potions: {
              potion: 20, super_potion: 20, max_potion: 20, antidote: 10,
              attack_buff: 10, strong_attack_buff: 10,
            },
            // 탑 모달에서 50층을 바로 고를 수 있는 상태 (프리셋과 동일)
            bestFloor: 49,
            storyFlags: {},
            questStatus: {},
            craftedItems: [],
            craftedArtifacts: [],
            craftedPotions: [],
            equippedArtifacts,
          },
          version: 1,
        }),
      );
    },
    { party, equippedArtifacts },
  );
}

/** 베이스캠프에서 탑 앞까지 걸어가 E로 층 선택 모달을 연다 */
async function walkToTowerAndOpenModal(page: Page) {
  // Phaser는 게임 캔버스 외에 텍스처용 캔버스도 만들므로 첫 번째만 잡는다
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  // Phaser 씬이 배경/스프라이트를 다 올릴 때까지 잠깐 대기
  await page.waitForTimeout(3000);
  await canvas.click({ position: { x: 10, y: 10 } });

  const towerModal = page.getByText("무한의 탑", { exact: true });

  // 시작 위치는 집 앞(794,1230), 탑 상호작용 지점은 (278,1110) 부근.
  // 이동 속도 220px/s 기준으로 왼쪽 → 위로 이동한 뒤 E. 벽 충돌로 덜 갈 수 있어
  // 조금씩 더 밀어보며 모달이 뜰 때까지 재시도한다.
  for (let attempt = 0; attempt < 8; attempt++) {
    await holdKey(page, "ArrowLeft", attempt === 0 ? 2600 : 400);
    await holdKey(page, "ArrowUp", attempt === 0 ? 600 : 250);
    await page.keyboard.press("e");
    await page.waitForTimeout(400);
    if (await towerModal.isVisible().catch(() => false)) return;
  }
  throw new Error("탑 층 선택 모달을 열지 못했습니다");
}

async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

test("개발자 프리셋 구성으로 50층 오름 격파", async ({ page }) => {
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

  await seedDevPreset(page);
  await page.goto("/");

  await walkToTowerAndOpenModal(page);
  await page.locator("button").filter({ hasText: "50층" }).first().click();

  await playFloor(page, 50);
  await expect(winOverlay(page)).toBeVisible();

  await page.screenshot({ path: path.join(ARTIFACT_DIR, "dev-preset-floor-50.png") });
});
