import { test, expect, type Page } from "@playwright/test";

/**
 * 서버 세이브 동기화 회귀 테스트.
 *
 * 동기화가 깨져도 게임은 멀쩡히 돌아가고, 다른 기기에서 열어 봐야 비로소 드러난다.
 * 그래서 눈에 안 띄는 만큼 회귀 가치가 높다.
 *
 * 계정 준비와 서버 상태 확인은 API 로 직접 한다. UI 로 볼 것은 셋이다.
 *   1) 로그인하면 서버 세이브가 로컬로 내려온다 (pull)
 *   2) 게임 안에서 바뀐 진행도가 서버로 올라간다 (push)
 *   3) 두 기기가 엇갈리면 서버 쪽이 이긴다 (충돌)
 *
 * 이 테스트만 백엔드가 필요하다. server/ 가 안 떠 있으면 통째로 스킵한다.
 */

const API = "http://localhost:4000";
const PLAYER_KEY = "monster-rpg-player";
const AUTH_KEY = "monster-rpg-auth";
const PASSWORD = "e2e-pass-1234";

/** dev.db 를 공유하므로 실행마다 새 계정을 만든다 */
const uniqueName = () => `e2e_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function serverUp(): Promise<boolean> {
  try { return (await fetch(`${API}/api/health`)).ok; } catch { return false; }
}

async function register(username: string): Promise<string> {
  const res = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`계정 생성 실패 ${res.status}: ${await res.text()}`);
  return (await res.json() as { token: string }).token;
}

interface ServerSave {
  data: string | null;
  version: number | null;
  revision: number;
  updatedAt: string | null;
}

async function putSave(token: string, state: Record<string, unknown>, baseRevision: number | null = null) {
  const res = await fetch(`${API}/api/save`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JSON.stringify(state), version: 2, baseRevision }),
  });
  if (!res.ok) throw new Error(`세이브 업로드 실패 ${res.status}: ${await res.text()}`);
  return await res.json() as ServerSave;
}

async function getSave(token: string): Promise<ServerSave> {
  const res = await fetch(`${API}/api/save`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`세이브 조회 실패 ${res.status}`);
  return await res.json() as ServerSave;
}

function sampleSave(bestFloor: number): Record<string, unknown> {
  return {
    party: [{ id: "mossyfinal", level: 42, uid: "srv-1", currentHp: 500 }],
    storage: [], dexSeen: ["mossyfinal"], dexCaught: ["mossyfinal"],
    materials: { crystal: 7 }, potions: {}, bestFloor,
    storyFlags: {}, questStatus: {}, seenDialogues: [],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {}, imprint: {},
  };
}

async function loginThroughUi(page: Page, username: string) {
  await page.goto("/");
  const inputs = page.locator('input[type="text"], input[type="password"]');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(PASSWORD);
  await page.getByRole("button", { name: /^로그인$/ }).first().click();
}

function readBestFloor(page: Page): Promise<number> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw).state?.bestFloor ?? -1) : -1;
  }, PLAYER_KEY);
}

/** 게임 안에서 실제로 스토어를 바꾼다. localStorage 를 직접 고치면 pull 이 덮어쓴다 */
async function makeProgressInGame(page: Page) {
  await page.goto("/monsters");
  await page.getByRole("button", { name: /HP 전회복|파티 HP/ }).first().click();
  await page.waitForTimeout(1200);
  await page.goto("/farm"); // 화면을 옮겨 debounce(4초)가 만료되게 둔다
}

test.describe("서버 세이브 동기화", () => {
  test.skip(async () => !(await serverUp()),
    "server/ 가 떠 있지 않습니다 — npm run dev:server 후 다시 실행하세요");

  test("로그인하면 서버 세이브가 내려오고, 이후 변경은 다시 올라간다", async ({ page }) => {
    const username = uniqueName();
    const token = await register(username);

    // 서버에 "다른 기기에서 만든 진행도"를 미리 올려둔다
    await putSave(token, sampleSave(27));

    // ── pull: 빈 브라우저로 로그인 ────────────────────────────────────────────
    await loginThroughUi(page, username);

    await expect.poll(() => readBestFloor(page),
      { timeout: 25_000, message: "서버 세이브가 로컬로 안 내려왔습니다 (pull 경로)" }).toBe(27);

    const mats = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.materials, PLAYER_KEY);
    expect(mats.crystal, "재료까지 함께 내려와야 합니다").toBe(7);

    // 로그인 화면이 아니라 게임 안으로 들어왔는지
    await expect(page.getByRole("button", { name: /^회원가입$/ })).toHaveCount(0);

    // ── push: 게임 안에서 상태를 바꾸면 서버로 올라가는가 ─────────────────────
    const before = (await getSave(token)).revision;
    await makeProgressInGame(page);

    await expect.poll(async () => (await getSave(token)).revision,
      { timeout: 30_000, message: "게임 안 변경이 서버로 안 올라갔습니다 (push 경로)" })
      .toBeGreaterThan(before);

    // 올라간 세이브가 우리 진행도인지 확인 (엉뚱한 초기 상태가 덮어쓰지 않았는가)
    const pushed = JSON.parse((await getSave(token)).data!) as Record<string, unknown>;
    expect(pushed.bestFloor, "업로드된 세이브의 진행도가 어긋납니다").toBe(27);

    // 토큰이 살아 있어야 다음 로그인에서 pull 이 된다
    const auth = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state, AUTH_KEY);
    expect(auth.token, "로그인 토큰이 저장되지 않았습니다").toBeTruthy();
    expect(auth.isGuest).toBe(false);
  });

  test("두 기기가 엇갈리면 서버 쪽이 이긴다", async ({ page }) => {
    const username = uniqueName();
    const token = await register(username);
    await putSave(token, sampleSave(10));

    // 이 브라우저(=PC)가 로그인해 10층을 받는다
    await loginThroughUi(page, username);
    await expect.poll(() => readBestFloor(page), { timeout: 25_000 }).toBe(10);

    // 그 사이 다른 기기(=노트북)가 33층까지 올려 둔다
    const current = await getSave(token);
    await putSave(token, sampleSave(33), current.revision);

    // 이 브라우저에서 뭔가를 바꾸면, 올리려다 409 를 받고 서버 것을 받아 온다
    await makeProgressInGame(page);

    await expect.poll(() => readBestFloor(page),
      { timeout: 30_000, message: "충돌 뒤에 서버 세이브를 안 받아왔습니다" }).toBe(33);

    // 서버는 밀리지 않았다
    const after = JSON.parse((await getSave(token)).data!) as Record<string, unknown>;
    expect(after.bestFloor, "뒤처진 기기가 서버를 덮어썼습니다").toBe(33);
  });

  test("다른 계정으로 갈아타면 앞 사람의 진행이 안 보인다", async ({ page }) => {
    // 한 브라우저를 둘이 쓰는 자리 — 같이 개발하는 PC 와 남에게 보여주는 자리가 그렇다.
    // 로그아웃이 토큰만 지우고 세이브는 두고 갔어서, 다음 사람이 앞 사람의 파티를
    // 그대로 보고 있었다. 게다가 새 계정은 서버가 비어 있으니 그게 첫 세이브로 올라가 굳는다.
    const first = uniqueName();
    const firstToken = await register(first);
    await putSave(firstToken, sampleSave(27));

    await loginThroughUi(page, first);
    await expect.poll(() => readBestFloor(page), { timeout: 25_000 }).toBe(27);

    // 앞 사람이 걷다 만 원정까지 남겨 둔다. 이건 서버 세이브에 안 들어가서
    // 계정이 바뀔 때 따로 지우지 않으면 그대로 남는다.
    await page.evaluate(() => localStorage.setItem("monster-rpg-forest-run", JSON.stringify({ kind: "run" })));

    await page.evaluate((k) => {
      const raw = JSON.parse(localStorage.getItem(k)!);
      raw.state.token = null;
      raw.state.username = null;
      localStorage.setItem(k, JSON.stringify(raw));
    }, AUTH_KEY);

    // 두 번째 사람이 새 계정으로 들어온다
    const second = uniqueName();
    const secondToken = await register(second);
    await loginThroughUi(page, second);

    await expect.poll(() => readBestFloor(page),
      { timeout: 25_000, message: "새 계정이 앞 사람의 진행을 물려받았습니다" }).toBe(0);

    const party = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.party, PLAYER_KEY);
    expect(party, "새 계정의 파티는 비어 있어야 합니다").toEqual([]);

    const run = await page.evaluate(() => localStorage.getItem("monster-rpg-forest-run"));
    expect(run, "앞 사람이 걷다 만 원정이 남았습니다").toBeNull();

    // 서버에도 앞 사람의 진행이 올라가면 안 된다 — 올라가면 되돌릴 수 없다
    await makeProgressInGame(page);
    await expect.poll(async () => (await getSave(secondToken)).revision, { timeout: 30_000 })
      .toBeGreaterThan(0);
    const uploaded = JSON.parse((await getSave(secondToken)).data!) as Record<string, unknown>;
    expect(uploaded.bestFloor, "앞 사람의 진행이 새 계정의 세이브로 올라갔습니다").toBe(0);

    // 앞 사람 것은 그대로 남아 있다
    const firstSave = JSON.parse((await getSave(firstToken)).data!) as Record<string, unknown>;
    expect(firstSave.bestFloor, "앞 사람의 서버 세이브가 밀렸습니다").toBe(27);
  });
});
