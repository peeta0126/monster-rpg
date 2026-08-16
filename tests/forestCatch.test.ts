import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TELL_HAND, TELL_WEIGHT, chainInDex, counterTo, handWeights, rollHand,
  tellOf, tellReveal, tellTypeOf,
} from "../src/camp/forest/catchTells.ts";
import {
  ATTEMPT_ALERT, CATCH_ATTEMPTS, attemptAlert, attemptAlertTotal, attemptRng,
  expectedCatchChance, getRpsResult,
} from "../src/camp/forest/catchRules.ts";
import { startRun, resolveStep, makeRng } from "../src/camp/forest/runStore.ts";
import { FOREST_AREAS } from "../src/camp/forest/areas.ts";
import type { ElementType } from "../src/shared/game.ts";
import type { RpsChoice } from "../src/workshop/rps.ts";

/**
 * 포획에서 지키는 것 셋.
 *   1) 상대 손이 속성마다 편향돼 있다 — 세 버튼이 진짜로 다르다.
 *   2) 그 정보는 **공짜가 아니다** — 도감과 정찰이 산다.
 *   3) 재도전에 값이 있고, 물러서기는 그 값을 안 낸다.
 * 그리고 어느 것도 시드 고정(= 새로고침 리롤 방지)을 깨지 않는다.
 */

const TYPES: ElementType[] = ["fire", "water", "grass", "electric", "ice", "poison", "normal"];
const HANDS: RpsChoice[] = ["rock", "paper", "scissors"];

// ── 1. 편향 ──────────────────────────────────────────────────────────────────

test("속성별 편향 분포가 표대로다", () => {
  const N = 120_000;
  for (const type of TYPES) {
    const tell = TELL_HAND[type];
    if (!tell) continue;

    const seen: Record<RpsChoice, number> = { rock: 0, paper: 0, scissors: 0 };
    const { rng } = makeRng(20260812);
    for (let i = 0; i < N; i++) seen[rollHand(type, rng)]++;

    for (const hand of HANDS) {
      const want = handWeights(type)[hand];
      const got = seen[hand] / N;
      assert.ok(
        Math.abs(got - want) < 0.006,
        `${type} 의 ${hand} 비율이 ${got.toFixed(4)} — 표는 ${want}`,
      );
    }
    assert.equal(handWeights(type)[tell], TELL_WEIGHT, `${type} 의 선호 비중이 표와 다르다`);
  }
});

test("normal 은 균등하다 — 읽히지 않는 게 그 값이다", () => {
  assert.equal(tellOf("normal"), null);
  const N = 120_000;
  const seen: Record<RpsChoice, number> = { rock: 0, paper: 0, scissors: 0 };
  const { rng } = makeRng(7777);
  for (let i = 0; i < N; i++) seen[rollHand("normal", rng)]++;
  for (const hand of HANDS) {
    assert.ok(Math.abs(seen[hand] / N - 1 / 3) < 0.006, `normal 의 ${hand} 가 균등에서 벗어났다`);
  }
});

test("무속성(type null)은 노말과 같이 버릇이 없다", () => {
  assert.equal(tellTypeOf({ type: null }), "normal");
  assert.equal(tellOf(tellTypeOf({ type: null })), null);
});

test("계열별 편향 배정이 프롬프트 표와 같다", () => {
  assert.equal(TELL_HAND.fire, "rock");
  assert.equal(TELL_HAND.electric, "rock");
  assert.equal(TELL_HAND.water, "paper");
  assert.equal(TELL_HAND.ice, "paper");
  assert.equal(TELL_HAND.grass, "scissors");
  assert.equal(TELL_HAND.poison, "scissors");
  assert.equal(TELL_HAND.normal, null);
});

test("버릇을 아는 것에 값이 있다 — 카운터 > 아무거나 > 최악", () => {
  for (const type of TYPES) {
    const tell = TELL_HAND[type];
    const blind = HANDS.reduce((s, h) => s + expectedCatchChance(h, type, 0), 0) / 3;

    // 아무 수나 낼 때의 기대값은 어떤 편향에서도 균등값 그대로다.
    // 이게 깨지면 "모르는 플레이어가 손해를 본다"가 되어 버릇이 벌점이 된다
    assert.ok(Math.abs(blind - 0.44) < 1e-9, `${type} 의 무작위 기대값이 0.44 가 아니다`);

    if (!tell) {
      for (const h of HANDS) assert.ok(Math.abs(expectedCatchChance(h, type, 0) - blind) < 1e-9);
      continue;
    }
    const counter = expectedCatchChance(counterTo(tell), type, 0);
    const worst = expectedCatchChance(counterTo(counterTo(tell)), type, 0);
    assert.ok(counter > blind + 0.05, `${type}: 카운터가 ${counter.toFixed(3)} — 차이가 너무 작다`);
    assert.ok(worst < blind - 0.05, `${type}: 최악이 ${worst.toFixed(3)} — 차이가 너무 작다`);
    // 세 손의 평균은 늘 균등값이다 (편향이 총량을 움직이지 않는다)
    const mirror = expectedCatchChance(tell, type, 0);
    assert.ok(Math.abs((counter + worst + mirror) / 3 - blind) < 1e-9);
  }
});

test("counterTo 는 실제로 이기는 수를 준다", () => {
  for (const hand of HANDS) assert.equal(getRpsResult(counterTo(hand), hand), "win");
});

// ── 2. 시드 고정 ─────────────────────────────────────────────────────────────

test("같은 시도 번호는 늘 같은 손 — 새로고침 리롤이 막힌다", () => {
  for (const type of TYPES) {
    for (let attempt = 0; attempt < CATCH_ATTEMPTS; attempt++) {
      const a = rollHand(type, attemptRng(4242, attempt));
      const b = rollHand(type, attemptRng(4242, attempt));
      assert.equal(a, b, `시드 4242 · 시도 ${attempt} 가 두 번 다르게 나왔다`);
    }
  }
});

test("시도 번호가 다르면 갈래가 갈린다 — 한 손만 반복되지 않는다", () => {
  // 시드를 여러 개 훑어 시도 0/1/2 가 서로 다른 손을 내는 경우가 실제로 있는지 본다
  let varied = 0;
  for (let seed = 0; seed < 200; seed++) {
    const hands = [0, 1, 2].map((a) => rollHand("normal", attemptRng(seed, a)));
    if (new Set(hands).size > 1) varied++;
  }
  assert.ok(varied > 150, `시도별로 손이 갈리는 시드가 ${varied}/200 뿐이다`);
});

test("손을 뽑아도 그 뒤 굴림이 밀리지 않는다 — rng 를 정확히 한 번 쓴다", () => {
  for (const type of TYPES) {
    const { rng: a } = makeRng(99);
    const { rng: b } = makeRng(99);
    rollHand(type, a);
    b();                       // 손 하나 = 굴림 하나
    assert.equal(a(), b(), `${type} 의 손이 rng 를 한 번 넘게 썼다`);
  }
});

// ── 3. 노출 규칙 ─────────────────────────────────────────────────────────────

test("정찰 등급이 버릇 노출을 정한다", () => {
  const at = (scout: "detail" | "type" | "danger" | "none") =>
    tellReveal({ dexCaught: false, revealTypes: true, scout });
  assert.equal(at("detail"), "hand", "소란 0~25 에서는 버릇이 명시돼야 한다");
  assert.equal(at("type"), "type", "소란 26~50 에서는 속성 칩까지다");
  assert.equal(at("danger"), "none");
  assert.equal(at("none"), "none");
});

test("도감에 잡은 기록이 있으면 소란과 무관하게 버릇이 보인다", () => {
  for (const scout of ["detail", "type", "danger", "none"] as const) {
    assert.equal(tellReveal({ dexCaught: true, revealTypes: true, scout }), "hand");
  }
});

test("고대 숲 + 도감 미기록 = 아무것도 안 보인다", () => {
  const ancient = FOREST_AREAS.find((a) => a.id === "ancient")!;
  assert.equal(ancient.revealTypes, false, "고대 숲의 정보 차단 전제가 깨졌다");
  for (const scout of ["detail", "type", "danger", "none"] as const) {
    assert.equal(
      tellReveal({ dexCaught: false, revealTypes: ancient.revealTypes, scout }),
      "none",
      `고대 숲에서 정찰 ${scout} 만으로 정보가 새어 나온다`,
    );
  }
});

test("고대 숲이라도 잡아 본 계열이면 버릇이 보인다 — 아는 놈만 상대할 수 있다", () => {
  assert.equal(tellReveal({ dexCaught: true, revealTypes: false, scout: "none" }), "hand");
});

test("도감은 종이 아니라 계열로 센다 — 진화시켰다고 다시 모르게 되지 않는다", () => {
  const mossy = { id: "mossy", evolutionChainId: "mossy" };
  const mossevo = { id: "mossevo", evolutionChainId: "mossy" };
  assert.equal(chainInDex(mossevo, ["mossy"]), true, "같은 계열의 기초 단계 기록이 안 먹힌다");
  assert.equal(chainInDex(mossy, ["mossevo"]), true, "진화형 기록이 기초 단계에 안 먹힌다");
  assert.equal(chainInDex(mossy, ["flameling"]), false);
  assert.equal(chainInDex(mossy, []), false);
});

// ── 4. 재도전 비용 ───────────────────────────────────────────────────────────

test("시도별 소란은 0 / +5 / +10 이다", () => {
  assert.deepEqual(ATTEMPT_ALERT, [0, 5, 10]);
  assert.equal(attemptAlert(0), 0, "첫 시도는 공짜여야 한다");
  assert.equal(attemptAlert(1), 5);
  assert.equal(attemptAlert(2), 10);
  assert.deepEqual([0, 1, 2, 3].map(attemptAlertTotal), [0, 0, 5, 15]);
  assert.equal(ATTEMPT_ALERT.length, CATCH_ATTEMPTS, "시도 수와 비용표 길이가 어긋났다");
});

/** 소란만 보기 위한 걸음 — 흔적은 포획이 없고 소란 델타가 고정이다 */
function stepAlertAfter(outcome: Parameters<typeof resolveStep>[1]) {
  const run = { ...startRun("shallow", 20, { capLevel: 99, canCatch: true }, 555), current: "trace" as const, depth: 0 };
  return resolveStep(run, outcome).alert;
}

test("건 시도만큼 소란이 오른다", () => {
  const base = stepAlertAfter({});
  assert.equal(stepAlertAfter({ attemptAlert: attemptAlertTotal(1) }), base + 0);
  assert.equal(stepAlertAfter({ attemptAlert: attemptAlertTotal(2) }), base + 5);
  assert.equal(stepAlertAfter({ attemptAlert: attemptAlertTotal(3) }), base + 15);
});

test("물러서기는 escapeAlert 를 안 낸다 — 시도 비용만 치른다", () => {
  const attempts = 2;
  const retreat = stepAlertAfter({ escaped: false, attemptAlert: attemptAlertTotal(attempts) });
  const missed = stepAlertAfter({ escaped: true, attemptAlert: attemptAlertTotal(attempts) });
  assert.ok(missed > retreat, "놓친 것과 물러선 것의 값이 같으면 선택지가 아니다");
  assert.equal(retreat, stepAlertAfter({}) + 5, "물러섬에 escapeAlert 가 섞였다");
});

test("한 번도 안 걸고 물러서면 소란이 전혀 안 오른다", () => {
  assert.equal(stepAlertAfter({ escaped: false, attemptAlert: attemptAlertTotal(0) }), stepAlertAfter({}));
});

test("물러서기는 짐도 안 흘린다 — 놓침만 흘린다", () => {
  const run = { ...startRun("shallow", 10, { capLevel: 99, canCatch: true }, 31337), current: "encounter" as const, depth: 0,
    bag: [{ id: "herb", count: 6 }] };
  const retreat = resolveStep(run, { escaped: false, attemptAlert: attemptAlertTotal(3) });
  const missed = resolveStep(run, { escaped: true, attemptAlert: attemptAlertTotal(3) });
  assert.equal(retreat.bag.reduce((s, b) => s + b.count, 0), 6);
  assert.equal(missed.bag.reduce((s, b) => s + b.count, 0), 4, "놓침이 두 칸을 안 흘렸다");
});
