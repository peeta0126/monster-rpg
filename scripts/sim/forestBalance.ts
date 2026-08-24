/**
 * 숲 밸런스 측정. `npx tsx scripts/sim/forestBalance.ts`
 *
 * 소란도가 다이얼로 작동하는지 보는 도구다. 소란을 피하는 쪽(avoid)과 올리는 쪽
 * (greedy)의 집에 가져오는 양이 비슷해야 선택이 선택이 된다. 한쪽이 압도적이면
 * 다이얼이 아니라 정답이 하나 있는 장식이다.
 *
 * 결과는 docs/FOREST_BALANCE.md 에 기록해 STEP 마다 비교한다.
 */
import { FOREST_AREAS } from "../../src/camp/forest/areas";
import { runForest, type ForestStrategy } from "./gameModel";
import { materialValue } from "../../src/shared/dropTables";

/** 몬스터 1마리의 가치 (시뮬 정규화용). forestSteps.ts 와 같은 값을 쓴다 */
const MONSTER_VALUE = Number(process.env.MONSTER_VALUE ?? 6);

const RUNS = 20000;
/** 강제 퇴각 시 회수율 (STEP 4 정산) */
const FORCED_RECOVERY = 0.5;

const STRATEGIES: ForestStrategy[] = ["avoid", "random", "greedy"];

/** 자진 귀환 기준. 소란이 이 값에 닿으면 돌아간다 */
const BANK_AT = Number(process.env.BANK_AT ?? 85);

interface Row {
  materials: number;
  carried: number;
  peak: number;
  forced: number;
  steps: number;
  escapes: number;
  warden: number;
}

function measure(areaIdx: number, strategy: ForestStrategy): Row {
  let materials = 0, carried = 0, peak = 0, forced = 0, steps = 0, escapes = 0, warden = 0;
  for (let i = 0; i < RUNS; i++) {
    const r = runForest(FOREST_AREAS[areaIdx], strategy, BANK_AT);
    const got = r.drops.reduce((a, d) => a + d.count * materialValue(d.id), 0);
    materials += got;
    // 재료만 회수율에 걸린다. 몬스터는 잡는 즉시 확정이라 퇴각해도 남는다
    carried += (r.forcedRetreat ? got * FORCED_RECOVERY : got) + r.caught * MONSTER_VALUE;
    peak += r.alertPeak;
    steps += r.steps;
    escapes += r.escapes;
    if (r.metWarden) warden++;
    if (r.forcedRetreat) forced++;
  }
  return {
    materials: materials / RUNS,
    carried: carried / RUNS,
    peak: peak / RUNS,
    forced: (forced / RUNS) * 100,
    steps: steps / RUNS,
    escapes: escapes / RUNS,
    warden: (warden / RUNS) * 100,
  };
}

console.log(`자진 귀환 기준: 소란 ${BANK_AT} (BANK_AT 환경변수로 조절)`);

for (const [i, area] of FOREST_AREAS.entries()) {
  console.log(`\n${area.name} (시작 소란 ${area.startingAlert})`);
  const rows = new Map<ForestStrategy, Row>();
  for (const s of STRATEGIES) {
    const r = measure(i, s);
    rows.set(s, r);
    console.log(
      `  ${s.padEnd(6)} 재료 ${r.materials.toFixed(1).padStart(5)}  ` +
      `반입 ${r.carried.toFixed(2).padStart(5)}  ` +
      `걸음 ${r.steps.toFixed(1).padStart(4)}  ` +
      `최고소란 ${r.peak.toFixed(0).padStart(3)}  ` +
      `퇴각 ${r.forced.toFixed(1).padStart(5)}%  ` +
      `놓침 ${r.escapes.toFixed(2)}  주인 ${r.warden.toFixed(1)}%`,
    );
  }
  const avoid = rows.get("avoid")!.carried;
  const greedy = rows.get("greedy")!.carried;
  const gap = ((greedy - avoid) / avoid) * 100;
  const verdict = Math.abs(gap) <= 10 ? "균형" : gap > 0 ? "탐욕 우세" : "회피 우세";
  console.log(`  → 반입 격차 ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%  (${verdict})`);
}
