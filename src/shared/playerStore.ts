import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster } from "./game";
import type { CraftingRecipe, CraftedItem, ArtifactInstance, CraftedPotionStack, ItemQuality } from "./crafting";
import { monsters } from "../monster/monsters";
import { MAX_TOWER_FLOOR } from "./floorTable";
import { POTIONS } from "./items";
import {
  rollItemQuality, applyArtifactQualityStats, ARTIFACT_SLOT_MAP, rollBonusStats,
  getEquipmentMaxLevel, MAX_EQUIPMENT_ENHANCEMENT,
} from "./craftingUtils";
import type { RpsResult } from "./craftingUtils";
import { ARTIFACT_RECIPES } from "../workshop/craftingRecipes";

// ─── 스토리 플래그 ──────────────────────────────────────────────────────────────

/** always: 항상 충족되는 sentinel. floor_*: bestFloor에서 파생(저장 안 함). 나머지는 저장 대상. */
export type StoryFlag =
  | "always"
  | "met_orion"
  | "met_baros"
  | "first_capture"
  | "quest_baros_done"
  | "quest_orion_done"
  | "tower_cleared"
  | "floor_5"
  | "floor_10"
  | "floor_20"
  | "floor_40"
  | "floor_50";

export type PersistedStoryFlag =
  | "met_orion"
  | "met_baros"
  | "first_capture"
  | "quest_baros_done"
  | "quest_orion_done"
  /** 오름을 쓰러뜨리고 엔딩까지 본 상태. bestFloor >= 50(floor_50)과 달리 "엔딩을 봤는가"를 가린다. */
  | "tower_cleared";

const DEFAULT_STORY_FLAGS: Record<PersistedStoryFlag, boolean> = {
  met_orion: false,
  met_baros: false,
  first_capture: false,
  quest_baros_done: false,
  quest_orion_done: false,
  tower_cleared: false,
};

export function isStoryFlagSet(
  flag: StoryFlag,
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
): boolean {
  switch (flag) {
    case "always":   return true;
    case "floor_5":  return bestFloor >= 5;
    case "floor_10": return bestFloor >= 10;
    case "floor_20": return bestFloor >= 20;
    case "floor_40": return bestFloor >= 40;
    case "floor_50": return bestFloor >= 50;
    default:         return storyFlags[flag];
  }
}

// ─── 퀘스트 상태 ────────────────────────────────────────────────────────────────

export type QuestStatus = "not_accepted" | "in_progress" | "completed";

export function getQuestStatus(
  questId: string,
  questStatus: Record<string, QuestStatus>,
): QuestStatus {
  return questStatus[questId] ?? "not_accepted";
}

// ─── OwnedMonster ────────────────────────────────────────────────────────────────

export interface OwnedMonster extends Monster {
  uid: string;
  nickname?: string;
  currentHp: number;
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────────

function makeUid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function monsterToOwned(m: Monster): OwnedMonster {
  return { ...m, uid: makeUid(), currentHp: m.maxHp };
}

/** 개발자 모드 진입 시 지급되는 보유 몬스터 레벨 (50층 테스트 대응) */
const DEV_PARTY_LEVEL = 50;

/** 개발자 프리셋 파티(선두 3마리). 50층 시험이 목적이라 최종 진화체 위주로 고른다. */
const DEV_PARTY_IDS = ["mossyfinal", "aquavern", "frostorb"];

/** 개발자 프리셋이 파티에 장착시키는 아티팩트 — 정식 레시피(ARTIFACT_RECIPES)의 만렙 엘리트 버전 */
const DEV_PRESET_ARTIFACTS = ARTIFACT_RECIPES.map((r) => ({
  itemId: r.resultItemId,
  name:   r.resultItemName,
  description: r.description,
  baseStats: r.baseStats ?? [],
}));

/** 개발자 프리셋 물약 — 50층은 물약 운용을 전제로 한 난이도라 넉넉히 지급한다 */
const DEV_PRESET_POTIONS: Record<string, number> = {
  potion: 20, super_potion: 20, max_potion: 20, antidote: 10,
  attack_buff: 10, strong_attack_buff: 10,
};

/** 엘리트 등급 + 해당 등급 만렙 + 최대 강화 상태의 아티팩트 인스턴스를 만든다 */
function makeDevArtifact(def: (typeof DEV_PRESET_ARTIFACTS)[number]): ArtifactInstance {
  const quality: ItemQuality = "elite";
  const level = getEquipmentMaxLevel(quality);
  return {
    instanceId: makeUid(),
    itemId:     def.itemId,
    name:       def.name,
    quality,
    description: def.description,
    statBonuses: applyArtifactQualityStats(def.baseStats, quality),
    createdAt:  Date.now(),
    level,
    enhancement: MAX_EQUIPMENT_ENHANCEMENT,
    source:     "crafting",
    // 레벨 10마다 해제되는 부가 능력치도 만렙 기준으로 채워둔다
    bonusStats: rollBonusStats(def.itemId, 1, level, []),
  };
}

// 기존 items.ts MATERIALS ID 기준
const WORKSHOP_TEST_MATERIALS: Record<string, number> = {
  herb:            10,
  berry:            5,
  root:             5,
  crystal:          4,
  wood_plank:       6,
  iron_fragment:    6,
  leather:          3,
  monster_essence:  5,
  slime_extract:    4,
  magic_dust:       4,
};

// ─── 저장 대상 데이터 (persist가 실제로 디스크에 쓰는 필드) ──────────────────────────────
//
// PlayerState 중 액션(함수)을 뺀 "순수 데이터" 부분. 함수는 JSON.stringify에서
// 어차피 사라지지만, 마이그레이션 코드에서 "무엇이 저장 대상인지"를 명확히 하기 위해
// 별도 타입으로 뽑아둔다. 새 데이터 필드를 추가할 땐 여기와 PlayerState 양쪽에 반영.
export interface PersistedPlayerState {
  party: OwnedMonster[];
  storage: OwnedMonster[];
  dexSeen: string[];
  dexCaught: string[];
  materials: Record<string, number>;
  potions: Record<string, number>;
  bestFloor: number;
  storyFlags: Record<PersistedStoryFlag, boolean>;
  questStatus: Record<string, QuestStatus>;
  craftedItems: CraftedItem[];
  craftedArtifacts: ArtifactInstance[];
  craftedPotions: CraftedPotionStack[];
  equippedArtifacts: Record<string, ArtifactInstance[]>;
}

/** 새 게임 시작 시(혹은 마이그레이션 실패 폴백 시) 사용하는 기본 상태 */
function createInitialState(): PersistedPlayerState {
  return {
    party:       [monsterToOwned(monsters[0])],
    storage:     [],
    dexSeen:     ["flameling"],
    dexCaught:   ["flameling"],
    materials:   {},
    potions:     {},
    bestFloor:   0,
    storyFlags:  { ...DEFAULT_STORY_FLAGS },
    questStatus: {},
    craftedItems: [],
    craftedArtifacts: [],
    craftedPotions: [],
    equippedArtifacts: {},
  };
}

// ─── 세이브 마이그레이션 ─────────────────────────────────────────────────────────────
//
// 저장 구조는 개발 중 여러 번 바뀌었다(스토리 플래그, 퀘스트 상태, 도감, 몬스터
// 능력치·학습테이블, 독 타입 추가 등). 예전 세이브를 가진 브라우저에서 새 코드를
// 열었을 때 없는 필드를 읽다가 깨지는 걸 막기 위한 버전 관리 + 필드 단위 보정.

/** 현재 저장 스키마 버전. 구조를 또 바꾸면 이 값을 올리고 아래 migrate에 분기 추가 */
const PERSIST_VERSION = 1;

function normalizeRecord(raw: unknown): Record<string, number> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, number>)
    : {};
}

function normalizeStringArray(raw: unknown, fallback: string[]): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : fallback;
}

/**
 * 레벨에 따른 능력치를 "새 밸런스 기준"으로 다시 계산한다.
 * battleUtils.ts의 gainExp()가 레벨업마다 적용하는 증분(HP+10/공격+3/방어+2/속도+2)과
 * 동일한 공식 — 저장된 수치를 신뢰하지 않고, 최신 monsters.ts의 base 스탯 위에
 * 이 증분을 (level-1)번 다시 쌓는다. 레벨 자체는 유지하되 수치는 항상 최신 밸런스를 따른다.
 */
function recomputeStatsForLevel(base: Monster, level: number) {
  const n = Math.max(0, level - 1);
  return {
    maxHp:   base.maxHp   + n * 10,
    attack:  base.attack  + n * 3,
    defense: base.defense + n * 2,
    speed:   base.speed   + n * 2,
  };
}

/**
 * 포획 몬스터 1마리 보정.
 * - 현재 monsters.ts에 있는 종이면: 최신 종 정의를 기본값으로 깔아 없는 필드를 채우고,
 *   maxHp/attack/defense/speed는 저장된 값을 무시하고 recomputeStatsForLevel로 항상
 *   재계산한다 — 즉 레벨(육성 진행도)은 보존하되, 능력치는 새 밸런스를 그대로 적용받는다.
 * - 삭제/개명 등으로 monsters.ts에 없는 id면: 조용히 버리지 않고 콘솔에 경고를
 *   남긴 뒤 저장된 값을 최대한 그대로 보존한다(재계산할 기준 종 정의 자체가 없으므로).
 */
function normalizeOwnedMonster(raw: unknown): OwnedMonster | null {
  if (!raw || typeof raw !== "object") return null;
  // 세이브에서 막 꺼낸 값이라 형태를 신뢰할 수 없다. 필드마다 개별적으로 검사한다.
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const base = monsters.find((m) => m.id === r.id);

  if (!base) {
    console.warn(
      `[playerStore] 세이브 마이그레이션: 몬스터 id "${r.id}"가 현재 monsters.ts에 없습니다. ` +
      `삭제되었거나 이름이 바뀐 종일 수 있어요. 데이터를 지우지 않고 저장된 값 그대로 보존합니다 — ` +
      `필요하면 monsters.ts에 해당 종을 다시 추가하거나 별도 이관 처리를 해주세요.`,
    );
    return {
      id: r.id,
      name: typeof r.name === "string" ? r.name : r.id,
      type: (r.type ?? null) as OwnedMonster["type"],
      maxHp: typeof r.maxHp === "number" ? r.maxHp : 1,
      attack: typeof r.attack === "number" ? r.attack : 0,
      defense: typeof r.defense === "number" ? r.defense : 0,
      speed: typeof r.speed === "number" ? r.speed : 0,
      moves: (Array.isArray(r.moves) ? r.moves : []) as OwnedMonster["moves"],
      level: typeof r.level === "number" ? r.level : 1,
      exp: typeof r.exp === "number" ? r.exp : 0,
      expToNextLevel: typeof r.expToNextLevel === "number" ? r.expToNextLevel : 100,
      rewardExp: typeof r.rewardExp === "number" ? r.rewardExp : 0,
      evolutionStage: r.evolutionStage as OwnedMonster["evolutionStage"],
      evolutionChainId: r.evolutionChainId as OwnedMonster["evolutionChainId"],
      evolvesTo: r.evolvesTo as OwnedMonster["evolvesTo"],
      evolvesFrom: r.evolvesFrom as OwnedMonster["evolvesFrom"],
      evolvesAtLevel: r.evolvesAtLevel as OwnedMonster["evolvesAtLevel"],
      uid: typeof r.uid === "string" ? r.uid : makeUid(),
      nickname: r.nickname as OwnedMonster["nickname"],
      currentHp: typeof r.currentHp === "number" ? r.currentHp : (typeof r.maxHp === "number" ? r.maxHp : 1),
    };
  }

  const level = typeof r.level === "number" && r.level >= 1 ? r.level : base.level;
  const recomputed = recomputeStatsForLevel(base, level);
  const rawCurrentHp = typeof r.currentHp === "number" ? r.currentHp : recomputed.maxHp;

  return {
    ...base,
    ...r,
    uid: typeof r.uid === "string" ? r.uid : makeUid(),
    moves: (Array.isArray(r.moves) && r.moves.length > 0 ? r.moves : base.moves) as OwnedMonster["moves"],
    level,
    ...recomputed,
    // 재계산으로 maxHp가 줄었을 수 있으니 현재 HP는 새 상한을 넘지 않게 clamp
    currentHp: Math.min(rawCurrentHp, recomputed.maxHp),
  } as OwnedMonster;
}

function normalizeOwnedMonsterArray(raw: unknown): OwnedMonster[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeOwnedMonster).filter((m): m is OwnedMonster => m !== null);
}

/**
 * 상태 전체를 필드 단위로 보정한다. 없는 필드는 기본값(배열→[], 객체→{}, 불리언→false,
 * 숫자→0)으로 채우고, 있는 값은 그대로 유지한다. version 분기와 무관하게 매 로드마다
 * (migrate 경로든 onRehydrateStorage 경로든) 항상 거쳐서 이중 안전장치로 쓴다.
 */
export function normalizeState(input: object): PersistedPlayerState {
  // 세이브(서버/로컬)에서 온 값도, 스토어 상태 객체도 들어온다. 어느 쪽이든 필드별로 검사하므로
  // 여기서는 인덱싱 가능한 형태로만 좁힌다.
  const raw = input as Record<string, unknown>;
  const fallback = createInitialState();
  const party = normalizeOwnedMonsterArray(raw.party);

  return {
    // 파티가 완전히 비면(구버전 손상 등) 최소 1마리는 있어야 게임 진행이 가능하므로 폴백
    party: party.length > 0 ? party : fallback.party,
    storage: normalizeOwnedMonsterArray(raw.storage),
    dexSeen:   normalizeStringArray(raw.dexSeen, fallback.dexSeen),
    dexCaught: normalizeStringArray(raw.dexCaught, fallback.dexCaught),
    materials: normalizeRecord(raw.materials),
    potions:   normalizeRecord(raw.potions),
    bestFloor: typeof raw.bestFloor === "number" && Number.isFinite(raw.bestFloor) ? raw.bestFloor : 0,
    storyFlags: {
      ...DEFAULT_STORY_FLAGS,
      ...(raw.storyFlags && typeof raw.storyFlags === "object" ? raw.storyFlags : {}),
    },
    questStatus: (raw.questStatus && typeof raw.questStatus === "object"
      ? raw.questStatus : {}) as PersistedPlayerState["questStatus"],
    craftedItems:      (Array.isArray(raw.craftedItems) ? raw.craftedItems : []) as PersistedPlayerState["craftedItems"],
    craftedArtifacts:  (Array.isArray(raw.craftedArtifacts) ? raw.craftedArtifacts : []) as PersistedPlayerState["craftedArtifacts"],
    craftedPotions:    (Array.isArray(raw.craftedPotions) ? raw.craftedPotions : []) as PersistedPlayerState["craftedPotions"],
    equippedArtifacts: (raw.equippedArtifacts && typeof raw.equippedArtifacts === "object"
      ? raw.equippedArtifacts : {}) as PersistedPlayerState["equippedArtifacts"],
  };
}

/**
 * zustand persist의 migrate 훅. 저장된 version이 PERSIST_VERSION과 다를 때만 호출된다
 * (version 개념이 없던 옛 세이브는 zustand가 자동으로 version=0을 넘겨줌).
 *
 * ⭐ 앞으로 저장 구조를 또 바꿀 때:
 *   1) 위 PERSIST_VERSION을 +1 한다.
 *   2) 아래에 `if (version < 새버전) { ... 그 버전에서만 필요한 변환 ... }` 분기를 추가한다.
 *      기존 분기는 지우지 말 것 — 여러 버전을 건너뛴 옛 세이브도 순서대로 다 거쳐야 한다.
 *   3) 마지막엔 항상 normalizeState()를 거치므로, 대부분의 "필드 추가"는 별도 분기 없이
 *      normalizeState의 기본값 채우기만으로 해결된다. 값의 "형태 변환"(예: 배열→객체)이
 *      필요할 때만 버전 분기를 추가하면 된다.
 */
function migrate(persistedState: unknown, version: number): PersistedPlayerState {
  try {
    const raw = persistedState && typeof persistedState === "object" ? persistedState : {};

    if (version < 1) {
      // v0(버전 개념 이전) → v1: 이 시점 기준 필드 누락은 전부 normalizeState가 처리.
      // 값의 "형태"가 바뀐 필드는 아직 없어 별도 변환 없음.
    }

    return normalizeState(raw);
  } catch (err) {
    console.warn("[playerStore] 세이브 마이그레이션 중 오류가 발생해 초기 상태로 시작합니다.", err);
    return createInitialState();
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────────

interface PlayerState {
  party: OwnedMonster[];
  storage: OwnedMonster[];
  dexSeen: string[];
  dexCaught: string[];
  materials: Record<string, number>;
  potions: Record<string, number>;
  bestFloor: number;
  storyFlags: Record<PersistedStoryFlag, boolean>;
  questStatus: Record<string, QuestStatus>;

  // ── 제작 공방 ─────────────────────────────────────────────────────────────────
  craftedItems: CraftedItem[];
  craftedArtifacts: ArtifactInstance[];
  craftedPotions: CraftedPotionStack[];

  // ── 아티팩트 장착 ─────────────────────────────────────────────────────────────
  equippedArtifacts: Record<string, ArtifactInstance[]>; // monsterUid → 장착 목록

  addToDexSeen:   (id: string) => void;
  addToDexCaught: (id: string) => void;
  updateBestFloor: (floor: number) => void;
  setStoryFlag: (flag: PersistedStoryFlag) => void;
  acceptQuest: (questId: string) => void;
  /** 재료 확인 → 차감 → 보상 지급 → 완료 처리 → 플래그 설정을 한 번의 set()으로 원자적으로 수행 */
  completeQuest: (
    questId: string,
    objective: { itemId: string; amount: number },
    rewards: { itemId: string; amount: number }[],
    setsFlag: PersistedStoryFlag,
  ) => boolean;
  addCapturedMonster: (monster: Monster) => "storage" | "full";
  swapWithStorage:  (partyIndex: number, storageUid: string) => void;
  moveToStorage:    (partyIndex: number) => void;
  moveToParty:      (storageUid: string, partyIndex?: number) => void;
  swapPartySlots:   (indexA: number, indexB: number) => void;
  updatePartyMemberHp:  (uid: string, currentHp: number) => void;
  updatePartyMember:    (updated: OwnedMonster) => void;
  restorePartyHp:       () => void;
  addMaterial:  (id: string, count?: number) => void;
  craftPotion:  (potionId: string) => boolean;
  usePotion:    (potionId: string) => boolean;

  // ── 제작 공방 메서드 ──────────────────────────────────────────────────────────
  /** 재료가 부족하면 아무것도 소모/생성하지 않고 null을 반환 */
  craftWorkshopRecipe: (recipe: CraftingRecipe, rpsResult: RpsResult) => CraftedItem | null;
  /** 품질을 외부(QTE 미니게임 등)에서 이미 결정한 경우 직접 전달. 재료 부족 시 null 반환 */
  craftWorkshopRecipeByQuality: (recipe: CraftingRecipe, quality: ItemQuality) => CraftedItem | null;
  grantWorkshopTestMaterials: () => void;
  addCraftedArtifact: (instance: ArtifactInstance) => void;
  removeCraftedArtifact: (instanceId: string) => void;
  /** 장비 성장(레벨업/강화) — instanceId 기준으로 가방 + 장착 위치 모두 업데이트
   *  level 값을 포함하면 레벨 10 배수 달성 시 부가 능력치를 자동으로 해제한다 */
  updateCraftedArtifact: (
    instanceId: string,
    patch: Partial<Pick<ArtifactInstance, "level" | "enhancement" | "bonusStats">>,
  ) => void;

  // ── 아티팩트 장착/해제 ────────────────────────────────────────────────────────
  equipArtifact: (monsterUid: string, artifact: ArtifactInstance) => void;
  unequipArtifact: (monsterUid: string, instanceId: string) => void;

  // ── 버리기 / 놓아주기 ─────────────────────────────────────────────────────────
  discardMaterial: (id: string, amount: number) => void;
  discardPotion: (stackId: string, amount: number) => void;
  discardArtifact: (instanceId: string) => void;
  releaseMonster: (uid: string) => boolean;

  /** 개발자 모드 진입 시: 모든 몬스터 도감 해금 + 전 종족 보유 + 50층 도전 가능 상태로 세팅 */
  loadDevPreset: () => void;

}

export const usePlayerStore = create<PlayerState>()(
  persist<PlayerState, [], [], PersistedPlayerState>(
    (set, get) => ({
      ...createInitialState(),

      addToDexSeen: (id) =>
        set((s) => ({
          dexSeen: s.dexSeen.includes(id) ? s.dexSeen : [...s.dexSeen, id],
        })),

      addToDexCaught: (id) =>
        set((s) => ({
          dexSeen:   s.dexSeen.includes(id)   ? s.dexSeen   : [...s.dexSeen, id],
          dexCaught: s.dexCaught.includes(id) ? s.dexCaught : [...s.dexCaught, id],
        })),

      updateBestFloor: (floor) =>
        set((s) => ({ bestFloor: Math.max(s.bestFloor, floor) })),

      setStoryFlag: (flag) =>
        set((s) => ({ storyFlags: { ...s.storyFlags, [flag]: true } })),

      acceptQuest: (questId) =>
        set((s) => ({ questStatus: { ...s.questStatus, [questId]: "in_progress" } })),

      completeQuest: (questId, objective, rewards, setsFlag) => {
        const s = get();
        if ((s.materials[objective.itemId] ?? 0) < objective.amount) return false;
        const newMats = { ...s.materials };
        newMats[objective.itemId] = (newMats[objective.itemId] ?? 0) - objective.amount;
        for (const reward of rewards) {
          newMats[reward.itemId] = (newMats[reward.itemId] ?? 0) + reward.amount;
        }
        set({
          materials:   newMats,
          questStatus: { ...s.questStatus, [questId]: "completed" },
          storyFlags:  { ...s.storyFlags, [setsFlag]: true },
        });
        return true;
      },

      addCapturedMonster: (monster) => {
        let result: "storage" | "full" = "full";
        set((s) => {
          if (s.storage.length >= 30) return {};
          result = "storage";
          return {
            storage:   [...s.storage, monsterToOwned(monster)],
            dexSeen:   s.dexSeen.includes(monster.id)   ? s.dexSeen   : [...s.dexSeen, monster.id],
            dexCaught: s.dexCaught.includes(monster.id) ? s.dexCaught : [...s.dexCaught, monster.id],
          };
        });
        return result;
      },

      swapWithStorage: (partyIndex, storageUid) =>
        set((s) => {
          const si = s.storage.findIndex((m) => m.uid === storageUid);
          if (si === -1 || partyIndex >= s.party.length) return s;
          const np = [...s.party]; const ns = [...s.storage];
          [np[partyIndex], ns[si]] = [ns[si], np[partyIndex]];
          return { party: np, storage: ns };
        }),

      moveToStorage: (partyIndex) =>
        set((s) => {
          if (s.party.length <= 1) return s;
          const np = [...s.party];
          const [removed] = np.splice(partyIndex, 1);
          return { party: np, storage: [...s.storage, removed] };
        }),

      moveToParty: (storageUid, partyIndex) =>
        set((s) => {
          if (s.party.length >= 3) return s;
          const si = s.storage.findIndex((m) => m.uid === storageUid);
          if (si === -1) return s;
          const ns = [...s.storage];
          const [moved] = ns.splice(si, 1);
          const np = [...s.party];
          if (partyIndex !== undefined && partyIndex <= np.length) {
            np.splice(partyIndex, 0, moved);
          } else {
            np.push(moved);
          }
          return { party: np, storage: ns };
        }),

      swapPartySlots: (indexA, indexB) =>
        set((s) => {
          const p = [...s.party];
          if (indexA >= p.length || indexB >= p.length) return s;
          [p[indexA], p[indexB]] = [p[indexB], p[indexA]];
          return { party: p };
        }),

      updatePartyMemberHp: (uid, currentHp) =>
        set((s) => ({
          party: s.party.map((m) => (m.uid === uid ? { ...m, currentHp } : m)),
        })),

      updatePartyMember: (updated) =>
        set((s) => ({
          party: s.party.map((m) => (m.uid === updated.uid ? updated : m)),
        })),

      restorePartyHp: () =>
        set((s) => ({
          party: s.party.map((m) => ({ ...m, currentHp: m.maxHp })),
        })),

      addMaterial: (id, count = 1) =>
        set((s) => ({
          materials: { ...s.materials, [id]: (s.materials[id] ?? 0) + count },
        })),

      craftPotion: (potionId) => {
        const potion = POTIONS.find((p) => p.id === potionId);
        if (!potion) return false;
        const s = get();
        for (const [matId, needed] of Object.entries(potion.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(potion.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({ materials: newMats, potions: { ...s.potions, [potionId]: (s.potions[potionId] ?? 0) + 1 } });
        return true;
      },

      usePotion: (potionId) => {
        const s = get();
        if ((s.potions[potionId] ?? 0) <= 0) return false;
        set({ potions: { ...s.potions, [potionId]: s.potions[potionId] - 1 } });
        return true;
      },

      craftWorkshopRecipe: (recipe, rpsResult) => {
        const quality = rollItemQuality(rpsResult);
        return get().craftWorkshopRecipeByQuality(recipe, quality);
      },

      craftWorkshopRecipeByQuality: (recipe, quality) => {
        const s = get();
        for (const cost of recipe.costs) {
          if ((s.materials[cost.itemId] ?? 0) < cost.amount) return null;
        }
        // ── 재료 소모 ──────────────────────────────────────────────────────────────
        const newMats = { ...s.materials };
        for (const cost of recipe.costs) {
          newMats[cost.itemId] = (newMats[cost.itemId] ?? 0) - cost.amount;
        }
        // ── 아티팩트 스탯 계산 ──────────────────────────────────────────────────────
        const statBonuses =
          recipe.stationType === "artifact" && recipe.baseStats
            ? applyArtifactQualityStats(recipe.baseStats, quality)
            : undefined;
        // ── 제작 로그 ─────────────────────────────────────────────────────────────
        const craftedItem: CraftedItem = {
          id: makeUid(),
          recipeId: recipe.id,
          name: recipe.resultItemName,
          quality,
          stationType: recipe.stationType,
          createdAt: Date.now(),
          statBonuses,
        };
        // ── 물약 → potions 레코드 + craftedPotions 스택 ────────────────────────────
        const newPotions = { ...s.potions };
        let newCraftedPotions = s.craftedPotions;
        let newCraftedArtifacts = s.craftedArtifacts;

        if (recipe.stationType === "potion") {
          newPotions[recipe.resultItemId] = (newPotions[recipe.resultItemId] ?? 0) + 1;
          const stackId = `${recipe.resultItemId}_${quality}`;
          const idx = newCraftedPotions.findIndex((p) => p.stackId === stackId);
          if (idx >= 0) {
            newCraftedPotions = newCraftedPotions.map((p, i) =>
              i === idx ? { ...p, quantity: p.quantity + 1 } : p,
            );
          } else {
            newCraftedPotions = [
              ...newCraftedPotions,
              { stackId, itemId: recipe.resultItemId, name: recipe.resultItemName, quality, quantity: 1 },
            ];
          }
        } else if (recipe.stationType === "artifact") {
          const instance: ArtifactInstance = {
            instanceId: makeUid(),
            itemId: recipe.resultItemId,
            name: recipe.resultItemName,
            quality,
            description: recipe.description,
            statBonuses: statBonuses ?? [],
            createdAt: Date.now(),
            level:       1,
            enhancement: 0,
            source:      "crafting",
          };
          newCraftedArtifacts = [...newCraftedArtifacts, instance];
        }

        set({
          materials:        newMats,
          potions:          newPotions,
          craftedItems:     [craftedItem, ...s.craftedItems].slice(0, 50),
          craftedArtifacts: newCraftedArtifacts,
          craftedPotions:   newCraftedPotions,
        });
        return craftedItem;
      },

      addCraftedArtifact: (instance) =>
        set((s) => ({ craftedArtifacts: [...s.craftedArtifacts, instance] })),

      updateCraftedArtifact: (instanceId, patch) =>
        set((s) => {
          const applyPatch = (a: ArtifactInstance): ArtifactInstance => {
            if (a.instanceId !== instanceId) return a;
            const updated = { ...a, ...patch };
            // 레벨 변경 시 부가 능력치 자동 해제
            if (patch.level !== undefined) {
              const prevLevel = a.level ?? 1;
              const newBonusStats = rollBonusStats(
                a.itemId,
                prevLevel,
                patch.level,
                updated.bonusStats ?? [],
              );
              updated.bonusStats = newBonusStats;
            }
            return updated;
          };
          const newEquipped: Record<string, ArtifactInstance[]> = {};
          for (const [uid, list] of Object.entries(s.equippedArtifacts)) {
            newEquipped[uid] = list.map(applyPatch);
          }
          return {
            craftedArtifacts:  s.craftedArtifacts.map(applyPatch),
            equippedArtifacts: newEquipped,
          };
        }),

      removeCraftedArtifact: (instanceId) =>
        set((s) => ({
          craftedArtifacts: s.craftedArtifacts.filter((a) => a.instanceId !== instanceId),
        })),

      equipArtifact: (monsterUid, artifact) => {
        const slot = ARTIFACT_SLOT_MAP[artifact.itemId];
        if (!slot) return;
        set((s) => {
          const current = s.equippedArtifacts[monsterUid] ?? [];
          // 같은 슬롯에 이미 장착된 아티팩트 찾기
          const displaced = current.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
          // 가방에서 장착할 아티팩트 제거
          const newBag = s.craftedArtifacts.filter((a) => a.instanceId !== artifact.instanceId);
          // 교체된 아티팩트는 가방으로 반환
          const finalBag = displaced ? [...newBag, displaced] : newBag;
          const newEquipped = [
            ...current.filter((a) => ARTIFACT_SLOT_MAP[a.itemId] !== slot),
            artifact,
          ];
          return {
            craftedArtifacts:  finalBag,
            equippedArtifacts: { ...s.equippedArtifacts, [monsterUid]: newEquipped },
          };
        });
      },

      unequipArtifact: (monsterUid, instanceId) => {
        set((s) => {
          const current = s.equippedArtifacts[monsterUid] ?? [];
          const artifact = current.find((a) => a.instanceId === instanceId);
          if (!artifact) return s;
          return {
            craftedArtifacts:  [...s.craftedArtifacts, artifact],
            equippedArtifacts: {
              ...s.equippedArtifacts,
              [monsterUid]: current.filter((a) => a.instanceId !== instanceId),
            },
          };
        });
      },

      discardMaterial: (id, amount) =>
        set((s) => ({
          materials: {
            ...s.materials,
            [id]: Math.max(0, (s.materials[id] ?? 0) - amount),
          },
        })),

      discardPotion: (stackId, amount) =>
        set((s) => {
          const stack = s.craftedPotions.find((p) => p.stackId === stackId);
          if (!stack) return s;
          const newQty = Math.max(0, stack.quantity - amount);
          return {
            potions: {
              ...s.potions,
              [stack.itemId]: Math.max(0, (s.potions[stack.itemId] ?? 0) - amount),
            },
            craftedPotions: newQty <= 0
              ? s.craftedPotions.filter((p) => p.stackId !== stackId)
              : s.craftedPotions.map((p) => p.stackId === stackId ? { ...p, quantity: newQty } : p),
          };
        }),

      discardArtifact: (instanceId) =>
        set((s) => {
          // 혹시 장착 중이라면 장착 해제도 처리
          const newEquipped: Record<string, ArtifactInstance[]> = {};
          for (const uid of Object.keys(s.equippedArtifacts)) {
            newEquipped[uid] = (s.equippedArtifacts[uid] ?? []).filter(
              (a) => a.instanceId !== instanceId,
            );
          }
          return {
            craftedArtifacts:  s.craftedArtifacts.filter((a) => a.instanceId !== instanceId),
            equippedArtifacts: newEquipped,
          };
        }),

      releaseMonster: (uid) => {
        const s = get();
        const inPartyIdx = s.party.findIndex((m) => m.uid === uid);
        if (inPartyIdx >= 0) {
          if (s.party.length <= 1) return false; // 마지막 파티원 보호
        } else if (!s.storage.find((m) => m.uid === uid)) {
          return false; // 존재하지 않음
        }
        // 장착 아티팩트 회수
        const equipped = s.equippedArtifacts[uid] ?? [];
        const newEquipped = { ...s.equippedArtifacts };
        delete newEquipped[uid];
        const newBag = [...s.craftedArtifacts, ...equipped];

        if (inPartyIdx >= 0) {
          set({
            party: s.party.filter((m) => m.uid !== uid),
            craftedArtifacts:  newBag,
            equippedArtifacts: newEquipped,
          });
        } else {
          set({
            storage: s.storage.filter((m) => m.uid !== uid),
            craftedArtifacts:  newBag,
            equippedArtifacts: newEquipped,
          });
        }
        return true;
      },

      grantWorkshopTestMaterials: () => {
        set((s) => {
          const newMats = { ...s.materials };
          for (const [id, count] of Object.entries(WORKSHOP_TEST_MATERIALS)) {
            newMats[id] = (newMats[id] ?? 0) + count;
          }
          return { materials: newMats };
        });
      },

      loadDevPreset: () => {
        // 오름(최종 보스)은 포획 불가능한 존재라 개발자 모드에서도 보유/도감 대상에서 제외한다
        const catchableMonsters = monsters.filter((m) => m.id !== "ormr");
        const ids = catchableMonsters.map((m) => m.id);
        // monsters.ts 앞 3종은 초반 스타터(플레미·버노·아쿠비)라, 그대로 파티에 넣으면
        // 만렙 장비를 껴도 50층을 시험할 수 없다. 최종 진화체 위주로 강한 순서대로 세운다.
        const partyIds = DEV_PARTY_IDS.filter((id) => catchableMonsters.some((m) => m.id === id));
        const owned = [
          ...partyIds.map((id) => catchableMonsters.find((m) => m.id === id)!),
          ...catchableMonsters.filter((m) => !partyIds.includes(m.id)),
        ].map((m) => {
          const stats = recomputeStatsForLevel(m, DEV_PARTY_LEVEL);
          return {
            ...m,
            ...stats,
            level: DEV_PARTY_LEVEL,
            uid: makeUid(),
            currentHp: stats.maxHp,
          } as OwnedMonster;
        });
        const party = owned.slice(0, 3);

        // 파티 3마리에게 만렙 엘리트 아티팩트 풀세트를 장착시킨다.
        // 레벨 50 파티만으로는 50층 오름(HP 1870 / 공격 498 / 방어 319)을 이길 수 없어
        // "50층 테스트 대응"이라는 이 프리셋의 목적 자체가 성립하지 않는다.
        const equippedArtifacts: Record<string, ArtifactInstance[]> = {};
        for (const m of party) {
          equippedArtifacts[m.uid] = DEV_PRESET_ARTIFACTS.map(makeDevArtifact);
        }

        set({
          party,
          storage:    owned.slice(3),
          dexSeen:    ids,
          dexCaught:  ids,
          bestFloor:  MAX_TOWER_FLOOR - 1,
          potions:    { ...DEV_PRESET_POTIONS },
          equippedArtifacts,
        });
      },


    }),
    {
      name: "monster-rpg-player",
      version: PERSIST_VERSION,
      migrate,
      // migrate는 저장된 version이 다를 때만 실행된다. 버전이 같아도(같은 세션 내
      // 수동 localStorage 편집 등으로) 필드가 깨져 있을 수 있으니, 매 로드마다
      // normalizeState를 한 번 더 거쳐 이중으로 방어한다.
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[playerStore] 세이브를 불러오는 중 오류가 발생했습니다.", error);
          return;
        }
        if (!state) return;
        try {
          Object.assign(state, normalizeState(state));
        } catch (err) {
          console.warn("[playerStore] 세이브 정규화 중 오류가 발생해 초기 상태로 되돌립니다.", err);
          Object.assign(state, createInitialState());
        }
      },
    }
  )
);
