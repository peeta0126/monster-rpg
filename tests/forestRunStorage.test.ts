import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * 원정 저장.
 *
 * 여기서 지키는 건 하나다. 플레이어가 자기 잘못이 아닌 일로 잃지 않는가.
 * 새로고침해도 걷던 자리로 돌아오고, 정산 화면에서 끊겨도 수확이 남고, 세이브를
 * 못 읽게 되더라도 가방은 건져서 100% 정산으로 보낸다.
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

const KEY = "monster-rpg-forest-run";

const { startRun, advanceStep } = await import("../src/camp/forest/runStore.ts");
const { loadForest, saveForestRun, saveForestSettlement, clearForest } =
  await import("../src/camp/forest/runStorage.ts");

function reset() { fake.clear(); }

test("걷다 만 원정은 걸음 안의 진행까지 그대로 돌아온다", () => {
  reset();
  const run = advanceStep(startRun("deep", 15, { capLevel: 99, canCatch: true }, 4242), { entered: true, attempts: 1 });
  saveForestRun(run);

  const loaded = loadForest();
  assert.equal(loaded.kind, "run");
  if (loaded.kind === "run") assert.deepEqual(loaded.run, run);
});

test("정산 화면에서 끊겨도 수확이 남는다", () => {
  reset();
  // 여기가 가장 아까운 순간이다. 런은 끝났는데 재료는 아직 창고에 안 들어갔다
  saveForestSettlement({
    areaId: "shallow", reason: "forced",
    bag: [{ id: "herb", count: 4 }], caught: 2, alertPeak: 100,
  });

  const loaded = loadForest();
  assert.equal(loaded.kind, "settle");
  if (loaded.kind === "settle") {
    assert.equal(loaded.settlement.reason, "forced", "회수율이 걸린 값이라 이유가 바뀌면 안 된다");
    assert.equal(loaded.settlement.bag[0].count, 4);
    assert.equal(loaded.settlement.caught, 2);
  }
});

test("정산이 저장돼 있으면 런보다 먼저다 — 끝난 원정을 이어 걷지 않는다", () => {
  reset();
  fake.setItem(KEY, JSON.stringify({
    run: startRun("shallow", 0, { capLevel: 99, canCatch: true }, 1),
    settled: { areaId: "shallow", reason: "voluntary", bag: [], caught: 0, alertPeak: 10 },
  }));
  assert.equal(loadForest().kind, "settle");
});

test("읽을 수 없는 런은 가방만 건져 100% 정산으로 보낸다", () => {
  reset();
  // 스키마가 바뀌면 마이그레이션하지 않는다. 그렇다고 수확까지 버리면 안 된다
  fake.setItem(KEY, JSON.stringify({
    run: { runVersion: 99, areaId: "deep", depth: 7, bag: [{ id: "herb", count: 3 }], caught: 1, alertPeak: 62 },
  }));

  const loaded = loadForest();
  assert.equal(loaded.kind, "settle");
  if (loaded.kind === "settle") {
    assert.equal(loaded.settlement.reason, "stale");
    assert.equal(loaded.settlement.areaId, "deep");
    assert.equal(loaded.settlement.bag[0].count, 3, "건질 수 있는 가방을 버렸다");
    assert.equal(loaded.settlement.alertPeak, 62);
  }
});

test("원정한 흔적이 없으면 조용히 지우고 구역 선택으로", () => {
  reset();
  // 아무것도 못 건지는데 정산 화면을 띄우면 그건 복구가 아니라 헛것이다
  for (const junk of ["", "런", "{", "null", "[]", '{"run":{"runVersion":99}}']) {
    fake.setItem(KEY, junk);
    assert.equal(loadForest().kind, "none", `${junk} 에서 무언가를 복원했다`);
  }
  assert.equal(fake.getItem(KEY), null, "못 읽는 세이브를 지우지 않고 남겨 뒀다");
});

test("빈 저장소는 그냥 빈 것이다", () => {
  reset();
  assert.equal(loadForest().kind, "none");
});

test("지우면 남지 않는다", () => {
  reset();
  saveForestRun(startRun("shallow", 0, { capLevel: 99, canCatch: true }, 9));
  clearForest();
  assert.equal(fake.getItem(KEY), null);
});

test("localStorage 를 못 쓰는 브라우저에서도 숲이 열린다", () => {
  reset();
  const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage")!;
  Object.defineProperty(globalThis, "localStorage", {
    get() { throw new Error("사생활 보호 모드"); }, configurable: true,
  });
  try {
    // 저장을 못 하는 것과 못 노는 것은 다르다
    assert.doesNotThrow(() => saveForestRun(startRun("shallow", 0, { capLevel: 99, canCatch: true }, 3)));
    assert.doesNotThrow(() => clearForest());
    assert.equal(loadForest().kind, "none");
  } finally {
    Object.defineProperty(globalThis, "localStorage", desc);
  }
});
