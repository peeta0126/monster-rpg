/**
 * 포획 밸런스 측정 — `npx tsx scripts/sim/forestCatch.ts`
 *
 * 두 가지를 잰다.
 *   1) 버릇을 아는 것에 값이 있는가 — 세 손의 기대 포획률이 실제로 갈리는가.
 *   2) 재도전 비용이 "늘 3번"을 깼는가 — 조우당 평균 시도가 3에서 얼마나 내려갔는가.
 *      그리고 그 대가로 런이 얼마나 짧아졌는가. 너무 짧아지면 비용이 센 것이다.
 *
 * 표는 전부 게임 소스에서 온다(catchTells · catchRules). 여기서 수치를 다시 적으면
 * 측정이 게임이 아니라 사본을 잰다.
 */
import { FOREST_AREAS } from "../../src/camp/forest/areas";
import { materialValue } from "../../src/shared/dropTables";
import { runForest, type CatchPolicy } from "./gameModel";
import { CATCH_ATTEMPTS, expectedCatchChance } from "../../src/camp/forest/catchRules";
import { TELL_WEIGHT, counterTo, tellOf } from "../../src/camp/forest/catchTells";
import { RPS_KO, type RpsChoice } from "../../src/workshop/rps";
import type { ElementType } from "../../src/shared/game";

const MONSTER_VALUE = Number(process.env.MONSTER_VALUE ?? 6);
const RUNS = Number(process.env.RUNS ?? 20000);
const BANK_AT = Number(process.env.BANK_AT ?? 85);
const FORCED_RECOVERY = 0.5;

// ── 1. 손 하나의 기대값 ──────────────────────────────────────────────────────

console.log(`■ 손 하나의 기대 포획률 (소란 0 · 편향 ${Math.round(TELL_WEIGHT * 100)}%)\n`);
console.log("  속성    버릇      카운터   버릇대로   최악(지는 수)   아무거나");

const SAMPLE: ElementType[] = ["fire", "water", "grass", "normal"];
for (const type of SAMPLE) {
  const tell = tellOf(type);
  const hands: RpsChoice[] = ["rock", "paper", "scissors"];
  const blind = hands.reduce((s, h) => s + expectedCatchChance(h, type, 0), 0) / 3;
  const counter = tell ? expectedCatchChance(counterTo(tell), type, 0) : blind;
  const mirror = tell ? expectedCatchChance(tell, type, 0) : blind;
  const worst = tell ? expectedCatchChance(counterTo(counterTo(tell)), type, 0) : blind;
  console.log(
    `  ${type.padEnd(9)}${(tell ? RPS_KO[tell] : "없음").padEnd(8)}` +
    `${counter.toFixed(3).padStart(6)}   ${mirror.toFixed(3).padStart(6)}   ` +
    `${worst.toFixed(3).padStart(10)}   ${blind.toFixed(3).padStart(8)}`,
  );
}

// 시도 3회를 다 쓸 때까지의 누적 — 버릇을 아는 값이 시도 수에서 어떻게 보이는지
const per = { blind: 0.44, counter: expectedCatchChance("paper", "fire", 0) };
const cum = (p: number) => 1 - Math.pow(1 - p, CATCH_ATTEMPTS);
const tries = (p: number) => 1 + (1 - p) + Math.pow(1 - p, 2);
console.log(
  `\n  3회까지 누적   모름 ${cum(per.blind).toFixed(3)} · 앎 ${cum(per.counter).toFixed(3)}` +
  `\n  평균 시도 수   모름 ${tries(per.blind).toFixed(2)} · 앎 ${tries(per.counter).toFixed(2)}`,
);

// ── 2. 런 단위 ───────────────────────────────────────────────────────────────

interface Row {
  carried: number; caught: number; steps: number; peak: number;
  catchSteps: number; perCatchStep: number; retreats: number;
  attemptAlert: number; forced: number;
}

function measure(areaIdx: number, policy: CatchPolicy): Row {
  let carried = 0, caught = 0, steps = 0, peak = 0;
  let attempts = 0, catchSteps = 0, retreats = 0, attemptAlert = 0, forced = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runForest(FOREST_AREAS[areaIdx], "random", BANK_AT, policy);
    const got = r.drops.reduce((a, d) => a + d.count * materialValue(d.id), 0);
    carried += (r.forcedRetreat ? got * FORCED_RECOVERY : got) + r.caught * MONSTER_VALUE;
    caught += r.caught;
    steps += r.steps;
    peak += r.alertPeak;
    attempts += r.attempts;
    catchSteps += r.catchSteps;
    retreats += r.retreats;
    attemptAlert += r.attemptAlertSpent;
    if (r.forcedRetreat) forced++;
  }
  return {
    carried: carried / RUNS, caught: caught / RUNS, steps: steps / RUNS, peak: peak / RUNS,
    catchSteps: catchSteps / RUNS,
    perCatchStep: catchSteps > 0 ? attempts / catchSteps : 0,
    // 물러선 비율은 조우 대비로 본다 — 런당 횟수만 보면 런 길이에 휘둘린다
    retreats: catchSteps > 0 ? (retreats / catchSteps) * 100 : 0,
    attemptAlert: attemptAlert / RUNS,
    forced: (forced / RUNS) * 100,
  };
}

/**
 * 정책 넷.
 *
 * "예전"은 비용을 곱셈 0 으로 지운 것이다(CatchPolicy.costScale — 비교 전용 다이얼).
 * 나머지 셋이 지금 게임이고, 버릇을 아는가로 갈린다.
 */
const RETREAT_ALERT = Number(process.env.RETREAT_ALERT ?? 60);

const POLICIES: [string, CatchPolicy][] = [
  ["예전(공짜·모름)", { knowsTell: false, retreatCostOver: Infinity, retreatAlertOver: Infinity,    costScale: 0 }],
  ["모름·끝까지",     { knowsTell: false, retreatCostOver: Infinity, retreatAlertOver: Infinity,    costScale: 1 }],
  ["모름·신중",       { knowsTell: false, retreatCostOver: Infinity, retreatAlertOver: RETREAT_ALERT, costScale: 1 }],
  ["앎·신중",         { knowsTell: true,  retreatCostOver: Infinity, retreatAlertOver: RETREAT_ALERT, costScale: 1 }],
];

console.log(`\n\n■ 런 단위 (자진 귀환 소란 ${BANK_AT} · ${RUNS}판)\n`);

for (const [i, area] of FOREST_AREAS.entries()) {
  console.log(`${area.name} (시작 소란 ${area.startingAlert})`);
  console.log("  정책             반입    포획   걸음   조우   조우당시도   물러섬%   시도소란   퇴각%");
  for (const [label, policy] of POLICIES) {
    const r = measure(i, policy);
    console.log(
      `  ${label.padEnd(15)}` +
      `${r.carried.toFixed(1).padStart(6)}  ` +
      `${r.caught.toFixed(2).padStart(5)}  ` +
      `${r.steps.toFixed(1).padStart(5)}  ` +
      `${r.catchSteps.toFixed(2).padStart(5)}  ` +
      `${r.perCatchStep.toFixed(2).padStart(9)}  ` +
      `${r.retreats.toFixed(1).padStart(7)}  ` +
      `${r.attemptAlert.toFixed(1).padStart(8)}  ` +
      `${r.forced.toFixed(1).padStart(6)}`,
    );
  }
  console.log("");
}

console.log("※ 조우당 시도가 3.00 에 붙어 있으면 재도전 비용이 약한 것이다(늘 3번 = 절차).");
console.log("   물러섬이 조우 대비 너무 잦으면 비용이 센 것이다 — 목표는 '가끔'이지 '늘'이 아니다.");
