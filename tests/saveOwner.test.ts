import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 이 브라우저의 진행이 누구 것인가.
 *
 * 로그아웃은 토큰만 지웠고 세이브는 localStorage 에 남았다. 그래서 다음 사람이 들어오면
 * 앞 사람의 파티·재료가 그대로 보였고, 새 계정은 서버가 비어 있으니 그 상태가 첫 세이브로
 * 올라가 굳었다 — "새로 로그인했는데 몇 마리가 있다" 가 이것이다.
 *
 * 지우는 쪽만 보면 반대로 틀리기 쉽다. 같은 사람이 다시 들어오는 경우까지 지우면
 * 서버가 없는 동안 논 진행이 로그아웃 한 번에 사라진다. 그래서 둘 다 여기서 본다.
 */

class FakeStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  get length() { return this.data.size; }
}

const fake = new FakeStorage();
Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true, writable: true });

const { usePlayerStore } = await import("../src/shared/playerStore.ts");
const { adoptSaveOwner, claimSaveFor } = await import("../src/auth/saveOwner.ts");

const OWNER_KEY = "monster-rpg-save-owner";
const FOREST_KEY = "monster-rpg-forest-run";

/** 앞 사람이 놀다 간 브라우저를 만든다 — 진행도, 걷다 만 원정도 남아 있다 */
function leftoverProgress() {
  fake.clear();
  usePlayerStore.getState().resetToInitial();
  usePlayerStore.setState({ bestFloor: 24, materials: { slime_jelly: 9 } });
  fake.setItem(FOREST_KEY, JSON.stringify({ kind: "run" }));
}

test("다른 사람이 들어오면 앞 사람의 진행이 남지 않는다", () => {
  leftoverProgress();
  fake.setItem(OWNER_KEY, "aram");

  claimSaveFor("boram");

  assert.equal(usePlayerStore.getState().bestFloor, 0);
  assert.deepEqual(usePlayerStore.getState().materials, {});
  assert.equal(fake.getItem(OWNER_KEY), "boram");
});

test("걷다 만 원정도 같이 지운다 — 서버 세이브에 안 들어가서 여기서 안 지우면 남는다", () => {
  leftoverProgress();
  fake.setItem(OWNER_KEY, "aram");

  claimSaveFor("boram");

  assert.equal(fake.getItem(FOREST_KEY), null);
});

test("같은 사람이 다시 들어오면 지우지 않는다 — 서버 없이 논 진행이 로그아웃으로 사라지면 안 된다", () => {
  leftoverProgress();
  fake.setItem(OWNER_KEY, "aram");

  claimSaveFor("aram");

  assert.equal(usePlayerStore.getState().bestFloor, 24);
  assert.equal(fake.getItem(FOREST_KEY) !== null, true);
});

test("주인을 안 적던 시절의 브라우저는, 로그인해 있던 사람 것으로 받아 준다", () => {
  leftoverProgress();

  adoptSaveOwner("aram");
  assert.equal(fake.getItem(OWNER_KEY), "aram");

  // 받아 주기만 하고 지우지는 않는다
  assert.equal(usePlayerStore.getState().bestFloor, 24);

  // 그 다음 그 사람이 다시 들어와도 그대로다
  claimSaveFor("aram");
  assert.equal(usePlayerStore.getState().bestFloor, 24);
});

test("로그인한 적 없이 세이브만 남아 있으면 주인 없는 것으로 두고, 다음 계정이 지운다", () => {
  leftoverProgress();

  adoptSaveOwner(null);
  assert.equal(fake.getItem(OWNER_KEY), "");

  claimSaveFor("boram");
  assert.equal(usePlayerStore.getState().bestFloor, 0);
});

test("이미 주인이 적혀 있으면 받아 주기가 덮어쓰지 않는다", () => {
  leftoverProgress();
  fake.setItem(OWNER_KEY, "aram");

  adoptSaveOwner("boram");

  assert.equal(fake.getItem(OWNER_KEY), "aram");
});
