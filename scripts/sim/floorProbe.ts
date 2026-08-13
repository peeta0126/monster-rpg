/**
 * 한 층만 반복해서 싸워 승률을 잰다.
 *
 * run.ts 는 1층부터 끝까지 도는 전체 판이라 한 판에 수십 초가 걸리고, 40판을 돌려도
 * 보스층 표본은 몇 개뿐이라 크게 흔들린다. 전투 규칙 하나(치명타율·속도 게이지·AI)를
 * 고치고 "그래서 50층이 얼마나 어려워졌나"만 보고 싶을 때는 이쪽이 맞다.
 *
 * 실행: npx tsx scripts/sim/floorProbe.ts [층] [판수] [파티]
 *   npx tsx scripts/sim/floorProbe.ts 50 150
 *   npx tsx scripts/sim/floorProbe.ts 20 150 "mossevo:23,toxadon:16,mossy:17"
 *
 * 파티는 `종족id:레벨` 을 쉼표로 이은 것. 기본값은 run.ts 가 실제로 그 층에 데려간 구성이다.
 */
import { installSeededRandom, fightFloor, type SimState, type OwnedMon } from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { scaleToLevel } from "../../src/shared/floorTable";

const floor = Number(process.argv[2] ?? 50);
const runs = Number(process.argv[3] ?? 150);
const spec = (process.argv[4] ?? "mossyfinal:58,mossevo:28,toxadon:30").split(",");

function makeParty(): OwnedMon[] {
  return spec.map((s, i) => {
    const [id, lv] = s.split(":");
    const base = monsters.find((m) => m.id === id);
    if (!base) throw new Error(`그런 몬스터가 없다: ${id}`);
    const scaled = scaleToLevel(base, Number(lv));
    return { ...scaled, uid: `p${i}`, currentHp: scaled.maxHp };
  });
}

async function main() {
  let wins = 0;
  let turns = 0;
  for (let i = 0; i < runs; i++) {
    const restore = installSeededRandom(1000 + i);
    const s: SimState = {
      party: makeParty(), imprint: {}, materials: {}, potions: { max_potion: 10 },
      artifacts: [], equipped: {}, bestFloor: floor - 1,
      questBarosDone: true, questOrionDone: true,
    };
    const r = await fightFloor(s, floor);
    if (r.win) wins++;
    turns += r.turns;
    restore();
  }
  console.log(
    `${floor}층 · ${spec.join(" ")} · ${runs}판 → ` +
    `승률 ${((wins / runs) * 100).toFixed(0)}% · 평균 ${(turns / runs).toFixed(1)}턴`,
  );
}

main();
