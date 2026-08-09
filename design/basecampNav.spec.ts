import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { CAMP_COLLISION_BOXES, hitsWall } from "../src/camp/campCollision";

/**
 * 베이스캠프를 실제로 걸어 다니며 충돌을 확인한다.
 *
 * 실행: `npx playwright test --config design/playwright.config.ts -g "basecamp:"`
 *
 * Phaser 캔버스는 접근성 트리에 안 잡히므로 좌표는 씬에서 직접 읽는다. 게임 코드에
 * 테스트용 훅을 심지 않으려고 `game.scene.getScene(...)` 로 꺼낸다 — Phaser 인스턴스는
 * main.tsx 가 window 에 올려 두지 않으므로 캔버스 부모의 내부 참조를 쓴다.
 */

const OUT = path.resolve("design/screenshots");

const DEV_AUTH = JSON.stringify({
  state: { token: null, username: "admin", isGuest: true, isDev: true },
  version: 0,
});

/**
 * 캔버스의 순빨강 픽셀 수. 판정선이 그려졌는지를 픽셀로 확인한다.
 *
 * StrictMode 가 dev 에서 효과를 두 번 돌려 캔버스가 잠깐 두 개일 수 있다. 전부 합산한다.
 */
function redPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    let n = 0;
    for (const c of document.querySelectorAll("canvas")) {
      const off = document.createElement("canvas");
      off.width = c.width; off.height = c.height;
      const ctx = off.getContext("2d")!;
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] > 230 && d[i + 1] < 60 && d[i + 2] < 60) n++;
      }
    }
    return n;
  });
}

async function openCamp(page: Page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    ["monster-rpg-auth", DEV_AUTH],
  );
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.waitForFunction(() => {
    const g = (window as unknown as { __phaserGame?: unknown }).__phaserGame as
      | { scene?: { getScene?: (k: string) => unknown } }
      | undefined;
    const s = g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null;
    return Boolean(s?.player);
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(400);
}

function scenePos(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __phaserGame?: unknown }).__phaserGame as {
      scene: { getScene: (k: string) => { player: { x: number; y: number; body: { x: number; y: number; width: number; height: number } } } };
    };
    const p = g.scene.getScene("BaseCampScene").player;
    return { x: p.x, y: p.y, bx: p.body.x + p.body.width / 2, by: p.body.y + p.body.height / 2 };
  });
}

async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(120);
}

test.describe("basecamp:", () => {
  test("어느 방향으로 오래 밀어붙여도 충돌 박스 안으로 들어가지 않는다", async ({ page }) => {
    await openCamp(page);

    const runs: Array<{ keys: string[]; label: string }> = [
      { keys: ["ArrowUp"], label: "위" },
      { keys: ["ArrowLeft"], label: "왼쪽" },
      { keys: ["ArrowDown"], label: "아래" },
      { keys: ["ArrowRight"], label: "오른쪽" },
      { keys: ["ArrowUp", "ArrowLeft"], label: "좌상" },
      { keys: ["ArrowDown", "ArrowRight"], label: "우하" },
    ];

    for (const run of runs) {
      await hold(page, run.keys, 2500);
      const p = await scenePos(page);
      const inside = CAMP_COLLISION_BOXES.find(
        (b) => p.bx > b.x && p.bx < b.x + b.w && p.by > b.y && p.by < b.y + b.h,
      );
      expect(inside?.id, `${run.label}으로 밀었더니 ${inside?.id} 안이다 (${p.bx | 0}, ${p.by | 0})`)
        .toBeUndefined();
      expect(hitsWall(p.bx, p.by), `${run.label}: 바디가 벽과 겹친다`).toBe(false);
    }
  });

  test("개발자 모드에서 빨간 판정선이 그려진다", async ({ page }) => {
    await openCamp(page);
    await page.screenshot({ path: path.join(OUT, "collision-ingame-basecamp.png") });

    // F9 로 끄면 사라지고 다시 켜진다 — 캔버스 픽셀에서 순빨강의 양으로 확인한다
    const on = await redPixels(page);
    expect(on, "판정선이 안 보인다").toBeGreaterThan(500);

    await page.keyboard.press("F9");
    await page.waitForTimeout(300);
    expect(await redPixels(page), "F9 로 껐는데 남아 있다").toBeLessThan(on / 4);

    await page.keyboard.press("F9");
    await page.waitForTimeout(300);
    expect(await redPixels(page)).toBeGreaterThan(500);
  });

  test("게스트 세션에서는 판정선이 나오지 않는다", async ({ page }) => {
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      ["monster-rpg-auth", JSON.stringify({
        state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
      })],
    );
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible();
    await page.waitForTimeout(1500);

    expect(await redPixels(page), "개발자 모드가 아닌데 판정선이 보인다").toBeLessThan(500);
  });
});
