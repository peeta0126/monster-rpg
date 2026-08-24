/**
 * 사건별 기대가치 측정. `npx tsx scripts/sim/forestSteps.ts`
 *
 * 걸음 수를 소란이 정하는 구조에서는 "비싼 사건이 배수를 더 받는다"만으로는 부족하다.
 * 소란 25 를 쓰는 사건은 소란 5 짜리보다 기대 수확 자체가 5배 가까이 커야 본전이다.
 * 안 그러면 비싼 길은 언제나 손해고, 다이얼은 한 방향으로만 굳는다.
 *
 * 개수가 아니라 가치로 잰다(dropTables.MATERIAL_VALUE). 약초 1개와 강화석 1개를
 * 같은 무게로 세면 희귀 전용 사건이 흔적보다 못한 것으로 계산된다.
 */
import { FOREST_AREAS } from "../../src/camp/forest/areas";
import { materialValue } from "../../src/shared/dropTables";
import { STEP_ALERT } from "../../src/camp/forest/alert";
import { rollStepRewards, hasCatch, type ForestStepKind } from "../../src/camp/forest/steps";
import { makeRng } from "../../src/camp/forest/runStore";
import { CATCH_ATTEMPTS, attemptAlert, catchChance } from "../../src/camp/forest/catchRules";

/**
 * 몬스터 1마리를 재료 몇 가치로 칠 것인가.
 *
 * 시뮬 정규화용 숫자다. "몬스터가 강화석 1.5개짜리"라는 뜻이 아니다. 포획 연출과
 * 도감 등록의 체감은 이 숫자와 무관하게 크게 만든다.
 *
 * ⚠️ 이 값은 판이 진행되면 실제로 떨어진다(도감이 차면 조우가 나쁜 선택이 된다).
 *    미해결 항목이고 배경은 docs/FOREST_BALANCE.md 의 "미해결" 절에 있다.
 */
const MONSTER_VALUE = Number(process.env.MONSTER_VALUE ?? 6);

/**
 * 시도당 포획률. 버릇을 모르는 플레이어 기준.
 *
 * 상대 손에 편향이 붙어도 아무 수나 낼 때의 기대값은 세 손의 평균 그대로다.
 * 그래서 기준선은 예전과 같은 값이고, 버릇을 아는 쪽이 그 위로 벌어진다.
 */
function perAttempt(alert: number): number {
  return (catchChance("win", alert) + catchChance("draw", alert) + catchChance("lose", alert)) / 3;
}

/** 시도 3회를 다 쓸 때의 포획 성공률 */
function catchSuccessRate(alert: number): number {
  return 1 - Math.pow(1 - perAttempt(alert), CATCH_ATTEMPTS);
}

/**
 * 조우 하나가 시도 비용으로 태우는 소란의 기대값.
 *
 * 사건 자체의 소란(STEP_ALERT)만 세면 포획이 붙은 사건이 실제보다 싸 보인다.
 * 지금은 재도전에 값이 붙으므로 그 몫도 이 사건의 값이다.
 */
function expectedAttemptAlert(alert: number): number {
  const per = perAttempt(alert);
  let sum = 0;
  for (let a = 0; a < CATCH_ATTEMPTS; a++) sum += attemptAlert(a) * Math.pow(1 - per, a);
  return sum;
}

const N = 40000;
/** 이 소란도에서 잰다. 구간 배수가 1.0 인 지점이라 사건 자체의 값이 보인다 */
const AT_ALERT = 0;

const KINDS: ForestStepKind[] = ["trace", "encounter", "nest", "anomaly", "champion", "warden"];

/** 목표 비례계수. 비싼 사건이 약간 유리해야 다이얼이 양방향으로 돈다 */
const TARGET_K: Partial<Record<ForestStepKind, number>> = {
  trace: 1.00, encounter: 1.05, nest: 1.10, anomaly: 1.15, champion: 1.20, warden: 1.25,
};

const KIND_KO: Record<ForestStepKind, string> = {
  trace: "흔적", encounter: "조우", nest: "둥지", anomaly: "이변",
  hideout: "은신처", champion: "강적", warden: "주인",
};

for (const area of FOREST_AREAS) {
  console.log(`\n${area.name}  (materialRate ${area.materialRate} · bonus ${area.materialBonus})`);
  console.log("  사건      소란   재료개수   재료가치   포획가치   총가치   비례계수 k   목표 k");

  const base: Record<string, number> = {};
  for (const kind of KINDS) {
    let count = 0, value = 0;
    for (let seed = 0; seed < N; seed++) {
      const { rng } = makeRng(seed);
      for (const d of rollStepRewards(area, kind, AT_ALERT, rng)) {
        count += d.count;
        value += d.count * materialValue(d.id);
      }
    }
    const alert = STEP_ALERT[kind] + (hasCatch(kind) ? expectedAttemptAlert(AT_ALERT) : 0);
    const avgCount = count / N;
    const matValue = value / N;
    const catchValue = hasCatch(kind) ? MONSTER_VALUE * catchSuccessRate(AT_ALERT) : 0;
    const total = matValue + catchValue;
    base[kind] = total;

    // k = 이 사건의 "소란 1 당 가치"가 흔적의 몇 배인가
    const perAlert = total / alert;
    console.log(
      `  ${KIND_KO[kind].padEnd(6)}` +
      `${alert.toFixed(1).padStart(5)}  ` +
      `${avgCount.toFixed(2).padStart(7)}   ` +
      `${matValue.toFixed(2).padStart(7)}   ` +
      `${catchValue.toFixed(2).padStart(7)}   ` +
      `${total.toFixed(2).padStart(6)}   ` +
      `${(perAlert / (base.trace / STEP_ALERT.trace)).toFixed(2).padStart(8)}   ` +
      `${(TARGET_K[kind] ?? 1).toFixed(2).padStart(5)}`,
    );
  }
}

console.log(`\n※ k=1.00 이면 흔적과 같은 "소란 1 당 가치". 1 보다 작으면 그 사건은 손해다.`);
console.log(`   목표: 흔적 1.00 · 조우 1.05 · 둥지 1.10 · 이변 1.15 · 강적 1.20`);
