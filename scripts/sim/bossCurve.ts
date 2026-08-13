/**
 * 관문 층이 **레벨로 넘는 벽인지 장비로 넘는 벽인지**를 잰다.
 *
 * 이 게임의 설계 목표는 한 문장이다 — "장비를 갖추는 것이 레벨을 올리는 것보다 크게
 * 이득이어야 한다". 그 부등식이 성립하는지 보려면 같은 층을 **레벨 축**과 **장비 축**
 * 양쪽으로 훑어야 한다. 그래서 표가 2차원이다.
 *
 * 실행: npx tsx scripts/sim/bossCurve.ts [판수]
 *
 * 읽는 법: 한 줄(같은 장비)에서 오른쪽으로 가는 것이 레벨을 올리는 것,
 *          한 칸 아래로 가는 것이 장비를 한 단계 올리는 것이다.
 *          **아래로 가는 폭이 오른쪽으로 8칸 가는 폭보다 커야 한다.**
 */
import { installSeededRandom, fightFloor, type SimState } from "./gameModel";
import { getFloorEnemy } from "../../src/shared/floorTable";
import type { ArtifactInstance } from "../../src/shared/crafting";
import {
  freshPotions, imprintAt, makeGear, makeParty, parseGear, type GearSpec,
} from "./loadout";

const TRIALS = Number(process.argv[2] ?? 30);

interface Scenario {
  floor: number;
  /** 그 층에 도달했을 때 현실적으로 들고 있는 종족 구성 */
  species: string[];
  /** 그 층에서 "정규"라고 볼 장비 */
  loadouts: { label: string; gear: string; imprint: number }[];
}

/** 층마다 정규 등급이 다르다 — 재료가 열리는 시점이 다르기 때문이다 */
const SCENARIOS: Scenario[] = [
  {
    floor: 10, species: ["flameling", "aquabe", "venomcrow"],
    loadouts: [
      { label: "맨몸",            gear: "-",           imprint: 0 },
      { label: "각인만 3",        gear: "-",           imprint: 3 },
      { label: "노말 L5+1",       gear: "normal:5:1",  imprint: 0 },
      { label: "노말 L5+1 · 각인3", gear: "normal:5:1", imprint: 3 },
    ],
  },
  {
    floor: 20, species: ["burno", "frostorb", "toxadon"],
    loadouts: [
      { label: "맨몸",             gear: "-",            imprint: 0 },
      { label: "노말 L10+2",       gear: "normal:10:2",  imprint: 0 },
      { label: "레어 L15+3",       gear: "rare:15:3",    imprint: 0 },
      { label: "레어 L15+3 · 각인3", gear: "rare:15:3",  imprint: 3 },
    ],
  },
  {
    floor: 30, species: ["aquavern", "frostorb", "mossevo"],
    loadouts: [
      { label: "맨몸",             gear: "-",           imprint: 0 },
      { label: "노말 L15+2",       gear: "normal:15:2", imprint: 0 },
      { label: "레어 L20+3",       gear: "rare:20:3",   imprint: 0 },
      { label: "레어 L20+3 · 각인4", gear: "rare:20:3", imprint: 4 },
    ],
  },
  {
    floor: 40, species: ["mossyfinal", "aquavern", "frostorb"],
    loadouts: [
      { label: "맨몸",             gear: "-",           imprint: 0 },
      { label: "레어 L20+3",       gear: "rare:20:3",   imprint: 0 },
      { label: "레어 L30+5",       gear: "rare:30:5",   imprint: 0 },
      { label: "레어 L30+5 · 각인4", gear: "rare:30:5", imprint: 4 },
    ],
  },
  {
    floor: 50, species: ["mossyfinal", "aquavern", "frostorb"],
    loadouts: [
      { label: "맨몸",              gear: "-",           imprint: 0 },
      { label: "레어 L30+5",        gear: "rare:30:5",   imprint: 3 },
      { label: "엘리트 L30+5 · 각인5", gear: "elite:30:5", imprint: 5 },
      { label: "엘리트 L50+5 · 각인5", gear: "elite:50:5", imprint: 5 },
    ],
  },
];

async function winRate(
  floor: number, species: string[], level: number, gear: GearSpec | null, tier: number,
): Promise<number> {
  let wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const restore = installSeededRandom(7000 + t);
    const party = await makeParty(species.map((id) => `${id}:${level}`).join(","));
    const equipped: Record<string, ArtifactInstance[]> = {};
    for (const m of party) equipped[m.uid] = makeGear(m.uid, gear);
    const s: SimState = {
      party,
      imprint: imprintAt(party, tier),
      materials: {},
      potions: freshPotions(floor),          // 시행마다 새로
      artifacts: [], equipped, bestFloor: floor - 1,
      questBarosDone: true, questOrionDone: true,
    };
    if ((await fightFloor(s, floor)).win) wins++;
    restore();
  }
  return Math.round((wins / TRIALS) * 100);
}

async function main() {
  console.log(`관문 승률표 (${TRIALS}판 · 물약은 시행마다 새로)\n`);
  console.log("아래로 = 장비를 올린다 / 오른쪽으로 = 레벨을 올린다\n");

  for (const sc of SCENARIOS) {
    const boss = getFloorEnemy(sc.floor, "none");
    const levels = [sc.floor - 2, sc.floor + 1, sc.floor + 3, sc.floor + 6, sc.floor + 11];

    console.log(
      `${String(sc.floor).padStart(2)}층 ${boss.name} ` +
      `(적 Lv.${boss.level} · HP ${boss.maxHp} · 공 ${boss.attack} · 방 ${boss.defense})`,
    );
    console.log(`  ${"장비".padEnd(22)}${levels.map((l) => `Lv${l}`.padStart(7)).join("")}`);

    for (const lo of sc.loadouts) {
      const gear = parseGear(lo.gear);
      const cells: string[] = [];
      for (const lv of levels) cells.push(`${await winRate(sc.floor, sc.species, lv, gear, lo.imprint)}%`.padStart(7));
      console.log(`  ${lo.label.padEnd(22)}${cells.join("")}`);
    }
    console.log("");
  }
}

main();
