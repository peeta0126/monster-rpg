/**
 * 관문이 장비로 넘는 벽인지 한 번에 확인한다.
 *
 * ⚠️ 2026-09-01 에 입력을 다시 세웠다. 예전에는 `run.ts` 40판이 낸 파티·장비·각인·
 * 입장HP·물약을 **평균 내서** 상수표(GATES)에 손으로 옮겨 적고, 그 한 벌로 60판을
 * 싸웠다. 그게 실제와 어긋났다.
 *
 *   · 승률은 자원에 대해 시그모이드다. 평균 장비로 잰 승률은 승률의 평균이 아니다
 *     (f(E[x]) ≠ E[f(x)]). 벽인 층에서 정확히 갈렸다 — 같은 40층을 이 검사는 2%,
 *     run.ts 는 18% 로 재고 있었다. 10층은 100% ↔ 33% 로 세 배 벌어졌다.
 *   · 반올림이 저층에서 크게 먹었다. 실측 강화 +1.6 · 각인 1.7 이 표에서 +2 · 2 가
 *     되는데, 10층은 그 한 칸으로 94% → 100% 가 된다.
 *   · 밸런스를 만질 때마다 사람이 표를 다시 옮겨 적어야 했고, 안 옮기면 옛 밸런스가
 *     만든 파티로 새 밸런스를 재게 됐다.
 *
 * 지금은 `playRun.simulateRun` 을 직접 불러 **판마다 다른 실제 스냅샷**을 표본으로 쓴다.
 * 손으로 옮겨 적는 절차가 없어졌고, 밸런스를 고치면 실측 열이 저절로 따라온다.
 *
 * 네 열의 뜻은 "장비를 얼마나 모았나" 가 아니라 **어떤 플레이어인가** 다.
 *   맨몸:       같은 파티인데 장비·각인이 없는 사람
 *   실측:       평균적인 판. 이 열이 곧 사람들이 겪는 난이도다
 *   한 발 앞선: 제작대에 한 번 더 다녀온 사람(장비 레벨 ×1.6+2 · 강화 +1)
 *   완비:       그 층에서 가능한 최선(elite · 층 레벨 · +5 · 각인 만렙 · 만렙HP · 넉넉한 물약)
 *
 * 실행: npx tsx scripts/sim/gateCheck.ts [판수]
 *   GATE_RUNS=24  표본으로 쓸 실제 판 수(기본 24). 늘리면 실측 열이 안정된다
 */
import { installSeededRandom, fightFloor, type SimState } from "./gameModel";
import { DEFAULT_STORY_FLAGS } from "../../src/shared/storyFlags";
import { getFloorEnemy, isBossFloor } from "../../src/shared/floorTable";
import { MAX_IMPRINT_TIER } from "../../src/monster/imprint";
import { MAX_EQUIPMENT_ENHANCEMENT } from "../../src/shared/craftingUtils";
import type { ArtifactInstance } from "../../src/shared/crafting";
import { simulateRun } from "./playRun";
import {
  freshPotions, imprintAt, makeGear, makeParty, parseGear,
} from "./loadout";

const TRIALS = Number(process.argv[2] ?? 60);
/** 표본으로 쓸 실제 판 수. 판마다 파티도 장비도 가방도 다르다 */
const SAMPLE_RUNS = Number(process.env.GATE_RUNS ?? 24);
const GATE_FLOORS = [10, 15, 20, 25, 30, 35, 40, 45, 50];

/** 어떤 판이 그 층에 도착했을 때의 상태 한 벌 */
interface Snapshot {
  /** `종족id:레벨` 목록. 벤치가 선봉보다 낮은 것까지 그대로 */
  party: string;
  /**
   * 파티원 각자가 실제로 낀 장비(party 와 같은 순서).
   *
   * 선봉 장비 하나를 셋에게 복사하지 않는다. 실제 판은 벤치가 맨몸이거나 한 칸만
   * 낀 경우가 흔한데, 그걸 완비로 세면 이 검사가 실제보다 20~40%p 후해진다.
   */
  gearPerMon: ArtifactInstance[][];
  /** 각인 누적(계열키 → 먹인 수). 계열마다 다르다 */
  imprint: Record<string, number>;
  /** 표시용. 선봉 기준 `등급:레벨:강화` */
  gearLabel: string;
  tier: number;
  /** 파티원 각자의 입장 HP 비율(party 와 같은 순서). 실제 판은 만렙으로 들어서지 않는다 */
  entryHp: number[];
  potions: Record<string, number>;
  /** 그 판의 첫 도전 승패. 실측 열이 이것과 크게 어긋나면 검사가 틀린 것이다 */
  firstTry: boolean;
}

/** 실제 판을 돌려 층별 스냅샷을 모은다 */
async function collectSamples(): Promise<Map<number, Snapshot[]>> {
  const byFloor = new Map<number, Snapshot[]>(GATE_FLOORS.map((f) => [f, []]));
  const seedBase = Number(process.env.SIM_SEED ?? 1000);

  for (let i = 0; i < SAMPLE_RUNS; i++) {
    const r = await simulateRun(seedBase + i);
    for (const f of GATE_FLOORS) {
      const party = r.bossParty[f];
      const kit = r.bossKit[f];
      if (!party || !kit) continue;   // 그 판이 그 층까지 못 갔다
      byFloor.get(f)!.push({
        party: party.map((m) => `${m.id}:${m.level}`).join(","),
        gearPerMon: r.bossGear[f] ?? party.map(() => []),
        imprint: r.bossImprint[f] ?? {},
        gearLabel: kit.quality === "-" ? "-" : `${kit.quality}:${kit.level}:${kit.enh}`,
        tier: kit.tier,
        entryHp: party.map((m) => m.hpRatio),
        potions: r.bossPotions[f] ?? {},
        firstTry: r.bossFirstTry[f] ?? false,
      });
    }
  }
  return byFloor;
}

/**
 * 제작대에 한 번 더 다녀온 상태. 장비 레벨 1.6배 +2 · 강화 +1.
 *
 * 비례로 두는 게 중요하다. 고정 +10 으로 뒀더니 10층(레벨 3 → 13)에서는 네 배가 되고
 * 50층(21 → 31)에서는 1.5배가 돼서, 같은 열이 층마다 다른 뜻이 됐다.
 */
function stepUp(a: ArtifactInstance): { level: number; enhancement: number } {
  return {
    // level·enhancement 는 옛 세이브 호환으로 옵셔널이다. 없으면 만든 직후로 본다
    level: Math.round((a.level ?? 1) * 1.6) + 2,
    enhancement: Math.min(MAX_EQUIPMENT_ENHANCEMENT, (a.enhancement ?? 0) + 1),
  };
}

/** 그 층에서 가능한 최선 */
function fullKit(floor: number): string {
  return `elite:${floor}:5`;
}

type Column = "bare" | "real" | "ahead" | "full";

/**
 * 표본을 하나씩 돌아가며 싸운다.
 *
 * ⚠️ 표본을 평균 내지 않는다. 그게 이 도구가 실제와 어긋났던 원인이다.
 * 시행 t 는 표본 t 를 그대로 쓰고, 표본 수보다 시행이 많으면 다시 돈다.
 */
async function winRate(floor: number, samples: Snapshot[], column: Column): Promise<number> {
  if (samples.length === 0) return -1;
  let wins = 0;

  for (let t = 0; t < TRIALS; t++) {
    const sample = samples[t % samples.length];
    const restore = installSeededRandom(31000 + t);

    // 완비 열만 만렙 HP 에 넉넉한 물약으로 들어선다. "완비하고 정비까지 마친 사람"이다.
    // ⚠️ 물약은 시행마다 새로 만든다. 한 벌을 돌려쓰면 앞 시행이 다 마셔 버린다
    const potions = column === "full" ? freshPotions(floor) : { ...sample.potions };

    const party = await makeParty(sample.party);
    party.forEach((m, i) => {
      const ratio = column === "full" ? 1 : (sample.entryHp[i] ?? 1);
      m.currentHp = Math.max(1, Math.round(m.maxHp * ratio));
    });

    const equipped: Record<string, ArtifactInstance[]> = {};
    party.forEach((m, i) => {
      const worn = sample.gearPerMon[i] ?? [];
      equipped[m.uid] =
        column === "bare"  ? []
        : column === "real"  ? worn.map((a) => ({ ...a }))
        // 제작대에 한 번 더 다녀온 사람. 낀 것을 그대로 올린다 — 안 낀 칸은 여전히 빈 칸이다
        : column === "ahead" ? worn.map((a) => ({ ...a, ...stepUp(a) }))
        : makeGear(m.uid, parseGear(fullKit(floor)));
    });

    const imprint =
      column === "bare" ? {}
      : column === "full" ? imprintAt(party, MAX_IMPRINT_TIER)
      : { ...sample.imprint };

    const s: SimState = {
      party, imprint, materials: {},
      potions,
      artifacts: [], equipped, bestFloor: floor - 1,
      dexCaught: [],
      storyFlags: { ...DEFAULT_STORY_FLAGS, met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true },
      questStatus: {},
    };
    if ((await fightFloor(s, floor)).win) wins++;
    restore();
  }
  return Math.round((wins / TRIALS) * 100);
}

/**
 * 합격선.
 *
 * 보스는 재도전 2~3회가 설계값이다. 승률로 옮기면 1/(1+재도전) = 25~33% 이고,
 * 여유를 둬서 25~45% 로 잡는다. 관문은 "제작대까지 돌아갈 일은 아닌 검문" 이라
 * 대부분 한 번에 넘어야 하고, 그래서 60~88% 다.
 * 완비 열만 90%(관문 95%) 위여야 한다. 그게 "완비하면 넘는다" 는 이 게임의 약속이다.
 */
function verdict(floor: number, bare: number, real: number, ahead: number, full: number): string {
  const fails: string[] = [];
  // 맨몸에는 상한만 건다. 예전에는 관문에 "35~60%" 로 하한도 걸어 뒀는데, 그건
  // 파티가 과대평가돼 있던 시절의 값이다. 25층까지 아티팩트를 하나도 안 만든 사람은
  // 실재하지 않으므로, 그 사람이 관문을 절반쯤 넘어야 할 이유도 없다.
  if (isBossFloor(floor)) {
    if (bare > 25) fails.push(`맨몸 ${bare}%>25`);
    if (real < 25 || real > 45) fails.push(`실측 ${real}%∉25~45`);
    if (ahead < 60 || ahead > 90) fails.push(`앞선 ${ahead}%∉60~90`);
    if (full < 90) fails.push(`완비 ${full}%<90`);
  } else {
    if (bare > 60) fails.push(`맨몸 ${bare}%>60`);
    if (real < 60 || real > 88) fails.push(`실측 ${real}%∉60~88`);
    if (ahead < 85) fails.push(`앞선 ${ahead}%<85`);
    if (full < 95) fails.push(`완비 ${full}%<95`);
  }
  return fails.length ? `✗ ${fails.join(" · ")}` : "✓";
}

async function main() {
  const samples = await collectSamples();

  console.log(`
관문 검사 (${SAMPLE_RUNS}판 실측을 표본으로, 층마다 ${TRIALS}회 시행)
`);
  console.log(`  층 | 종류 |  맨몸    실측  한발앞선    완비 | 실제판 | 판정`);
  console.log(`-----|------|----------------------------------|--------|------`);

  for (const floor of GATE_FLOORS) {
    const ss = samples.get(floor)!;
    const bare  = await winRate(floor, ss, "bare");
    const real  = await winRate(floor, ss, "real");
    const ahead = await winRate(floor, ss, "ahead");
    const full  = await winRate(floor, ss, "full");
    // 실제 판의 첫 도전 승률. 실측 열이 이것과 크게 어긋나면 이 검사가 틀린 것이다
    const actual = ss.length ? Math.round(ss.filter((x) => x.firstTry).length / ss.length * 100) : -1;
    const kind = isBossFloor(floor) ? "보스" : "관문";
    console.log(
      `  ${String(floor).padStart(2)} | ${kind} |` +
      `${`${bare}%`.padStart(7)}${`${real}%`.padStart(8)}${`${ahead}%`.padStart(10)}${`${full}%`.padStart(8)} | ` +
      `${`${actual}%`.padStart(6)} | ` +
      verdict(floor, bare, real, ahead, full),
    );
  }

  console.log("\n적 실효 능력치와 그 층에 도착한 판들");
  for (const floor of GATE_FLOORS) {
    const ss = samples.get(floor)!;
    const e = getFloorEnemy(floor, "none");
    const gears = [...new Set(ss.map((x) => x.gearLabel))].slice(0, 3).join(" / ");
    const hp = ss.length
      ? Math.round(ss.reduce((a, x) => a + x.entryHp.reduce((n, v) => n + v, 0) / x.entryHp.length, 0) / ss.length * 100)
      : 0;
    console.log(
      `  ${String(floor).padStart(2)}층 ${e.name.padEnd(12)} Lv${String(e.level).padStart(2)}` +
      ` HP${String(e.maxHp).padStart(5)} 공${String(e.attack).padStart(4)} 방${String(e.defense).padStart(4)} 속${String(e.speed).padStart(4)}` +
      `  표본 ${String(ss.length).padStart(2)}판 · 입장HP ${hp}% · 장비 ${gears}`,
    );
  }
}

main();
