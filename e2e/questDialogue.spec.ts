import { test, expect, type Page } from "@playwright/test";

/**
 * 마을에서 사람에게 말을 거는 흐름을 실제로 눌러 본다.
 *
 * 단위 시험은 대사를 고르는 함수까지만 본다. 여기서 보려는 건 그 뒤다. 고른 대사가
 * 화면에 뜨는가, 끝까지 넘기면 세이브에 기록이 남는가, 보상이 정말 가방에 들어오는가.
 *
 * 실행: npx playwright test e2e/questDialogue.spec.ts
 */

const PLAYER_KEY = "monster-rpg-player";
const AUTH = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

/** NPC 좌표. BaseCampScene 의 BASECAMP_NPCS 와 같은 자리 */
const NPC_AT = {
  orion: { x: 1090, y: 1950 },
  baros: { x: 430, y: 1200 },
} as const;

type SaveOverrides = Record<string, unknown>;

function save(over: SaveOverrides, version = 2) {
  return JSON.stringify({
    state: {
      party: [{ id: "flameling", level: 20, uid: "e0" }],
      storage: [],
      dexSeen: ["flameling"], dexCaught: ["flameling"],
      materials: {}, potions: { potion: 1 }, bestFloor: 0,
      storyFlags: {}, questStatus: {}, seenDialogues: [],
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      imprint: {},
      ...over,
    },
    version,
  });
}

async function openCamp(page: Page, saveJson: string) {
  await page.addInitScript(
    ([pk, pv, ak, av]) => {
      window.localStorage.setItem(ak as string, av as string);
      window.localStorage.setItem(pk as string, pv as string);
    },
    [PLAYER_KEY, saveJson, "monster-rpg-auth", AUTH] as const,
  );
  await page.goto("/");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __phaserGame?: { scene?: { getScene?: (k: string) => unknown } } }).__phaserGame;
    const s = g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null;
    return Boolean(s?.player);
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(400);
}

/** 그 사람 앞으로 순간이동한 뒤 E 를 눌러 말을 건다 */
async function talkTo(page: Page, npc: keyof typeof NPC_AT) {
  const { x, y } = NPC_AT[npc];
  await page.evaluate(([px, py]) => {
    const g = (window as unknown as {
      __phaserGame: { scene: { getScene: (k: string) => { player: { setPosition: (a: number, b: number) => void } } } };
    }).__phaserGame;
    g.scene.getScene("BaseCampScene").player.setPosition(px, py + 60);
  }, [x, y] as const);
  await page.waitForTimeout(150);
  await page.keyboard.press("e");
  await page.waitForTimeout(250);
}

/** 지금 떠 있는 대사창의 첫 줄 */
async function currentLine(page: Page): Promise<string> {
  const box = page.locator("img[alt='Orion'], img[alt='Baros']").first();
  await expect(box).toBeVisible({ timeout: 5_000 });
  return (await page.locator("p.text-cream-100").last().innerText()).trim();
}

/** 대사를 끝까지 넘긴다. 반환값은 읽은 줄 전부 */
async function readThrough(page: Page, maxLines = 20): Promise<string[]> {
  const lines: string[] = [];
  for (let i = 0; i < maxLines; i++) {
    const dialogue = page.locator("img[alt='Orion'], img[alt='Baros']").first();
    if (!(await dialogue.isVisible().catch(() => false))) break;
    lines.push((await page.locator("p.text-cream-100").last().innerText()).trim());
    await page.keyboard.press(" ");
    await page.waitForTimeout(120);
  }
  return lines;
}

function readSave(page: Page) {
  return page.evaluate((k) => JSON.parse(window.localStorage.getItem(k as string)!).state, PLAYER_KEY);
}

// ─────────────────────────────────────────────────────────────────────────────

test("엔딩까지 본 세이브 — 이야기 한 번 뒤로는 잡담이 나오고, 연달아 같은 말을 안 한다", async ({ page }) => {
  await openCamp(page, save({
    bestFloor: 50,
    storyFlags: {
      met_orion: true, met_baros: true, first_capture: true,
      quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
    },
    // 퀘스트는 전부 끝낸 상태로 둔다. 여기서 보려는 건 그 다음이다
    questStatus: Object.fromEntries([
      "baros_first_hunt", "orion_mothers_medicine", "baros_gear_up",
      "orion_where_i_stopped", "baros_type_matchup", "orion_once_more",
      "baros_change_gear", "orion_mothers_cure",
    ].map((id) => [id, "completed"])),
  }));

  // 1) 기록이 빈 세이브라, 조건을 만족하는 이야기를 앞에서부터 다 읽어야 잡담에 닿는다
  let first: string[] = [];
  for (let i = 0; i < 12; i++) {
    await talkTo(page, "orion");
    const read = await readThrough(page);
    first = [...first, ...read];
    if (read.length <= 1) break;   // 한 줄짜리가 나오면 잡담 구간에 들어선 것이다
  }
  expect(first.length).toBeGreaterThan(0);

  // 2) 그 뒤로는 잡담. 스무 번 말을 걸어 같은 말이 연달아 두 번 나오는지 본다
  const said: string[] = [];
  for (let i = 0; i < 20; i++) {
    await talkTo(page, "orion");
    const line = await currentLine(page);
    said.push(line);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
  }

  // 이야기를 다 읽고 나면 한 줄짜리 잡담만 남는다
  const tail = said.slice(5);
  expect(tail.length).toBeGreaterThan(10);
  for (let i = 1; i < tail.length; i++) {
    expect(tail[i], `${i}번째에서 같은 말이 연달아 나왔다: ${tail[i]}`).not.toBe(tail[i - 1]);
  }
  // 여러 줄이 실제로 돌아야 한다. 하나만 반복되면 무작위가 아니다
  expect(new Set(tail).size).toBeGreaterThan(2);
});

test("안 본 이야기가 잡담에 묻히지 않는다", async ({ page }) => {
  await openCamp(page, save({
    bestFloor: 50,
    storyFlags: {
      met_orion: true, met_baros: true, first_capture: true,
      quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
    },
    questStatus: Object.fromEntries([
      "baros_first_hunt", "orion_mothers_medicine", "baros_gear_up",
      "orion_where_i_stopped", "baros_type_matchup", "orion_once_more",
      "baros_change_gear", "orion_mothers_cure",
    ].map((id) => [id, "completed"])),
    // 엔딩 후 대사만 안 읽은 상태. 옛 세이브 마이그레이션이 만드는 바로 그 자리다
    seenDialogues: [
      "orion_intro", "orion_after_baros", "orion_first_capture", "orion_quest_medicine",
      "orion_floor_10", "orion_floor_20", "orion_floor_40", "orion_floor_50",
    ],
  }));

  await talkTo(page, "orion");
  const lines = await readThrough(page);
  expect(lines.join(" "), "엔딩 후 이야기가 잡담에 밀렸다").toContain("마당까지");

  // 읽었으면 기록에 남는다
  await page.waitForTimeout(300);
  const state = await readSave(page);
  expect(state.seenDialogues).toContain("orion_cleared");
});

test("옛 세이브(버전 1 · 기록 없음)로 열어도 안 깨지고, 지난 대사가 다시 뜨지 않는다", async ({ page }) => {
  const legacy = JSON.stringify({
    state: {
      party: [{ id: "flameling", level: 30, uid: "old0" }],
      storage: [], dexSeen: ["flameling"], dexCaught: ["flameling"],
      materials: {}, potions: {}, bestFloor: 50,
      storyFlags: {
        met_orion: true, met_baros: true, first_capture: true,
        quest_baros_done: true, quest_orion_done: true, tower_cleared: true,
      },
      questStatus: { baros_first_hunt: "completed", orion_mothers_medicine: "completed" },
      // seenDialogues 가 통째로 없다. 이 기록이 생기기 전의 세이브다
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
      imprint: {},
    },
    version: 1,
  });
  await openCamp(page, legacy);

  const state = await readSave(page);
  expect(state.seenDialogues, "지나온 대사가 채워져야 한다").toBeTruthy();
  expect(state.seenDialogues).toContain("orion_intro");
  expect(state.seenDialogues, "사람마다 마지막 하나는 남긴다").not.toContain("orion_cleared");

  // 첫 만남 대사가 다시 뜨면 플레미를 또 받게 된다
  await talkTo(page, "orion");
  const lines = await readThrough(page);
  expect(lines.join(" ")).not.toContain("이름은 플레미다");
  expect(lines.join(" ")).toContain("마당까지");
});

test("퀘스트 보상이 실제로 가방에 들어온다", async ({ page }) => {
  await openCamp(page, save({
    bestFloor: 5,
    materials: { herb: 9 },
    storyFlags: { met_orion: true, met_baros: true, first_capture: true },
    questStatus: { baros_first_hunt: "in_progress" },
    seenDialogues: [
      "orion_intro", "orion_after_baros", "orion_first_capture",
      "baros_gate", "baros_intro", "baros_first_capture", "baros_floor_5",
    ],
  }));

  await talkTo(page, "baros");
  const lines = await readThrough(page);
  expect(lines.join(" "), "완료 대사가 나와야 한다").toContain("살아 돌아왔군");

  // 받은 것 화면이 뜨고, 받은 목록이 적혀 있다
  const rewards = page.locator('[data-testid="quest-rewards"]');
  await expect(rewards).toBeVisible();
  await expect(rewards).toContainText("마법 가루");
  await rewards.getByRole("button", { name: "확인" }).click();

  await page.waitForTimeout(300);
  const state = await readSave(page);
  expect(state.questStatus.baros_first_hunt).toBe("completed");
  expect(state.materials.herb, "목표 3개를 내고 보상 2개를 받는다").toBe(9 - 3 + 2);
  expect(state.materials.magic_dust).toBe(1);
  expect(state.materials.root).toBe(2);
  expect(state.storyFlags.quest_baros_done).toBe(true);
});

test("몬스터 보상이 파티에 들어온다", async ({ page }) => {
  await openCamp(page, save({
    bestFloor: 12,
    party: [{ id: "flameling", level: 16, uid: "e0" }],
    storyFlags: {
      met_orion: true, met_baros: true, first_capture: true,
      quest_baros_done: true, quest_orion_done: true,
    },
    questStatus: {
      baros_first_hunt: "completed",
      orion_mothers_medicine: "completed",
      orion_where_i_stopped: "in_progress",
    },
    seenDialogues: [
      "orion_intro", "orion_after_baros", "orion_first_capture",
      "orion_quest_medicine", "orion_floor_10",
    ],
  }));

  await talkTo(page, "orion");
  const lines = await readThrough(page);
  expect(lines.join(" "), "완료 대사가 나와야 한다").toContain("이름은 리피다");

  const rewards = page.locator('[data-testid="quest-rewards"]');
  await expect(rewards).toBeVisible();
  await expect(rewards).toContainText("리피");
  await rewards.getByRole("button", { name: "확인" }).click();

  await page.waitForTimeout(300);
  const state = await readSave(page);
  const leafy = [...state.party, ...state.storage].find((m: { id: string }) => m.id === "leafy");
  expect(leafy, "리피가 파티나 보관함에 있어야 한다").toBeTruthy();
  // 파티 최고 레벨(16)보다 둘 아래
  expect(leafy.level).toBe(14);
  expect(state.dexCaught).toContain("leafy");
});

test("파티도 보관함도 차 있으면 완료를 미루고 자리를 비우라고 한다", async ({ page }) => {
  const full = Array.from({ length: 30 }, (_, i) => ({ id: "nobi", level: 5, uid: `s${i}` }));
  await openCamp(page, save({
    bestFloor: 12,
    party: [
      { id: "flameling", level: 16, uid: "e0" },
      { id: "nobi", level: 12, uid: "e1" },
      { id: "aquabe", level: 12, uid: "e2" },
    ],
    storage: full,
    storyFlags: {
      met_orion: true, met_baros: true, first_capture: true,
      quest_baros_done: true, quest_orion_done: true,
    },
    questStatus: {
      baros_first_hunt: "completed",
      orion_mothers_medicine: "completed",
      orion_where_i_stopped: "in_progress",
    },
    seenDialogues: [
      "orion_intro", "orion_after_baros", "orion_first_capture",
      "orion_quest_medicine", "orion_floor_10",
    ],
  }));

  await talkTo(page, "orion");
  const lines = await readThrough(page);
  expect(lines.join(" ")).toContain("자리를 비우고");
  expect(lines.join(" "), "건네받은 게 소리 없이 사라지면 안 된다").not.toContain("이름은 리피다");

  await page.waitForTimeout(300);
  const state = await readSave(page);
  expect(state.questStatus.orion_where_i_stopped, "완료를 미뤄야 한다").toBe("in_progress");
});
