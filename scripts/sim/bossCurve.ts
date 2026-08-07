/**
 * 보스층 승률이 파티 레벨에 따라 어떻게 변하는지 측정한다.
 * "몇 레벨에서 이길 만해지는가"를 알아야 보스 배수를 근거 있게 정할 수 있다.
 *
 * 실행: npx tsx scripts/sim/bossCurve.ts
 */
import { installSeededRandom, fightFloor, type SimState, type OwnedMon } from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { applyLevelGrowth } from "../../src/monster/growth";
import { getFloorEnemy } from "../../src/shared/floorTable";
import type { ArtifactInstance } from "../../src/shared/crafting";
import { applyArtifactQualityStats } from "../../src/shared/craftingUtils";
import { ARTIFACT_RECIPES } from "../../src/workshop/craftingRecipes";

/** 레벨 lv짜리 파티 3마리 (그 시점에 현실적으로 갖출 만한 구성) */
async function makeParty(species: string[], lv: number): Promise<OwnedMon[]> {
  return Promise.all(species.map(async (id, i) => {
    const base = monsters.find((m) => m.id === id)!;
    const n = lv - 1;
    let mon: OwnedMon = {
      ...base,
      uid: `t${i}`,
      level: lv,
      maxHp: base.maxHp + n * 10,
      attack: base.attack + n * 3,
      defense: base.defense + n * 2,
      speed: base.speed + n * 2,
      currentHp: base.maxHp + n * 10,
    };
    // 레벨업 성장(기술 습득·진화)을 1레벨부터 다시 적용
    mon = (await applyLevelGrowth(mon, 1)).monster as OwnedMon;
    return mon;
  }));
}

/** rare 등급 · 레벨 lv · +2 정도의 "적당히 관리한" 장비 세트 */
function makeGear(uid: string, artifactLevel: number): ArtifactInstance[] {
  return ARTIFACT_RECIPES.map((r, i) => ({
    instanceId: `${uid}-g${i}`,
    itemId: r.resultItemId,
    name: r.resultItemName,
    quality: "rare" as const,
    description: r.description,
    statBonuses: applyArtifactQualityStats(r.baseStats ?? [], "rare"),
    createdAt: 0,
    level: artifactLevel,
    enhancement: 2,
    source: "crafting" as const,
    bonusStats: [],
  }));
}

const TRIALS = 40;
const SCENARIOS: { floor: number; species: string[]; gearLevel: number }[] = [
  { floor: 10, species: ["flameling", "aquabe", "venomcrow"], gearLevel: 5 },
  { floor: 20, species: ["burno", "frostorb", "toxadon"], gearLevel: 12 },
  { floor: 30, species: ["aquavern", "frostorb", "mossevo"], gearLevel: 20 },
  { floor: 40, species: ["mossyfinal", "aquavern", "frostorb"], gearLevel: 28 },
  { floor: 50, species: ["mossyfinal", "aquavern", "frostorb"], gearLevel: 36 },
];

const restore = installSeededRandom(7);

console.log("보스 승률 곡선 (파티 3마리 · rare 장비 착용 · 물약 10개)\n");
for (const sc of SCENARIOS) {
  const boss = getFloorEnemy(sc.floor, "none");
  const levels: number[] = [];
  for (let d = -8; d <= 10; d += 2) levels.push(Math.max(2, sc.floor + d));

  const cells: string[] = [];
  for (const lv of levels) {
    let wins = 0;
    for (let t = 0; t < TRIALS; t++) {
      const party = await makeParty(sc.species, lv);
      const equipped: Record<string, ArtifactInstance[]> = {};
      for (const m of party) equipped[m.uid] = makeGear(m.uid, sc.gearLevel);
      const s: SimState = {
        party, materials: {},
        potions: { potion: 10, super_potion: 5 },
        artifacts: [], equipped, bestFloor: sc.floor - 1,
        questBarosDone: false, questOrionDone: false,
      };
      if ((await fightFloor(s, sc.floor)).win) wins++;
    }
    cells.push(`Lv${String(lv).padStart(2)}:${String(Math.round((wins / TRIALS) * 100)).padStart(3)}%`);
  }
  console.log(`${String(sc.floor).padStart(2)}층 ${boss.name.padEnd(10)} (적 Lv.${boss.level}, HP ${boss.maxHp}, 공 ${boss.attack}, 방 ${boss.defense})`);
  console.log(`   ${cells.join("  ")}\n`);
}

restore();
