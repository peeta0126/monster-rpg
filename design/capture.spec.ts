import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

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
 * 노드 맵은 구역 배경 위에 바로 얹힌다 — 카드처럼 판을 깔고 그리는 화면이 아니라서
 * 원화가 바뀌면 여기가 제일 먼저 읽히지 않게 된다. 선택 화면과 따로 남긴다.
 */
test("capture: forest-nodes", async ({ page }) => {
  await seedStorage(page, true);
  await page.goto("/forest");
  await page.locator('[data-testid="forest-tier-shallow"]').click();
  await expect(page.locator('[data-testid^="forest-node-"]').first()).toBeVisible({ timeout: 20_000 });

  await waitForVisualSettle(page);
  await page.screenshot({ path: path.join(OUT_DIR, "forest-nodes.png"), fullPage: false });
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
