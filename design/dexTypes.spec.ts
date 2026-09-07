import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * 도감의 속성 칩. 속성이 여덟으로 늘고 이중 속성이 생긴 뒤에 필요해진 캡처다.
 *
 * 이 화면은 오랫동안 자기 사본 표를 들고 있었고, 그 표에서 불꽃과 전기가 **같은 클래스
 * 문자열**이었다(물·얼음·독도 셋이 같았다). 코드에서는 안 보이고 그림에서만 보이는
 * 종류의 고장이라 캡처를 남긴다.
 */
const OUT = path.join("design", "screenshots", "current");

/** 이중 속성과 크리스탈이 다 보이게 도감을 열어 둔 세이브 */
const SEEN = [
  "crystafox",                                    // 얼음/크리스탈
  "gemto", "gemguard", "gemlord",                 // 크리스탈(단일)
  "sporemus",                                     // 풀/독
  "bublock", "bubldon",                           // 물 · 물/독
  "flameling", "mossy", "frostorb", "nobi",       // 색이 헷갈리던 자리들
];

const SAVE = JSON.stringify({
  state: {
    party: [{ id: "flameling", level: 20, uid: "d0" }],
    storage: [],
    dexSeen: SEEN, dexCaught: SEEN,
    materials: {}, potions: {}, bestFloor: 0,
    storyFlags: { met_orion: true }, questStatus: {}, seenDialogues: ["orion_intro"],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    imprint: {},
  },
  version: 2,
});

const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

test("dex: 속성 칩", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(([save, auth]) => {
    window.localStorage.setItem("monster-rpg-auth", auth as string);
    window.localStorage.setItem("monster-rpg-player", save as string);
  }, [SAVE, AUTH] as const);

  await page.goto("/");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __phaserGame?: { scene?: { getScene?: (k: string) => unknown } } }).__phaserGame;
    const s = g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null;
    return Boolean(s?.player);
  }, undefined, { timeout: 30_000 });
  await page.locator("button", { hasText: "메뉴" }).first().click();
  await page.locator("button").filter({ hasText: /^도감$/ }).first().click();
  await expect(page.getByText("몬스터 도감")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "_dex-types.png") });

  // 크리샤(얼음/크리스탈)가 칩 둘로 나온다. 하나로 접히면 화면마다 같은 몬스터가
  // 달라 보인다. 젬 계열은 반대로 하나여야 한다 — 그쪽은 e2e/dualType.spec.ts 가 본다
  await page.getByText("크리샤").first().click();
  await expect(page.getByText("크리스탈").first()).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "_dex-types-detail.png") });
});
