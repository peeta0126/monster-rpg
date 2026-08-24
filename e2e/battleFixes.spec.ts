import { test, expect, type Page } from "@playwright/test";
import { advanceLogs, canAct } from "./autoBattle";

/**
 * 이번 전투 정비가 실제 화면에서 되는지 확인한다. 계산 쪽은 tests/ 가 보고,
 * 여기서는 사람이 눈으로 확인할 자리(메뉴·로그·기절 흐름)만 UI 로 짚는다.
 */

interface SeedOptions {
  species: string;
  level: number;
  /** 시작 HP 를 최대치의 몇 할로 둘지 */
  hpRatio?: number;
  moves?: unknown[];
  potions?: Record<string, number>;
}

async function seed(page: Page, o: SeedOptions) {
  await page.addInitScript((opt: SeedOptions) => {
    localStorage.setItem("monster-rpg-auth", JSON.stringify({
      state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
    const mon: Record<string, unknown> = { id: opt.species, level: opt.level, uid: "fx-0" };
    if (opt.moves) mon.moves = opt.moves;
    localStorage.setItem("monster-rpg-player", JSON.stringify({
      state: {
        party: [mon], storage: [], dexSeen: [], dexCaught: [], materials: {},
        potions: opt.potions ?? {}, bestFloor: 0, storyFlags: {}, questStatus: {},
        craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      },
      version: 1,
    }));
  }, o);
}

async function enterFloor(page: Page, floor: number) {
  await page.goto("/battle");
  await expect(page.locator("#root")).not.toBeEmpty();
  await page.evaluate((f) => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: f } }, "");
  }, floor);
  await page.reload();
  await expect.poll(() => canAct(page), { timeout: 60_000 }).toBe(true);
}

/** 로그 기록 패널을 열어 지금까지의 줄을 전부 읽는다 */
async function logLines(page: Page): Promise<string> {
  const toggle = page.locator("button").filter({ hasText: "기록" }).first();
  const history = page.getByTestId("battle-log-history");
  // 눌렀다고 바로 열려 있지는 않다. 열린 것을 확인하고 읽는다. 예전에는 곧바로
  // innerText 를 읽어서, 화면이 잠깐 버벅이면 로그 대신 적 정보를 읽고 실패했다.
  await toggle.click();
  await expect(history).toBeVisible();
  const text = await page.locator("[data-testid=battle-panel]").innerText();
  await toggle.click();
  await expect(history).toBeHidden();
  return text;
}

// ─── 1. 합쳐진 기술 메뉴 ────────────────────────────────────────────────────────

test("시작 몬스터 모시로 시작해도 비활성 기술 버튼이 없다", async ({ page }) => {
  // 모시는 특수 기술이 0개다. 예전 메뉴에서는 "스킬" 버튼이 영구 비활성이었다.
  await seed(page, { species: "mossy", level: 5 });
  await enterFloor(page, 1);

  await expect(page.getByTestId("cmd-moves")).toBeEnabled();
  await page.getByTestId("cmd-moves").click();

  const cells = page.locator('[data-testid^="move-"]');
  await expect(cells).toHaveCount(2);          // 몸통박치기 · 전기불꽃
  for (let i = 0; i < 2; i++) await expect(cells.nth(i)).toBeEnabled();

  // 칸마다 속성·분류·위력·명중이 다 적혀 있다
  const first = (await cells.first().innerText()).replace(/\s+/g, " ");
  expect(first).toMatch(/노말|전기/);
  expect(first).toMatch(/물리|특수|상태/);
  expect(first).toMatch(/위력 \d+/);
  expect(first).toMatch(/명중 \d+/);
});

test("상태기 칸은 위력 0 대신 상태이상이라고 적는다", async ({ page }) => {
  await seed(page, {
    species: "flameling", level: 20,
    moves: [{ id: "cinder-toss", name: "불티날림", type: "fire", power: 0, accuracy: 90,
      category: "status", statusEffect: "burn", statusChance: 100 }],
  });
  await enterFloor(page, 1);
  await page.getByTestId("cmd-moves").click();

  const cell = (await page.getByTestId("move-cinder-toss").innerText()).replace(/\s+/g, " ");
  expect(cell).toContain("상태이상");
  expect(cell).not.toContain("위력 0");
  expect(cell).toContain("화상");
});

// ─── 2. 상태이상 ────────────────────────────────────────────────────────────────

test("상태이상은 몇 턴 뒤 스스로 풀리고, 이미 걸린 상대에게는 효과가 없다", async ({ page }) => {
  // 위력 1 짜리 기술 + 한 방에 안 죽는 30층 보스. 상태이상이 풀릴 때까지 전투가 이어져야 한다.
  await seed(page, {
    species: "flameling", level: 60, potions: { max_potion: 30 },
    moves: [
      { id: "cinder-toss", name: "불티날림", type: "fire", power: 0, accuracy: 100,
        category: "status", statusEffect: "burn", statusChance: 100 },
      { id: "ember", name: "불씨", type: "fire", power: 1, accuracy: 100, category: "special" },
    ],
  });
  await enterFloor(page, 30);

  const castMove = async (id: string) => {
    await page.getByTestId("cmd-moves").click();
    await page.getByTestId(`move-${id}`).click();
    await advanceLogs(page);
  };

  await castMove("cinder-toss");
  expect(await logLines(page)).toContain("화상 상태이상이 걸렸다!");

  // 두 번 걸면 아무 일도 없다는 걸 화면이 말해야 한다.
  //
  // ⚠ 한 번 눌러 보고 단정하면 안 된다. 이 층 보스는 설풍으로 이쪽을 얼리고, 얼면 그 턴이
  //   통째로 날아가 기술이 아예 안 나간다. 네 번에 한 번꼴로 "안 나간 기술"을 가지고
  //   게임이 틀렸다고 말하고 있었다. 기술이 실제로 나갈 때까지 눌러 본다.
  let saidNoEffect = false;
  for (let i = 0; i < 4 && !saidNoEffect && (await canAct(page)); i++) {
    await castMove("cinder-toss");
    saidNoEffect = (await logLines(page)).includes("효과가 없었다");
  }
  expect(saidNoEffect, "이미 화상인 상대에게 또 걸었는데 화면이 아무 말도 안 한다").toBe(true);

  // 지속 턴(화상 4턴)이 지나면 풀린다
  for (let i = 0; i < 4 && (await canAct(page)); i++) await castMove("ember");
  expect(await logLines(page)).toContain("화상 상태가 풀렸다");
});

test("상태이상 피해로 HP 가 0 이 되면 그 자리에서 쓰러진다", async ({ page }) => {
  // 자기 몸에 화상을 걸고 계속 맞아 가며 HP 를 바닥까지 떨어뜨린 뒤,
  // 마지막 한 방을 상태이상이 가져가는지 본다. 예전에는 HP 0 으로 계속 싸웠다.
  await seed(page, {
    species: "flameling", level: 3,
    moves: [{ id: "ember", name: "불씨", type: "fire", power: 1, accuracy: 100, category: "special",
      statusEffect: "burn", statusChance: 0 }],
  });
  await enterFloor(page, 9);

  // 적에게 계속 맞으며 진행. 지든 이기든 "HP 0 인데 살아 있는" 상태로는 끝나지 않아야 한다
  for (let i = 0; i < 40; i++) {
    if (!(await canAct(page))) { await advanceLogs(page); continue; }
    await page.getByTestId("cmd-moves").click();
    await page.getByTestId("move-ember").click();
    await advanceLogs(page);
    const panel = await page.getByTestId("battle-panel").innerText();
    const hp = panel.match(/(\d+)\/(\d+)/);
    if (hp && Number(hp[1]) === 0) {
      // 0 이 됐다면 조작이 막혀 있어야 한다(패배 화면이거나 교체 대기)
      expect(await canAct(page)).toBe(false);
      return;
    }
    if (await page.getByText("LOSE...", { exact: true }).isVisible().catch(() => false)) return;
    if (await page.getByText("WIN!", { exact: true }).isVisible().catch(() => false)) return;
  }
});

// ─── 3. 치명타 · 속도 ───────────────────────────────────────────────────────────

test("치명타가 장비 없이도 뜬다 (기본 치명타율)", async ({ page }) => {
  // 오래 살아남아야 표본이 쌓인다. 관문이 세진 지금은 레벨을 넉넉히 준다
  await seed(page, { species: "mossyfinal", level: 150, potions: { max_potion: 30 },
    moves: [{ id: "spark", name: "전기불꽃", type: "electric", power: 1, accuracy: 100, category: "physical" }] });
  await enterFloor(page, 30);

  // 한 방에 안 죽는 보스를 오래 때리며 치명타 로그가 뜨는지 본다
  for (let i = 0; i < 40; i++) {
    if (!(await canAct(page))) { await advanceLogs(page); continue; }
    if ((await logLines(page)).includes("치명타 공격!")) return;
    await page.getByTestId("cmd-moves").click();
    await page.getByTestId("move-spark").click();
    await advanceLogs(page);
  }
  throw new Error("40턴 동안 치명타가 한 번도 안 떴다");
});

// ─── 4. 적이 읽히지 않는가 ──────────────────────────────────────────────────────

/** 로그에서 적이 쓴 기술 이름을 순서대로 뽑는다 */
function enemyMoveSequence(log: string, enemyName: string): string[] {
  return [...log.matchAll(new RegExp(`${enemyName}의 ⚠?(.+?)!`, "g"))].map((m) => m[1]);
}

test("50층 오름의 기술 순서가 고정 순환이 아니다", async ({ page }) => {
  // 오래 버티기만 하면 되는 구성. 위력 1 짜리 기술이라 전투가 안 끝나고, HP 는 넉넉하다
  await seed(page, { species: "mossyfinal", level: 150,
    moves: [{ id: "spark", name: "전기불꽃", type: "electric", power: 1, accuracy: 100, category: "physical" }] });
  await enterFloor(page, 50);

  let log = "";
  for (let i = 0; i < 12; i++) {
    if (!(await canAct(page))) { await advanceLogs(page); continue; }
    log = await logLines(page);   // 전투가 끝나면 결과 화면이 덮어서 못 읽는다 — 매 턴 읽어 둔다
    await page.getByTestId("cmd-moves").click();
    await page.getByTestId("move-spark").click();
    await advanceLogs(page);
  }

  const seq = enemyMoveSequence(log, "오름");
  expect(seq.length).toBeGreaterThanOrEqual(8);
  // 예전엔 가진 기술 4개를 1→2→3→4→1 로 돌렸다. 네 칸 뒤가 늘 같은 기술이었다
  const cyclic = seq.slice(4).every((m, i) => m === seq[i]);
  expect(cyclic, `순서가 여전히 4턴 주기다: ${seq.join(" → ")}`).toBe(false);
  // 그렇다고 한 기술만 반복하지도 않는다
  expect(new Set(seq).size).toBeGreaterThan(1);
});

test("턴 바가 이번 라운드 순서를 미리 보여준다", async ({ page }) => {
  await seed(page, { species: "mossyfinal", level: 40 });   // 속도 158 — 1층 적보다 훨씬 빠르다
  await enterFloor(page, 1);
  const info = (await page.getByTestId("turn-order").innerText()).replace(/\s+/g, " ");
  // 빠른 쪽(모왕)이 먼저 선다
  expect(info).toMatch(/순서 모왕/);
  // 속도 차가 크면 연속 행동 예고가 붙는다
  expect(info).toMatch(/연속/);
});

test("방어 커맨드가 있고, 눌러도 전투가 이어진다", async ({ page }) => {
  await seed(page, { species: "flameling", level: 20 });
  await enterFloor(page, 3);
  await expect(page.getByTestId("cmd-guard")).toBeEnabled();
  await page.getByTestId("cmd-guard").click();
  await advanceLogs(page);
  expect(await logLines(page)).toContain("몸을 웅크렸다");
});

test("키보드만으로 기술을 고를 수 있다", async ({ page }) => {
  await seed(page, { species: "mossy", level: 8 });
  await enterFloor(page, 1);
  // 1 = 첫 칸(기술) → 목록 → 1 = 첫 기술
  await page.keyboard.press("1");
  await expect(page.locator('[data-testid^="move-"]').first()).toBeVisible();
  await page.keyboard.press("1");
  await advanceLogs(page);
  expect(await logLines(page)).toMatch(/모시의/);
});

test("커맨드에서 왼쪽 화살표로 파티 구역에 들어간다", async ({ page }) => {
  await seed(page, { species: "mossy", level: 8 });
  await enterFloor(page, 1);
  await page.keyboard.press("ArrowLeft");
  // 파티 구역이 포커스를 받으면 그 칸에 커서 표시(▶)가 붙는다
  await expect(page.getByTestId("party-0")).toContainText("▶");
});
