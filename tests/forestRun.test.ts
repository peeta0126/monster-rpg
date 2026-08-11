import { test } from "node:test";
import assert from "node:assert/strict";

import {
  startRun, resolveStep, makeRng, addToBag, dropRandom, bagTotal,
  settleBag, recoveryRate, parseRun, judgeAlert, runIsOver, advanceStep,
  RUN_VERSION, NEW_STEP,
  type ForestRun,
} from "../src/camp/forest/runStore.ts";
import { FORK_CHANCE, rollStep, rollFork, wardenCanAppear, STEP_DEFS } from "../src/camp/forest/steps.ts";
import { chooseFork } from "../src/camp/forest/runStore.ts";
import { ALERT_MAX } from "../src/camp/forest/alert.ts";

/**
 * 원정은 지도가 아니라 걸음이다. 여기서 지키는 건 걸음의 규칙 — 판정 순서, 짐을
 * 흘리는 방식, 정산 셈, 그리고 **저장을 못 읽을 때 플레이어가 손해를 보지 않는가**다.
 */

const run0 = () => startRun("shallow", 0, 12345);

test("시작 상태 — 소란은 구역이 정하고 첫 사건이 이미 정해져 있다", () => {
  const run = startRun("deep", 15, 999);
  assert.equal(run.runVersion, RUN_VERSION);
  assert.equal(run.areaId, "deep");
  assert.equal(run.depth, 0);
  assert.equal(run.alert, 15, "시작 소란이 구역 값과 다르다");
  assert.equal(run.alertPeak, 15);
  assert.equal(bagTotal(run.bag), 0);
  assert.ok(STEP_DEFS[run.current], "첫 사건이 정해져 있지 않다");
});

test("같은 시드는 같은 원정을 만든다 — 새로고침 리롤이 막힌다", () => {
  const a = startRun("shallow", 0, 4242);
  const b = startRun("shallow", 0, 4242);
  assert.deepEqual(a, b);

  const a1 = resolveStep(a, {});
  const b1 = resolveStep(b, {});
  assert.deepEqual(a1, b1, "같은 상태에서 같은 판정을 했는데 다음 걸음이 다르다");
});

test("소란은 판정이 끝난 뒤에 오른다 — 주인만 예외", () => {
  // 그 걸음의 수확 배수는 오르기 전 값으로 계산해야 한다.
  // 안 그러면 방금 올린 소란으로 그 걸음의 수확을 불리게 된다.
  const walk: ForestRun = { ...run0(), current: "encounter", alert: 40, depth: 0 };
  assert.equal(judgeAlert(walk), 40, "조우인데 판정 전에 소란이 올랐다");

  const warden: ForestRun = { ...run0(), current: "warden", alert: 40, depth: 0 };
  assert.ok(judgeAlert(warden) > 40, "주인을 깨웠는데 소란이 그대로다");
});

test("한 걸음을 치르면 깊이가 늘고 다음 사건이 나온다", () => {
  const run = run0();
  const next = resolveStep(run, { gained: [{ id: "herb", count: 2 }] });
  assert.equal(next.depth, run.depth + 1);
  assert.equal(bagTotal(next.bag), 2, "수확이 가방에 안 담겼다");
  assert.notEqual(next.seed, run.seed, "시드가 안 굴렀다 — 다음 걸음이 늘 같아진다");
});

test("놓치면 런이 끝나지 않고 짐을 흘린다", () => {
  const run: ForestRun = { ...run0(), bag: [{ id: "herb", count: 5 }], alert: 10, current: "encounter" };
  const next = resolveStep(run, { escaped: true });

  assert.ok(next.alert > 10 + 10, "놓쳤는데 소란이 조우 값만큼만 올랐다");
  assert.equal(bagTotal(next.bag), 3, "놓쳤는데 두 칸이 안 떨어졌다");
  assert.ok(!runIsOver(next) || next.alert >= ALERT_MAX, "놓쳤다고 런이 끝나면 안 된다");
});

test("짐은 스택째가 아니라 한 칸씩 떨어진다", () => {
  // 스택째 날리면 흔적 한 번에 모은 5개가 통째로 사라져 손실이 널을 뛴다
  const { rng } = makeRng(7);
  const bag = [{ id: "herb", count: 5 }, { id: "berry", count: 3 }];
  const after = dropRandom(bag, 2, rng);
  assert.equal(bagTotal(after), 6, "정확히 두 칸만 떨어져야 한다");
});

test("가방보다 많이 흘리라고 해도 음수가 되지 않는다", () => {
  const { rng } = makeRng(3);
  const after = dropRandom([{ id: "herb", count: 1 }], 5, rng);
  assert.equal(bagTotal(after), 0);
  assert.ok(after.every((b) => b.count > 0), "0개짜리 항목이 남아 있다");
});

test("같은 재료는 한 줄로 합쳐진다", () => {
  const bag = addToBag(addToBag([], { id: "herb", count: 2 }), { id: "herb", count: 3 });
  assert.equal(bag.length, 1);
  assert.equal(bag[0].count, 5);
});

test("정산 — 자진 귀환은 전부, 강제 퇴각은 절반", () => {
  assert.equal(recoveryRate("voluntary"), 1);
  assert.equal(recoveryRate("warden"), 1);
  assert.equal(recoveryRate("stale"), 1, "읽을 수 없는 세이브는 플레이어 잘못이 아니다");
  assert.equal(recoveryRate("forced"), 0.5);

  const bag = [{ id: "herb", count: 4 }, { id: "crystal", count: 3 }];
  assert.deepEqual(settleBag(bag, "voluntary"), bag);

  const forced = settleBag(bag, "forced");
  assert.equal(forced.find((b) => b.id === "herb")?.count, 2);
  assert.equal(forced.find((b) => b.id === "crystal")?.count, 1);
});

test("강제 퇴각에서 지목한 하나는 온전히 남는다", () => {
  const bag = [{ id: "herb", count: 4 }, { id: "crystal", count: 3 }];
  const kept = settleBag(bag, "forced", "crystal");
  assert.equal(kept.find((b) => b.id === "crystal")?.count, 3, "지킨다고 골랐는데 깎였다");
  assert.equal(kept.find((b) => b.id === "herb")?.count, 2);
});

test("갈림길 두 갈래는 서로 다른 사건이다", () => {
  // 같은 사건이 두 번 나오면 고를 이유가 없다
  for (let seed = 0; seed < 200; seed++) {
    const { rng } = makeRng(seed);
    const [a, b] = rollFork(50, 3, rng);
    assert.notEqual(a, b, `시드 ${seed}: 갈림길 양쪽이 같은 사건이다`);
  }
});

test("주인은 조건을 채워야 나온다", () => {
  assert.equal(wardenCanAppear(0, 0), false);
  assert.equal(wardenCanAppear(80, 0), true, "소란이 높으면 나와야 한다");
  assert.equal(wardenCanAppear(0, 15), true, "깊이 끈기로도 닿아야 한다");

  // 조건 전에는 절대 안 나온다 — 안 그러면 초반에 원정이 끝나 버린다
  for (let seed = 0; seed < 500; seed++) {
    const { rng } = makeRng(seed);
    assert.notEqual(rollStep(10, 2, rng), "warden", `시드 ${seed}: 조건도 안 찼는데 주인이 나왔다`);
  }
});

test("갈림길 빈도가 표에 적힌 값과 맞는다", () => {
  const N = 20000;
  let forks = 0;
  for (let seed = 0; seed < N; seed++) {
    const { rng } = makeRng(seed);
    if (rng() < FORK_CHANCE) forks++;
  }
  const rate = forks / N;
  assert.ok(
    Math.abs(rate - FORK_CHANCE) < 0.02,
    `갈림길이 ${(rate * 100).toFixed(1)}% 나왔다 — 표에는 ${FORK_CHANCE * 100}%`,
  );
});

// ── 저장 복원 ────────────────────────────────────────────────────────────────

test("저장한 런을 그대로 되읽는다", () => {
  const run = resolveStep(run0(), { gained: [{ id: "herb", count: 3 }], caught: true });
  const parsed = parseRun(JSON.parse(JSON.stringify(run)));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.run, run);
});

test("옛 노드 그래프 세이브는 파싱하지 않고 정산으로 보낸다", () => {
  // depth/col/nextIds/event/rest 가 들어 있던 예전 구조. 읽으려 들면 터진다
  const legacy = {
    area: "shallow",
    nodes: [{ id: "n0", type: "event", depth: 0, col: 0, totalCols: 1, nextIds: ["n1"] }],
    currentNodeId: "n0",
    alert: 40,
  };
  const parsed = parseRun(legacy);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.reason, "stale");
});

test("버전이 다르면 마이그레이션하지 않는다", () => {
  const run = { ...run0(), runVersion: RUN_VERSION + 1 };
  const parsed = parseRun(run);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.reason, "stale");
});

test("깨진 값에도 안 터진다", () => {
  for (const bad of [null, undefined, 0, "", "런", [], { runVersion: RUN_VERSION }, { runVersion: RUN_VERSION, bag: "herb" }]) {
    const parsed = parseRun(bad);
    assert.equal(parsed.ok, false, `${JSON.stringify(bad)} 를 읽을 수 있다고 판단했다`);
  }
});

test("걸음이 끝나면 진행 기록이 비워진다", () => {
  // 안 비우면 다음 걸음이 "이미 들어간 상태"로 시작해 사건 패널을 건너뛴다
  const walked = advanceStep(run0(), { entered: true, attempts: 2 });
  const next = resolveStep(walked, {});
  assert.deepEqual(next.step, NEW_STEP);
});

test("포획 시도 횟수가 저장에 살아남는다 — 새로고침 리롤이 막힌다", () => {
  // 시도 번호마다 상대의 수가 정해져 있다. 횟수를 잃으면 방금 본 수를 알고 다시 낼 수 있다
  const run = advanceStep(run0(), {
    entered: true, attempts: 2, pending: { hand: "rock", caught: false },
  });
  const parsed = parseRun(JSON.parse(JSON.stringify(run)));
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.run.step.attempts, 2, "시도 횟수가 초기화됐다");
    assert.deepEqual(parsed.run.step.pending, { hand: "rock", caught: false });
  }
});

test("진행 기록이 깨져 있으면 안 걸은 걸음으로 되돌린다", () => {
  for (const bad of [undefined, null, 7, "entered", { attempts: "셋" }]) {
    const parsed = parseRun({ ...run0(), step: bad });
    assert.equal(parsed.ok, true, "진행 기록 하나 때문에 런 전체를 버리면 안 된다");
    if (parsed.ok) assert.equal(parsed.run.step.attempts, 0);
  }
});

test("갈림길은 고르기 전까지 판정이 시작되지 않는다", () => {
  // 여러 시드를 훑어 갈림길이 나오는 런을 찾는다
  let run = startRun("shallow", 0, 1);
  for (let seed = 1; seed < 200 && !run.fork; seed++) run = startRun("shallow", 0, seed);
  assert.ok(run.fork, "갈림길이 나오는 런을 못 찾았다 — 빈도가 0 이 됐을 수 있다");

  const before = { alert: run.alert, depth: run.depth, bag: run.bag };
  const picked = chooseFork(run, run.fork!.kinds[1]);

  assert.equal(picked.fork, null, "골랐는데 갈림길이 남아 있다");
  assert.equal(picked.current, run.fork!.kinds[1], "고른 갈래가 눈앞의 사건이 되지 않았다");
  assert.equal(picked.alert, before.alert, "고르기만 했는데 소란이 움직였다");
  assert.equal(picked.depth, before.depth, "고르기만 했는데 깊이가 늘었다");
});

test("갈림길 두 갈래의 이름이 서로 다르다", () => {
  for (let seed = 0; seed < 400; seed++) {
    const run = startRun("shallow", 0, seed);
    if (!run.fork) continue;
    assert.notEqual(run.fork.names[0], run.fork.names[1], `시드 ${seed}: 두 길 이름이 같다`);
  }
});
