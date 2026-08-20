import { test, expect } from "@playwright/test";
import { openWorkshop, readPos, walkTo } from "./workshopNav";
import {
  INITIAL_POS, PLAYER_BOUNDS, CRAFTING_STATIONS, EXIT_ZONE, COLLISION_BOXES,
} from "../src/workshop/workshopLayout";

/**
 * 공방 회귀 검증 — 배경을 새 이미지로 갈고 좌표계를 통째로 바꿨으므로,
 * 기존 기능이 살아 있는지 실제로 눌러서 확인한다. 추측으로 체크하지 않으려고 만들었다.
 *
 * 실행: npx playwright test --config design/playwright.config.ts -g "workshop:"
 *
 * 로그인 우회는 capture.spec.ts 와 같은 방식(zustand persist 키에 게스트 세션 주입)이다.
 */

/**
 * 제작대까지 얼마나 파고들 것인가. 제작대 중심은 자기 충돌 박스 안이라 반경의
 * 절반까지는 못 들어간다 — 실제로 설 수 있는 가장 가까운 자리가 반경의 0.6~0.65배다.
 */
const APPROACH = 0.8;

test.describe("workshop:", () => {
  test("스폰 위치가 INITIAL_POS 다", async ({ page }) => {
    await openWorkshop(page);
    const p = await readPos(page);
    expect(p.x).toBeCloseTo(INITIAL_POS.x, 1);
    expect(p.y).toBeCloseTo(INITIAL_POS.y, 1);
  });

  test("방향키로 움직이고 걷기 프레임이 바뀐다", async ({ page }) => {
    await openWorkshop(page);
    const before = await readPos(page);
    const frameBefore = await page.locator('[aria-label="player"]').getAttribute("data-frame");

    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(400);
    const frameWalking = await page.locator('[aria-label="player"]').getAttribute("data-frame");
    await page.keyboard.up("ArrowUp");
    await page.waitForTimeout(100);

    const after = await readPos(page);
    expect(after.y).toBeLessThan(before.y);            // 위로 갔다
    expect(frameWalking).not.toBe(frameBefore);        // 걷기 프레임으로 바뀌었다

    // 네 방향 모두 스프라이트가 달라지는지
    const seen = new Set<string>();
    for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(200);
      await page.keyboard.up(key);
      const s = await page.locator('[aria-label="player"]').getAttribute("data-frame");
      const flip = await page.locator('[aria-label="player"]').evaluate((e) => (e as HTMLElement).style.transform);
      seen.add(`${s}|${flip}`);
      await page.waitForTimeout(80);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);       // 좌/우는 flip 으로 구분된다
  });

  test("가구를 통과하지 못한다", async ({ page }) => {
    await openWorkshop(page);
    // 상자(chest, x 67~79 / y 78~93) 를 향해 오른쪽 아래로 밀어붙인다
    const chest = COLLISION_BOXES.find((b) => b.id === "chest")!;
    await walkTo(page, { x: chest.x + chest.width / 2, y: chest.y + chest.height / 2 }, 1);
    const p = await readPos(page);
    const inside =
      p.x >= chest.x && p.x <= chest.x + chest.width &&
      p.y >= chest.y && p.y <= chest.y + chest.height;
    expect(inside, `상자 안(${p.x.toFixed(1)}, ${p.y.toFixed(1)})으로 들어갔다`).toBe(false);
  });

  test("스테이지 밖으로 나가지 못한다", async ({ page }) => {
    await openWorkshop(page);
    for (const key of ["ArrowLeft", "ArrowUp"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(2500);
      await page.keyboard.up(key);
    }
    const p = await readPos(page);
    expect(p.x).toBeGreaterThanOrEqual(PLAYER_BOUNDS.minX - 0.1);
    expect(p.y).toBeGreaterThanOrEqual(PLAYER_BOUNDS.minY - 0.1);
  });

  test("러그 위를 지나갈 수 있다", async ({ page }) => {
    await openWorkshop(page);
    const reached = await walkTo(page, { x: 50, y: 52 }, 3);
    expect(reached, "러그 한가운데까지 못 갔다").toBe(true);
  });

  for (const station of CRAFTING_STATIONS) {
    test(`${station.label} 근접 → SPACE → 모달`, async ({ page }) => {
      await openWorkshop(page);
      const reached = await walkTo(page, station, APPROACH * station.radius);
      expect(reached, `${station.id} 까지 못 갔다`).toBe(true);

      await expect(page.getByText(`${station.label} 사용하기`)).toBeVisible();
      await page.keyboard.press("Space");

      const title = station.type === "anvil" ? "장비 모루"
        : station.type === "artifact" ? "아티팩트 제작대" : "연금술 제작대";
      await expect(page.getByRole("heading", { name: title })).toBeVisible();

      // 모달이 열린 동안에는 SPACE 상호작용이 먹지 않아야 한다
      await page.keyboard.press("Space");
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByText(`${station.label} 사용하기`)).toBeHidden();

      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: title })).toBeHidden();
    });
  }

  test("출입구에서 SPACE 로 베이스캠프에 나간다", async ({ page }) => {
    await openWorkshop(page);
    // 스폰이 이미 출입구 판정 안이다
    await expect(page.getByText(EXIT_ZONE.label)).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/$/);
  });

  test("좌상단 '바깥으로' 버튼도 그대로 동작한다", async ({ page }) => {
    await openWorkshop(page);
    await page.getByRole("button", { name: /바깥으로/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("제작대 근처에서는 출입구가 아니라 제작대가 잡힌다", async ({ page }) => {
    await openWorkshop(page);
    // 아티팩트 제작대는 아래쪽이라 출입구와 가장 가깝다
    const bench = CRAFTING_STATIONS.find((s) => s.id === "artifact-workbench")!;
    await walkTo(page, bench, APPROACH * bench.radius);
    await expect(page.getByText(`${bench.label} 사용하기`)).toBeVisible();
    await expect(page.getByText(EXIT_ZONE.label)).toBeHidden();
  });

  /**
   * 모달 뒤에서 플레이어가 걸어다니던 버그. RAF 루프가 Tab 메뉴만 보고 제작 모달은
   * 보지 않아서, 모달을 열어둔 채 방향키로 방을 돌아다닐 수 있었다.
   */
  test("모달이 열려 있으면 방향키로 움직이지도 돌지도 않는다", async ({ page }) => {
    await openWorkshop(page);
    const anvil = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;
    await walkTo(page, anvil, APPROACH * anvil.radius);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();

    const before = await readPos(page);
    const facingBefore = await page.locator('[aria-label="player"]').getAttribute("data-frame");

    for (const key of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
      await page.keyboard.down(key);
      await page.waitForTimeout(250);
      await page.keyboard.up(key);
    }

    const after = await readPos(page);
    expect(after.x, "모달 중에 x 가 움직였다").toBeCloseTo(before.x, 1);
    expect(after.y, "모달 중에 y 가 움직였다").toBeCloseTo(before.y, 1);
    // 방향 전환도 막혀야 한다 — 뒤에서 캐릭터가 빙글빙글 돌면 안 된다
    expect(await page.locator('[aria-label="player"]').getAttribute("data-frame")).toBe(facingBefore);

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeHidden();
    await page.waitForTimeout(300);
    const afterClose = await readPos(page);
    expect(afterClose.x).toBeCloseTo(before.x, 1);
    expect(afterClose.y).toBeCloseTo(before.y, 1);
  });

  test("방향키를 누른 채 모달을 열었다 닫아도 미끄러지지 않는다", async ({ page }) => {
    await openWorkshop(page);
    const anvil = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;
    await walkTo(page, anvil, APPROACH * anvil.radius);

    // 방향키를 누른 상태로 모달을 연다. 이 상태에서 keyup 을 놓치면 닫는 순간
    // 유령 입력이 남아 플레이어가 저 혼자 미끄러진다.
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(120);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();

    // 기준 좌표는 모달이 뜬 뒤에 찍는다. 누르고 있는 동안 찍으면 그 사이에도
    // 계속 움직여서 기준 자체가 흔들린다 — 처음에 그렇게 짰다가 간헐적으로 깨졌다.
    await page.waitForTimeout(200);
    const before = await readPos(page);

    await page.waitForTimeout(300);
    await page.keyboard.up("ArrowUp");          // 모달이 떠 있는 동안 손을 뗀다
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeHidden();

    await page.waitForTimeout(500);             // 유령 입력이 있었다면 이 사이에 흐른다
    const after = await readPos(page);
    expect(after.y, "모달을 닫은 뒤 저 혼자 미끄러졌다").toBeCloseTo(before.y, 1);
    expect(after.x).toBeCloseTo(before.x, 1);
  });

  test("Tab 메뉴 차단은 그대로다", async ({ page }) => {
    await openWorkshop(page);
    const before = await readPos(page);
    await page.keyboard.press("Tab");
    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(400);
    await page.keyboard.up("ArrowUp");
    const after = await readPos(page);
    expect(after.y, "Tab 메뉴 중에 움직였다").toBeCloseTo(before.y, 1);
    await page.keyboard.press("Escape");
  });

  /**
   * 미니게임과 제작 품질 표시는 이번에 손대지 않았지만, 재배선한 페이지를 통해서만
   * 닿을 수 있으므로 실제로 끝까지 돌려본다.
   */
  test("연금술: 가위바위보 미니게임으로 물약이 제작된다", async ({ page }) => {
    await openWorkshop(page);
    const alchemy = CRAFTING_STATIONS.find((s) => s.id === "alchemy-workbench")!;
    await walkTo(page, alchemy, APPROACH * alchemy.radius);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "연금술 제작대" })).toBeVisible();

    await page.getByRole("button", { name: "테스트 재료" }).click();
    await page.getByText("작은 회복 물약").first().click();
    await page.getByRole("button", { name: /제작 시작|개 제작/ }).click();

    // 가위바위보 — 무엇을 내든 판정이 나오면 된다. 낸 뒤 "제작 완료"로 확정한다.
    await expect(page.getByRole("button", { name: /가위|바위|보/ }).first()).toBeVisible();
    await page.getByRole("button", { name: /바위/ }).first().click();
    await page.getByRole("button", { name: /제작 완료/ }).click();

    await expect(page.getByRole("button", { name: /계속/ })).toBeVisible();
    // 품질 라벨(QUALITY_LABEL)이 결과에 뜬다
    await expect(page.getByText(/일반|고급|희귀|영웅|전설/).first()).toBeVisible();
  });

  test("아티팩트: 방향키 QTE 미니게임으로 아티팩트가 제작된다", async ({ page }) => {
    await openWorkshop(page);
    const bench = CRAFTING_STATIONS.find((s) => s.id === "artifact-workbench")!;
    await walkTo(page, bench, APPROACH * bench.radius);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "아티팩트 제작대" })).toBeVisible();

    await page.getByRole("button", { name: "테스트 재료" }).click();
    await page.getByText("힘의 목걸이").first().click();
    await page.getByRole("button", { name: /제작 시작|개 제작/ }).click();

    // 방향키 QTE — 정확도와 무관하게 끝까지 가면 된다
    for (let i = 0; i < 40; i++) {
      for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
        await page.keyboard.press(k);
      }
      if (await page.getByRole("button", { name: /계속/ }).first().isVisible()) break;
      await page.waitForTimeout(80);
    }
    await expect(page.getByRole("button", { name: /계속/ }).first()).toBeVisible();
    await expect(page.getByText(/일반|고급|희귀|영웅|전설/).first()).toBeVisible();
  });

  test("모루: 제작한 아티팩트가 목록에 뜬다", async ({ page }) => {
    await openWorkshop(page);
    const anvil = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;
    await walkTo(page, anvil, APPROACH * anvil.radius);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();
    await expect(page.getByText(/레벨업|강화|분해|합성/).first()).toBeVisible();
  });

  test("재진입 시 위치가 스폰으로 돌아온다", async ({ page }) => {
    await openWorkshop(page);
    await walkTo(page, { x: 50, y: 52 }, 3);
    expect((await readPos(page)).y).toBeLessThan(INITIAL_POS.y - 10);

    await page.getByRole("button", { name: /바깥으로/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/workshop");
    await expect(page.locator('[aria-label="player"]')).toBeVisible();

    const p = await readPos(page);
    expect(p.x).toBeCloseTo(INITIAL_POS.x, 1);
    expect(p.y).toBeCloseTo(INITIAL_POS.y, 1);
  });
});
