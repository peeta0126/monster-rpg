import { expect, type Locator, type Page } from "@playwright/test";
import { isHardFloor } from "../src/shared/floorTable";

/**
 * 전투 화면을 자동으로 진행시키는 공용 헬퍼.
 * 게임 코드는 건드리지 않고 실제 UI만 조작한다 (선택 근거는 docs/notes/testing.md 참고).
 */

/** 한 층에서 허용할 최대 턴 수. 무한 루프 방지용 안전장치 */
const MAX_TURNS_PER_FLOOR = 300;

/** 2단 메뉴의 기술 버튼들 ("기술" 하위에서만 보인다) */
export const moveButtons = (page: Page) => page.locator('[data-testid^="move-"]');
/** 1단의 기술 항목. 예전엔 공격·스킬 둘로 갈려 있었는데 한 목록으로 합쳐졌다 */
const MOVE_ENTRY = "cmd-moves";

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

/**
 * 1단 메뉴의 "기술"을 누를 수 있으면 조작 대기 중이다.
 * 기술은 2단에 있어서 예전처럼 "위력" 버튼 존재 여부로는 못 본다.
 */
export async function canAct(page: Page): Promise<boolean> {
  const b = page.getByTestId(MOVE_ENTRY);
  return (await b.count()) > 0 && (await b.first().isEnabled());
}

/**
 * 기술 교체 선택 창이 떠 있으면 응답한다.
 * 전투가 플레이어 입력을 기다리며 멈춰 있으므로, 처리하지 않으면 자동 플레이가 그대로 굳는다.
 * 정책은 게임의 자동 판단과 같게. 위력이 가장 낮은 기술을 밀어낸다.
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
  testId: string;
  /** 셀에 적힌 예상 데미지(범위면 최소값). 상성 배율이 이미 반영된 값이다 */
  damage: number;
  /** 이 기술로 적을 쓰러뜨릴 수 있다고 셀이 말하는가 */
  ko: boolean;
}

/** "기술"을 열어 목록을 전부 훑고 1단으로 돌아온다 */
async function readMoves(page: Page): Promise<MoveOption[]> {
  const options: MoveOption[] = [];
  const entry = page.getByTestId(MOVE_ENTRY);
  if ((await entry.count()) === 0 || !(await entry.first().isEnabled())) return options;
  await entry.first().click();

  const buttons = moveButtons(page);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const testId = await btn.getAttribute("data-testid");
    if (!testId) continue;
    const text = (await btn.innerText()).replace(/\s+/g, " ");
    options.push({
      testId,
      damage: Number(text.match(/예상 (\d+)/)?.[1] ?? 0),
      ko: text.includes("쓰러뜨린다"),
    });
  }
  await page.getByTestId("cmd-back").click();
  return options;
}

/** 고른 기술을 실제로 사용한다 (목록을 다시 열고 클릭) */
async function selectMove(page: Page, choice: MoveOption): Promise<void> {
  await page.getByTestId(MOVE_ENTRY).first().click();
  await page.getByTestId(choice.testId).first().click();
}

/**
 * 예상 데미지가 가장 큰 기술을 고른다. 셀이 상성 배율까지 반영한 값을 적어 주므로
 * 예전처럼 "위력 × 상성 우위"로 따로 점수를 매길 필요가 없다.
 */
function pickMove(options: MoveOption[]): MoveOption | null {
  const usable = options.filter((o) => o.damage > 0);
  const pool = usable.length > 0 ? usable : options;
  if (pool.length === 0) return null;
  return pool.reduce((best, o) => (o.damage > best.damage ? o : best));
}

/**
 * 출전 중인 몬스터의 HP 비율.
 *
 * 예전엔 패널 전체 텍스트에서 첫 `숫자/숫자` 를 집었는데, 새 배치에서 그 첫 자리는
 * 파티 칸 1번이다. 출전 중인 몬스터가 2번이면 엉뚱한 HP 를 보고 물약을 안 마신다.
 * 출전 표시(data-active)를 달아 둔 칸에서만 읽는다.
 */
async function playerHpRatio(page: Page): Promise<number> {
  const active = page.locator('[data-testid^="party-"][data-active="1"]');
  const text = (await active.count()) > 0
    ? await active.first().innerText()
    : await page.getByTestId("battle-panel").first().innerText();
  const m = text.match(/(\d+)\/(\d+)/);
  if (!m) return 1;
  const [, cur, max] = m;
  return Number(max) > 0 ? Number(cur) / Number(max) : 1;
}

/** 회복 물약을 사용하고 true 반환 (맥스 → 슈퍼 → 일반 순) */
async function tryUseHealingPotion(page: Page): Promise<boolean> {
  const bag = page.getByTestId("cmd-bag");
  if ((await bag.count()) === 0 || !(await bag.first().isEnabled())) return false;

  await bag.first().click();
  for (const id of ["max_potion", "super_potion", "potion"]) {
    const potion = page.getByTestId(`potion-${id}`);
    if ((await potion.count()) > 0 && (await potion.first().isEnabled())) {
      await potion.first().click();   // 사용하면 메뉴가 알아서 1단으로 돌아온다
      await advanceLogs(page);
      return true;
    }
  }
  await page.getByTestId("cmd-back").click();
  return false;
}

/**
 * 관문·보스에서 첫 턴에 공격 버프를 마신다.
 *
 * 이걸 안 쓰면 이 헬퍼가 재는 난이도가 시뮬(`gameModel.pickPotionAction`)과 다른
 * 사람의 것이 된다. 실제로 40층 가방은 회복 1개에 공격 버프 5~6개인데, 버프를 안 쓰는
 * 쪽으로 열두 판 돌리니 0% 였고 쓰는 쪽(시뮬)은 25% 였다. 게임이 어려운 게 아니라
 * 자동 플레이어가 가방의 절반을 안 쓰고 있었다.
 *
 * 강한 집중의 물약이 공격 ×2·5턴이라 보스전에서 제일 큰 배수다. 사람도 그걸 쓴다.
 */
async function tryUseAttackBuff(page: Page): Promise<boolean> {
  const bag = page.getByTestId("cmd-bag");
  if ((await bag.count()) === 0 || !(await bag.first().isEnabled())) return false;

  await bag.first().click();
  for (const id of ["strong_attack_buff", "attack_buff"]) {
    const potion = page.getByTestId(`potion-${id}`);
    if ((await potion.count()) > 0 && (await potion.first().isEnabled())) {
      await potion.first().click();
      await advanceLogs(page);
      return true;
    }
  }
  await page.getByTestId("cmd-back").click();
  return false;
}

/** 기절 시 강제 교체. 파티 구역에서 고를 수 있는 몬스터를 누른다 */
async function switchToHealthyMember(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const slot = page.getByTestId(`party-${i}`);
    if ((await slot.count()) > 0 && (await slot.first().isEnabled())) {
      await slot.first().click();
      await advanceLogs(page);
      return;
    }
  }
  throw new Error("교체할 수 있는 몬스터를 찾지 못했습니다");
}

/** 한 층을 승리할 때까지 진행한다. 패배하면 예외를 던진다. */
export async function playFloor(page: Page, floor: number): Promise<void> {
  let buffed = false;
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

    // 관문·보스는 첫 턴에 공격 버프부터. 시뮬의 pickPotionAction 과 같은 규칙이다
    if (!buffed && isHardFloor(floor)) {
      buffed = true;                       // 못 마셨어도 다시 시도하지 않는다(가방에 없는 것이다)
      if (await tryUseAttackBuff(page)) continue;
    }

    const options = await readMoves(page);
    const choice = pickMove(options);
    if (!choice) throw new Error(`${floor}층: 사용할 수 있는 기술이 없습니다`);

    await selectMove(page, choice);
    await advanceLogs(page);
  }

  throw new Error(`${floor}층이 ${MAX_TURNS_PER_FLOOR}턴 안에 끝나지 않았습니다`);
}
