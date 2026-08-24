import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  CAMP_COLLISION_BOXES, CAMP_INTERACTIONS, bodyYFromSpriteY, hitsWall,
} from "../src/camp/campCollision";

/**
 * 베이스캠프를 실제로 걸어 다니며 충돌을 확인한다.
 *
 * 실행: `npx playwright test --config design/playwright.config.ts -g "basecamp:"`
 *
 * Phaser 캔버스는 접근성 트리에 안 잡히므로 좌표는 씬에서 직접 읽는다. 게임 코드에
 * 테스트용 훅을 심지 않으려고 `game.scene.getScene(...)` 로 꺼낸다. Phaser 인스턴스는
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

/** 좌표와 근접 안내를 한 번에 읽는다. 안내는 씬이 이름 붙여 둔 텍스트 하나뿐이다. */
function readHint(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as {
      __phaserGame: {
        scene: {
          getScene: (k: string) => {
            player: { x: number; y: number };
            children: { getByName: (n: string) => { x: number; y: number; text: string } | null };
          };
        };
      };
    }).__phaserGame;
    const s = g.scene.getScene("BaseCampScene");
    const h = s.children.getByName("interactHint");
    return { x: s.player.x, y: s.player.y, hint: h ? { x: h.x, y: h.y, text: h.text } : null };
  });
}

async function hold(page: Page, keys: string[], ms: number) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(120);
}

const DIRS: Array<{ keys: string[]; label: string }> = [
  { keys: ["ArrowUp"], label: "위" },
  { keys: ["ArrowDown"], label: "아래" },
  { keys: ["ArrowLeft"], label: "왼쪽" },
  { keys: ["ArrowRight"], label: "오른쪽" },
  { keys: ["ArrowUp", "ArrowLeft"], label: "좌상" },
  { keys: ["ArrowUp", "ArrowRight"], label: "우상" },
  { keys: ["ArrowDown", "ArrowLeft"], label: "좌하" },
  { keys: ["ArrowDown", "ArrowRight"], label: "우하" },
];

/**
 * 지도 곳곳에서 출발한다. 스폰 한 곳에서만 밀면 광장 언저리밖에 못 본다.
 * 실제로 어긋나 있던 곳(우물·좌판 앞·남쪽 아치)은 거기서 걸어 닿기까지가 멀다.
 */
const STARTS = [
  { id: "스폰",      x: 794,  y: 1230 },
  { id: "우물 앞",   x: 700,  y: 1600 },
  { id: "좌판 앞",   x: 830,  y: 1700 },
  { id: "광장",      x: 800,  y: 1950 },
  { id: "남쪽 아치", x: 760,  y: 2350 },
  { id: "남쪽 끝",   x: 780,  y: 2650 },
  { id: "탑 길",     x: 285,  y: 1000 },
  { id: "숲 앞",     x: 1150, y: 1980 },
];

function teleport(page: Page, x: number, y: number) {
  return page.evaluate(([px, py]) => {
    const g = (window as unknown as {
      __phaserGame: { scene: { getScene: (k: string) => { player: { setPosition: (a: number, b: number) => void } } } };
    }).__phaserGame;
    g.scene.getScene("BaseCampScene").player.setPosition(px, py);
  }, [x, y]);
}

test.describe("basecamp:", () => {
  test("어느 자리에서 어느 방향으로 밀어붙여도 충돌 박스 안으로 들어가지 않는다", async ({ page }) => {
    test.slow();
    await openCamp(page);

    for (const s of STARTS) {
      expect(hitsWall(s.x, bodyYFromSpriteY(s.y)), `출발점 ${s.id} 이 벽 안이다`).toBe(false);
    }

    const bad: string[] = [];
    for (const s of STARTS) {
      for (const run of DIRS) {
        await teleport(page, s.x, s.y);
        await page.waitForTimeout(80);
        await hold(page, run.keys, 1400);
        const p = await scenePos(page);
        const inside = CAMP_COLLISION_BOXES.find(
          (b) => p.bx > b.x && p.bx < b.x + b.w && p.by > b.y && p.by < b.y + b.h,
        );
        if (inside) bad.push(`${s.id}→${run.label}: ${inside.id} 안 (${p.bx | 0}, ${p.by | 0})`);
        else if (hitsWall(p.bx, p.by)) bad.push(`${s.id}→${run.label}: 벽과 겹침 (${p.bx | 0}, ${p.by | 0})`);
      }
    }
    expect(bad.join("\n")).toBe("");
  });

  /**
   * 안내는 하나뿐이고 플레이어를 따라와야 한다. 예전에는 대상마다 텍스트를 만들고
   * 지웠는데 만든 자리에 못박혀 있어서, 걸어가면 안내만 월드에 남아 떠다녔다.
   */
  test("근접 안내가 플레이어를 따라온다", async ({ page }) => {
    await openCamp(page);
    const house = CAMP_INTERACTIONS.find((i) => i.id === "house")!;
    await teleport(page, house.x, house.y + 40);
    await page.waitForTimeout(300);

    const before = await readHint(page);
    expect(before.hint, "집 앞인데 안내가 없다").not.toBeNull();
    expect(Math.abs(before.hint!.x - before.x)).toBeLessThan(4);

    await hold(page, ["ArrowDown"], 400);
    const after = await readHint(page);
    expect(after.y, "아래로 눌렀는데 안 움직였다").toBeGreaterThan(before.y);
    if (after.hint) {
      expect(
        Math.abs(after.hint.x - after.x) + Math.abs(after.hint.y - (after.y - 60)),
        "안내가 플레이어를 안 따라온다",
      ).toBeLessThan(6);
    }
  });

  /**
   * 안내가 뜨는 것과 E 가 먹는 것이 같은 판정이어야 한다. 예전에는 숲 안내가 130px
   * 에서 뜨고 160px 에서 지워지는데 E 는 130px 만 받아서, 그 사이 30px 에서는
   * "E: 숲 입장" 을 보면서 눌러도 아무 일이 없었다.
   *
   * 어느 대상이 뽑히는지(우선순위)는 여기서 다시 계산하지 않는다. 베끼면 표가 두 벌이
   * 된다. "범위 안에 뭐라도 있으면 안내가 있다"만 본다.
   */
  test("안내 유무가 판정 범위와 일치한다", async ({ page }) => {
    await openCamp(page);
    const NPCS = [{ x: 430, y: 1200, r: 160 }, { x: 1090, y: 1950, r: 160 }];
    const mismatches: string[] = [];

    for (const spot of CAMP_INTERACTIONS) {
      for (let d = 0; d <= spot.radius + 120; d += 20) {
        await teleport(page, spot.x - d, spot.y);
        await page.waitForTimeout(110);
        const p = await readHint(page);
        const dists = [
          ...CAMP_INTERACTIONS.map((i) => Math.hypot(p.x - i.x, p.y - i.y) - i.radius),
          ...NPCS.map((n) => Math.hypot(p.x - n.x, p.y - n.y) - n.r),
        ];
        const anyInRange = dists.some((v) => v <= 0);
        const shows = Boolean(p.hint);
        // 경계 몇 px 은 텔레포트 직후 물리 밀어냄으로 갈릴 수 있어 여유를 둔다
        const margin = Math.min(...dists.map(Math.abs));
        if (shows !== anyInRange && margin > 6) {
          mismatches.push(
            `${spot.id} 에서 ${d}px: 안내 ${shows ? "뜸" : "없음"} / 범위 ${anyInRange ? "안" : "밖"}`,
          );
        }
      }
    }
    expect(mismatches.join("\n")).toBe("");
  });

  test("개발자 모드에서 빨간 판정선이 그려진다", async ({ page }) => {
    await openCamp(page);
    await page.screenshot({ path: path.join(OUT, "collision-ingame-basecamp.png") });

    // F9 로 끄면 사라지고 다시 켜진다. 캔버스 픽셀에서 순빨강의 양으로 확인한다
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
