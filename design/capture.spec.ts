import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openWorkshop, walkTo } from "./workshopNav";
import { CRAFTING_STATIONS } from "../src/workshop/workshopLayout";

/**
 * 디자인 검증용 화면 캡처.
 *
 * 실행:
 *   npm run design:shot            → design/screenshots/current/*.png
 *   npm run design:before          → design/screenshots/before/*.png
 *   npm run design:after           → design/screenshots/after/*.png
 *
 * ⚠️ 로그인 우회는 zustand persist 키 "monster-rpg-auth" 에 게스트 세션을 직접 심는 방식이다.
 *    src/auth/authStore.ts 의 persist name 이 바뀌면 아래 AUTH_STORAGE_KEY 도 같이 고쳐야 한다.
 *    세이브 데이터는 "monster-rpg-player" 키를 쓰는데, 여기서는 일부러 심지 않는다 —
 *    playerStore 의 createInitialState() 가 주는 신규 플레이어 상태(플레미 1마리, 재료 0개)가
 *    "가장 휑한 화면"이라 디자인 문제가 제일 잘 드러나기 때문이다.
 */

const AUTH_STORAGE_KEY = "monster-rpg-auth";
const PLAYER_STORAGE_KEY = "monster-rpg-player";

const LABEL = process.env.SHOT_LABEL ?? "current";
const OUT_DIR = path.resolve(process.cwd(), "design", "screenshots", LABEL);

/** zustand persist 가 읽는 그대로의 봉투 형태. authStore 는 version 옵션이 없어 0. */
const GUEST_AUTH_STATE = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

interface Screen {
  /** 파일명 겸 컨택트시트 라벨 */
  name: string;
  path: string;
  /** false 면 게스트 세션을 심지 않는다 → AuthGate 가 로그인 화면을 띄운다 */
  auth: boolean;
  /** Phaser 캔버스가 그려질 때까지 window.__PHASER_READY__ 를 기다린다 */
  phaser?: boolean;
}

const SCREENS: Screen[] = [
  { name: "login",    path: "/",         auth: false },
  { name: "basecamp", path: "/",         auth: true, phaser: true },
  { name: "forest",   path: "/forest",   auth: true },
  { name: "farm",     path: "/farm",     auth: true },
  { name: "monsters", path: "/monsters", auth: true },
  { name: "workshop", path: "/workshop", auth: true },
  // /battle 은 라우트 state 없이 들어가도 동작한다 — BattlePage 가 floor=1 로 폴백해
  // getFloorEnemy() 로 적을 만들고, setBattleInitData() 를 스스로 호출한 뒤 씬을 띄운다.
  // 필요한 건 파티에 몬스터가 1마리 이상 있는 것뿐이고, 그건 신규 세이브 기본값이 보장한다.
  { name: "battle",   path: "/battle",   auth: true, phaser: true },
];

/** 페이지 첫 스크립트보다 먼저 localStorage 를 세팅한다 (AuthGate 하이드레이션 전에 들어가야 함) */
async function seedStorage(page: Page, authed: boolean) {
  await page.addInitScript(
    ({ authKey, playerKey, authState, authed }) => {
      window.localStorage.removeItem(authKey);
      window.localStorage.removeItem(playerKey);
      if (authed) window.localStorage.setItem(authKey, authState);
    },
    { authKey: AUTH_STORAGE_KEY, playerKey: PLAYER_STORAGE_KEY, authState: GUEST_AUTH_STATE, authed },
  );
}

/** 이미지·폰트가 다 뜨고 레이아웃이 멈출 때까지 기다린다. 화면별 셀렉터에 의존하지 않는다. */
async function waitForVisualSettle(page: Page) {
  // 전환 커버가 걷힐 때까지 기다린다. 안 그러면 중간 프레임이 찍혀
  // 비주얼 리그레션이 무작위로 깨진다.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="scene-transition"]') === null,
    undefined, { timeout: 10_000 },
  );
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.fonts.status === "loaded");
  await page.waitForFunction(() => {
    const imgs = Array.from(document.images);
    // naturalWidth 0 + complete = 로드 실패. 무한 대기하지 않도록 실패도 "끝난 것"으로 친다.
    return imgs.every((img) => img.complete);
  });
  // CSS 트랜지션·Phaser 카메라 페이드인(500ms)이 끝나기를 기다린다
  await page.waitForTimeout(900);
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

/**
 * 숲은 고른 구역에 따라 배경이 통째로 바뀐다. 한 장만 찍으면 나머지 두 장이 실제로
 * 다른 그림인지 알 수가 없어서 티어별로 따로 남긴다. 잠긴 구역도 호버로 "보기"는
 * 되므로(들어가지만 못한다) 신규 세이브로도 셋 다 찍힌다.
 */
const FOREST_TIERS = ["shallow", "deep", "ancient"] as const;

for (const tier of FOREST_TIERS) {
  test(`capture: forest-${tier}`, async ({ page }) => {
    await seedStorage(page, true);
    await page.goto("/forest");
    await expect(page.locator("#root")).not.toBeEmpty();

    const card = page.locator(`[data-testid="forest-tier-${tier}"]`);
    await expect(card).toBeVisible();
    await card.hover();
    await expect(card).toHaveAttribute("data-selected", "1");

    await waitForVisualSettle(page);
    await page.screenshot({ path: path.join(OUT_DIR, `forest-${tier}.png`), fullPage: false });
  });
}

/**
 * 탐험 화면은 원화 위에 바로 얹힌다 — 배경이 무대라서 원화가 바뀌면 여기가 제일
 * 먼저 읽히지 않게 된다. 선택 화면과 따로 남긴다.
 */
test("capture: forest-walk", async ({ page }) => {
  await seedStorage(page, true);
  await page.goto("/forest");
  await page.locator('[data-testid="forest-tier-shallow"]').click();
  await expect(
    page.locator('[data-testid="forest-step-panel"], [data-testid="forest-fork"]').first(),
  ).toBeVisible({ timeout: 20_000 });

  await waitForVisualSettle(page);
  await page.screenshot({ path: path.join(OUT_DIR, "forest-walk.png"), fullPage: false });
});

/**
 * 가위바위보는 두 곳에서 같은 아이콘을 쓴다 — 공방 제작 품질과 숲 포획.
 *
 * 아이콘이 19×19 그리드라 표시 크기가 19의 배수(57·76)일 때만 픽셀 폭이 균일하다.
 * 그건 숫자로는 확인이 안 되고 확대해서 눈으로 봐야 잡힌다. 두 화면 다 남기는 이유는
 * 판(공방은 갈색 카드, 숲은 원화 위 반투명)이 달라서 같은 색이 다르게 읽히기 때문이다.
 */
test("capture: workshop-rps", async ({ page }) => {
  await openWorkshop(page);
  const alchemy = CRAFTING_STATIONS.find((s) => s.id === "alchemy-workbench")!;
  await walkTo(page, alchemy, 0.6 * alchemy.radius);
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "연금술 제작대" })).toBeVisible();

  await page.getByRole("button", { name: "테스트 재료" }).click();
  await page.getByText("작은 회복 물약").first().click();
  await page.getByRole("button", { name: /제작 시작|개 제작/ }).click();

  await expect(page.getByRole("button", { name: /가위|바위|보/ }).first()).toBeVisible();
  await waitForVisualSettle(page);
  await page.screenshot({ path: path.join(OUT_DIR, "workshop-rps-select.png"), fullPage: false });

  // 결과 화면 — 내가 고른 쪽에 테두리가 붙는다. 아이콘 색만으로는 구분이 안 되기 때문
  await page.getByRole("button", { name: /바위/ }).first().click();
  await waitForVisualSettle(page);
  await page.screenshot({ path: path.join(OUT_DIR, "workshop-rps-result.png"), fullPage: false });
});

/**
 * 숲 포획 화면은 걸어서 닿으려면 조우가 나올 때까지 굴려야 한다. 저장된 원정을 직접
 * 심어 조우 한가운데로 들어간다 — 세이브 형식이 곧 게임 상태라 이게 가장 짧은 길이다.
 */
test("capture: forest-rps", async ({ page }) => {
  await seedStorage(page, true);
  await page.addInitScript(({ k, v }) => localStorage.setItem(k as string, v as string), {
    k: "monster-rpg-forest-run",
    v: JSON.stringify({
      run: {
        runVersion: 1, areaId: "shallow", depth: 3, alert: 30, alertPeak: 30,
        bag: [{ id: "herb", count: 2 }], caught: 0,
        current: "encounter", fork: null,
        step: { entered: true, pick: null, attempts: 0, pending: null, done: null },
        seed: 4242,
      },
    }),
  });
  await page.goto("/forest");

  await expect(page.locator('[data-testid="forest-rps-rock"]')).toBeVisible({ timeout: 20_000 });
  await waitForVisualSettle(page);
  await page.screenshot({ path: path.join(OUT_DIR, "forest-rps.png"), fullPage: false });
});

/**
 * Tab 메뉴는 우상단 버튼에 붙어 아래로 펼쳐진다. 닫힌 화면만 찍으면 펼친 목록이
 * 목표 배너·최근 제작 패널과 겹치는지를 알 수가 없어서 열린 상태로 한 장 더 남긴다.
 */
const MENU_SCREENS = [
  { name: "basecamp-menu", path: "/", phaser: true },
  { name: "workshop-menu", path: "/workshop", phaser: false },
] as const;

for (const screen of MENU_SCREENS) {
  test(`capture: ${screen.name}`, async ({ page }) => {
    await seedStorage(page, true);
    await page.goto(screen.path);
    await expect(page.locator("#root")).not.toBeEmpty();
    if (screen.phaser) {
      await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
    }
    await waitForVisualSettle(page);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.waitForTimeout(200);

    await page.screenshot({ path: path.join(OUT_DIR, `${screen.name}.png`), fullPage: false });
  });
}

/** 소리 설정은 메뉴 안에서 펼쳐진다 — 슬라이더가 메뉴 폭에 눌리지 않는지는 눈으로만 잡힌다 */
test("capture: basecamp-menu-audio", async ({ page }) => {
  await seedStorage(page, true);
  await page.goto("/");
  await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
  await waitForVisualSettle(page);

  await page.keyboard.press("Tab");
  await page.getByRole("menuitem", { name: "소리" }).click();
  await expect(page.getByText("SOUND")).toBeVisible();
  // 커서를 치운다 — 눌렀던 항목에 hover 가 남으면 기본 색을 볼 수 없다
  await page.mouse.move(40, 600);
  await page.waitForTimeout(200);

  await page.screenshot({ path: path.join(OUT_DIR, "basecamp-menu-audio.png"), fullPage: false });
});

for (const screen of SCREENS) {
  test(`capture: ${screen.name}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => consoleErrors.push(String(e)));

    await seedStorage(page, screen.auth);
    await page.goto(screen.path);

    // React 가 실제로 마운트됐는지 (빈 #root 를 찍는 사고 방지)
    await expect(page.locator("#root")).not.toBeEmpty();

    if (screen.auth) {
      // 세션 주입이 실패하면 전 화면이 로그인 페이지로 찍힌다. 조용히 넘어가면 안 된다.
      await expect(
        page.getByRole("button", { name: /게스트로 시작/ }),
        `${screen.name}: 게스트 세션 주입 실패 — 로그인 화면이 떠 있다. ` +
        `authStore 의 persist name 이 "${AUTH_STORAGE_KEY}" 에서 바뀌지 않았는지 확인할 것.`,
      ).toHaveCount(0);
    } else {
      await expect(page.getByRole("button", { name: /게스트로 시작/ })).toBeVisible();
    }

    if (screen.phaser) {
      await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 30_000 });
    }

    await waitForVisualSettle(page);

    await page.screenshot({ path: path.join(OUT_DIR, `${screen.name}.png`), fullPage: false });

    if (consoleErrors.length > 0) {
      // 캡처는 이미 남겼다. 실패시키되 무엇이 터졌는지 로그에 남긴다.
      console.warn(`[${screen.name}] 콘솔 오류 ${consoleErrors.length}건:\n  ` + consoleErrors.join("\n  "));
    }
  });
}
