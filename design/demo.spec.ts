import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playFloor, winOverlay } from "../e2e/autoBattle";

/**
 * 제출용 데모 영상(3분 이내)을 녹화한다.
 *
 *   npm run submission:demo
 *
 * 결과: design/submission/demo.webm
 * mp4 가 필요하면: ffmpeg -i design/submission/demo.webm -c:v libx264 -pix_fmt yuv420p demo.mp4
 *
 * 화면을 한 바퀴 도는 것이 목적이라 실제 조작을 그대로 한다 — 베이스캠프는 방향키로 걷고,
 * 전투는 e2e 의 자동 플레이 헬퍼가 친다. 캡처를 이어 붙인 영상이 아니라 실제 플레이다.
 *
 * 길이는 아래 HOLD_* 로 조절한다. 3분을 넘기면 제출 가점 조건을 벗어난다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "submission");
const VIDEO_DIR = path.join(HERE, "..", "test-results", "submission");

/** 화면 하나를 보여 주는 시간 */
const HOLD_MS = 5000;
/** 걸음 하나 */
const STEP_MS = 420;

// 데모용 세이브 — 보여 줄 것이 있어야 하므로 중반 진행 상태로 심는다.
const DEMO_SAVE = JSON.stringify({
  state: {
    party: [
      { id: "mossyfinal", level: 34, uid: "demo-0" },
      { id: "aquavern", level: 32, uid: "demo-1" },
      { id: "frostorb", level: 30, uid: "demo-2" },
    ],
    storage: [
      { id: "flameling", level: 12, uid: "demo-s0" },
      { id: "bubblet", level: 9, uid: "demo-s1" },
    ],
    dexSeen: ["flameling", "aquavern", "bubblet", "mossyfinal", "frostorb"],
    dexCaught: ["flameling", "aquavern", "bubblet", "mossyfinal", "frostorb"],
    materials: { slime_extract: 12, iron_ore: 8, moss_clump: 9, spring_water: 6 },
    potions: { max_potion: 12, super_potion: 8, antidote: 4 },
    bestFloor: 24,
    storyFlags: { met_orion: true },
    questStatus: {},
    seenDialogues: ["orion_intro"],
    craftedItems: [],
    craftedArtifacts: [],
    craftedPotions: [],
    equippedArtifacts: {},
    imprint: {},
  },
  version: 2,
});

const GUEST_AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

/**
 * 뷰포트는 1600x900, 영상은 720p 로 줄여 받는다.
 * 1280x720 으로 찍으면 전투 화면이 세로로 눌려 캔버스 위아래가 까맣게 남는다
 * (전투는 캔버스 540 + 아래 패널이라 e2e 도 900 높이를 쓴다). 1440x810 이 16:9 를
 * 지키면서 그 둘이 다 들어가는 가장 작은 크기다.
 */
test.use({
  viewport: { width: 1440, height: 810 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
});

async function hold(page: Page, ms = HOLD_MS) {
  await page.waitForTimeout(ms);
}

/** 영상은 눈으로 확인할 수 없으니, 지나간 화면을 한 장씩 남겨 둔다 */
async function mark(page: Page, name: string) {
  fs.mkdirSync(path.join(OUT_DIR, "frames"), { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, "frames", `${name}.png`) });
}

/** 베이스캠프에서 방향키로 걷는다. Phaser 캔버스라 클릭 대상이 없다 */
async function walk(page: Page, key: string, ms = STEP_MS) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test("submission: 데모 영상", async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);

  await page.addInitScript(
    ([auth, save]: string[]) => {
      localStorage.setItem("monster-rpg-auth", auth);
      localStorage.setItem("monster-rpg-player", save);
    },
    [GUEST_AUTH, DEMO_SAVE],
  );

  // 1. 베이스캠프 — 걸어 다니는 화면
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();
  await hold(page, 2000);
  await walk(page, "ArrowRight", 700);
  await walk(page, "ArrowDown", 500);
  await walk(page, "ArrowLeft", 600);
  await hold(page, 1200);
  await mark(page, "1-basecamp");

  // 2. 내 몬스터 — 파티와 보관함
  await page.goto("/monsters");
  await hold(page);
  await mark(page, "2-monsters");

  // 3. 가방 — 재료와 물약
  await page.goto("/farm");
  await hold(page);
  await mark(page, "3-bag");

  // 4. 숲 — 구역 선택
  await page.goto("/forest");
  await hold(page);
  await mark(page, "4-forest");

  // 구역을 골라 실제로 원정을 시작한다 — 선형 원정 화면이 이 게임의 중심 축이다
  const enterForest = page.locator("button").filter({ hasText: "탐험하기" }).first();
  if (await enterForest.isVisible().catch(() => false)) {
    await enterForest.click();
    await hold(page);
    await mark(page, "4-forest-run");
  }

  // 5. 공방 — 제작
  await page.goto("/workshop");
  await expect(page.locator("canvas, [aria-label='player']").first()).toBeVisible();
  await hold(page);
  await mark(page, "5-workshop");

  // 6. 전투 — 실제로 두 층을 친다
  await page.goto("/battle");
  for (const floor of [1, 2]) {
    await playFloor(page, floor);
    await expect(winOverlay(page)).toBeVisible();
    await mark(page, `6-battle-${floor}`);
    await hold(page, 2200);
    if (floor === 1) {
      await page.locator("button").filter({ hasText: "다음층 (2F)" }).click();
    }
  }

  await hold(page, 1500);
});

test.afterAll(() => {
  // Playwright 는 컨텍스트가 닫힌 뒤에야 영상 파일을 완성한다. 그래서 여기서 옮긴다.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videos: { file: string; mtime: number }[] = [];
  const walkDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (entry.name.endsWith(".webm")) videos.push({ file: full, mtime: fs.statSync(full).mtimeMs });
    }
  };
  walkDir(VIDEO_DIR);
  if (videos.length === 0) {
    console.log("영상 파일을 찾지 못했습니다.");
    return;
  }
  videos.sort((a, b) => b.mtime - a.mtime);
  const dest = path.join(OUT_DIR, "demo.webm");
  fs.copyFileSync(videos[0].file, dest);
  console.log(`데모 영상: ${dest} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB)`);
});
