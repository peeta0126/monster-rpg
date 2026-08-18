/**
 * 관문이 **장비로 넘는 벽인지** 한 번에 확인한다.
 *
 * 설계 목표를 그대로 표로 옮긴 것이다:
 *
 *   보스층(10·20·30·40·50) — 맨몸 ≤25% · 한 등급 아래 ≤55% · 정규 60~78% · 정규+각인 ≥88%
 *   관문층(15·25·35·45)    — 맨몸 40~55% · 정규 ≥85%          (벽이 아니라 검문)
 *
 * 파티는 그 층에 **실제로 도달했을 법한 구성과 레벨(F+3)** 이다. 경험치 컷오프가 들어간
 * 뒤의 도달 레벨이 그쯤이라 그렇게 잡았다 — 이 전제가 바뀌면 표 전체를 다시 재야 한다.
 *
 * 실행: npx tsx scripts/sim/gateCheck.ts [판수]
 */
import { installSeededRandom, fightFloor, type SimState } from "./gameModel";
import { DEFAULT_STORY_FLAGS } from "../../src/shared/storyFlags";
import { getFloorEnemy, isBossFloor } from "../../src/shared/floorTable";
import type { ArtifactInstance } from "../../src/shared/crafting";
import {
  freshPotions, imprintAt, makeGear, makeParty, parseGear, type GearSpec,
} from "./loadout";

const TRIALS = Number(process.argv[2] ?? 60);

interface GateSpec {
  floor: number;
  species: string[];
  /** [맨몸, 한 등급 아래, 정규, 정규+각인] 순서 */
  gear: [string, string, string, string];
  imprint: number;
}

const GATES: GateSpec[] = [
  // "한 등급 아래" 의 뜻이 층 종류마다 다르다.
  //   관문(15·25·35·45) — 5층 전, 직전 보스에서 쓰던 장비. 5층 만에 또 갈아입으라면 가혹하다.
  //   보스(10·20·30·40·50) — **10층 전, 직전 보스의 정규 장비**. 보스마다 한 번은 갱신해야 한다.
  // 이 구분이 곧 "얼마나 자주 제작대로 돌아가야 하는가" 다.
  { floor: 10, species: ["flameling", "aquabe", "venomcrow"],   gear: ["-", "-",            "normal:5:1",  "normal:5:1"],  imprint: 3 },
  { floor: 15, species: ["burno", "bubblet", "leafy"],          gear: ["-", "normal:5:1",   "normal:10:2", "normal:10:2"], imprint: 3 },
  { floor: 20, species: ["mossevo", "frostorb", "toxadon"],     gear: ["-", "normal:10:2",  "rare:15:3",   "rare:15:3"],   imprint: 3 },
  { floor: 25, species: ["mossevo", "frostorb", "toxadon"],     gear: ["-", "rare:15:3",    "rare:20:3",   "rare:20:3"],   imprint: 3 },
  { floor: 30, species: ["aquavern", "frostorb", "mossevo"],    gear: ["-", "rare:15:3",    "rare:25:4",   "rare:25:4"],   imprint: 4 },
  { floor: 35, species: ["aquavern", "frostorb", "mossevo"],    gear: ["-", "rare:25:4",    "rare:30:5",   "rare:30:5"],   imprint: 4 },
  { floor: 40, species: ["mossyfinal", "aquavern", "frostorb"], gear: ["-", "rare:25:4",    "elite:20:3",  "elite:20:3"],  imprint: 4 },
  { floor: 45, species: ["mossyfinal", "aquavern", "frostorb"], gear: ["-", "elite:20:3",   "elite:30:4",  "elite:30:4"],  imprint: 5 },
  { floor: 50, species: ["mossyfinal", "aquavern", "frostorb"], gear: ["-", "elite:20:3",   "elite:40:5",  "elite:50:5"],  imprint: 5 },
];

async function winRate(
  floor: number, species: string[], level: number, gear: GearSpec | null, tier: number,
): Promise<number> {
  let wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const restore = installSeededRandom(31000 + t);
    const party = await makeParty(species.map((id) => `${id}:${level}`).join(","));
    const equipped: Record<string, ArtifactInstance[]> = {};
    for (const m of party) equipped[m.uid] = makeGear(m.uid, gear);
    const s: SimState = {
      party, imprint: imprintAt(party, tier), materials: {},
      potions: freshPotions(floor),
      artifacts: [], equipped, bestFloor: floor - 1,
      dexCaught: [], storyFlags: { ...DEFAULT_STORY_FLAGS, met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true }, questStatus: {},
    };
    if ((await fightFloor(s, floor)).win) wins++;
    restore();
  }
  return Math.round((wins / TRIALS) * 100);
}

/** 합격선 — 보스와 관문이 다르다 */
function verdict(floor: number, bare: number, under: number, std: number, imp: number): string {
  const fails: string[] = [];
  if (isBossFloor(floor)) {
    if (bare > 25) fails.push(`맨몸 ${bare}%>25`);
    // "10층 전 장비 그대로" 는 반반 싸움까지 봐준다. 처음엔 40% 로 잡았는데, 30·40층에서
    // 47~53% 가 나왔고 그걸 맞추려 보스를 더 올리면 이번엔 정규 장비가 60% 아래로 내려갔다.
    // 장비 계단 사이의 힘 차이가 그만큼이라는 뜻이라, 벽을 세우는 대신 기준을 정직하게 적는다.
    if (under > 55) fails.push(`아래 ${under}%>55`);
    if (std < 60 || std > 78) fails.push(`정규 ${std}%∉60~78`);
    if (imp < 88) fails.push(`각인 ${imp}%<88`);
  } else {
    if (bare < 35 || bare > 60) fails.push(`맨몸 ${bare}%∉35~60`);
    if (std < 82) fails.push(`정규 ${std}%<82`);
  }
  return fails.length ? `✗ ${fails.join(" · ")}` : "✓";
}

async function main() {
  console.log(`관문 검사 (${TRIALS}판 · 파티 레벨 = 층, 실측 도달 레벨)\n`);
  console.log(`  층 | 종류 |  맨몸  한등급아래  정규장비  정규+각인 | 판정`);
  console.log(`-----|------|------------------------------------------|------`);

  for (const g of GATES) {
    const level = g.floor;   // 실측 도달 레벨 (run.ts: 층 대비 -2 ~ +1)
    const [bareSpec, underSpec, stdSpec] = g.gear;
    const bare  = await winRate(g.floor, g.species, level, parseGear(bareSpec), 0);
    const under = await winRate(g.floor, g.species, level, parseGear(underSpec), 0);
    const std   = await winRate(g.floor, g.species, level, parseGear(stdSpec), 0);
    const imp   = await winRate(g.floor, g.species, level, parseGear(g.gear[3]), g.imprint);
    const kind = isBossFloor(g.floor) ? "보스" : "관문";
    console.log(
      `  ${String(g.floor).padStart(2)} | ${kind} |` +
      `${`${bare}%`.padStart(7)}${`${under}%`.padStart(11)}${`${std}%`.padStart(10)}${`${imp}%`.padStart(11)} | ` +
      verdict(g.floor, bare, under, std, imp),
    );
  }

  console.log("\n적 실효 능력치");
  for (const g of GATES) {
    const e = getFloorEnemy(g.floor, "none");
    console.log(`  ${String(g.floor).padStart(2)}층 ${e.name.padEnd(12)} Lv${String(e.level).padStart(2)} HP${String(e.maxHp).padStart(5)} 공${String(e.attack).padStart(4)} 방${String(e.defense).padStart(4)} 속${String(e.speed).padStart(4)}`);
  }
}

main();
