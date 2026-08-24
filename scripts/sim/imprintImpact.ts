/**
 * 각인이 무한의 탑 난이도를 얼마나 내리는지 잰다.
 *
 * 재는 방식: 층마다 "80% 이상 이기는 최소 파티 레벨"을 이분 탐색으로 찾고,
 * 각인 0등급과 5등급(+25%)에서 그 레벨이 얼마나 벌어지는지 본다. 물약·아티팩트는
 * 끄고 순수하게 능력치 배수만 남긴다. 섞으면 무엇이 난이도를 내렸는지 알 수 없다.
 *
 * 실행: npx tsx scripts/sim/imprintImpact.ts
 */
import {
  installSeededRandom, createInitialSim, fightFloor, MAX_TOWER_FLOOR,
  type OwnedMon, type SimState,
} from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { scaleToLevel } from "../../src/shared/floorTable";
import { chainKeyOf, IMPRINT_TIERS } from "../../src/monster/imprint";

/** 측정 대상 층 */
const FLOORS = [5, 10, 15, 20, 25, 30, 35, 40, 45, MAX_TOWER_FLOOR];
const SEEDS = Array.from({ length: 16 }, (_, i) => 1000 + i * 7919);
const WIN_TARGET = 0.8;
const MAX_LEVEL = 70;

/** 이 레벨의 플레이어가 들고 있을 법한 3마리. 진화 조건을 실제로 적용해 세운다 */
function partyAt(level: number): OwnedMon[] {
  return ["mossy", "aquabe", "flameling"].map((id, i) => {
    let base = monsters.find((m) => m.id === id)!;
    while (base.evolvesTo && base.evolvesAtLevel !== undefined && level >= base.evolvesAtLevel) {
      base = monsters.find((m) => m.id === base.evolvesTo)!;
    }
    const s = scaleToLevel(base, level);
    return { ...s, uid: `p${i}`, currentHp: s.maxHp };
  });
}

function imprintFor(party: OwnedMon[], tier: number): Record<string, number> {
  if (tier <= 0) return {};
  const fed = IMPRINT_TIERS[tier - 1].fed;
  return Object.fromEntries(party.map((m) => [chainKeyOf(m), fed]));
}

async function winRate(floor: number, level: number, tier: number): Promise<number> {
  let wins = 0;
  for (const seed of SEEDS) {
    const restore = installSeededRandom(seed);
    const s: SimState = createInitialSim();
    s.party = partyAt(level);
    s.imprint = imprintFor(s.party, tier);
    const r = await fightFloor(s, floor);
    restore();
    if (r.win) wins++;
  }
  return wins / SEEDS.length;
}

/** 80% 승률을 넘기는 최소 레벨. 못 넘기면 null */
async function minLevel(floor: number, tier: number): Promise<number | null> {
  if (await winRate(floor, MAX_LEVEL, tier) < WIN_TARGET) return null;
  let lo = 1, hi = MAX_LEVEL;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await winRate(floor, mid, tier) >= WIN_TARGET) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

const pad = (v: number | null, n = 3) => String(v ?? "—").padStart(n);

console.log(`80% 승률에 필요한 최소 파티 레벨 (${SEEDS.length}판/조건, 물약·장비 없음)\n`);
console.log("  층   각인0   각인3(+15%)   각인5(+25%)   각인5 이득");

const deltas: number[] = [];
for (const floor of FLOORS) {
  const base = await minLevel(floor, 0);
  const t3   = await minLevel(floor, 3);
  const t5   = await minLevel(floor, 5);
  // 같은 레벨에서 각인5 가 실제로 얼마나 여유롭게 이기는지 (문턱 레벨 기준 승률)
  const cushion = base !== null ? await winRate(floor, base, 5) : null;
  if (base !== null && t5 !== null) deltas.push(base - t5);
  console.log(
    `  ${pad(floor)}  Lv.${pad(base)}      Lv.${pad(t3)}        Lv.${pad(t5)}` +
    `        -${base !== null && t5 !== null ? base - t5 : "—"}레벨` +
    (cushion !== null ? `  (문턱 레벨 승률 ${Math.round(cushion * 100)}%)` : ""),
  );
}

const avg = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
console.log(`\n각인 5등급이 낮추는 요구 레벨: 평균 ${avg.toFixed(1)}레벨 (최대 ${Math.max(...deltas)})`);
