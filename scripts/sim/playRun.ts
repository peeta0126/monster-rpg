/**
 * 처음(플레미 Lv.1)부터 엔딩(50층)까지 한 판을 끝까지 플레이하는 시뮬레이션.
 *
 * 연금술(물약 제작)·아티팩트 제작·장비 모루를 전부 쓰는, "할 수 있는 건 다 하는" 플레이어를 가정한다.
 * 목적은 두 가지다.
 *   1) 정식 플레이로 엔딩에 도달 가능한가, 도달한다면 얼마나 걸리는가
 *   2) 못 간다면 정확히 어디서, 왜 막히는가
 *
 * 여기는 판을 돌리는 쪽이고 표를 찍는 건 `run.ts` 다. 나눠 둔 이유는 `gateCheck.ts` 가
 * 이 함수를 직접 불러야 하기 때문이다. 예전에는 run.ts 가 찍은 표를 사람이 손으로
 * gateCheck 의 상수표에 옮겨 적었는데, 그러면 두 도구가 다른 시점의 밸런스를 재게 된다.
 */
import {
  installSeededRandom, createInitialSim, restorePartyHp, fightFloor, runForest,
  canCraft, craft, equip, levelUpArtifact, enhanceArtifact, synthesize, disassemble, addMaterial,
  FOREST_AREAS, MAX_TOWER_FLOOR, ALL_RECIPES,
  type SimState, type OwnedMon,
} from "./gameModel";
import { monsters } from "../../src/monster/monsters";
import { settleBag } from "../../src/camp/forest/runStore";
import {
  chainKeyOf, essenceCostFor, imprintTier, IMPRINT_ESSENCE_ID, MAX_IMPRINT_TIER,
} from "../../src/monster/imprint";
import {
  ARTIFACT_SLOT_MAP, MAX_EQUIPMENT_ENHANCEMENT, canSynthesizeArtifacts,
} from "../../src/shared/craftingUtils";
import type { ArtifactInstance } from "../../src/shared/crafting";

import type { ItemQuality } from "../../src/shared/crafting";
import { collectQuests, type QuestLogEntry } from "./quests";

const canSynth = (a: ArtifactInstance, b: ArtifactInstance) => canSynthesizeArtifacts(a, b);

/**
 * 퀘스트 보상을 받는가. 보상 수량을 정하려면 "받았을 때와 안 받았을 때"를 나란히 재야 한다.
 * SIM_QUESTS=0 으로 끈다.
 */
export const USE_QUESTS = process.env.SIM_QUESTS !== "0";

// ─── 플레이어 숙련도 ─────────────────────────────────────────────────────────
// 미니게임을 곧잘 하는 플레이어 가정 (아티팩트 QTE에서 great 정도)
const CRAFT_QUALITY: ItemQuality = "rare";

/** 한 판이 막혔다고 판정하기까지 허용할 연속 실패 사이클 */
const STUCK_LIMIT = Number(process.env.SIM_STUCK ?? 250);
/** 한 판에서 허용할 총 전투 수 상한. 이걸 넘기면 "사람이 할 짓이 아니다"로 본다 */
const BATTLE_BUDGET = Number(process.env.SIM_BUDGET ?? 4000);

export interface RunStats {
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
  /** 보스층을 처음 시도할 때의 파티. 벽의 원인을 보려면 레벨만으로는 부족하다 */
  bossParty: Record<number, { id: string; name: string; level: number; atk: number; hp: number; pow: number; hpRatio: number }[]>;
  /**
   * 보스 앞에 설 때 실제로 들고 있는 장비와 각인.
   *
   * gateCheck 의 합격선이 오래 가정으로 서 있었다. "정규 장비" 를 손으로 적은
   * elite:40:5 같은 값으로 두었는데, 실제 판이 거기 못 미치면 그 표는 아무도 겪지
   * 않는 상황을 재게 된다. 그 표를 이 값으로 채우려고 여기서 뽑는다.
   */
  bossKit: Record<number, { quality: string; level: number; enh: number; tier: number }>;
  /** 그 층에 설 때 파티원 각자가 낀 장비. bossParty 와 같은 순서 */
  bossGear: Record<number, ArtifactInstance[][]>;
  /** 그 층에 설 때의 각인 누적(계열키 → 먹인 수) */
  bossImprint: Record<number, Record<string, number>>;
  /** 그 층 첫 도전의 승패. gateCheck 의 한 열과 직접 비교되는 유일한 값이다 */
  bossFirstTry: Record<number, boolean>;
  /** 첫 도전에 들어설 때의 파티 평균 HP 비율. 만렙 회복을 가정하는 검사와의 차이를 잰다 */
  bossHpRatio: Record<number, number>;
  /** 첫 도전에 들어설 때 가방에 있던 물약. 소모 축이 이 게임 난이도의 절반이다 */
  bossPotions: Record<number, Record<string, number>>;
  /** 보스층을 깨기까지 실제로 몇 번 죽었나 (그 층에서 소모한 재도전 사이클) */
  bossRetries: Record<number, number>;
  /** 각인에 먹인 중복 수 */
  imprintFed: number;
  /** 소란 100 에 걸려 쫓겨난 숲 원정 수 (재료 절반) */
  forcedRetreats: number;
  /** 캠프로 내려가 회복한 횟수. 이게 0 이면 소모 관리가 없다는 뜻이다 */
  campReturns: number;
  /** 받은 퀘스트와 받은 시점의 층 */
  questsDone: QuestLogEntry[];
}

/**
 * 몬스터의 "키울 가치" 평가. 파티에 누구를 남길지 고르는 용도.
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

export async function simulateRun(seed: number): Promise<RunStats> {
  const restore = installSeededRandom(seed);
  const s = createInitialSim();
  const st: RunStats = {
    seed, cleared: false, wallFloor: null,
    towerBattles: 0, towerLosses: 0, forestRuns: 0, totalTurns: 0,
    potionsCrafted: 0, potionsUsed: 0, artifactsCrafted: 0, artifactLevelUps: 0,
    artifactEnhances: 0, artifactSynths: 0, artifactDisassembles: 0,
    finalLevels: [], finalParty: [], materialsLeft: {}, blockedRecipes: {},
    lossByFloor: {}, battlesByFloor: {}, leadLevelAtFloor: {},
    bossParty: {}, bossRetries: {}, bossKit: {}, bossFirstTry: {}, bossHpRatio: {}, bossPotions: {},
    bossGear: {}, bossImprint: {},
    imprintFed: 0, forcedRetreats: 0, campReturns: 0, questsDone: [],
  };

  /** 보관함. 각인 재료가 된다. 전투에는 안 나오므로 능력치는 필요 없다 */
  const storage: OwnedMon[] = [];

  let uid = 1;

  // ── 숲 1회 ───────────────────────────────────────────────────────────────
  //
  // 예전 이 함수는 게임보다 후하게 쳐 줬다. `settleBag`(강제 퇴각 50% 회수)을 안 걸고
  // `bankAlert=Infinity` 로 쫓겨날 때까지 걸어서 원재료를 그대로 적립했고(약 1.85배 과대),
  // 포획은 `runForest` 가 이미 굴린 결과를 버리고 `tryCatch()` 로 다시 굴렸다.
  // 지금은 소란 85 에서 자진 귀환하고 버릇을 읽는 사람을 흉내 낸다.
  const CATCH_POLICY = { knowsTell: true, retreatCostOver: 10, retreatAlertOver: 70, costScale: 1 };

  const doForest = () => {
    const area = [...FOREST_AREAS].reverse().find((a) => s.bestFloor >= a.unlockFloor) ?? FOREST_AREAS[0];
    // 숲은 파티 최고 레벨보다 센 놈을 안 내준다(catchLevel.ts). 시뮬도 같은 천장을 쓴다
    const capLevel = s.party.reduce((max, m) => Math.max(max, m.level), 0);
    const res = runForest(area, "avoid", 85, CATCH_POLICY, capLevel);
    st.forestRuns++;

    // 가방을 한 번 합친 뒤 정산한다. 쫓겨났으면 지목한 한 종류만 온전히 남는다
    const bag = new Map<string, number>();
    for (const d of res.drops) bag.set(d.id, (bag.get(d.id) ?? 0) + d.count);
    const entries = [...bag].map(([id, count]) => ({ id, count }));
    const keep = entries.reduce<{ id: string; count: number } | null>(
      (best, e) => (best && best.count >= e.count ? best : e), null);
    const reason = res.forcedRetreat ? "forced" : res.metWarden ? "warden" : "voluntary";
    for (const b of settleBag(entries, reason, keep?.id)) addMaterial(s, b.id, b.count);
    if (res.forcedRetreat) st.forcedRetreats++;

    // 잡아 온 것: 파티가 비면 채우고, 더 좋으면 갈아타고, 나머지는 각인 재료로 남긴다
    for (const wild of res.caughtMonsters) {
      const caught: OwnedMon = { ...wild, uid: `c${uid++}`, currentHp: wild.maxHp };
      // 도감과 첫 포획 플래그. 퀘스트 조건과 목표가 이 둘을 읽는다
      if (!s.dexCaught.includes(caught.id)) s.dexCaught.push(caught.id);
      s.storyFlags.first_capture = true;
      if (partySlots(s) < 3) { s.party.push(caught); continue; }
      const weakest = s.party.reduce((a, b) => (power(a) <= power(b) ? a : b));
      // 키워둔 몬스터를 레벨이 훨씬 낮은 신규 포획으로 갈아타지는 않는다.
      // (종족 잠재력이 좋아도 레벨 차이를 메우는 비용이 더 크다)
      const levelOk = caught.level >= weakest.level * 0.8;
      if (levelOk && power(caught) > power(weakest) * 1.15) {
        const dropped = s.party[s.party.indexOf(weakest)];
        s.party[s.party.indexOf(weakest)] = caught;
        storage.push(dropped);
      } else {
        storage.push(caught);
      }
    }
    doImprint();
  };

  /**
   * 각인. 보관함의 중복을 계열에 먹인다 (playerStore.feedImprint 와 같은 규칙).
   *
   * 예전 시뮬은 각인을 한 번도 쓰지 않았다(`imprint: {}` 고정). 각인은 능력치 전부에
   * 최대 +25% 라, 그걸 빼고 "시스템을 다 쓰는 플레이어"를 잰다고 할 수 없다.
   */
  const doImprint = () => {
    for (const mon of s.party) {
      const key = chainKeyOf(mon);
      for (;;) {
        const fed = s.imprint[key] ?? 0;
        if (imprintTier(fed) >= MAX_IMPRINT_TIER) break;
        // 같은 계열의 여분이 있어야 먹인다 (파티에 있는 개체는 못 먹인다)
        const idx = storage.findIndex((m) => chainKeyOf(m) === key);
        if (idx < 0) break;
        const cost = essenceCostFor(fed);
        if ((s.materials[IMPRINT_ESSENCE_ID] ?? 0) < cost) break;
        if (cost > 0) s.materials[IMPRINT_ESSENCE_ID] -= cost;
        storage.splice(idx, 1);
        s.imprint[key] = fed + 1;
        st.imprintFed++;
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

  /** 마을에 들러 받을 것을 받고 낼 것을 낸다. 사람은 층을 넘길 때마다 들른다 */
  const doQuests = async () => {
    if (!USE_QUESTS) return;
    await collectQuests(s, storage, () => `q${uid++}`, st.questsDone);
  };

  // ── 본 루프 ─────────────────────────────────────────────────────────────
  doForest(); doForest(); doForest();   // 파티 확보 + 초기 재료
  await doQuests();
  doCrafting(); doAnvil();

  let floor = 1;
  let stuck = 0;

  /** 캠프까지 내려가 쉰다. 무료지만 공짜는 아니다. 내려간 만큼 다시 올라와야 한다 */
  const goHomeAndRest = () => {
    restorePartyHp(s);
    st.campReturns++;
  };

  while (floor <= MAX_TOWER_FLOOR) {
    // 층마다 공짜 전회복을 넣지 않는다. 예전엔 여기서 매 층 회복시켜 놓고
    // "소모가 없다"고 진단했는데, 그 소모를 지운 게 이 줄이었다.
    // 사람이 하듯 위험할 때만 내려간다.
    const hurt = s.party.filter((m) => m.currentHp > 0).length === 0
      || s.party.reduce((sum, m) => sum + m.currentHp / m.maxHp, 0) / s.party.length < 0.5;
    if (hurt) goHomeAndRest();

    if (st.leadLevelAtFloor[floor] === undefined) {
      st.leadLevelAtFloor[floor] = Math.max(...s.party.map((m) => m.level));
      if (floor % 5 === 0) {
        st.bossParty[floor] = s.party.map((m) => ({
          // id 를 같이 남긴다. gateCheck 이 이 스냅샷으로 파티를 다시 만드는데,
          // 표시 이름(모왕)으로는 loadout.makeParty 가 종을 못 찾는다
          id: m.id, name: m.name, level: m.level, atk: m.attack, hp: m.maxHp,
          pow: Math.max(...m.moves.map((mv) => mv.power), 0),
          // 파티 평균 HP 로 뭉뚱그리지 않는다. 실제 판은 선봉만 성하고 벤치 둘이
          // 반죽은 상태로 보스 앞에 서는 일이 흔한데, 평균을 셋에 고루 발라 두면
          // 그 판이 실제보다 훨씬 튼튼해 보인다
          hpRatio: m.currentHp / m.maxHp,
        }));
        // 선봉이 낀 장비 세 칸의 중앙값 격이 곧 "이 층에서의 정규 장비"다
        const lead = s.party.reduce((b, m) => (m.level > b.level ? m : b), s.party[0]);
        const gear = (s.equipped[lead.uid] ?? []);
        const rank = { normal: 0, rare: 1, elite: 2 } as Record<string, number>;
        const best = gear.reduce<typeof gear[number] | null>(
          (b, a) => (!b || rank[a.quality] > rank[b.quality] ? a : b), null);
        st.bossKit[floor] = {
          quality: best?.quality ?? "-",
          level: gear.length ? Math.round(gear.reduce((n, a) => n + (a.level ?? 1), 0) / gear.length) : 0,
          enh: gear.length ? Math.round(gear.reduce((n, a) => n + (a.enhancement ?? 0), 0) / gear.length) : 0,
          tier: imprintTier(s.imprint[chainKeyOf(lead)] ?? 0),
        };
        st.bossHpRatio[floor] = s.party.reduce((n, m) => n + m.currentHp / m.maxHp, 0) / s.party.length;
        st.bossPotions[floor] = { ...s.potions };
        // 파티원마다 실제로 낀 장비를 그대로 남긴다(bossParty 와 같은 순서).
        // 선봉 장비 하나로 셋을 다 채우면 벤치가 맨몸인 판까지 완비로 세게 되고,
        // 그만큼 관문 검사가 실제보다 후해진다.
        st.bossGear[floor] = s.party.map((m) => (s.equipped[m.uid] ?? []).map((a) => ({ ...a })));
        st.bossImprint[floor] = { ...s.imprint };
      }
    }
    const firstTry = floor % 5 === 0 && st.bossFirstTry[floor] === undefined;
    const r = await fightFloor(s, floor);
    if (firstTry) st.bossFirstTry[floor] = r.win;
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
      await doQuests();
      if (floor % 3 === 0) { doCrafting(); doAnvil(); }
      continue;
    }

    // 패배 → 한 사이클 갈고닦기: 숲 1회 + 이미 깬 최고 층 3회 파밍
    st.towerLosses++;
    if (floor % 10 === 0) st.bossRetries[floor] = (st.bossRetries[floor] ?? 0) + 1;
    stuck++;
    if (stuck > STUCK_LIMIT || st.towerBattles > BATTLE_BUDGET) { st.wallFloor = floor; break; }

    goHomeAndRest();
    doForest();
    await doQuests();
    doCrafting();
    doAnvil();
    const farmFloor = Math.max(1, s.bestFloor);
    for (let i = 0; i < 3; i++) {
      if (s.party.reduce((sum, m) => sum + m.currentHp / m.maxHp, 0) / s.party.length < 0.5) goHomeAndRest();
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

