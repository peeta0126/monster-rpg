import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openWorkshop, walkTo } from "./workshopNav";
import { CRAFTING_STATIONS } from "../src/workshop/workshopLayout";
import { ARTIFACT_RECIPES } from "../src/workshop/craftingRecipes";
import {
  applyArtifactQualityStats, getEquipmentMaxLevel, rollBonusStats,
  MAX_EQUIPMENT_ENHANCEMENT,
} from "../src/shared/craftingUtils";

/**
 * 장비 칸이 실제로 어떻게 보이는지 남긴다.
 *
 * 여기서 보려는 것은 숫자가 아니라 그림이다 — 갓 만든 것과 다 키운 것이 한눈에 다른
 * 물건으로 보이는가, 좁은 칸에서 배지가 아이콘을 덮지 않는가, 줄 높이가 장비마다
 * 들쭉날쭉하지 않은가. 기본 캡처는 신규 세이브라 가방이 비어 있어 아무것도 안 나온다.
 */

const AUTH_STORAGE_KEY = "monster-rpg-auth";
const PLAYER_STORAGE_KEY = "monster-rpg-player";
const LABEL = process.env.SHOT_LABEL ?? "current";
const OUT_DIR = path.resolve(process.cwd(), "design", "screenshots", LABEL);

const GUEST_AUTH_STATE = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

type Quality = "normal" | "rare" | "elite";

/** 레시피 하나로 장비 한 개. 다 키운 것(maxed)이면 만렙·최대강화·부가 능력치까지 붙는다 */
function artifact(recipeId: string, quality: Quality, maxed: boolean, tag: string) {
  const r = ARTIFACT_RECIPES.find((x) => x.id === recipeId)!;
  const level = maxed ? getEquipmentMaxLevel(quality) : 1;
  return {
    instanceId:  `${recipeId}-${tag}`,
    itemId:      r.resultItemId,
    name:        r.resultItemName,
    quality,
    description: r.description,
    statBonuses: applyArtifactQualityStats(r.baseStats ?? [], quality),
    createdAt:   0,
    level,
    enhancement: maxed ? MAX_EQUIPMENT_ENHANCEMENT : 0,
    source:      "crafting" as const,
    bonusStats:  maxed ? rollBonusStats(r.resultItemId, 1, level, []) : [],
  };
}

/**
 * 가방에 두 벌을 넣는다 — 갓 만든 정예와 다 키운 정예를 나란히.
 * 뒤의 셋은 모루 재료 목록이 비지 않게 하려는 것이다(등급이 같아야 후보로 뜬다).
 */
const BAG = [
  artifact("power_necklace", "elite",  true,  "maxed"),
  artifact("power_necklace", "elite",  false, "fresh"),
  artifact("guard_bracelet", "elite",  true,  "maxed"),
  artifact("guard_bracelet", "elite",  false, "fresh"),
  artifact("spirit_amulet",  "rare",   true,  "maxed"),
  artifact("spirit_amulet",  "rare",   false, "fresh"),
];

/** 장착 슬롯 셋이 다 찬 몬스터 하나 */
const EQUIPPED = [
  artifact("power_necklace", "elite",  true,  "on"),
  artifact("guard_bracelet", "rare",   false, "on"),
  artifact("spirit_amulet",  "normal", true,  "on"),
];

const SAVE = JSON.stringify({
  state: {
    party: [{ id: "flameling", level: 30, uid: "eq-0" }],
    storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
    materials: { enhancement_stone: 400 }, potions: {}, bestFloor: 30,
    storyFlags: { met_orion: true }, questStatus: {},
    seenDialogues: ["orion_intro"],
    craftedItems: [], craftedArtifacts: BAG, craftedPotions: [],
    equippedArtifacts: { "eq-0": EQUIPPED },
    imprint: {},
  },
  version: 2,
});

async function seed(page: Page) {
  await page.addInitScript(
    ({ authKey, playerKey, authState, save }) => {
      window.localStorage.setItem(authKey, authState);
      if (!window.localStorage.getItem(playerKey)) {
        window.localStorage.setItem(playerKey, save);
      }
    },
    { authKey: AUTH_STORAGE_KEY, playerKey: PLAYER_STORAGE_KEY, authState: GUEST_AUTH_STATE, save: SAVE },
  );
}

async function settle(page: Page) {
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scene-transition"]') === null,
    undefined, { timeout: 10_000 },
  );
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete));
  await page.waitForTimeout(600);
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });

test.beforeAll(() => { fs.mkdirSync(OUT_DIR, { recursive: true }); });

test("capture: equip-bag", async ({ page }) => {
  await seed(page);
  await page.goto("/farm");
  await page.getByRole("button", { name: "아티팩트" }).first().click();
  await settle(page);
  await shot(page, "equip-bag");
});

test("capture: equip-modal", async ({ page }) => {
  await seed(page);
  await page.goto("/monsters");
  await page.getByRole("button", { name: "장착", exact: true }).first().click();
  await expect(page.getByText(/장착 중인 장비/)).toBeVisible();
  await settle(page);
  await shot(page, "equip-modal");
});

const ANVIL_TABS = ["레벨업", "강화", "분해", "합성"] as const;

test("capture: equip-anvil", async ({ page }) => {
  await seed(page);
  await openWorkshop(page);
  const anvil = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;
  expect(await walkTo(page, anvil, 0.8 * anvil.radius), "모루까지 못 갔다").toBe(true);
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();

  for (const tab of ANVIL_TABS) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    // 왼쪽 목록에서 하나 골라야 오른쪽 패널이 뜬다. 합성만 정예를 고르면 안 된다 —
    // 정예는 더 올라갈 등급이 없어서 결과 미리보기가 아예 안 나온다.
    await page.getByText(tab === "합성" ? "정령의 부적" : "힘의 목걸이").first().click();
    await settle(page);
    await shot(page, `equip-anvil-${ANVIL_TABS.indexOf(tab)}-${tab}`);
  }
});

test("capture: equip-craft-result", async ({ page }) => {
  await seed(page);
  await openWorkshop(page);
  const bench = CRAFTING_STATIONS.find((s) => s.id === "artifact-workbench")!;
  expect(await walkTo(page, bench, 0.8 * bench.radius), "아티팩트 제작대까지 못 갔다").toBe(true);
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "아티팩트 제작대" })).toBeVisible();

  await page.getByRole("button", { name: "테스트 재료" }).click();
  await page.getByText("힘의 목걸이").first().click();
  await page.getByRole("button", { name: /제작 시작|개 제작/ }).click();

  // 방향키 QTE — 정확도는 상관없다. 끝까지만 가면 결과 화면이 뜬다.
  for (let i = 0; i < 40; i++) {
    for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) await page.keyboard.press(k);
    if (await page.getByRole("button", { name: /계속/ }).first().isVisible()) break;
    await page.waitForTimeout(80);
  }
  await expect(page.getByRole("button", { name: /계속/ }).first()).toBeVisible();
  await settle(page);
  await shot(page, "equip-craft-result");
});
