/**
 * 처음부터 엔딩까지 여러 판 돌리고 표를 찍는다.
 *
 * 판을 도는 것 자체는 `playRun.ts` 가 한다. 여기는 그 결과를 읽는 쪽이다.
 *
 * 실행: npx tsx scripts/sim/run.ts [횟수]
 *   SIM_SEED=7000  독립 표본으로 다시 재고 싶을 때
 *   SIM_QUESTS=0   퀘스트 보상을 끄고 재고 싶을 때
 */
import { getFloorEnemy } from "../../src/shared/floorTable";
import { ALL_RECIPES } from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { simulateRun, USE_QUESTS, type RunStats } from "./playRun";


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
console.log(`숲 탐험 수      : ${avg((r) => r.forestRuns).toFixed(1)} (강제 퇴각 ${avg((r) => r.forcedRetreats).toFixed(1)})`);
console.log(`각인에 먹인 수  : ${avg((r) => r.imprintFed).toFixed(1)}`);
console.log(`캠프 복귀       : ${avg((r) => r.campReturns).toFixed(1)}`);
console.log(`총 전투 턴      : ${avg((r) => r.totalTurns).toFixed(0)}`);
console.log(`제작 물약       : ${avg((r) => r.potionsCrafted).toFixed(1)}`);
console.log(`사용 물약       : ${avg((r) => r.potionsUsed).toFixed(1)}`);
console.log(`제작 아티팩트   : ${avg((r) => r.artifactsCrafted).toFixed(1)}`);
console.log(`장비 레벨업     : ${avg((r) => r.artifactLevelUps).toFixed(1)}`);
console.log(`장비 강화       : ${avg((r) => r.artifactEnhances).toFixed(1)}`);
console.log(`장비 합성       : ${avg((r) => r.artifactSynths).toFixed(1)}`);
console.log(`장비 분해       : ${avg((r) => r.artifactDisassembles).toFixed(1)}`);
console.log(`최종 파티       : ${results[0]?.finalParty.join(", ") ?? "-"} (1판 기준)`);

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
    // 손으로 적으면 틀린다. 보스도 관문도 floor+2 인데 예전 표는 10→11, 20→20 으로 적혀 있었다
    const enemyLv = getFloorEnemy(f, "none").level;
    console.log(`${String(f).padStart(3)} | ${m.toFixed(1).padStart(19)} | ${String(enemyLv).padStart(7)} | ${(m - enemyLv).toFixed(1).padStart(5)}`);
  }
}

console.log(`\n── 보스 벽 (${RUNS}판) ──`);
{
  console.log("층  | 재도전 | 첫도전승률 | 입장HP | 실제 장비(평균) | 각인 | 물약(평균) | 첫 도전 파티(평균)");
  for (const f of [10, 15, 20, 25, 30, 35, 40, 45, 50]) {
    // ⚠️ 재도전은 n0층만 센다(bossRetries). 관문의 0.0 은 "안 졌다"가 아니라 "안 센다"다.
    //    첫도전 승률 열을 봐라.
    const retries = results.map((r) => r.bossRetries[f] ?? 0);
    if (!results.some((r) => r.bossParty[f])) continue;
    const mean = retries.reduce((a, b) => a + b, 0) / RUNS;
    // ⚠️ 파티도 평균을 낸다. 예전엔 `results.find(...)` 로 한 판만 뽑아 적었는데,
    // 나머지 열은 40판 평균이라 표가 판마다 흔들렸다. gateCheck 이 이 값을 그대로
    // 받아 쓰므로, 한 칸만 표본이면 그 검사 전체가 같이 흔들린다.
    const parties = results.map((r) => r.bossParty[f]).filter(Boolean);
    const slots = Math.max(...parties.map((p) => p.length));
    const party = Array.from({ length: slots }, (_, i) => {
      const slot = parties.map((p) => p[i]).filter(Boolean);
      if (!slot.length) return "";
      // 종족은 최빈값, 레벨은 평균. "그 자리에 대개 누가 몇 레벨로 서는가"
      const byName: Record<string, number> = {};
      for (const m of slot) byName[m.name] = (byName[m.name] ?? 0) + 1;
      const name = Object.entries(byName).sort((a, b) => b[1] - a[1])[0][0];
      const lv = slot.reduce((n, m) => n + m.level, 0) / slot.length;
      const atk = slot.reduce((n, m) => n + m.atk, 0) / slot.length;
      return `${name} Lv${lv.toFixed(0)}(공${atk.toFixed(0)})`;
    }).filter(Boolean).join(" ");
    // 장비·각인은 판마다 다르므로 평균을 낸다. 합격선은 한 판이 아니라 이 평균 위에 서야 한다
    const tries = results.map((r) => r.bossFirstTry[f]).filter((v) => v !== undefined);
    const firstWin = tries.length ? Math.round((tries.filter(Boolean).length / tries.length) * 100) : 0;
    const hps = results.map((r) => r.bossHpRatio[f]).filter((v) => v !== undefined);
    const hpAvg = hps.length ? hps.reduce((a, b) => a + b, 0) / hps.length : 1;
    const pots = results.map((r) => r.bossPotions[f]).filter(Boolean);
    const potAvg: Record<string, number> = {};
    for (const p of pots) for (const [k, v] of Object.entries(p)) potAvg[k] = (potAvg[k] ?? 0) + v / pots.length;
    const potStr = Object.entries(potAvg).filter(([, v]) => v >= 0.5)
      .map(([k, v]) => `${k.replace("_potion", "").replace("strong_", "s")}${v.toFixed(0)}`).join(" ") || "-";
    const kits = results.map((r) => r.bossKit[f]).filter(Boolean);
    const rank = ["normal", "rare", "elite"];
    const qAvg = kits.length
      ? rank[Math.round(kits.reduce((n, k) => n + Math.max(0, rank.indexOf(k.quality)), 0) / kits.length)]
      : "-";
    const lAvg = kits.length ? kits.reduce((n, k) => n + k.level, 0) / kits.length : 0;
    const eAvg = kits.length ? kits.reduce((n, k) => n + k.enh, 0) / kits.length : 0;
    const tAvg = kits.length ? kits.reduce((n, k) => n + k.tier, 0) / kits.length : 0;
    console.log(
      `${String(f).padStart(3)} | ${mean.toFixed(1).padStart(6)} | ` +
      `${`${firstWin}%`.padStart(10)} | ${`${(hpAvg * 100).toFixed(0)}%`.padStart(6)} | ` +
      `${`${qAvg}:${lAvg.toFixed(0)}:${eAvg.toFixed(1)}`.padStart(15)} | ${tAvg.toFixed(1).padStart(4)} | ${potStr.padStart(22)} | ${party}`,
    );
  }
}

console.log(`\n── 퀘스트 (${USE_QUESTS ? "보상 받음" : "보상 안 받음 · SIM_QUESTS=0"}) ──`);
{
  const done = results.map((r) => r.questsDone.length);
  console.log(`평균 완료 ${(done.reduce((a, b) => a + b, 0) / RUNS).toFixed(1)}개`);
  const byQuest = new Map<string, { n: number; floors: number[] }>();
  for (const r of results) {
    for (const q of r.questsDone) {
      const v = byQuest.get(q.questId) ?? { n: 0, floors: [] };
      v.n++; v.floors.push(q.atFloor); byQuest.set(q.questId, v);
    }
  }
  for (const [id, v] of byQuest) {
    const mean = v.floors.reduce((a, b) => a + b, 0) / v.floors.length;
    console.log(`  ${id.padEnd(24)} ${String(v.n).padStart(3)}/${RUNS}판 · 평균 ${mean.toFixed(1)}층에서 받음`);
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
