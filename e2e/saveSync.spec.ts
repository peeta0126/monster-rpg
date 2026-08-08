import { test, expect } from "@playwright/test";

/**
 * 서버 세이브 동기화 회귀 테스트.
 *
 * Handoff 6장 5번이 "회귀가 눈에 안 띄어 가치가 높다"고 지목한 경로다.
 * 동기화가 깨져도 게임은 멀쩡히 돌아가고, 다른 기기에서 로그인해야 비로소 드러난다.
 *
 * 계정 준비와 서버 상태 확인은 API 로 직접 한다. UI 로 검증할 것은 딱 두 가지다.
 *   1) 로그인하면 서버 세이브가 로컬로 내려오는가 (pull)
 *   2) 게임 안에서 바뀐 진행도가 서버로 올라가는가 (push)
 *
 * ⚠️ 이 테스트만 백엔드가 필요하다. server/ 가 안 떠 있으면 통째로 스킵한다.
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

async function putSave(token: string, state: Record<string, unknown>) {
  const res = await fetch(`${API}/api/save`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: JSON.stringify(state) }),
  });
  if (!res.ok) throw new Error(`세이브 업로드 실패 ${res.status}: ${await res.text()}`);
}

async function getSave(token: string) {
  const res = await fetch(`${API}/api/save`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`세이브 조회 실패 ${res.status}`);
  return await res.json() as { data: string | null; updatedAt: string | null };
}

test.describe("서버 세이브 동기화", () => {
  test.skip(async () => !(await serverUp()),
    "server/ 가 떠 있지 않습니다 — npm run dev:server 후 다시 실행하세요");

  test("로그인하면 서버 세이브가 내려오고, 이후 변경은 다시 올라간다", async ({ page }) => {
    const username = uniqueName();
    const token = await register(username);

    // 서버에 "다른 기기에서 만든 진행도"를 미리 올려둔다
    await putSave(token, {
      party: [{ id: "mossyfinal", level: 42, uid: "srv-1", currentHp: 500 }],
      storage: [], dexSeen: ["mossyfinal"], dexCaught: ["mossyfinal"],
      materials: { crystal: 7 }, potions: {}, bestFloor: 27,
      storyFlags: {}, questStatus: {},
      craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    });

    // ── pull: 빈 브라우저로 로그인 ────────────────────────────────────────────
    await page.goto("/");
    const inputs = page.locator('input[type="text"], input[type="password"]');
    await inputs.nth(0).fill(username);
    await inputs.nth(1).fill(PASSWORD);
    await page.getByRole("button", { name: /^로그인$/ }).first().click();

    await expect.poll(async () => {
      const raw = await page.evaluate((k) => localStorage.getItem(k), PLAYER_KEY);
      return raw ? (JSON.parse(raw).state?.bestFloor ?? -1) : -1;
    }, { timeout: 25_000, message: "서버 세이브가 로컬로 안 내려왔습니다 (pull 경로)" }).toBe(27);

    const mats = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state.materials, PLAYER_KEY);
    expect(mats.crystal, "재료까지 함께 내려와야 합니다").toBe(7);

    // 로그인 화면이 아니라 게임 안으로 들어왔는지
    await expect(page.getByRole("button", { name: /게스트로 시작/ })).toHaveCount(0);

    // ── push: 게임 안에서 상태를 바꾸면 서버로 올라가는가 ─────────────────────
    //
    // localStorage 를 직접 고치고 새로고침하는 방법은 안 된다 — 로그인 상태로 뜨면
    // 서버 세이브를 먼저 pull 해서 로컬 변경을 덮어쓴다(useSaveSync 의 의도된 동작).
    // 실제 조작으로 스토어를 바꿔야 구독이 걸리고 debounce 가 돈다.
    const before = (await getSave(token)).updatedAt;

    await page.goto("/monsters");
    await page.getByRole("button", { name: /HP 전회복|파티 HP/ }).first().click();
    await page.waitForTimeout(1200);
    await page.goto("/farm");   // 화면을 옮겨 debounce(4초)가 만료되게 둔다

    await expect.poll(async () => (await getSave(token)).updatedAt,
      { timeout: 30_000, message: "게임 안 변경이 서버로 안 올라갔습니다 (push 경로)" })
      .not.toBe(before);

    // 올라간 세이브가 우리 진행도인지 확인 (엉뚱한 초기 상태가 덮어쓰지 않았는가)
    const pushed = JSON.parse((await getSave(token)).data!) as Record<string, unknown>;
    expect(pushed.bestFloor, "업로드된 세이브의 진행도가 어긋납니다").toBe(27);

    // 토큰이 살아 있어야 다음 로그인에서 pull 이 된다
    const auth = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).state, AUTH_KEY);
    expect(auth.token, "로그인 토큰이 저장되지 않았습니다").toBeTruthy();
    expect(auth.isGuest).toBe(false);
  });
});
