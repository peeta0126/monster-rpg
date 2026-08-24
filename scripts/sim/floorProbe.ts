/**
 * 한 층만 반복해서 싸워 승률을 잰다.
 *
 * run.ts 는 1층부터 끝까지 도는 전체 판이라 한 판에 수십 초가 걸리고, 40판을 돌려도
 * 관문 층 표본은 몇 개뿐이라 크게 흔들린다. 전투 규칙 하나(치명타율·속도 게이지·AI)나
 * 관문 배수를 고치고 "그래서 이 층이 얼마나 어려워졌나"만 보고 싶을 때는 이쪽이 맞다.
 *
 * 실행: npx tsx scripts/sim/floorProbe.ts [층] [판수] [파티] [장비] [각인]
 *   npx tsx scripts/sim/floorProbe.ts 20 200 "mossevo:23,toxadon:16,mossy:17" -
 *   npx tsx scripts/sim/floorProbe.ts 20 200 "mossevo:23,toxadon:16,mossy:17" rare:15:3 3
 *
 *   파티 : `종족id:레벨` 쉼표로. 진화·기술 습득은 자동으로 적용된다(loadout.makeParty)
 *   장비 : `등급:레벨:강화` 또는 `-`(맨몸)
 *   각인 : 0~5. 파티의 모든 계열에 같은 등급을 준다
 *
 * ⚠️ 물약은 시행마다 새로 만든다. 한 벌을 돌려쓰면 앞 시행이 다 마셔 버려서
 *    같은 설정이 73% 로도 15% 로도 나온다(실제로 한 시간 태웠다).
 */
import { installSeededRandom, fightFloor, type SimState } from "./gameModel";
import { DEFAULT_STORY_FLAGS } from "../../src/shared/storyFlags";
import { getFloorEnemy } from "../../src/shared/floorTable";
import type { ArtifactInstance } from "../../src/shared/crafting";
import {
  freshPotions, gearLabel, imprintAt, makeGear, makeParty, parseGear,
} from "./loadout";

const floor = Number(process.argv[2] ?? 50);
const runs = Number(process.argv[3] ?? 150);
const partySpec = process.argv[4] ?? "mossyfinal:58,mossevo:28,toxadon:30";
const gear = parseGear(process.argv[5]);
const imprintTier = Number(process.argv[6] ?? 0);

async function main() {
  let wins = 0;
  let turns = 0;
  let potionsUsed = 0;

  for (let i = 0; i < runs; i++) {
    const restore = installSeededRandom(1000 + i);
    const party = await makeParty(partySpec);
    const equipped: Record<string, ArtifactInstance[]> = {};
    for (const m of party) equipped[m.uid] = makeGear(m.uid, gear);

    const s: SimState = {
      party,
      imprint: imprintAt(party, imprintTier),
      materials: {},
      potions: freshPotions(floor),
      artifacts: [], equipped, bestFloor: floor - 1,
      dexCaught: [], storyFlags: { ...DEFAULT_STORY_FLAGS, met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true }, questStatus: {},
    };
    const r = await fightFloor(s, floor);
    if (r.win) wins++;
    turns += r.turns;
    potionsUsed += r.potionsUsed;
    restore();
  }

  const enemy = getFloorEnemy(floor, "none");
  console.log(
    `${floor}층(${enemy.name} Lv${enemy.level} HP${enemy.maxHp}/공${enemy.attack}/방${enemy.defense}) · ` +
    `${gearLabel(gear, imprintTier)} · ${runs}판 → ` +
    `승률 ${((wins / runs) * 100).toFixed(0)}% · 평균 ${(turns / runs).toFixed(1)}턴 · ` +
    `물약 ${(potionsUsed / runs).toFixed(1)}개`,
  );
}

main();
