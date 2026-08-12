import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "design", "screenshots", "current");

// 연출 도중 레이아웃이 흔들리지 않는지 보는 용도. npm run design:fx

test("fx: 타격 연출 중/후", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.removeItem("monster-rpg-player");
  });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 기술은 2단 메뉴 안에 있다 — 1단에서 "공격"을 먼저 열어야 보인다
  await page.getByTestId("cmd-attack").click();
  await page.locator('[data-testid^="move-"]').first().click();
  // 기술명 로그를 Q로 넘기면 곧바로 타격 연출이 시작된다
  await page.waitForTimeout(300);
  await page.keyboard.press("q");
  await page.waitForTimeout(170);
  await page.screenshot({ path: path.join(OUT, "_fx-during.png") });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "_fx-after.png") });
});

/**
 * HP 패널이 "상대가 누구고 내가 얼마나 위험한지"를 말하는지 본다.
 * 속성 칩 · 상태이상 배지 · 위험(25% 이하) 경고는 셋 다 실제로 그 상황을 만들어야 보인다.
 */
test("fx: 전투 HUD 경고", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        // HP 를 미리 깎아 둔다(60/410 = 14%) — 위험 연출은 그 구간에서만 켜진다.
        // 기술은 100% 화상기 하나만 줘서 적 상태이상 배지를 확실히 띄운다.
        party: [{
          id: "flameling", level: 30, uid: "hud-0", currentHp: 60,
          moves: [{ id: "cinder-toss", name: "불티날림", type: "fire", power: 0, accuracy: 90,
                    category: "status", statusEffect: "burn", statusChance: 100 }],
        }],
        storage: [], dexSeen: [], dexCaught: [], materials: {}, potions: {},
        bestFloor: 0, storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      },
      version: 1,
    }));
  });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 시작부터 아군은 위험 구간이다 — 하단 상태바가 먼저 그것을 말해야 한다
  await page.screenshot({ path: path.join(OUT, "_hud-danger.png") });

  await page.getByTestId("cmd-skill").click();
  await page.getByTestId("move-cinder-toss").click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("q");
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId("cmd-skill")).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "_hud-status.png") });
});

/** 상성표. 전투 중에 T 하나로 열리고, 지금 상대의 줄이 강조되는지 본다. */
test("fx: 속성 상성표", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.removeItem("monster-rpg-player");
  });
  await page.goto("/battle");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 1층 상대는 물 속성이다 — 물 행/열이 강조돼야 한다
  await page.keyboard.press("t");
  await expect(page.getByTestId("type-chart")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_type-chart.png") });

  // 열어 둔 채로 기술을 고를 수 있어야 한다 (전투를 멈추지 않는다)
  await page.getByTestId("cmd-attack").click();
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
  await expect(page.getByTestId("type-chart")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_type-chart-with-moves.png") });

  await page.keyboard.press("t");
  await expect(page.getByTestId("type-chart")).toHaveCount(0);
});
