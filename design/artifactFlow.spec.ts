import { test, expect, type Page } from "@playwright/test";
import { openWorkshop, walkTo } from "./workshopNav";
import { CRAFTING_STATIONS } from "../src/workshop/workshopLayout";

/**
 * 아티팩트 한 살이 — 제작 → 강화 → 장착 → 스탯 반영 → 보너스 증가.
 *
 * 공방 회귀 확인에서 여기만 "모루 모달 진입·목록까지"로 남아 있었다. 흐름이 공방과
 * /monsters 두 화면에 걸쳐 있어 한 스펙으로 묶었다.
 *
 * ⚠️ 순서가 '장착 → 강화'가 아니라 '강화 → 장착'인 이유:
 *    장착하면 그 아티팩트가 가방(craftedArtifacts)에서 빠지는데(playerStore.equipArtifact),
 *    모루는 가방만 나열한다. 그래서 **장착 중인 장비는 강화할 수 없다.** 스토어의
 *    updateCraftedArtifact 는 장착 위치까지 갱신하도록 돼 있어 의도된 제약인지는 불분명하다.
 *    여기서는 UI 가 실제로 허용하는 순서로만 확인한다.
 *
 * 수량을 "최대"로 두는 게 핵심이다. 일괄 제작은 미니게임 한 번의 판정을 전량에 적용하므로
 * 같은 등급이 여러 개 나오고, 강화 재료(같은 등급 장비)가 확보된다. 한 개씩 만들면 QTE
 * 정확도에 따라 등급이 갈려 재료가 안 맞을 수 있다.
 *
 * +0 → +1 강화는 성공률 100% 라(ENHANCEMENT_SUCCESS_RATE[0]) 결과가 흔들리지 않는다.
 */

// 좌표를 베껴 두면 제작대를 옮겼을 때 스펙만 조용히 딴 데를 찍는다. 원본에서 읽는다.
const BENCH = CRAFTING_STATIONS.find((s) => s.id === "artifact-workbench")!;
const ANVIL = CRAFTING_STATIONS.find((s) => s.id === "anvil")!;

/** 제작대 중심은 자기 충돌 박스 안이라 반경의 0.8배까지만 다가갈 수 있다 */
const APPROACH = 0.8;

/** 아티팩트 제작대에서 힘의 목걸이를 상한까지 만든다. 일괄 제작이라 전부 같은 등급이다. */
async function craftBatch(page: Page) {
  expect(await walkTo(page, BENCH, APPROACH * BENCH.radius), "아티팩트 제작대까지 못 갔다").toBe(true);
  await expect(page.getByText("아티팩트 제작대 사용하기")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "아티팩트 제작대" })).toBeVisible();

  await page.getByRole("button", { name: "테스트 재료" }).click();
  await page.getByText("힘의 목걸이").first().click();
  // 수량은 "최대"로. 힘의 목걸이는 테스트 재료 한 번으로 3개가 상한이라 craft-qty-5 는
  // 아예 렌더되지 않는다. craft-qty-max 는 상한이 2 이상이면 항상 있다.
  await page.getByTestId("craft-qty-max").click();
  await page.getByRole("button", { name: /제작 시작|개 제작/ }).click();

  // 방향키 QTE — 정확도는 상관없다. 끝까지만 가면 된다.
  for (let i = 0; i < 40; i++) {
    for (const k of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) await page.keyboard.press(k);
    if (await page.getByRole("button", { name: /계속/ }).first().isVisible()) break;
    await page.waitForTimeout(80);
  }
  await expect(page.getByRole("button", { name: /계속/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

/** 파티 첫 몬스터를 골라 상태창을 띄운다 (handlePartyClick → detailUid) */
async function openStatus(page: Page) {
  await page.getByText("전투 파티").waitFor();
  if (!(await page.getByTestId("stat-공격-value").first().isVisible().catch(() => false))) {
    await page.getByText("플레미").first().click();
  }
  await expect(page.getByTestId("stat-공격-value").first()).toBeVisible();
}

const statValue = async (page: Page, label: string) =>
  Number((await page.getByTestId(`stat-${label}-value`).first().innerText()).trim());

const statBonus = async (page: Page, label: string) =>
  Number((await page.getByTestId(`stat-${label}-bonus`).first().innerText()).replace("+", ""));

/**
 * 장비 모달을 열고 가방의 index 번째 아티팩트를 장착한다.
 *
 * 장착 버튼은 카드마다 있던 것이 상태창의 '관리' 한 벌로 모였다 — 그래서
 * openStatus() 로 대상을 먼저 세운 뒤에만 눌린다.
 */
async function equipNth(page: Page, index: number) {
  await page.getByTestId("action-equip").click();
  await expect(page.getByTestId("equip-modal")).toBeVisible();
  await page.getByText("장착하기").nth(index).click();
  await page.keyboard.press("Escape");
}

test.describe("artifact:", () => {
  test("제작 → 강화 → 장착 → 스탯 반영 → 보너스 증가", async ({ page }) => {
    // ── 1. 같은 등급으로 여러 개 만든다 ────────────────────────────────────
    await openWorkshop(page);
    await craftBatch(page);

    // ── 2. 모루에서 첫 번째를 두 번째를 재료로 강화한다 (+0 → +1, 성공률 100%) ──
    expect(await walkTo(page, ANVIL, APPROACH * ANVIL.radius), "모루까지 못 갔다").toBe(true);
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: "장비 모루" })).toBeVisible();
    await page.getByRole("button", { name: /강화/ }).first().click();

    // 왼쪽 목록에서 강화 대상을 고르면 오른쪽 패널이 뜬다
    await page.getByText("힘의 목걸이").first().click();
    await expect(page.getByText("✦ 장비 강화 ✦")).toBeVisible();
    await expect(page.getByText(/재료 선택/)).toBeVisible();
    // 재료는 오른쪽 패널의 목록에서 고른다. 이름만으로 찾으면 왼쪽 '보유 아티팩트'
    // 목록이 먼저 잡혀 강화 대상만 바뀌고 재료는 안 골라진다.
    await page.locator("div.max-h-32.overflow-y-auto").getByText("힘의 목걸이").first().click();
    await expect(page.getByRole("button", { name: /강화하기/ }), "재료가 안 골라졌다")
      .toBeVisible();
    await page.getByRole("button", { name: /강화하기/ }).click();
    await expect(page.getByText("+1").first()).toBeVisible();
    await page.keyboard.press("Escape");

    // 가방 순서는 [강화된 것, 안 한 것] 이다. 재료로 쓴 게 중간에서 빠졌다.

    // ── 3. 강화 안 한 것을 장착해 스탯 반영을 본다 ─────────────────────────
    await page.goto("/monsters");
    await openStatus(page);
    const atkBefore = await statValue(page, "공격");
    await expect(page.getByTestId("stat-공격-bonus")).toHaveCount(0);   // 아직 보너스 없음

    await equipNth(page, 1);                                  // 안 한 쪽
    await openStatus(page);
    const bonusPlain = await statBonus(page, "공격");
    expect(bonusPlain, "장착했는데 공격 보너스가 0이다").toBeGreaterThan(0);
    expect(await statValue(page, "공격"), "장착했는데 공격 수치가 그대로다")
      .toBe(atkBefore + bonusPlain);

    // ── 4. 강화한 것으로 바꿔 끼우면 보너스가 늘어야 한다 ──────────────────
    await equipNth(page, 0);                                  // 강화된 쪽 (같은 슬롯 → 교체)
    await openStatus(page);
    const bonusEnhanced = await statBonus(page, "공격");
    expect(
      bonusEnhanced,
      `강화한 장비를 꼈는데 보너스가 안 늘었다 (${bonusPlain} → ${bonusEnhanced})`,
    ).toBeGreaterThan(bonusPlain);
    expect(await statValue(page, "공격")).toBe(atkBefore + bonusEnhanced);
  });
});
