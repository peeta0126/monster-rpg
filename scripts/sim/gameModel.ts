/**
 * 시뮬레이션용 게임 모델.
 *
 * 밸런스 수치를 다시 적기 시작하면 그 순간부터 시뮬레이션은 게임이 아니라 "시뮬레이션의 밸런스"를
 * 재는 도구가 된다. 그래서 전투 계산·층 구성·아티팩트 수치는 전부 실제 소스를 그대로 import하고,
 * React 컴포넌트 안에 갇혀 있어 import할 수 없는 것(전투 턴 루프, 숲 노드, 드랍 테이블)만
 * 원본과 1:1로 옮겨 적는다. 옮겨 적은 곳에는 출처를 주석으로 남긴다.
 */
import {
  getFloorEnemy, getFloorEnemySkill, isBossFloor, MAX_TOWER_FLOOR, scaleToLevel,
} from "../../src/shared/floorTable";
import {
  applyDamage, applyStatusEffect, calculateDamage, checkStatusEffects,
  createBattleMonster, gainExp, getAIAction, getTypeMultiplier, isFainted,
  type BattleMonster,
} from "../../src/battle/battleUtils";
import { monsters } from "../../src/monster/monsters";
import { applyLevelGrowth } from "../../src/monster/growth";
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

export { MAX_TOWER_FLOOR };

/** BattlePage의 BENCH_EXP_SHARE와 같은 값 */
const BENCH_EXP_SHARE = 0.5;

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

// ─── 전투 드랍 (BattlePage.rollBattleDrop 원본 이식) ──────────────────────────

export function rollBattleDrop(floor: number): { id: string; count: number }[] {
  const drops: { id: string; count: number }[] = [];
  const rollChance = isBossFloor(floor) ? 0.95 : 0.45;
  if (Math.random() > rollChance) return drops;

  const pool: string[] =
    floor >= 31 ? ["iron_fragment", "crystal", "monster_essence", "enhancement_stone"] :
    floor >= 21 ? ["iron_fragment", "crystal", "wood_plank", "monster_essence", "enhancement_stone"] :
    floor >= 11 ? ["iron_fragment", "wood_plank", "leather", "enhancement_stone"] :
                  ["wood_plank", "leather", "herb"];

  const count = isBossFloor(floor) ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  drops.push({ id: picked, count });

  if (isBossFloor(floor) && Math.random() < 0.6) {
    const extra = pool.filter((p) => p !== picked)[Math.floor(Math.random() * (pool.length - 1))];
    drops.push({ id: extra, count: 1 });
  }
  return drops;
}

// ─── 전투 (BattlePage의 턴 흐름 이식) ─────────────────────────────────────────

export interface BattleOutcome {
  win: boolean;
  turns: number;
  potionsUsed: number;
  drops: { id: string; count: number }[];
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
  const battlers = s.party.map((m, i) => toBattleMon(m, bonuses[i].hp));
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
      const persistedMax = grown.maxHp - bonus.hp;
      owned.level = grown.level;
      owned.exp = grown.exp;
      owned.expToNextLevel = grown.expToNextLevel;
      owned.maxHp = persistedMax;
      owned.attack = grown.attack - 0;
      owned.defense = grown.defense;
      owned.speed = grown.speed;
      owned.currentHp = Math.min(persistedMax, grown.currentHp - bonus.hp);
      owned.id = grown.id;
      owned.name = grown.name;
      owned.type = grown.type;
      owned.moves = grown.moves;
      owned.rewardExp = grown.rewardExp;
      owned.evolvesTo = grown.evolvesTo;
      owned.evolvesAtLevel = grown.evolvesAtLevel;
      // 기절하지 않은 나머지 파티원: HP 반영 + 경험치 분배(BENCH_EXP_SHARE)
      for (let i = 0; i < s.party.length; i++) {
        if (i === activeIdx) continue;
        const mate = s.party[i];
        mate.currentHp = Math.max(0, battlers[i].currentHp - bonuses[i].hp);
        if (mate.currentHp <= 0) continue;
        const share = Math.max(1, Math.floor(earned * BENCH_EXP_SHARE));
        const bm = createBattleMonster(mate);
        const prevLv = bm.level;
        const res = gainExp(bm, share);
        let g = res.updatedMonster;
        if (res.leveledUp) g = (await applyLevelGrowth(g, prevLv)).monster;
        mate.level = g.level; mate.exp = g.exp; mate.expToNextLevel = g.expToNextLevel;
        mate.maxHp = g.maxHp; mate.attack = g.attack; mate.defense = g.defense; mate.speed = g.speed;
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
          s.party[i].currentHp = Math.max(0, battlers[i].currentHp - bonuses[i].hp);
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

interface ForestArea {
  id: string;
  monsterPool: string[];
  levelRange: [number, number];
  materialRate: number;
  materialBonus: number;
  unlockFloor: number;
}

export const FOREST_AREAS: ForestArea[] = [
  // ⚠️ src/camp/forest/areas.ts 와 같은 값을 유지할 것. 시뮬은 구조를 따로 들고 있다.
  { id: "shallow", monsterPool: ["flameling", "aquabe", "leafy", "nobi", "venomcrow", "mossy"],
    levelRange: [1, 8], materialRate: 0.40, materialBonus: 0, unlockFloor: 0 },
  { id: "deep", monsterPool: ["burno", "bubblet", "mossy", "crystafox", "frostorb", "toxadon"],
    levelRange: [8, 18], materialRate: 0.55, materialBonus: 1, unlockFloor: 11 },
  { id: "ancient", monsterPool: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
    levelRange: [18, 32], materialRate: 0.65, materialBonus: 2, unlockFloor: 21 },
];

const AREA_MATERIAL_POOL: Record<string, string[]> = {
  shallow: ["herb", "herb", "berry", "root", "wood_plank", "leather", "slime_extract"],
  deep:    ["herb", "berry", "root", "crystal", "wood_plank", "leather",
            "slime_extract", "iron_fragment", "magic_dust"],
  ancient: ["herb", "root", "crystal", "crystal", "iron_fragment",
            "magic_dust", "monster_essence", "monster_essence", "enhancement_stone"],
};
const CATCH_RATE = { win: 0.72, draw: 0.42, lose: 0.18 };

function rollDrop(area: ForestArea): { id: string; count: number } | null {
  if (Math.random() > area.materialRate) return null;
  const pool = AREA_MATERIAL_POOL[area.id] ?? AREA_MATERIAL_POOL.shallow;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const count = 1 + area.materialBonus + (Math.random() < 0.3 ? 1 : 0);
  return { id, count };
}

function pickForestMonster(area: ForestArea, elite: boolean): Monster {
  const pool = elite ? area.monsterPool.slice(-2) : area.monsterPool;
  const id = pool[Math.floor(Math.random() * pool.length)];
  const base = monsters.find((m) => m.id === id)!;
  const lvMin = elite ? Math.floor((area.levelRange[0] + area.levelRange[1]) / 2) : area.levelRange[0];
  const level = lvMin + Math.floor(Math.random() * (area.levelRange[1] - lvMin + 1));
  return scaleToLevel(base, level);
}

function weightedPick<T>(weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) { r -= w; if (r <= 0) return v; }
  return weights[weights.length - 1][0];
}

export interface ForestRunResult {
  drops: { id: string; count: number }[];
  encounters: Monster[];
  nodes: number;
}

/** 숲 탐험 1회: 입구 → 보스까지 한 경로(깊이당 노드 1개)를 지난다 */
export function runForest(area: ForestArea): ForestRunResult {
  const totalCols = 6 + Math.floor(Math.random() * 3);
  const maxDepth = totalCols - 1;
  const drops: { id: string; count: number }[] = [];
  const encounters: Monster[] = [];

  for (let depth = 1; depth <= maxDepth; depth++) {
    const p = depth / maxDepth;
    const type = depth === maxDepth ? "boss" : weightedPick<string>(
      p < 0.35 ? [["battle", 4], ["material", 3], ["event", 2], ["rest", 1]] :
      p < 0.65 ? [["battle", 3], ["material", 3], ["event", 2], ["rest", 2]] :
                 [["battle", 3], ["material", 2], ["event", 2], ["rest", 2], ["elite", 3]],
    );
    if (type === "material") {
      const d1 = rollDrop(area); if (d1) drops.push(d1);
      const d2 = rollDrop(area); if (d2 && d2.id !== d1?.id) drops.push(d2);
    } else if (type === "battle" || type === "elite" || type === "boss") {
      const d = rollDrop(area); if (d) drops.push(d);
      encounters.push(pickForestMonster(area, type === "elite" || type === "boss"));
    }
  }
  return { drops, encounters, nodes: maxDepth };
}

/** 가위바위보 포획 시도 1회 (플레이어는 상대 수를 알 수 없으므로 승/무/패가 균등) */
export function tryCatch(): boolean {
  const r = Math.random();
  const rate = r < 1 / 3 ? CATCH_RATE.win : r < 2 / 3 ? CATCH_RATE.draw : CATCH_RATE.lose;
  return Math.random() < rate;
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
