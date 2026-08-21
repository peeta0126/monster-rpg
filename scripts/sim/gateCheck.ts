/**
 * 관문이 **장비로 넘는 벽인지** 한 번에 확인한다.
 *
 * ⚠️ **2026-08-21 에 이 도구를 통째로 다시 세웠다.** 예전에는 파티·장비·물약·HP 를 전부
 * 손으로 가정하고 있었고, 그 가정이 실제 판보다 훨씬 후했다. 그래서 같은 50층 보스를
 * 이 도구는 "정규 장비 63% · 각인까지 100%" 로, `scripts/sim/run.ts` 는 "첫 도전 승률
 * 8% · 재도전 4.5회" 로 재고 있었다. 두 도구가 반대를 말하면 밸런스는 잴 수가 없다.
 *
 * 지금은 네 축이 전부 run.ts 실측이다 — 파티 구성과 레벨, 장비, 각인 등급, 입장 HP,
 * 가방의 물약. 그렇게 맞추자 어려운 층이 실제와 겹쳤다(20층 10%↔10% · 25층 100%↔100% ·
 * 45층 100%↔95%).
 *
 * ⚠️ **지금 이 검사는 대부분 빨간불이다. 그게 게임의 실제 상태다.**
 * 실측 열이 25층 100% · 40층 1% · 45층 100% · 50층 8% 로 톱니처럼 튄다 — 평균적인
 * 플레이어에게 어떤 층은 공짜고 어떤 층은 벽이다. 예전 표는 이걸 매끈한 계단으로
 * 보여 주고 있었다(정규 60~78% 가 나란히).
 *
 * 초록불로 만들려면 배수를 만지면 되는데, **그렇게 하면 수렴하지 않는다.** 보스를
 * 올리면 플레이어가 그 앞에서 더 파밍하게 되고, 그러면 뒷층의 실측 입력이 통째로
 * 바뀐다. 실제로 세 바퀴 돌려 봤더니 이 표는 아홉 층 전부 초록이 됐는데 실제 판은
 * 30층 재도전 6.4회 · 탑 전투 206회(기준선 136)로 나빠졌다. 그래서 배수는 되돌렸다.
 *
 * 고치려면 배수가 아니라 **입력 쪽**이어야 한다 — 40·50층에 회복 물약이 없는 것,
 * 파티가 모시 계열 하나로 수렴하는 것(로스터가 14종뿐), 관문 앞에서 정비를 안 하는 것.
 * 그게 풀리면 그때 배수는 저절로 좁은 범위에 들어온다.
 *
 * 실행: npx tsx scripts/sim/gateCheck.ts [판수]
 * 실측 갱신: npx tsx scripts/sim/run.ts 40 → "보스 벽" 절의 값을 아래 표에 옮긴다.
 *   ⚠️ 밸런스를 만졌으면 **반드시** 다시 뜬다. 안 그러면 옛 밸런스가 만든 파티로
 *   새 밸런스를 재게 되고, 그 값은 아무 뜻이 없다.
 */
import { installSeededRandom, fightFloor, type SimState } from "./gameModel";
import { DEFAULT_STORY_FLAGS } from "../../src/shared/storyFlags";
import { getFloorEnemy, isBossFloor } from "../../src/shared/floorTable";
import { MAX_IMPRINT_TIER } from "../../src/monster/imprint";
import type { ArtifactInstance } from "../../src/shared/crafting";
import {
  freshPotions, imprintAt, makeGear, makeParty, parseGear, type GearSpec,
} from "./loadout";

const TRIALS = Number(process.argv[2] ?? 60);

interface GateSpec {
  floor: number;
  /** 그 층에 도착한 **평균적인 판**의 파티. `종족id:레벨` 목록 — 벤치가 선봉보다 낮은 것까지 그대로 */
  party: string;
  /** 그 층에 도착한 **평균적인 판**이 실제로 낀 장비. scripts/sim/run.ts 실측(40판 평균) */
  actual: string;
  /** 같은 시점의 실제 각인 등급 */
  actualTier: number;
  /**
   * 그 층에 **들어설 때의 파티 평균 HP 비율**. 실제 판은 만렙 회복으로 들어가지 않는다 —
   * 사람이 하듯 평균 HP 가 절반 아래로 떨어져야 캠프에 내려가기 때문에 73~84% 로 들어선다.
   * 이걸 빼먹으면 이 검사가 실제보다 훨씬 후하게 나온다(40층 실측 13% ↔ 만렙 가정 100%).
   */
  entryHp: number;
  /**
   * 그 층에 들어설 때 가방에 실제로 있던 물약(40판 평균, 반올림).
   *
   * ⚠️ **40층부터 회복 물약이 0 개다.** 해독제와 공격 버프만 남는다 — 제작 경제가
   * 후반의 회복 소모를 못 따라간다(한 판에 94개 만들고 101개 쓴다). 예전 이 검사는
   * 그 자리에 강력 회복 물약 4 + 맥스 물약 2 를 쥐여 주고 있었고, 그래서 50층을
   * 63~100% 로 재고 있었다. 실제 첫 도전 승률은 8% 다.
   */
  potions: Record<string, number>;
}

/**
 * ⚠️ **이 표는 가정이 아니라 실측이다.**
 *
 * 예전에는 층마다 "정규 장비" 를 손으로 적어 뒀다(40층 elite:20:3, 50층 elite:40:5).
 * 그런데 `scripts/sim/run.ts` 로 실제 판을 재 보니 40층에 도착한 파티는 rare:15:2.7,
 * 50층은 elite:25:1.7 이었다 — 표가 아무도 겪지 않는 상황을 재고 있었다.
 *
 * 그래서 승률이 두 도구에서 정반대로 나왔다. 이 표에서 50층 보스는 "정규 장비 63% ·
 * 각인까지 100%" 인데, 실제 판에서는 재도전 4.5회(승률 18%)짜리 벽이었다. 각인을 깎아
 * 100% 를 내리려 하면 이 표는 거의 안 움직이고 실제 플레이어만 맞는 이유가 그것이다.
 *
 * 이제 가운데 열을 실측에 못 박고, 그 위아래로 한 발씩 둔다. 세 열의 뜻이 이렇다:
 *
 * ⚠️ 실측 열의 장비 등급이 늘 rare 인 것은 `scripts/sim/run.ts` 의 `CRAFT_QUALITY` 가
 * rare 로 못 박혀 있어서다 — 미니게임을 보통으로 하는 플레이어를 가정한 값이다. 그래서
 * 이 표의 세 열은 "장비를 얼마나 모았나" 가 아니라 **어떤 플레이어인가** 로 갈린다.
 *
 *   맨몸        — 같은 파티인데 장비·각인이 없는 사람
 *   실측        — **평균적인 판**. 이 열이 곧 사람들이 겪는 난이도다
 *   한 발 앞선  — 제작대에 한 번 더 다녀온 사람(장비 레벨 +10 · 강화 +1)
 *   완비        — 그 층에서 가능한 최선(elite · 층 레벨 · +5 · 각인 만렙)
 *
 * 실측을 다시 뜨는 법: `npx tsx scripts/sim/run.ts 40` → "보스 벽" 절의 장비·각인 열.
 * 밸런스를 만졌으면 그 값을 여기 옮겨 적고 나서 이 검사를 돌려야 한다 — 안 그러면
 * 또 옛 가정을 재게 된다.
 */
const GATES: GateSpec[] = [
  { floor: 10, party: "mossy:8,mossy:7,mossy:7", actual: "rare:3:2", actualTier: 2, entryHp: 0.85, potions: { potion: 9, attack_buff: 5, antidote: 16, strong_attack_buff: 1 } },
  { floor: 15, party: "mossy:13,mossy:12,mossy:12", actual: "rare:3:3", actualTier: 2, entryHp: 0.83, potions: { potion: 1, attack_buff: 5, antidote: 14 } },
  { floor: 20, party: "mossevo:20,mossy:18,mossy:19", actual: "rare:6:4", actualTier: 2, entryHp: 0.81, potions: { attack_buff: 5, antidote: 15, strong_attack_buff: 1 } },
  { floor: 25, party: "mossevo:25,mossevo:24,mossevo:24", actual: "rare:6:2", actualTier: 3, entryHp: 0.74, potions: { attack_buff: 5, antidote: 12, max_potion: 4, strong_attack_buff: 3 } },
  { floor: 30, party: "mossevo:28,mossevo:27,mossevo:27", actual: "rare:6:2", actualTier: 3, entryHp: 0.79, potions: { attack_buff: 5, antidote: 11, max_potion: 2, strong_attack_buff: 2 } },
  { floor: 35, party: "mossevo:33,mossevo:32,mossevo:31", actual: "rare:10:3", actualTier: 3, entryHp: 0.81, potions: { potion: 1, attack_buff: 5, antidote: 10, max_potion: 1, strong_attack_buff: 1 } },
  { floor: 40, party: "mossyfinal:37,mossevo:36,mossevo:36", actual: "rare:13:3", actualTier: 3, entryHp: 0.82, potions: { potion: 1, attack_buff: 5, antidote: 4 } },
  // 45층이 40층보다 장비가 얇은 건 오타가 아니다 — 40층 보스를 넘느라 분해로 재료를
  // 끌어 쓴 직후라 실제로 그렇게 나온다(rare:8:0.6). 관문이 관문 노릇을 하는 자리다.
  { floor: 45, party: "mossyfinal:42,mossyfinal:42,mossyfinal:43", actual: "rare:8:1", actualTier: 4, entryHp: 0.78, potions: { potion: 1, attack_buff: 5, antidote: 1 } },
  { floor: 50, party: "mossyfinal:46,mossyfinal:45,mossyfinal:46", actual: "rare:21:2", actualTier: 4, entryHp: 0.79, potions: { attack_buff: 5, antidote: 1 } },
];

/**
 * 실측에서 제작대에 한 번 더 다녀온 상태 — 장비 레벨 1.6배 +2 · 강화 +1.
 *
 * 비례로 두는 게 중요하다. 고정 +10 으로 뒀더니 10층(레벨 3 → 13)에서는 네 배가 되고
 * 50층(21 → 31)에서는 1.5배가 돼서, 같은 열이 층마다 다른 뜻이 됐다.
 */
function oneStepUp(spec: string): string {
  const [q, lv, en] = spec.split(":");
  return `${q}:${Math.round(Number(lv) * 1.6) + 2}:${Number(en) + 1}`;
}

/** 그 층에서 가능한 최선 */
function fullKit(floor: number): string {
  return `elite:${floor}:5`;
}

async function winRate(
  floor: number, partySpec: string, gear: GearSpec | null, tier: number,
  entryHp: number, potions: Record<string, number>,
): Promise<number> {
  let wins = 0;
  for (let t = 0; t < TRIALS; t++) {
    const restore = installSeededRandom(31000 + t);
    const party = await makeParty(partySpec);
    // 만렙으로 들어서지 않는다 — 실제 판의 입장 HP 를 그대로 쓴다
    for (const m of party) m.currentHp = Math.max(1, Math.round(m.maxHp * entryHp));
    const equipped: Record<string, ArtifactInstance[]> = {};
    for (const m of party) equipped[m.uid] = makeGear(m.uid, gear);
    const s: SimState = {
      party, imprint: imprintAt(party, tier), materials: {},
      potions: { ...potions },
      artifacts: [], equipped, bestFloor: floor - 1,
      dexCaught: [], storyFlags: { ...DEFAULT_STORY_FLAGS, met_orion: true, met_baros: true, quest_baros_done: true, quest_orion_done: true }, questStatus: {},
    };
    if ((await fightFloor(s, floor)).win) wins++;
    restore();
  }
  return Math.round((wins / TRIALS) * 100);
}

/**
 * 합격선.
 *
 * 가운데 열이 실측이 된 뒤로 숫자가 통째로 바뀌었다. 예전 표의 "정규 60~78%" 는 손으로
 * 적은 장비를 재던 값이라 지금 열들과 비교하면 안 된다.
 *
 * 보스는 **재도전 2~3회**가 설계값이다. 승률로 옮기면 1/(1+재도전) = 25~33% 이고,
 * 여유를 둬서 25~45% 로 잡는다. 관문은 "제작대까지 돌아갈 일은 아닌 검문" 이라
 * 대부분 한 번에 넘어야 하고, 그래서 60~88% 다.
 * 완비 열만 90%(관문 95%) 위여야 한다 — 그게 "완비하면 넘는다" 는 이 게임의 약속이다.
 */
function verdict(floor: number, bare: number, real: number, ahead: number, full: number): string {
  const fails: string[] = [];
  // 맨몸에는 **상한만** 건다. 예전에는 관문에 "35~60%" 로 하한도 걸어 뒀는데, 그건
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
  console.log(`관문 검사 (${TRIALS}판 · 파티·장비·각인 전부 run.ts 실측)
`);
  console.log(`  층 | 종류 |  맨몸    실측  한발앞선    완비 | 판정`);
  console.log(`-----|------|----------------------------------|------`);

  for (const g of GATES) {
    const bare  = await winRate(g.floor, g.party, parseGear("-"), 0, g.entryHp, g.potions);
    const real  = await winRate(g.floor, g.party, parseGear(g.actual), g.actualTier, g.entryHp, g.potions);
    const ahead = await winRate(g.floor, g.party, parseGear(oneStepUp(g.actual)), g.actualTier, g.entryHp, g.potions);
    // 완비 열만 만렙 HP 에 넉넉한 물약으로 들어선다 — "완비하고 정비까지 마친 사람"이다
    const full  = await winRate(g.floor, g.party, parseGear(fullKit(g.floor)), MAX_IMPRINT_TIER, 1, freshPotions(g.floor));
    const kind = isBossFloor(g.floor) ? "보스" : "관문";
    console.log(
      `  ${String(g.floor).padStart(2)} | ${kind} |` +
      `${`${bare}%`.padStart(7)}${`${real}%`.padStart(8)}${`${ahead}%`.padStart(10)}${`${full}%`.padStart(8)} | ` +
      verdict(g.floor, bare, real, ahead, full),
    );
  }

  console.log("\n적 실효 능력치");
  for (const g of GATES) {
    const e = getFloorEnemy(g.floor, "none");
    console.log(`  ${String(g.floor).padStart(2)}층 ${e.name.padEnd(12)} Lv${String(e.level).padStart(2)} HP${String(e.maxHp).padStart(5)} 공${String(e.attack).padStart(4)} 방${String(e.defense).padStart(4)} 속${String(e.speed).padStart(4)}  실측장비 ${g.actual} · 각인 ${g.actualTier}`);
  }
}

main();
