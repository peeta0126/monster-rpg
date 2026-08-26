import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playFloor, winOverlay } from "../e2e/autoBattle";
import { walkTo } from "./workshopNav";
import { CRAFTING_STATIONS } from "../src/workshop/workshopLayout";

/**
 * 게임의 모든 기능을 한 번에 훑는 전체 플레이 영상.
 *
 *   npx playwright test --config design/submission.config.ts -g "fullplay:"
 *
 * 결과: design/submission/fullplay.webm (지나간 화면은 submission/fullplay-frames/*.png)
 *
 * 한 브라우저 컨텍스트에서 끝까지 간다 — Playwright 는 컨텍스트 하나당 영상 하나를
 * 만들기 때문에, 새 탭을 열면 영상이 쪼개진다. 화면 이동은 전부 같은 탭에서 한다.
 *
 * 개발자 모드로 돌지만 충돌 판정선은 꺼 둔다(monster-rpg-collision-debug=off).
 * 소스의 판정선 색(collisionDebug.ts 의 #FF0000)은 건드리지 않는다 — 그 색을 고치면
 * 개발자 모드가 쓸모없어지고, 되돌리는 걸 잊으면 다음 사람이 벽을 못 본다.
 *
 * 한 장(chapter)이 실패해도 나머지는 계속 찍는다. 십 분짜리 녹화가 3분에서 죽으면
 * 통째로 버리게 되기 때문이다. 무엇이 찍혔고 무엇이 어긋났는지는 끝에 출력한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, "submission");
const FRAME_DIR = path.join(OUT_DIR, "fullplay-frames");
const VIDEO_DIR = path.join(HERE, "..", "test-results", "submission");

/** 화면 하나를 눈으로 읽을 시간 */
const READ = 2600;
/** 짧게 스치는 화면 */
const GLANCE = 1400;

const DEV_AUTH = JSON.stringify({
  state: { token: null, username: "demo", isGuest: true, isDev: true },
  version: 0,
});
const NO_AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: false, isDev: false },
  version: 0,
});

/** 보여 줄 것이 다 있는 중후반 세이브. 숲 네 구역과 탑 관문이 열려 있어야 한다 */
const SAVE = JSON.stringify({
  state: {
    party: [
      { id: "mossyfinal", level: 38, uid: "demo-0" },
      { id: "aquavern", level: 36, uid: "demo-1" },
      { id: "frostorb", level: 35, uid: "demo-2" },
    ],
    storage: [
      { id: "flameling", level: 12, uid: "demo-s0" },
      { id: "bubblet", level: 9, uid: "demo-s1" },
    ],
    dexSeen: ["flameling", "aquavern", "bubblet", "mossyfinal", "frostorb"],
    dexCaught: ["flameling", "aquavern", "bubblet", "mossyfinal", "frostorb"],
    materials: {
      slime_extract: 40, iron_fragment: 40, herb: 40, berry: 40, root: 40,
      crystal: 40, wood_plank: 40, leather: 40, monster_essence: 40,
      magic_dust: 40, enhancement_stone: 40,
    },
    potions: { max_potion: 20, super_potion: 20, potion: 20, antidote: 10 },
    bestFloor: 24,
    storyFlags: { met_orion: true },
    questStatus: {},
    seenDialogues: [],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [],
    equippedArtifacts: {}, imprint: {},
  },
  version: 2,
});

test.use({
  // 1440x810 은 전투(캔버스 540 + 아래 패널)와 16:9 를 같이 만족하는 가장 작은 크기다.
  viewport: { width: 1440, height: 810 },
  video: { mode: "on", size: { width: 1280, height: 720 } },
});

const done: string[] = [];
const failed: string[] = [];
let shot = 0;

async function mark(page: Page, name: string) {
  fs.mkdirSync(FRAME_DIR, { recursive: true });
  shot += 1;
  await page.screenshot({
    path: path.join(FRAME_DIR, `${String(shot).padStart(2, "0")}-${name}.png`),
  });
}

/** 한 장. 실패해도 영상은 계속 간다 */
async function chapter(page: Page, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    done.push(name);
  } catch (e) {
    failed.push(`${name} — ${String(e).replace(/\s+/g, " ").slice(0, 160)}`);
    // 다음 장이 엉뚱한 화면에서 시작하지 않게 마을로 돌려놓는다
    await page.goto("/").catch(() => {});
    await page.waitForTimeout(800);
  }
}

const hold = (page: Page, ms = READ) => page.waitForTimeout(ms);

/** 베이스캠프에서 방향키로 걷는다. Phaser 캔버스라 누를 대상이 없다 */
async function walk(page: Page, keys: string[], ms = 420) {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
  await page.waitForTimeout(120);
}

async function campReady(page: Page) {
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const g = (window as unknown as { __phaserGame?: { scene?: { getScene?: (k: string) => unknown } } }).__phaserGame;
    return Boolean((g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null)?.player);
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(500);
}

/** 화면 밖에서 자리를 옮긴다. 마을이 세로로 길어 걸어서만 가면 영상이 이동으로만 찬다 */
async function teleport(page: Page, x: number, y: number) {
  await page.evaluate(([px, py]) => {
    const s = (window as unknown as {
      __phaserGame: { scene: { getScene: (k: string) => {
        player: { setPosition: (x: number, y: number) => void; body: { reset: (x: number, y: number) => void } };
      } } };
    }).__phaserGame.scene.getScene("BaseCampScene");
    s.player.setPosition(px as number, py as number);
    s.player.body.reset(px as number, py as number);
  }, [x, y]);
  await page.waitForTimeout(400);
}

/** 대사창을 끝까지 넘긴다. 넘기기는 Space, 닫기는 Escape 다 */
async function clearDialogue(page: Page, lines = 8) {
  for (let i = 0; i < lines; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(650);
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

/** 공방 제작대 앞까지 걸어가 SPACE 를 누른다 */
async function openStation(page: Page, id: string, heading: string) {
  const st = CRAFTING_STATIONS.find((s) => s.id === id)!;
  await walkTo(page, st, st.radius * 0.8);
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 10_000 });
}

/**
 * Tab 메뉴를 열고 항목 하나를 누른다.
 *
 * 항목의 role 은 button 이 아니라 menuitem 이다. button 으로 찾으면 메뉴가 눈앞에
 * 떠 있어도 못 찾는다 — 처음 녹화에서 퀘스트·도감·무한의 탑이 이래서 통째로 빠졌다.
 */
async function menuPick(page: Page, name: string) {
  const item = page.getByRole("menuitem", { name });
  if (!(await item.first().isVisible().catch(() => false))) {
    await page.keyboard.press("Escape");           // 대사창 같은 게 떠 있으면 Tab 이 막힌다
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /메뉴/ }).first().click();
    await page.waitForTimeout(600);
  }
  await item.first().click();
  await page.waitForTimeout(700);
}

/** Tab 메뉴만 연다 */
async function openMenu(page: Page) {
  if (await page.getByRole("menuitem").first().isVisible().catch(() => false)) return;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /메뉴/ }).first().click();
  await expect(page.getByRole("menuitem").first()).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

/**
 * 화면 가운데에 커서를 놓고 굴린다.
 *
 * page.mouse.wheel 은 지금 커서 자리에서 구른다. 기본값이 (0,0) 이라 안쪽 스크롤
 * 상자 밖에서 굴러 아무 일도 안 일어났다 — 도감·가방·내 몬스터가 전부 그랬다.
 */
async function scroll(page: Page, dy: number) {
  const vp = page.viewportSize() ?? { width: 1440, height: 810 };
  await page.mouse.move(vp.width / 2, vp.height / 2);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(700);
}

/** 버튼이 보이면 누르고 true */
async function clickIf(page: Page, testId: string, waitMs = 500): Promise<boolean> {
  const b = page.locator(`[data-testid="${testId}"]`);
  if ((await b.count()) === 0) return false;
  const f = b.first();
  if (!(await f.isVisible().catch(() => false))) return false;
  await f.click().catch(() => {});
  await page.waitForTimeout(waitMs);
  return true;
}

test("fullplay: 전체 기능 플레이 영상", async ({ page }) => {
  test.setTimeout(40 * 60 * 1000);

  // ── 0. 로그인 화면 ────────────────────────────────────────────────────────────
  // 세이브만 먼저 심고 인증은 비워 둔다. 첫 화면이 로그인이어야 해서다.
  // ⚠ addInitScript 는 네비게이션마다 다시 돈다. 무조건 덮으면 개발자 모드로 갈아 끼운
  // 인증이 다음 이동에서 로그아웃 상태로 되돌아가, 그 뒤 모든 화면이 로그인 창이 된다.
  // 실제로 한 번 그렇게 찍혔다. 없을 때만 심는다.
  await page.addInitScript(
    ([auth, save]: string[]) => {
      if (!localStorage.getItem("monster-rpg-auth")) localStorage.setItem("monster-rpg-auth", auth);
      if (!localStorage.getItem("monster-rpg-player")) localStorage.setItem("monster-rpg-player", save);
      localStorage.setItem("monster-rpg-collision-debug", "off");   // 판정선 끄기
    },
    [NO_AUTH, SAVE],
  );

  await chapter(page, "0. 로그인 화면", async () => {
    await page.goto("/");
    await hold(page, 2200);
    await mark(page, "login");
    // 개발자 코드 창은 실제 계정으로 로그인하는 길목에서만 열린다(LoginForm 57줄).
    // 코드가 해시로만 들어 있어 여기서는 통과할 수 없으므로 영상에서 뺀다.
    const reg = page.getByRole("button", { name: /회원가입/ }).first();
    if (await reg.isVisible().catch(() => false)) {
      await reg.click();
      await hold(page, GLANCE);
      await mark(page, "login-register");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  });

  // 개발자 모드로 갈아 끼우고 다시 들어간다. 여기서 마을이 안 뜨면 뒤가 전부 로그인
  // 화면이 되므로, 나머지를 헛으로 찍지 않게 여기서 바로 멈춘다.
  await page.evaluate((auth) => localStorage.setItem("monster-rpg-auth", auth), DEV_AUTH);
  await page.goto("/");
  await campReady(page);

  // ── 1. 베이스캠프 — 걷기 ─────────────────────────────────────────────────────
  await chapter(page, "1. 베이스캠프 8방향 보행", async () => {
    await page.goto("/");
    await campReady(page);
    await mark(page, "basecamp");
    await hold(page, GLANCE);
    for (const keys of [
      ["ArrowDown"], ["ArrowDown", "ArrowRight"], ["ArrowRight"], ["ArrowUp", "ArrowRight"],
      ["ArrowUp"], ["ArrowUp", "ArrowLeft"], ["ArrowLeft"], ["ArrowDown", "ArrowLeft"],
    ]) {
      await walk(page, keys, 480);
    }
    await mark(page, "basecamp-walk");
  });

  // ── 2. 메뉴와 소리 설정 ──────────────────────────────────────────────────────
  await chapter(page, "2. Tab 메뉴 · 소리 설정", async () => {
    await openMenu(page);
    await hold(page, READ);
    await mark(page, "menu");
    await menuPick(page, "소리");
    await hold(page, READ);
    await mark(page, "menu-audio");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ── 3. 이장 오리온 · 바로스 대화 ─────────────────────────────────────────────
  await chapter(page, "3. NPC 대화 (오리온 · 바로스)", async () => {
    await teleport(page, 1090 + 90, 1950 - 87);
    await walk(page, ["ArrowLeft"], 260);
    await hold(page, GLANCE);
    await page.keyboard.press("e");
    await hold(page, READ);
    await mark(page, "talk-orion");
    await clearDialogue(page);
    await hold(page, GLANCE);

    await teleport(page, 430 + 90, 1200 - 87);
    await walk(page, ["ArrowLeft"], 260);
    await page.keyboard.press("e");
    await hold(page, READ);
    await mark(page, "talk-baros");
    await clearDialogue(page);
  });

  // ── 4. 퀘스트 · 도감 ─────────────────────────────────────────────────────────
  await chapter(page, "4. 퀘스트 목록 · 도감", async () => {
    await openMenu(page);
    await menuPick(page, "퀘스트");
    await hold(page, READ + 800);
    await mark(page, "quests");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    await openMenu(page);
    await menuPick(page, "도감");
    await hold(page, READ);
    await mark(page, "dex");
    await scroll(page, 600);
    await hold(page, GLANCE);
    await mark(page, "dex-scroll");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  // ── 5. 내 몬스터 ─────────────────────────────────────────────────────────────
  await chapter(page, "5. 내 몬스터 — 상세 · 각인 · 장비", async () => {
    await page.goto("/monsters");
    await expect(page.getByTestId("action-party").or(page.getByText("내 몬스터")).first())
      .toBeVisible({ timeout: 20_000 });
    await hold(page, READ);
    await mark(page, "monsters");
    await scroll(page, 700);
    await hold(page, GLANCE);
    await mark(page, "monsters-detail");
    await scroll(page, -700);
    await page.waitForTimeout(400);
    // 장착은 파티 몬스터 쪽에서 연다
    await page.getByText("아쿠사").first().click().catch(() => {});
    await page.waitForTimeout(700);
    if (await clickIf(page, "action-equip", 1000)) {
      await hold(page, READ);
      await mark(page, "equip");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }

    // 각인은 보관함으로 내린 뒤에만 먹일 수 있다. 보관함 칸을 누르면 파티와 자리를
    // 바꿔 버리니(교체), 파티에서 "보관함으로" 로 내리는 길로 간다.
    await page.getByText("프리로").first().click().catch(() => {});
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "보관함으로" }).first().click().catch(() => {});
    await page.waitForTimeout(900);
    await mark(page, "monsters-storage");
    if (await clickIf(page, "action-imprint", 1000)) {
      await hold(page, READ);
      await mark(page, "imprint");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
  });

  // ── 6. 가방 ──────────────────────────────────────────────────────────────────
  await chapter(page, "6. 가방 — 재료 · 물약 · 아티팩트", async () => {
    await page.goto("/farm");
    await expect(page.getByText(/재료|물약|아티팩트/).first()).toBeVisible({ timeout: 20_000 });
    await hold(page, READ);
    await mark(page, "bag");
    await scroll(page, 600);
    await hold(page, GLANCE);
    await mark(page, "bag-scroll");
  });

  // ── 7~8. 숲 ──────────────────────────────────────────────────────────────────
  await chapter(page, "7. 숲 — 구역 선택", async () => {
    await page.goto("/forest");
    await expect(page.locator('[data-testid="forest-tier-shallow"]')).toBeVisible({ timeout: 20_000 });
    await hold(page, READ + 600);
    await mark(page, "forest-areas");
    await scroll(page, 500);
    await hold(page, GLANCE);
    await mark(page, "forest-areas-2");
    await scroll(page, -500);
  });

  await chapter(page, "8. 숲 — 원정 · 포획 · 정산", async () => {
    const card = page.locator('[data-testid="forest-tier-shallow"]');
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(
      page.locator('[data-testid="forest-step-panel"], [data-testid="forest-fork"]').first(),
    ).toBeVisible({ timeout: 20_000 });
    await hold(page, READ);
    await mark(page, "forest-run");

    for (let step = 0; step < 18; step++) {
      if ((await page.locator('[data-testid="forest-settle"]').count()) > 0) break;
      if (await clickIf(page, "forest-fork-0", 900)) { await mark(page, "forest-fork"); continue; }
      if (await clickIf(page, "forest-rps-rock", 900)) { await mark(page, "forest-catch"); continue; }
      if (await clickIf(page, "forest-rps-done", 800)) continue;
      if (await clickIf(page, "forest-rps-retreat", 800)) continue;
      if (await clickIf(page, "forest-nest-pick-0", 800)) continue;
      if (await clickIf(page, "forest-step-action", 900)) continue;
      await page.waitForTimeout(300);
    }
    await mark(page, "forest-walked");

    await clickIf(page, "forest-go-home", 1200);
    const settle = page.locator('[data-testid="forest-settle"]');
    if (await settle.isVisible().catch(() => false)) {
      await hold(page, READ);
      await mark(page, "forest-settle");
      await clickIf(page, "forest-settle-confirm", 1200);
    }
  });

  // ── 9~12. 공방 ───────────────────────────────────────────────────────────────
  await chapter(page, "9. 공방 — 걷기", async () => {
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]').first()).toBeVisible({ timeout: 20_000 });
    await hold(page, READ);
    await mark(page, "workshop");
    for (const k of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      await page.keyboard.down(k);
      await page.waitForTimeout(500);
      await page.keyboard.up(k);
    }
    await hold(page, GLANCE);
  });

  await chapter(page, "10. 공방 — 연금술 (가위바위보)", async () => {
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await openStation(page, "alchemy-workbench", "연금술 제작대");
    await hold(page, READ);
    await mark(page, "alchemy");
    await page.getByText("작은 회복 물약").first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /제작 시작|개 제작/ }).first().click();
    await expect(page.getByRole("button", { name: /가위|바위|보/ }).first()).toBeVisible({ timeout: 10_000 });
    await hold(page, GLANCE);
    await mark(page, "alchemy-rps");
    await page.getByRole("button", { name: /바위/ }).first().click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /제작 완료/ }).first().click();
    await expect(page.getByRole("button", { name: /계속/ }).first()).toBeVisible({ timeout: 10_000 });
    await hold(page, READ);
    await mark(page, "alchemy-result");
    await page.getByRole("button", { name: /계속/ }).first().click();
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
  });

  await chapter(page, "11. 공방 — 아티팩트 (방향키 QTE)", async () => {
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await openStation(page, "artifact-workbench", "아티팩트 제작대");
    await hold(page, READ);
    await mark(page, "artifact");
    await page.getByText("힘의 목걸이").first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /제작 시작|개 제작/ }).first().click();
    await page.waitForTimeout(600);
    await mark(page, "artifact-qte");
    for (let i = 0; i < 40; i++) {
      for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) await page.keyboard.press(k);
      if (await page.getByRole("button", { name: /계속/ }).first().isVisible().catch(() => false)) break;
      await page.waitForTimeout(80);
    }
    await hold(page, READ);
    await mark(page, "artifact-result");
    await page.getByRole("button", { name: /계속/ }).first().click();
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
  });

  await chapter(page, "12. 공방 — 장비 모루", async () => {
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]').first()).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await openStation(page, "anvil", "장비 모루");
    await hold(page, READ + 900);
    await mark(page, "anvil");
    await page.keyboard.press("Escape");
  });

  // ── 13~16. 전투 ──────────────────────────────────────────────────────────────
  await chapter(page, "13. 무한의 탑 — 층 선택 창", async () => {
    await page.goto("/");
    await campReady(page);
    await openMenu(page);
    await menuPick(page, "무한의 탑");
    await hold(page, READ);
    await mark(page, "tower-modal");
    await page.getByRole("button", { name: /파티 HP 전회복/ }).first().click().catch(() => {});
    await page.waitForTimeout(700);
    await mark(page, "tower-heal");
    await page.getByRole("button", { name: "1층부터 시작" }).first().click();
    await page.waitForTimeout(1500);
  });

  await chapter(page, "14. 전투 — 명령 메뉴 · 상성표 · 로그 · 자동진행", async () => {
    await expect(page.getByTestId("battle-panel").first()).toBeVisible({ timeout: 30_000 });
    await hold(page, READ);
    await mark(page, "battle");

    await clickIf(page, "cmd-type-chart", 900);
    await hold(page, READ);
    await mark(page, "battle-typechart");
    await clickIf(page, "type-chart-close", 600);

    await clickIf(page, "cmd-log", 900);
    await hold(page, READ);
    await mark(page, "battle-log");
    await clickIf(page, "cmd-log", 600);

    await clickIf(page, "log-auto", 600);
    await clickIf(page, "log-speed", 600);
    await mark(page, "battle-auto");

    await clickIf(page, "cmd-moves", 700);
    await hold(page, GLANCE);
    await mark(page, "battle-moves");
    await clickIf(page, "cmd-back", 500);

    await clickIf(page, "cmd-bag", 700);
    await hold(page, GLANCE);
    await mark(page, "battle-bag");
    await clickIf(page, "cmd-back", 500);
  });

  await chapter(page, "15. 전투 — 1층 승리 · 경험치", async () => {
    await playFloor(page, 1);
    await expect(winOverlay(page)).toBeVisible({ timeout: 30_000 });
    await hold(page, READ);
    await mark(page, "battle-win");
    const exp = page.getByTestId("exp-gain");
    if (await exp.isVisible().catch(() => false)) await mark(page, "battle-exp");
    await hold(page, GLANCE);
  });

  await chapter(page, "16. 전투 — 보스 층(10F)", async () => {
    await page.goto("/");
    await campReady(page);
    await openMenu(page);
    await menuPick(page, "무한의 탑");
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /파티 HP 전회복/ }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "10층", exact: true }).first().click();
    await expect(page.getByTestId("battle-panel").first()).toBeVisible({ timeout: 30_000 });
    await hold(page, READ);
    await mark(page, "battle-boss");
    await playFloor(page, 10);
    await expect(winOverlay(page)).toBeVisible({ timeout: 60_000 });
    await hold(page, READ);
    await mark(page, "battle-boss-win");
  });

  // ── 17~18. 엔딩 · 관리 화면 ──────────────────────────────────────────────────
  await chapter(page, "17. 엔딩 화면", async () => {
    await page.goto("/ending");
    await expect(page.getByText(/며칠 후|끝|엔딩/).first()).toBeVisible({ timeout: 20_000 });
    await hold(page, READ + 2200);
    await mark(page, "ending");
  });

  await chapter(page, "18. 관리 화면 (접속 문)", async () => {
    await page.goto("/admin");
    await hold(page, READ);
    await mark(page, "admin");
  });

  await page.goto("/");
  await campReady(page).catch(() => {});
  await hold(page, 2000);

  console.log(`\n── 찍은 장 ${done.length} ──`);
  for (const d of done) console.log(`  O ${d}`);
  if (failed.length > 0) {
    console.log(`\n── 어긋난 장 ${failed.length} ──`);
    for (const f of failed) console.log(`  X ${f}`);
  }
});

test.afterAll(() => {
  // 영상 파일은 컨텍스트가 닫힌 뒤에 완성된다. 그래서 여기서 옮긴다.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videos: { file: string; mtime: number }[] = [];
  const walkDir = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walkDir(full);
      else if (e.name.endsWith(".webm")) videos.push({ file: full, mtime: fs.statSync(full).mtimeMs });
    }
  };
  walkDir(VIDEO_DIR);
  if (videos.length === 0) { console.log("영상 파일을 찾지 못했습니다."); return; }
  videos.sort((a, b) => b.mtime - a.mtime);
  const dest = path.join(OUT_DIR, "fullplay.webm");
  fs.copyFileSync(videos[0].file, dest);
  console.log(`\n전체 플레이 영상: ${dest} (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB)`);
});
