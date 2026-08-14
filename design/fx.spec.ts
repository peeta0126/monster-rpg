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
  await page.getByTestId("cmd-moves").click();
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

  await page.getByTestId("cmd-moves").click();
  await page.getByTestId("move-cinder-toss").click();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("q");
    await page.waitForTimeout(120);
  }
  await expect(page.getByTestId("cmd-moves")).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "_hud-status.png") });
});

/**
 * 포획 버튼과 경험치 연출. 둘 다 실제로 그 상황을 만들어야 보인다.
 * 강한 파티로 1층 포획 전투에 들어가면 한 대에 정리되므로 두 장면을 이어서 찍을 수 있다.
 */
test("fx: 경험치 연출", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        // 다음 레벨까지 1 만 남겨 둔다 — 한 판 이기면 반드시 레벨업 카드가 뜬다.
        // ⚠️ 레벨은 층과 가까워야 한다. 레벨차가 6 이상이면 경험치가 0 이라(컷오프)
        //    연출 자체가 안 뜬다 — 그게 정상 동작이라 여기서 잡으려는 것과 다르다.
        party: [{
          id: "flameling", level: 5, uid: "fx-0", exp: 115, expToNextLevel: 116,
          moves: [{ id: "tap", name: "톡", type: "normal", power: 20, accuracy: 100, category: "physical" }],
        }],
        storage: [], dexSeen: [], dexCaught: [], materials: {}, potions: {},
        bestFloor: 0, storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      },
      version: 1,
    }));
    // 수동으로 둔다 — 자동이면 연출이 알아서 지나가 버려 카드를 못 찍는다
    localStorage.setItem("monster-rpg-battle-settings", JSON.stringify({
      state: { autoAdvance: false, logSpeed: "normal" }, version: 0 }));
  });
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate(() => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: 1 } }, "");
  });
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  // 상대 카드가 상성을 미리 말해 준다 — 예전엔 T 를 눌러 7×7 표를 봐야 알았다
  await expect(page.getByTestId("enemy-card")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_enemy-card.png") });

  const swing = async () => {
    await page.getByTestId("cmd-moves").click();
    await page.getByTestId("move-tap").click();
    for (let i = 0; i < 20; i++) {
      if (await page.getByTestId("exp-gain").count()) return;
      if (await page.getByTestId("cmd-moves").isEnabled().catch(() => false)) return;
      await page.keyboard.press("q");
      await page.waitForTimeout(110);
    }
  };

  // 한 대 → 적 HP 가 줄고 상대 카드가 그걸 그대로 말한다
  await swing();
  await expect(page.getByTestId("enemy-card")).toContainText("HP");
  await page.screenshot({ path: path.join(OUT, "_enemy-card-hurt.png") });

  // 쓰러질 때까지 때린다
  for (let i = 0; i < 6; i++) {
    if (await page.getByTestId("exp-gain").count()) break;
    await swing();
  }

  // 그대로 쓰러지면 경험치 연출이 뜬다. 수동이라 레벨업 카드에서 멈춰 선다.
  const exp = page.getByTestId("exp-gain");
  await expect(exp).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "_exp-gain.png") });

  await expect(page.getByTestId("exp-levelup")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(OUT, "_exp-levelup.png") });

  // Space 한 번으로 전부 건너뛴다 — 반복 플레이를 막지 않는지 확인
  await page.keyboard.press("Space");
  await expect(exp).toHaveCount(0, { timeout: 10_000 });
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
  await page.getByTestId("cmd-moves").click();
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
  await expect(page.getByTestId("type-chart")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "_type-chart-with-moves.png") });

  await page.keyboard.press("t");
  await expect(page.getByTestId("type-chart")).toHaveCount(0);
});

/**
 * 상태이상 칩과 공격버프 칩이 **동시에** 뜬 상태. 순서 줄은 칩이 뜨는 대로 늘어나므로
 * 여기서 아래 경험치 줄이 밀리거나 잘리면 배치가 잘못된 것이다.
 *
 * 10층 보스만 마비를 35% 로 건다. 강화 전투 물약을 계속 들이켜며 맞아 주면
 * 두 칩이 겹치는 순간이 온다.
 */
test("fx: 칩 두 개", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        // 오래 버텨야 두 칩이 겹친다 — 레벨을 올려 맞아도 안 죽게 두고 공격은 안 한다
        party: [{
          id: "flameling", level: 26, uid: "chip-0",
          moves: [{ id: "tap", name: "톡", type: "normal", power: 5, accuracy: 100, category: "physical" }],
        }],
        storage: [], dexSeen: [], dexCaught: [], materials: {},
        potions: { strong_attack_buff: 30 },
        bestFloor: 9, storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      },
      version: 1,
    }));
    localStorage.setItem("monster-rpg-battle-settings", JSON.stringify({
      state: { autoAdvance: true, logSpeed: "fast" }, version: 0 }));
  });
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate(() => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: 10 } }, "");
  });
  await page.reload();
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await page.waitForTimeout(1200);

  const status = page.getByTestId("chip-status");
  const buff = page.getByTestId("chip-buff");
  for (let turn = 0; turn < 40; turn++) {
    if (await status.count() && await buff.count()) break;
    if (await page.getByTestId("cmd-bag").isEnabled().catch(() => false)) {
      await page.getByTestId("cmd-bag").click();
      // 가방은 두 쪽이다. 전투 물약은 뒷장에 있다
      const buffPotion = page.getByTestId("potion-strong_attack_buff");
      if (!(await buffPotion.count())) await page.keyboard.press("Tab");
      await buffPotion.click();
    } else {
      await page.keyboard.press("q");
    }
    await page.waitForTimeout(200);
  }

  await expect(status).toBeVisible();
  await expect(buff).toBeVisible();
  // 칩이 둘 다 뜬 채로도 경험치 줄은 제자리에 온전히 있어야 한다
  await expect(page.getByTestId("exp-row")).toContainText("EXP");
  await page.screenshot({ path: path.join(OUT, "_chips-two.png") });
});
