/**
 * 처음(플레미 Lv.1)부터 엔딩(50층)까지 한 판을 끝까지 플레이하는 시뮬레이션.
 *
 * 연금술(물약 제작)·아티팩트 제작·장비 모루를 전부 쓰는, "할 수 있는 건 다 하는" 플레이어를 가정한다.
 * 목적은 두 가지다.
 *   1) 정식 플레이로 엔딩에 도달 가능한가, 도달한다면 얼마나 걸리는가
 *   2) 못 간다면 정확히 어디서, 왜 막히는가
 *
 * 실행: npx tsx scripts/sim/run.ts [횟수]
 */
import {
  installSeededRandom, createInitialSim, restorePartyHp, fightFloor, runForest, tryCatch,
  canCraft, craft, equip, levelUpArtifact, enhanceArtifact, synthesize, disassemble, addMaterial,
  FOREST_AREAS, MAX_TOWER_FLOOR, ALL_RECIPES,
  type SimState, type OwnedMon,
} from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { getFloorEnemy } from "../../src/shared/floorTable";
import {
  ARTIFACT_SLOT_MAP, MAX_EQUIPMENT_ENHANCEMENT, canSynthesizeArtifacts,
} from "../../src/shared/craftingUtils";
import type { ArtifactInstance } from "../../src/shared/crafting";

const canSynth = (a: ArtifactInstance, b: ArtifactInstance) => canSynthesizeArtifacts(a, b);
import type { ItemQuality } from "../../src/shared/crafting";

// ─── 플레이어 숙련도 ─────────────────────────────────────────────────────────
// 미니게임을 곧잘 하는 플레이어 가정 (아티팩트 QTE에서 great 정도)
const CRAFT_QUALITY: ItemQuality = "rare";

/** 한 판이 막혔다고 판정하기까지 허용할 연속 실패 사이클 */
const STUCK_LIMIT = Number(process.env.SIM_STUCK ?? 250);
/** 한 판에서 허용할 총 전투 수 상한 — 이걸 넘기면 "사람이 할 짓이 아니다"로 본다 */
const BATTLE_BUDGET = Number(process.env.SIM_BUDGET ?? 4000);

interface RunStats {
  seed: number;
  cleared: boolean;
  wallFloor: number | null;
  towerBattles: number;
  towerLosses: number;
  forestRuns: number;
  totalTurns: number;
  potionsCrafted: number;
  potionsUsed: number;
  artifactsCrafted: number;
  artifactLevelUps: number;
  artifactEnhances: number;
  artifactSynths: number;
  artifactDisassembles: number;
  finalLevels: number[];
  finalParty: string[];
  materialsLeft: Record<string, number>;
  blockedRecipes: Record<string, number>; // 재료가 없어 못 만든 횟수
  lossByFloor: Record<number, number>;
  /** 각 층을 처음 시도할 때의 선봉 레벨 */
  leadLevelAtFloor: Record<number, number>;
  battlesByFloor: Record<number, number>;
  /** 보스층을 처음 시도할 때의 파티 — 벽의 원인을 보려면 레벨만으로는 부족하다 */
  bossParty: Record<number, { name: string; level: number; atk: number; hp: number; pow: number }[]>;
  /** 보스층을 깨기까지 실제로 몇 번 죽었나 (그 층에서 소모한 재도전 사이클) */
  bossRetries: Record<number, number>;
}

/**
 * 몬스터의 "키울 가치" 평가 — 파티에 누구를 남길지 고르는 용도.
 * 진화가 남아 있으면 최종 진화체 기준으로 본다(플레이어도 그렇게 고른다).
 */
function power(m: { id: string; attack: number; maxHp: number; defense: number; moves: { power: number }[] }) {
  let spec = monsters.find((x) => x.id === m.id) ?? null;
  let guard = 0;
  while (spec?.evolvesTo && guard++ < 5) {
    spec = monsters.find((x) => x.id === spec!.evolvesTo) ?? spec;
  }
  const finalForm = spec ?? m;
  const bestMove = Math.max(...finalForm.moves.map((mv) => mv.power), 0);
  return finalForm.attack * bestMove * 0.02 + finalForm.maxHp * 0.5 + finalForm.defense;
}

function partySlots(s: SimState) { return s.party.length; }

async function simulateRun(seed: number): Promise<RunStats> {
  const restore = installSeededRandom(seed);
  const s = createInitialSim();
  const st: RunStats = {
    seed, cleared: false, wallFloor: null,
    towerBattles: 0, towerLosses: 0, forestRuns: 0, totalTurns: 0,
    potionsCrafted: 0, potionsUsed: 0, artifactsCrafted: 0, artifactLevelUps: 0,
    artifactEnhances: 0, artifactSynths: 0, artifactDisassembles: 0,
    finalLevels: [], finalParty: [], materialsLeft: {}, blockedRecipes: {},
    lossByFloor: {}, battlesByFloor: {}, leadLevelAtFloor: {},
    bossParty: {}, bossRetries: {},
  };

  let uid = 1;

  // ── 숲 1회 ───────────────────────────────────────────────────────────────
  const doForest = () => {
    const area = [...FOREST_AREAS].reverse().find((a) => s.bestFloor >= a.unlockFloor) ?? FOREST_AREAS[0];
    const res = runForest(area);
    st.forestRuns++;
    for (const d of res.drops) addMaterial(s, d.id, d.count);

    for (const wild of res.encounters) {
      if (!tryCatch()) continue;
      const caught: OwnedMon = { ...wild, uid: `c${uid++}`, currentHp: wild.maxHp };
      if (partySlots(s) < 3) { s.party.push(caught); continue; }
      // 파티가 찼으면 가장 약한 쪽과 비교해 교체 (보관함은 전투에 영향이 없으므로 생략)
      const weakest = s.party.reduce((a, b) => (power(a) <= power(b) ? a : b));
      // 키워둔 몬스터를 레벨이 훨씬 낮은 신규 포획으로 갈아타지는 않는다.
      // (종족 잠재력이 좋아도 레벨 차이를 메우는 비용이 더 크다)
      const levelOk = caught.level >= weakest.level * 0.8;
      if (levelOk && power(caught) > power(weakest) * 1.15) {
        s.party[s.party.indexOf(weakest)] = caught;
      }
    }
  };

  // ── 만들 수 있는 건 다 만든다 ────────────────────────────────────────────
  const doCrafting = () => {
    for (const r of ALL_RECIPES) {
      if (r.resultItemId === "mothers_cure_potion") continue; // 엔딩 전용, 전투에 무관
      let guard = 0;
      while (canCraft(s, r.id) && guard++ < 20) {
        const made = craft(s, r.id, CRAFT_QUALITY);
        if (made === "potion") st.potionsCrafted++;
        else if (made) {
          st.artifactsCrafted++;
          // 슬롯이 비어 있으면 바로 장착, 아니면 가방에 둔다
          const slot = ARTIFACT_SLOT_MAP[made.itemId];
          const target = s.party.reduce((a, b) => (power(a) >= power(b) ? a : b));
          const cur = s.equipped[target.uid] ?? [];
          if (!cur.some((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot)) equip(s, target.uid, made);
        }
        if (!made) break;
      }
      if (!canCraft(s, r.id)) st.blockedRecipes[r.id] = (st.blockedRecipes[r.id] ?? 0) + 1;
    }
  };

  // ── 모루 전체 사용: 레벨업 → 강화 → 합성 → 남는 건 분해 ───────────────────
  const doAnvil = () => {
    const equippedList = () => Object.values(s.equipped).flat();

    for (let pass = 0; pass < 4; pass++) {
      // 1) 장착 장비를 강화석으로 최대 레벨까지
      for (const a of equippedList()) {
        let guard = 0;
        while (levelUpArtifact(s, a.instanceId) && guard++ < 200) st.artifactLevelUps++;
      }

      // 2) 같은 등급의 여분을 재료로 +5까지 강화
      for (const a of equippedList()) {
        let guard = 0;
        while ((a.enhancement ?? 0) < MAX_EQUIPMENT_ENHANCEMENT && guard++ < 30) {
          const mat = s.artifacts.find((x) => x.quality === a.quality && x.instanceId !== a.instanceId);
          if (!mat) break;                       // 재료가 없으면 중단
          // 실패해도 재료만 잃으므로, 재료가 남아 있는 한 계속 시도한다
          if (enhanceArtifact(s, a.instanceId, mat.instanceId)) st.artifactEnhances++;
        }
      }

      // 3) 만렙·최대강화 짝이 맞으면 합성으로 등급을 올린다
      let synthesized = false;
      for (const a of equippedList()) {
        const partner = s.artifacts.find((x) => canSynth(a, x));
        if (partner && synthesize(s, a.instanceId, partner.instanceId)) {
          st.artifactSynths++;
          synthesized = true;
        }
      }
      if (!synthesized) break;
    }

    // 4) 강화·합성에 쓰이지 못하고 남은 것만 분해해 강화석으로 되돌린다
    //    (같은 등급 여분 1개는 다음 강화용으로 남겨둔다)
    const keep = new Set<string>();
    for (const a of equippedList()) {
      const spare = s.artifacts.find((x) => x.quality === a.quality && !keep.has(x.instanceId));
      if (spare) keep.add(spare.instanceId);
    }
    for (const spare of [...s.artifacts]) {
      if (keep.has(spare.instanceId)) continue;
      disassemble(s, spare.instanceId);
      st.artifactDisassembles++;
    }
  };

  // ── 본 루프 ─────────────────────────────────────────────────────────────
  doForest(); doForest(); doForest();   // 파티 확보 + 초기 재료
  doCrafting(); doAnvil();

  let floor = 1;
  let stuck = 0;

  while (floor <= MAX_TOWER_FLOOR) {
    restorePartyHp(s);
    if (st.leadLevelAtFloor[floor] === undefined) {
      st.leadLevelAtFloor[floor] = Math.max(...s.party.map((m) => m.level));
      if (floor % 10 === 0) {
        st.bossParty[floor] = s.party.map((m) => ({
          name: m.name, level: m.level, atk: m.attack, hp: m.maxHp,
          pow: Math.max(...m.moves.map((mv) => mv.power), 0),
        }));
      }
    }
    const r = await fightFloor(s, floor);
    st.towerBattles++;
    st.battlesByFloor[floor] = (st.battlesByFloor[floor] ?? 0) + 1;
    st.totalTurns += r.turns;
    st.potionsUsed += r.potionsUsed;
    if (!r.win) st.lossByFloor[floor] = (st.lossByFloor[floor] ?? 0) + 1;

    if (r.win) {
      stuck = 0;
      if (floor === MAX_TOWER_FLOOR) { st.cleared = true; break; }
      floor++;
      // 층을 넘길 때마다 자원 정비
      if (floor % 3 === 0) { doCrafting(); doAnvil(); }
      continue;
    }

    // 패배 → 한 사이클 갈고닦기: 숲 1회 + 이미 깬 최고 층 3회 파밍
    st.towerLosses++;
    if (floor % 10 === 0) st.bossRetries[floor] = (st.bossRetries[floor] ?? 0) + 1;
    stuck++;
    if (stuck > STUCK_LIMIT || st.towerBattles > BATTLE_BUDGET) { st.wallFloor = floor; break; }

    doForest();
    doCrafting();
    doAnvil();
    const farmFloor = Math.max(1, s.bestFloor);
    for (let i = 0; i < 3; i++) {
      restorePartyHp(s);
      const fr = await fightFloor(s, farmFloor);
      st.towerBattles++;
      st.battlesByFloor[farmFloor] = (st.battlesByFloor[farmFloor] ?? 0) + 1;
      if (!fr.win) st.lossByFloor[farmFloor] = (st.lossByFloor[farmFloor] ?? 0) + 1;
      st.totalTurns += fr.turns;
      st.potionsUsed += fr.potionsUsed;
      if (!fr.win) { st.towerLosses++; break; }
    }
  }

  st.finalLevels = s.party.map((m) => m.level);
  st.finalParty = s.party.map((m) => m.name);
  st.materialsLeft = { ...s.materials };
  restore();
  return st;
}

// ─── 실행 ────────────────────────────────────────────────────────────────────

const RUNS = Number(process.argv[2] ?? 10);
/** 시드 기준점. 밸런스 후보를 독립 표본으로 다시 재고 싶을 때 옮긴다. */
const SEED_BASE = Number(process.env.SIM_SEED ?? 1000);
const results: RunStats[] = [];
for (let i = 0; i < RUNS; i++) results.push(await simulateRun(SEED_BASE + i));

const avg = (f: (r: RunStats) => number) =>
  results.reduce((a, r) => a + f(r), 0) / results.length;

console.log(`\n══ ${RUNS}회 플레이 시뮬레이션 결과 ══\n`);
console.log("판 | 클리어 | 막힌층 | 탑전투 | 패배 | 숲 | 총턴수 | 최종레벨");
console.log("---|--------|--------|--------|------|-----|--------|----------");
for (const r of results) {
  console.log(
    `${String(r.seed - SEED_BASE + 1).padStart(2)} | ${r.cleared ? "  O   " : "  X   "} | ` +
    `${String(r.wallFloor ?? "-").padStart(6)} | ${String(r.towerBattles).padStart(6)} | ` +
    `${String(r.towerLosses).padStart(4)} | ${String(r.forestRuns).padStart(3)} | ` +
    `${String(r.totalTurns).padStart(6)} | ${r.finalLevels.join("/")}`,
  );
}

console.log(`\n── 평균 ──`);
console.log(`클리어율        : ${(results.filter((r) => r.cleared).length / RUNS * 100).toFixed(0)}%`);
console.log(`막힌 층(평균)   : ${results.filter(r => r.wallFloor).length ? avg((r) => r.wallFloor ?? 0) / (results.filter(r => r.wallFloor).length / RUNS) / RUNS * RUNS : "-"}`);
const walls = results.filter((r) => r.wallFloor !== null).map((r) => r.wallFloor!);
if (walls.length) {
  console.log(`막힌 층         : 평균 ${(walls.reduce((a, b) => a + b, 0) / walls.length).toFixed(1)}층 ` +
    `(최소 ${Math.min(...walls)} / 최대 ${Math.max(...walls)})`);
}
console.log(`탑 전투 수      : ${avg((r) => r.towerBattles).toFixed(1)}`);
console.log(`패배 수         : ${avg((r) => r.towerLosses).toFixed(1)}`);
console.log(`숲 탐험 수      : ${avg((r) => r.forestRuns).toFixed(1)}`);
console.log(`총 전투 턴      : ${avg((r) => r.totalTurns).toFixed(0)}`);
console.log(`제작 물약       : ${avg((r) => r.potionsCrafted).toFixed(1)}`);
console.log(`사용 물약       : ${avg((r) => r.potionsUsed).toFixed(1)}`);
console.log(`제작 아티팩트   : ${avg((r) => r.artifactsCrafted).toFixed(1)}`);
console.log(`장비 레벨업     : ${avg((r) => r.artifactLevelUps).toFixed(1)}`);
console.log(`장비 강화       : ${avg((r) => r.artifactEnhances).toFixed(1)}`);
console.log(`장비 합성       : ${avg((r) => r.artifactSynths).toFixed(1)}`);
console.log(`장비 분해       : ${avg((r) => r.artifactDisassembles).toFixed(1)}`);
console.log(`최종 파티       : ${results[0].finalParty.join(", ")} (1판 기준)`);

console.log(`\n── 층별 난이도 (${RUNS}판 합계, 패배가 많은 순 상위 15) ──`);
{
  const lossTotal: Record<number, number> = {};
  const battleTotal: Record<number, number> = {};
  for (const r of results) {
    for (const [f, n] of Object.entries(r.lossByFloor)) lossTotal[+f] = (lossTotal[+f] ?? 0) + n;
    for (const [f, n] of Object.entries(r.battlesByFloor)) battleTotal[+f] = (battleTotal[+f] ?? 0) + n;
  }
  const rows = Object.keys(battleTotal).map(Number)
    .map((f) => ({ f, loss: lossTotal[f] ?? 0, battles: battleTotal[f], rate: (lossTotal[f] ?? 0) / battleTotal[f] }))
    .sort((a, b) => b.loss - a.loss).slice(0, 15);
  console.log("층  | 전투 | 패배 | 패배율");
  for (const r of rows) {
    console.log(`${String(r.f).padStart(3)} | ${String(r.battles).padStart(4)} | ${String(r.loss).padStart(4)} | ${(r.rate * 100).toFixed(0)}%`);
  }
}

console.log(`\n── 층 도달 시점의 파티 레벨 (${RUNS}판 평균) ──`);
{
  console.log("층  | 첫 도전 시 최고레벨 | 적 레벨 | 차이");
  for (const f of [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    const vals = results.map((r) => r.leadLevelAtFloor[f]).filter((v) => v !== undefined);
    if (vals.length === 0) continue;
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const enemyLv = f === 10 ? 11 : f === 20 ? 20 : f === 30 ? 31 : f === 40 ? 40 : f === 50 ? 51 : f;
    console.log(`${String(f).padStart(3)} | ${m.toFixed(1).padStart(19)} | ${String(enemyLv).padStart(7)} | ${(m - enemyLv).toFixed(1).padStart(5)}`);
  }
}

console.log(`\n── 보스 벽 (${RUNS}판) ──`);
{
  console.log("층  | 재도전 | 보스: HP/공/방 | 첫 도전 파티 (1판 기준)");
  for (const f of [10, 20, 30, 40, 50]) {
    const retries = results.map((r) => r.bossRetries[f] ?? 0);
    if (!results.some((r) => r.bossParty[f])) continue;
    const mean = retries.reduce((a, b) => a + b, 0) / RUNS;
    const e = getFloorEnemy(f, "none");
    const party = (results.find((r) => r.bossParty[f])!.bossParty[f])
      .map((m) => `${m.name} Lv${m.level}(공${m.atk}/HP${m.hp}/위력${m.pow})`).join(" ");
    console.log(
      `${String(f).padStart(3)} | ${mean.toFixed(1).padStart(6)} | ` +
      `${String(e.maxHp).padStart(4)}/${String(e.attack).padStart(3)}/${String(e.defense).padStart(3)} | ${party}`,
    );
  }
}

console.log(`\n── 남은 재료(1판 기준) ──`);
console.log(JSON.stringify(results[0].materialsLeft));

console.log(`\n── 재료가 없어 못 만든 레시피(1판 기준) ──`);
for (const [id, n] of Object.entries(results[0].blockedRecipes)) {
  const r = ALL_RECIPES.find((x) => x.id === id)!;
  console.log(`  ${r.name.padEnd(12)} ${n}회 시도 실패 — 필요: ${r.costs.map((c) => `${c.name}×${c.amount}`).join(", ")}`);
}

// 참고: 몬스터별 기술 위력 상한 (레벨업으로 기술을 배우지 않으므로 평생 고정)
console.log(`\n── 종족별 최대 기술 위력 (레벨업 습득이 없어 평생 고정) ──`);
for (const m of monsters) {
  console.log(`  ${m.name.padEnd(8)} ${String(Math.max(...m.moves.map((mv) => mv.power))).padStart(3)} ` +
    `(${m.moves.map((mv) => mv.name).join(", ")})`);
}
