/**
 * 관문 층에 도착한 실제 판의 상태를 JSON 으로 뽑는다.
 *
 * 시뮬이 재는 것과 **같은 입력**을 실제 UI 에 심어서 승률을 비교하려고 만들었다.
 * 두 곳이 다른 파티·장비로 재면 숫자가 갈려도 원인을 모른다.
 *
 * 실행: npx tsx scripts/sim/dumpGateSnapshots.ts <출력경로> [판수]
 */
import fs from "node:fs";
import { simulateRun } from "./playRun";

const out = process.argv[2];
const runs = Number(process.argv[3] ?? 12);
const FLOORS = [15, 20, 40, 50];

const samples: Record<number, unknown[]> = {};
for (const f of FLOORS) samples[f] = [];

for (let i = 0; i < runs; i++) {
  const r = await simulateRun(1000 + i);
  for (const f of FLOORS) {
    const party = r.bossParty[f];
    if (!party) continue;
    samples[f].push({
      party: party.map((m) => ({ id: m.id, level: m.level, hpRatio: m.hpRatio, simAtk: m.atk, simHp: m.hp })),
      gear: r.bossGear[f] ?? [],
      imprint: r.bossImprint[f] ?? {},
      potions: r.bossPotions[f] ?? {},
      simFirstTry: r.bossFirstTry[f] ?? false,
    });
  }
}

fs.writeFileSync(out, JSON.stringify(samples, null, 1));
for (const f of FLOORS) console.log(`${f}층 표본 ${samples[f].length}판`);
