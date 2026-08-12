/**
 * 시뮬레이션용 게임 모델.
 *
 * 밸런스 수치를 다시 적기 시작하면 그 순간부터 시뮬레이션은 게임이 아니라 "시뮬레이션의 밸런스"를
 * 재는 도구가 된다. 그래서 전투 계산·층 구성·아티팩트 수치는 전부 실제 소스를 그대로 import하고,
 * React 컴포넌트 안에 갇혀 있어 import할 수 없는 것(전투 턴 루프, 숲 노드, 드랍 테이블)만
 * 원본과 1:1로 옮겨 적는다. 옮겨 적은 곳에는 출처를 주석으로 남긴다.
 */
import {
  getFloorEnemy, getFloorEnemySkill, MAX_TOWER_FLOOR, scaleToLevel,
} from "../../src/shared/floorTable";
import { rollBattleDrop } from "../../src/shared/dropTables";
import { FOREST_AREAS, type ForestArea } from "../../src/camp/forest/areas";
import {
  FORK_CHANCE, hasCatch, rollFork, rollStep, rollStepRewards, escapeAlert, type ForestStepKind,
} from "../../src/camp/forest/steps";
import {
  STEP_ALERT, clampAlert, isForcedRetreat,
  appliesAlertOnArrival, stepAlertDelta,
} from "../../src/camp/forest/alert";
import { makeRng } from "../../src/camp/forest/runStore";
import {
  CATCH_ATTEMPTS, attemptAlert, catchChance, getRpsResult,
} from "../../src/camp/forest/catchRules";
import { counterTo, rollHand, tellOf, tellTypeOf } from "../../src/camp/forest/catchTells";
import type { RpsChoice } from "../../src/workshop/rps";
import {
  applyDamage, applyStatusEffect, calculateDamage, checkStatusEffects,
  benchExpShare, createBattleMonster, gainExp, getAIAction, getTypeMultiplier, isFainted,
  type BattleMonster,
} from "../../src/battle/battleUtils";
import { monsters } from "../../src/monster/monsters";
import { applyLevelGrowth } from "../../src/monster/growth";
import { withImprint } from "../../src/monster/imprint";
import type { Monster, Move, ElementType } from "../../src/shared/game";
import type { ArtifactInstance, ArtifactStatBonus, ItemQuality } from "../../src/shared/crafting";
import {
  applyArtifactQualityStats, getEquipmentMaxLevel, getEquipmentLevelUpCost,
  getDisassembleStones, getNextQuality, canSynthesizeArtifacts,
  sumEquippedStatBonuses, sumEquippedBonusStats, rollBonusStats,
  MAX_EQUIPMENT_ENHANCEMENT, QUALITY_MULTIPLIER, ARTIFACT_SLOT_MAP, getEnhancementSuccessRate,
} from "../../src/shared/craftingUtils";
import { ARTIFACT_RECIPES, POTION_RECIPES } from "../../src/workshop/craftingRecipes";
import { POTIONS } from "../../src/shared/items";

export { MAX_TOWER_FLOOR, FOREST_AREAS };


// ─── 시드 RNG ────────────────────────────────────────────────────────────────
// 게임 코드는 내부에서 Math.random()을 부르므로, 전역을 갈아끼워야 재현 가능한 실행이 된다.

export function installSeededRandom(seed: number): () => void {
  const original = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => { Math.random = original; };
}

// ─── 플레이어 상태 ───────────────────────────────────────────────────────────

export interface OwnedMon extends Monster {
  uid: string;
  currentHp: number;
}

export interface SimState {
  party: OwnedMon[];
  /** 각인 — 계열키 → 먹인 중복 수 (playerStore.imprint 와 같은 표) */
  imprint: Record<string, number>;
  materials: Record<string, number>;
  potions: Record<string, number>;
  artifacts: ArtifactInstance[];                    // 가방
  equipped: Record<string, ArtifactInstance[]>;     // uid → 장착
  bestFloor: number;
  questBarosDone: boolean;
  questOrionDone: boolean;
}

export function createInitialSim(): SimState {
  const flameling = monsters.find((m) => m.id === "flameling")!;
  return {
    party: [{ ...flameling, uid: "p0", currentHp: flameling.maxHp }],
    imprint: {},
    materials: {},
    potions: {},
    artifacts: [],
    equipped: {},
    bestFloor: 0,
    questBarosDone: false,
    questOrionDone: false,
  };
}

export function addMaterial(s: SimState, id: string, n: number) {
  s.materials[id] = (s.materials[id] ?? 0) + n;
}

/** 파티 전체 회복 — /monsters 화면의 회복 버튼(restorePartyHp). 비용도 쿨다운도 없다. */
export function restorePartyHp(s: SimState) {
  for (const m of s.party) m.currentHp = m.maxHp;
}

// ─── 장비 보너스 (BattlePage.getEquipCombatBonus와 동일) ──────────────────────

export function equipBonus(s: SimState, uid: string) {
  const eq = s.equipped[uid] ?? [];
  const totals = sumEquippedStatBonuses(eq);
  const bonus = sumEquippedBonusStats(eq);
  const elementalDamage: Partial<Record<ElementType, number>> = {};
  if (bonus.fireDamage) elementalDamage.fire = bonus.fireDamage;
  if (bonus.waterDamage) elementalDamage.water = bonus.waterDamage;
  return {
    attack: totals.attack, defense: totals.defense, speed: totals.speed,
    critRate: totals.critRate, elementPower: totals.elementPower, hp: totals.hp,
    critDamage: bonus.critDamage, expBonus: bonus.expBonus, elementalDamage,
  };
}


// ─── 전투 (BattlePage의 턴 흐름 이식) ─────────────────────────────────────────

export interface BattleOutcome {
  win: boolean;
  turns: number;
  potionsUsed: number;
  drops: { id: string; count: number }[];
}

/** 종족 기본값 + 레벨로 다시 계산한 저장용 능력치. scaleToLevel 이 그 규칙의 단일 출처다 */
function statsForLevel(id: string, level: number) {
  const base = monsters.find((m) => m.id === id)!;
  const s = scaleToLevel(base, level);
  return { maxHp: s.maxHp, attack: s.attack, defense: s.defense, speed: s.speed };
}

function toBattleMon(m: OwnedMon, hpBonus: number): BattleMonster {
  return {
    ...createBattleMonster(m),
    maxHp: m.maxHp + hpBonus,
    currentHp: m.currentHp + hpBonus,
  };
}

/** 기대 피해가 가장 큰 기술 선택 (명중률 × 위력 × 상성) */
function pickBestMove(attacker: BattleMonster, defender: BattleMonster): Move {
  let best = attacker.moves[0];
  let bestScore = -1;
  for (const mv of attacker.moves) {
    if (mv.power === 0) continue;
    const score = mv.power * (mv.accuracy / 100) * getTypeMultiplier(mv.type, defender.type);
    if (score > bestScore) { bestScore = score; best = mv; }
  }
  return best;
}

/** 회복 물약 중 가장 효율 좋은 것을 고른다 */
function pickHealPotion(s: SimState, missing: number): string | null {
  const owned = POTIONS.filter((p) => (s.potions[p.id] ?? 0) > 0);
  const full = owned.find((p) => p.effect.type === "full_heal");
  if (full && missing > 200) return full.id;
  const heals = owned
    .filter((p): p is typeof p & { effect: { type: "heal"; amount: number } } => p.effect.type === "heal")
    .sort((a, b) => b.effect.amount - a.effect.amount);
  if (heals.length === 0) return full ? full.id : null;
  const enough = [...heals].reverse().find((p) => p.effect.amount >= missing);
  return (enough ?? heals[0]).id;
}

/**
 * 탑 한 층 전투. 실제 BattlePage와 같은 순서로 진행한다:
 * 선공 판정 → 상태이상 → 공격 → 반격 → 기절 시 교체 → 승리 시 경험치·드랍.
 */
export async function fightFloor(s: SimState, floor: number, maxTurns = 400): Promise<BattleOutcome> {
  // 플레이어는 가장 잘 키운 몬스터를 선봉에 세운다
  let activeIdx = s.party.reduce((best, m, i) => (m.level > s.party[best].level ? i : best), 0);
  const bonuses = s.party.map((m) => equipBonus(s, m.uid));
  // 각인 배수는 전투에 들어갈 때만 얹는다(BattlePage.toBattleEntry 와 같은 순서) —
  // 저장 쪽 스탯에 누적하면 전투마다 배수가 겹친다
  const battlers = s.party.map((m, i) => toBattleMon(withImprint(m, s.imprint), bonuses[i].hp));
  const enemy0 = getFloorEnemy(floor, s.party[activeIdx].id);
  let ne = createBattleMonster(enemy0);

  let turns = 0;
  let potionsUsed = 0;
  let enemyTurnIdx = 0;

  const startIdx = activeIdx;
  void startIdx;
  const alive = () => battlers.some((b, i) => i !== activeIdx && !isFainted(b));

  while (turns < maxTurns) {
    turns++;
    let np = battlers[activeIdx];
    const bonus = bonuses[activeIdx];

    // ── 행동 선택: 위험하면 회복, 아니면 공격 ──
    const missing = np.maxHp - np.currentHp;
    const potionId = np.currentHp / np.maxHp < 0.4 ? pickHealPotion(s, missing) : null;
    const move = pickBestMove(np, ne);
    const eMove = getFloorEnemySkill(floor, enemyTurnIdx, ne.moves) ?? getAIAction(ne, np);
    const playerFirst = (np.speed + bonus.speed) >= ne.speed;

    const doPlayerTurn = (): boolean => {
      if (potionId) {
        const potion = POTIONS.find((p) => p.id === potionId)!;
        s.potions[potionId] = (s.potions[potionId] ?? 0) - 1;
        potionsUsed++;
        if (potion.effect.type === "full_heal") np = { ...np, currentHp: np.maxHp };
        else if (potion.effect.type === "heal") {
          np = { ...np, currentHp: Math.min(np.maxHp, np.currentHp + potion.effect.amount) };
        }
        battlers[activeIdx] = np;
        return false;
      }
      const st = checkStatusEffects(np);
      np = st.monster;
      battlers[activeIdx] = np;
      if (st.skipTurn) return false;
      const eff = bonus.attack ? { ...np, attack: np.attack + bonus.attack } : np;
      const res = calculateDamage(
        eff, ne, move, bonus.critRate, bonus.elementPower, bonus.elementalDamage, bonus.critDamage,
      );
      if (!res.isHit) return false;
      if (res.damage > 0) ne = applyDamage(ne, res.damage);
      if (move.statusEffect && (move.statusChance ?? 0) > 0 && Math.random() * 100 <= (move.statusChance ?? 0)) {
        ne = applyStatusEffect(ne, move.statusEffect);
      }
      return isFainted(ne);
    };

    const doEnemyTurn = (): boolean => {
      const st = checkStatusEffects(ne);
      ne = st.monster;
      if (st.skipTurn) return false;
      const defended = bonus.defense ? { ...np, defense: np.defense + bonus.defense } : np;
      const res = calculateDamage(ne, defended, eMove);
      if (!res.isHit) return false;
      if (res.damage > 0) np = applyDamage(np, res.damage);
      if (eMove.statusEffect && (eMove.statusChance ?? 0) > 0 && Math.random() * 100 <= (eMove.statusChance ?? 0)) {
        np = applyStatusEffect(np, eMove.statusEffect);
      }
      battlers[activeIdx] = np;
      return isFainted(np);
    };

    let playerWon = false, enemyWon = false;
    if (playerFirst) {
      playerWon = doPlayerTurn();
      if (!playerWon) enemyWon = doEnemyTurn();
    } else {
      enemyWon = doEnemyTurn();
      if (!enemyWon) playerWon = doPlayerTurn();
    }
    enemyTurnIdx++;

    if (playerWon) {
      // 경험치는 마지막에 싸운 몬스터만 받는다 (BattlePage와 동일)
      const earned = Math.floor(ne.rewardExp * (1 + bonus.expBonus / 100));
      const prevLevel = np.level;
      let grown = gainExp(np, earned).updatedMonster;
      if (grown.level > prevLevel) grown = (await applyLevelGrowth(grown, prevLevel)).monster;
      const owned = s.party[activeIdx];
      // 전투가 부풀린 값(각인 배수·장비 HP)을 걷어낸다 — 종족 기본값 + 레벨로 다시 계산한다
      // (BattlePage.toPersisted 와 같은 규칙)
      const persisted = statsForLevel(grown.id, grown.level);
      owned.level = grown.level;
      owned.exp = grown.exp;
      owned.expToNextLevel = grown.expToNextLevel;
      owned.maxHp = persisted.maxHp;
      owned.attack = persisted.attack;
      owned.defense = persisted.defense;
      owned.speed = persisted.speed;
      owned.currentHp = Math.max(1, Math.round(persisted.maxHp * (grown.currentHp / grown.maxHp)));
      owned.id = grown.id;
      owned.name = grown.name;
      owned.type = grown.type;
      owned.moves = grown.moves;
      owned.rewardExp = grown.rewardExp;
      owned.evolvesTo = grown.evolvesTo;
      owned.evolvesAtLevel = grown.evolvesAtLevel;
      // 기절하지 않은 나머지 파티원: HP 반영 + 경험치 분배(benchExpShare)
      for (let i = 0; i < s.party.length; i++) {
        if (i === activeIdx) continue;
        const mate = s.party[i];
        // 대기 파티원의 HP도 각인 배수를 벗겨 되돌린다 (전투 상한 대비 비율만 지킨다)
        mate.currentHp = Math.max(0, Math.round(mate.maxHp * (battlers[i].currentHp / battlers[i].maxHp)));
        if (mate.currentHp <= 0) continue;
        const share = Math.max(1, Math.floor(earned * benchExpShare(mate.level, grown.level)));
        const bm = createBattleMonster(mate);
        const prevLv = bm.level;
        const res = gainExp(bm, share);
        let g = res.updatedMonster;
        if (res.leveledUp) g = (await applyLevelGrowth(g, prevLv)).monster;
        const mateStats = statsForLevel(g.id, g.level);
        mate.level = g.level; mate.exp = g.exp; mate.expToNextLevel = g.expToNextLevel;
        mate.maxHp = mateStats.maxHp; mate.attack = mateStats.attack;
        mate.defense = mateStats.defense; mate.speed = mateStats.speed;
        mate.id = g.id; mate.name = g.name; mate.type = g.type; mate.moves = g.moves;
        mate.rewardExp = g.rewardExp; mate.evolvesTo = g.evolvesTo; mate.evolvesAtLevel = g.evolvesAtLevel;
        mate.currentHp = Math.min(mate.maxHp, Math.max(1, mate.currentHp));
      }
      const drops = rollBattleDrop(floor);
      if (ne.id === "ormr") drops.push({ id: "ormr_essence", count: 1 });
      for (const d of drops) addMaterial(s, d.id, d.count);
      if (floor > s.bestFloor) s.bestFloor = floor;
      return { win: true, turns, potionsUsed, drops };
    }

    if (enemyWon) {
      battlers[activeIdx] = { ...np, currentHp: 0 };
      if (!alive()) {
        for (let i = 0; i < s.party.length; i++) {
          s.party[i].currentHp = Math.max(0,
            Math.round(s.party[i].maxHp * (battlers[i].currentHp / battlers[i].maxHp)));
        }
        return { win: false, turns, potionsUsed, drops: [] };
      }
      // 살아 있는 다음 몬스터로 교체 (교체 턴에는 적이 한 대 때린다)
      activeIdx = battlers.findIndex((b, i) => i !== activeIdx && !isFainted(b));
      const nb = battlers[activeIdx];
      const swMove = getFloorEnemySkill(floor, enemyTurnIdx, ne.moves) ?? getAIAction(ne, nb);
      const defended = bonuses[activeIdx].defense
        ? { ...nb, defense: nb.defense + bonuses[activeIdx].defense } : nb;
      const res = calculateDamage(ne, defended, swMove);
      if (res.isHit && res.damage > 0) battlers[activeIdx] = applyDamage(nb, res.damage);
      enemyTurnIdx++;
    }
  }

  return { win: false, turns, potionsUsed, drops: [] };
}

// ─── 숲 (ForestPage 이식) ────────────────────────────────────────────────────


function pickForestMonster(area: ForestArea, elite: boolean): Monster {
  const pool = elite ? area.monsterPool.slice(-2) : area.monsterPool;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const base = monsters.find((m) => m.id === id)!;
  const lvMin = elite ? Math.floor((area.levelRange[0] + area.levelRange[1]) / 2) : area.levelRange[0];
  const level = lvMin + Math.floor(Math.random() * (area.levelRange[1] - lvMin + 1));
  return scaleToLevel(base, level);
}

export type ForestStrategy = "avoid" | "random" | "greedy";

export interface ForestRunResult {
  drops: { id: string; count: number }[];
  encounters: Monster[];
  /** 걸은 걸음 수 */
  steps: number;
  /** 원정이 끝났을 때의 소란도 */
  alert: number;
  /** 이번 원정의 최고 소란 */
  alertPeak: number;
  /** 소란 100 에 걸려 쫓겨났는가 */
  forcedRetreat: boolean;
  /** 주인을 만나 끝났는가 */
  metWarden: boolean;
  /** 포획을 놓친 횟수 */
  escapes: number;
  /** 포획에 성공한 수 — 몬스터는 즉시 확정이라 정산에 안 걸린다 */
  caught: number;
  /** 스스로 물러선 횟수. 놓침과 달리 escapeAlert 가 안 붙는다 */
  retreats: number;
  /** 실제로 건 포획 시도의 총합. 3 에서 얼마나 내려갔는지가 이 작업의 지표다 */
  attempts: number;
  /** 포획 기회가 있던 걸음 수 (attempts / catchSteps = 조우당 평균 시도) */
  catchSteps: number;
  /** 시도 비용으로 태운 소란의 총합 */
  attemptAlertSpent: number;
}

/** 포획을 어떻게 두느냐. 버릇을 아는가 · 언제 물러서는가 */
export interface CatchPolicy {
  /**
   * 상대의 버릇을 읽는가.
   *
   * 도감이 찬 플레이어(또는 소란을 낮게 유지한 플레이어)를 흉내 낸다. 모르는 쪽은
   * 예전과 같이 아무 수나 낸다 — 어떤 편향에서도 기대값이 정확히 균등값이다.
   */
  knowsTell: boolean;
  /**
   * 다음 시도의 소란 비용이 이 값을 넘으면 물러선다.
   *
   * "늘 3번 쓴다"를 깨는 건 비용이지만, 그 비용을 실제로 피하는 판단이 없으면
   * 시뮬이 게임보다 손해를 크게 잰다. Infinity 면 예전처럼 끝까지 쓴다.
   */
  retreatCostOver: number;
  /**
   * 소란이 이 값 위면 재도전을 아예 안 한다.
   *
   * 소란 예산이 얼마 안 남았을 때 물러서기가 3번째 시도보다 나아지는 자리를 만든다.
   */
  retreatAlertOver: number;
  /**
   * 시도 비용에 곱하는 배수 — **비교 전용 다이얼**이다.
   *
   * 0 이면 재도전이 공짜였던 예전 규칙이 된다. 게임에는 이런 다이얼이 없다.
   * 비용을 붙이기 전후를 같은 코드로 재려고만 둔다(밸런스 표를 사본으로 만들지 않는다).
   */
  costScale: number;
}

export const CATCH_ALWAYS_THREE: CatchPolicy = {
  knowsTell: false, retreatCostOver: Infinity, retreatAlertOver: Infinity, costScale: 1,
};

/**
 * 원정 1회. 게임과 같은 표(steps.ts)로 사건을 뽑고 같은 순서로 판정한다.
 *
 * 전략은 갈림길에서 무엇을 고르느냐다 — 소란이 덜 오르는 쪽(avoid) · 무작위(random) ·
 * 더 오르는 쪽(greedy). 갈림길이 아닌 걸음은 선택지가 없으므로 전략과 무관하다.
 *
 * 자진 귀환 시점은 사람이 정하는 것이라 시뮬이 대신 정할 수 없다. 여기서는
 * "쫓겨나거나 주인을 만날 때까지 걷는다"를 상한으로 두고, 그 전에 멈추는 판단은
 * 정산 쪽(반입량)에서 따진다.
 */
export function runForest(
  area: ForestArea,
  strategy: ForestStrategy = "random",
  /**
   * 자진 귀환 기준. 소란이 이 값에 닿으면 스스로 돌아간다.
   *
   * 언제 멈출지는 사람이 정하는 것이라 시뮬이 대신 정할 수 없다 — 대신 정책을
   * 파라미터로 두고 여러 기준을 훑는다. 기본값은 "쫓겨날 때까지" 다.
   */
  bankAlert = Infinity,
  /** 포획을 어떻게 두는가. 기본은 예전 행동(버릇 모름 · 3번 다 씀) */
  policy: CatchPolicy = CATCH_ALWAYS_THREE,
): ForestRunResult {
  const drops: { id: string; count: number }[] = [];
  const encounters: Monster[] = [];

  let alert = clampAlert(area.startingAlert);
  let alertPeak = alert;
  let depth = 0;
  let escapes = 0;
  let caught = 0;
  let retreats = 0;
  let attempts = 0;
  let catchSteps = 0;
  let attemptAlertSpent = 0;
  let forcedRetreat = false;
  let metWarden = false;

  // 무한 루프 방지용 상한. 실제 런은 깊이 압력 때문에 훨씬 전에 끝난다
  const HARD_CAP = 200;

  let seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;

  while (depth < HARD_CAP) {
    const { rng, nextSeed } = makeRng(seed);

    // 갈림길이면 두 갈래 중 전략에 따라 고른다
    let kind: ForestStepKind;
    if (rng() < FORK_CHANCE) {
      const [a, b] = rollFork(alert, depth, rng);
      const [lo, hi] = STEP_ALERT[a] <= STEP_ALERT[b] ? [a, b] : [b, a];
      kind = strategy === "avoid" ? lo : strategy === "greedy" ? hi : (rng() < 0.5 ? a : b);
    } else {
      kind = rollStep(alert, depth, rng);
    }

    // 주인만 깨우는 순간(판정 전) 소란이 붙는다
    if (appliesAlertOnArrival(kind)) {
      alert = clampAlert(alert + stepAlertDelta(kind, depth));
      alertPeak = Math.max(alertPeak, alert);
    }

    // 수확 배수는 그렇게 정해진 소란도로 계산한다(게임과 같은 순서)
    drops.push(...rollStepRewards(area, kind, alert, rng));
    if (hasCatch(kind)) {
      const target = pickForestMonster(area, kind === "champion" || kind === "warden");
      encounters.push(target);
      catchSteps++;

      // 시도를 하나씩 실제로 굴린다. 예전엔 3회를 한 덩어리로 접었는데, 시도마다
      // 소란이 붙고 도중에 물러설 수 있는 지금은 몇 번째에 끝났는지가 곧 비용이다
      const type = tellTypeOf(target);
      const tell = tellOf(type);
      let spent = 0;
      let got = false;
      let quit = false;

      for (let a = 0; a < CATCH_ATTEMPTS; a++) {
        const cost = Math.round(attemptAlert(a) * policy.costScale);
        // 물러서기 — 놓치는 건 같지만 escapeAlert 도 이번 시도 비용도 안 낸다
        if (a > 0 && (cost > policy.retreatCostOver || alert + spent > policy.retreatAlertOver)) {
          quit = true;
          break;
        }
        spent += cost;
        attempts++;

        // 버릇을 알면 카운터를, 모르면 아무 수나. 상대 손은 게임과 같은 표에서 나온다
        const player: RpsChoice = policy.knowsTell && tell
          ? counterTo(tell)
          : (["rock", "paper", "scissors"] as RpsChoice[])[Math.floor(rng() * 3)];
        const comp = rollHand(type, rng);
        if (rng() < catchChance(getRpsResult(player, comp), alert)) { got = true; break; }
      }

      attemptAlertSpent += spent;
      alert = clampAlert(alert + spent);
      if (got) caught++;
      else if (quit) retreats++;
      else {
        escapes++;
        alert = clampAlert(alert + escapeAlert(kind));
      }
    }

    if (!appliesAlertOnArrival(kind)) {
      alert = clampAlert(alert + stepAlertDelta(kind, depth));
    }
    alertPeak = Math.max(alertPeak, alert);
    depth++;
    seed = nextSeed();

    if (kind === "warden") { metWarden = true; break; }
    if (isForcedRetreat(alert)) { forcedRetreat = true; break; }
    if (alert >= bankAlert) break;   // 자진 귀환
  }

  return {
    drops, encounters, steps: depth, alert, alertPeak, forcedRetreat, metWarden,
    escapes, caught, retreats, attempts, catchSteps, attemptAlertSpent,
  };
}

/**
 * 가위바위보 포획 시도 1회.
 *
 * 플레이어는 상대 수를 모르므로 승/무/패가 균등하다. 확률표는 catchRules.ts 한 벌뿐이라
 * 여기서 사본을 만들지 않는다 — 포획률을 고쳤는데 시뮬이 옛 값을 재던 적이 있다.
 */
export function tryCatch(alert = 0): boolean {
  const r = Math.random();
  const result = r < 1 / 3 ? "win" : r < 2 / 3 ? "draw" : "lose";
  return Math.random() < catchChance(result, alert);
}

// ─── 제작 / 모루 ─────────────────────────────────────────────────────────────

export const ALL_RECIPES = [...ARTIFACT_RECIPES, ...POTION_RECIPES];

export function canCraft(s: SimState, recipeId: string): boolean {
  const r = ALL_RECIPES.find((x) => x.id === recipeId);
  if (!r) return false;
  return r.costs.every((c) => (s.materials[c.itemId] ?? 0) >= c.amount);
}

let uidCounter = 0;
function nextId() { return `a${uidCounter++}`; }

/** 제작 1회. quality는 미니게임 결과로 결정된다(플레이어 숙련도는 호출부가 정함). */
export function craft(s: SimState, recipeId: string, quality: ItemQuality): ArtifactInstance | "potion" | null {
  const r = ALL_RECIPES.find((x) => x.id === recipeId);
  if (!r || !canCraft(s, recipeId)) return null;
  for (const c of r.costs) s.materials[c.itemId] -= c.amount;

  if (r.stationType === "potion") {
    s.potions[r.resultItemId] = (s.potions[r.resultItemId] ?? 0) + 1;
    return "potion";
  }
  const inst: ArtifactInstance = {
    instanceId: nextId(),
    itemId: r.resultItemId,
    name: r.resultItemName,
    quality,
    description: r.description,
    statBonuses: applyArtifactQualityStats((r.baseStats ?? []) as ArtifactStatBonus[], quality),
    createdAt: 0,
    level: 1,
    enhancement: 0,
    source: "crafting",
    bonusStats: [],
  };
  s.artifacts.push(inst);
  return inst;
}

export function equip(s: SimState, uid: string, inst: ArtifactInstance) {
  const slot = ARTIFACT_SLOT_MAP[inst.itemId];
  if (!slot) return;
  const cur = s.equipped[uid] ?? [];
  const displaced = cur.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
  s.artifacts = s.artifacts.filter((a) => a.instanceId !== inst.instanceId);
  if (displaced) s.artifacts.push(displaced);
  s.equipped[uid] = [...cur.filter((a) => a.instanceId !== displaced?.instanceId), inst];
}

function findArtifact(s: SimState, id: string): ArtifactInstance | null {
  const bag = s.artifacts.find((a) => a.instanceId === id);
  if (bag) return bag;
  for (const list of Object.values(s.equipped)) {
    const hit = list.find((a) => a.instanceId === id);
    if (hit) return hit;
  }
  return null;
}

/** 장비 레벨업 1회 (강화석 소모). 성공하면 true */
export function levelUpArtifact(s: SimState, id: string): boolean {
  const a = findArtifact(s, id);
  if (!a) return false;
  const lv = a.level ?? 1;
  const max = getEquipmentMaxLevel(a.quality);
  if (lv >= max) return false;
  const cost = getEquipmentLevelUpCost(a.quality, lv);
  if ((s.materials.enhancement_stone ?? 0) < cost) return false;
  s.materials.enhancement_stone -= cost;
  a.level = lv + 1;
  a.bonusStats = rollBonusStats(a.itemId, lv, lv + 1, a.bonusStats ?? []);
  return true;
}

/** 강화 1회 — 같은 등급의 다른 아티팩트를 재료로 소모한다. 실패해도 재료는 사라진다. */
export function enhanceArtifact(s: SimState, targetId: string, materialId: string): boolean {
  const t = findArtifact(s, targetId);
  const m = s.artifacts.find((a) => a.instanceId === materialId);
  if (!t || !m || t.quality !== m.quality) return false;
  const enh = t.enhancement ?? 0;
  if (enh >= MAX_EQUIPMENT_ENHANCEMENT) return false;
  s.artifacts = s.artifacts.filter((a) => a.instanceId !== materialId);
  if (Math.random() >= getEnhancementSuccessRate(enh)) return false;   // 실패
  t.enhancement = enh + 1;
  return true;
}

/** 분해 → 강화석 */
export function disassemble(s: SimState, id: string): number {
  const a = s.artifacts.find((x) => x.instanceId === id);
  if (!a) return 0;
  const stones = getDisassembleStones(a.quality, a.level ?? 1, a.enhancement ?? 0);
  s.artifacts = s.artifacts.filter((x) => x.instanceId !== id);
  addMaterial(s, "enhancement_stone", stones);
  return stones;
}

/** 합성 → 등급 상승 (AnvilModal.handleSynthesize 이식) */
export function synthesize(s: SimState, primaryId: string, secondaryId: string): boolean {
  const p = findArtifact(s, primaryId);
  const q = s.artifacts.find((a) => a.instanceId === secondaryId);
  if (!p || !q || !canSynthesizeArtifacts(p, q)) return false;
  const next = getNextQuality(p.quality);
  if (!next) return false;
  const fromMult = QUALITY_MULTIPLIER[p.quality];
  const toMult = QUALITY_MULTIPLIER[next];
  p.statBonuses = p.statBonuses.map((b) => ({ ...b, value: Math.round((b.value / fromMult) * toMult) }));
  p.quality = next;
  p.level = 1;
  p.enhancement = 0;
  s.artifacts = s.artifacts.filter((a) => a.instanceId !== secondaryId);
  return true;
}
