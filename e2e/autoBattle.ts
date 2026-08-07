import { expect, type Locator, type Page } from "@playwright/test";

/**
 * 전투 화면을 자동으로 진행시키는 공용 헬퍼.
 * 게임 코드는 건드리지 않고 실제 UI만 조작한다 (선택 근거는 Handoff.md 5장 참고).
 */

/** 한 층에서 허용할 최대 턴 수 — 무한 루프 방지용 안전장치 */
const MAX_TURNS_PER_FLOOR = 300;

export const moveButtons = (page: Page) =>
  page.locator("button").filter({ hasText: "위력" });

export const winOverlay = (page: Page) => page.getByText("WIN!", { exact: true });
export const loseOverlay = (page: Page) => page.getByText("LOSE...", { exact: true });
export const mustSwitchNotice = (page: Page) =>
  page.getByText("← 왼쪽에서 다음 몬스터를 선택하세요");
/** 기술 4칸이 찼을 때 뜨는 교체 선택 창 */
export const forgetPrompt = (page: Page) =>
  page.getByText("기술은 4개까지만 익힐 수 있다. 무엇을 잊을까?");

async function isVisible(loc: Locator): Promise<boolean> {
  return (await loc.count()) > 0 && (await loc.first().isVisible());
}

/** 기술 버튼이 하나라도 눌릴 수 있는 상태인가 (= 조작 대기 중) */
export async function canAct(page: Page): Promise<boolean> {
  const buttons = moveButtons(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    if (await buttons.nth(i).isEnabled()) return true;
  }
  return false;
}

/**
 * 기술 교체 선택 창이 떠 있으면 응답한다.
 * 전투가 플레이어 입력을 기다리며 멈춰 있으므로, 처리하지 않으면 자동 플레이가 그대로 굳는다.
 * 정책은 게임의 자동 판단과 같게 — 위력이 가장 낮은 기술을 밀어낸다.
 */
export async function resolveForgetPrompt(page: Page): Promise<boolean> {
  if (!(await isVisible(forgetPrompt(page)))) return false;

  const dialog = page.locator("div").filter({ hasText: "무엇을 잊을까?" }).last();
  const options = dialog.locator("button").filter({ hasText: "위력" });
  const count = await options.count();
  let worstIdx = -1;
  let worstPower = Number.POSITIVE_INFINITY;
  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).innerText()).replace(/\s+/g, " ");
    const power = Number(text.match(/위력 (\d+)/)?.[1] ?? 0);
    if (power < worstPower) { worstPower = power; worstIdx = i; }
  }
  if (worstIdx >= 0) await options.nth(worstIdx).click();
  else await page.locator("button").filter({ hasText: "배우지 않는다" }).first().click();
  await page.waitForTimeout(120);
  return true;
}

/**
 * 전투 로그는 한 줄마다 Q(또는 클릭) ACK를 기다린다(BattlePage.sendLogAndWait).
 * 조작 가능 상태로 돌아오거나 승패 오버레이가 뜰 때까지 q를 눌러 로그를 넘긴다.
 */
export async function advanceLogs(page: Page, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await resolveForgetPrompt(page)) continue;
    if (await isVisible(winOverlay(page))) return;
    if (await isVisible(loseOverlay(page))) return;
    if (await isVisible(mustSwitchNotice(page))) return;
    if (await canAct(page)) return;
    await page.keyboard.press("q");
    await page.waitForTimeout(60);
  }
  throw new Error("로그 진행이 멈췄습니다 (BATTLE_LOG_ACK 경로 확인 필요)");
}

interface MoveOption {
  index: number;
  power: number;
  superEffective: boolean;
  noEffect: boolean;
}

async function readMoves(page: Page): Promise<MoveOption[]> {
  const buttons = moveButtons(page);
  const count = await buttons.count();
  const options: MoveOption[] = [];
  for (let i = 0; i < count; i++) {
    const text = (await buttons.nth(i).innerText()).replace(/\s+/g, " ");
    const power = Number(text.match(/위력 (\d+)/)?.[1] ?? 0);
    options.push({
      index: i,
      power,
      superEffective: text.includes("효과 굉장"),
      noEffect: text.includes("효과 없음"),
    });
  }
  return options;
}

/** 상성 우위 > 위력 순으로 최선의 기술을 고른다 */
function pickMove(options: MoveOption[]): MoveOption | null {
  const usable = options.filter((o) => !o.noEffect && o.power > 0);
  const pool = usable.length > 0 ? usable : options;
  if (pool.length === 0) return null;
  return pool.reduce((best, o) => {
    const score = (x: MoveOption) => x.power * (x.superEffective ? 2 : 1);
    return score(o) > score(best) ? o : best;
  });
}

/** 상단 상태바의 "현재HP/최대HP"를 읽어 비율을 반환 */
async function playerHpRatio(page: Page): Promise<number> {
  const panel = await page.locator("div.bg-\\[\\#0e0b06\\]").first().innerText();
  const m = panel.match(/(\d+)\/(\d+)/);
  if (!m) return 1;
  const [, cur, max] = m;
  return Number(max) > 0 ? Number(cur) / Number(max) : 1;
}

/** 회복 물약을 사용하고 true 반환 (맥스 → 슈퍼 → 일반 순) */
async function tryUseHealingPotion(page: Page): Promise<boolean> {
  const bagButton = page.locator("button").filter({ hasText: "🎒 가방" });
  if (!(await isVisible(bagButton)) || !(await bagButton.first().isEnabled())) return false;

  await bagButton.first().click();
  for (const name of ["맥스 물약", "슈퍼 물약", "물약"]) {
    const potion = page.locator("button").filter({ hasText: name });
    if ((await potion.count()) > 0 && (await potion.first().isEnabled())) {
      await potion.first().click();
      await advanceLogs(page);
      return true;
    }
  }
  await page.locator("button").filter({ hasText: "닫기" }).first().click();
  return false;
}

/** 기절 시 강제 교체 — 벤치에서 선택 가능한 몬스터를 고른다 */
async function switchToHealthyMember(page: Page): Promise<void> {
  const bench = page.locator("button").filter({ hasText: "Lv." });
  const count = await bench.count();
  for (let i = 0; i < count; i++) {
    const button = bench.nth(i);
    const text = await button.innerText();
    if (text.includes("선택") && (await button.isEnabled())) {
      await button.click();
      await advanceLogs(page);
      return;
    }
  }
  throw new Error("교체할 수 있는 몬스터를 찾지 못했습니다");
}

/** 한 층을 승리할 때까지 진행한다. 패배하면 예외를 던진다. */
export async function playFloor(page: Page, floor: number): Promise<void> {
  // BATTLE_READY 전까지는 모든 버튼이 disabled 상태다
  await expect
    .poll(() => canAct(page), { timeout: 60_000, message: `${floor}층 전투 준비 실패` })
    .toBe(true);

  for (let turn = 0; turn < MAX_TURNS_PER_FLOOR; turn++) {
    if (await resolveForgetPrompt(page)) continue;
    if (await isVisible(winOverlay(page))) return;
    if (await isVisible(loseOverlay(page))) {
      throw new Error(`${floor}층에서 패배했습니다 (턴 ${turn})`);
    }
    if (await isVisible(mustSwitchNotice(page))) {
      await switchToHealthyMember(page);
      continue;
    }
    if (!(await canAct(page))) {
      await advanceLogs(page);
      continue;
    }

    // HP가 위험하면 먼저 회복
    if ((await playerHpRatio(page)) < 0.4 && (await tryUseHealingPotion(page))) continue;

    const options = await readMoves(page);
    const choice = pickMove(options);
    if (!choice) throw new Error(`${floor}층: 사용할 수 있는 기술이 없습니다`);

    await moveButtons(page).nth(choice.index).click();
    await advanceLogs(page);
  }

  throw new Error(`${floor}층이 ${MAX_TURNS_PER_FLOOR}턴 안에 끝나지 않았습니다`);
}
