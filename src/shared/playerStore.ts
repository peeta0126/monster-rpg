import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster } from "./game";
import type { CraftingRecipe, CraftedItem, ArtifactInstance, CraftedPotionStack, ItemQuality } from "./crafting";
import { monsters } from "../monster/monsters";
import { POTIONS } from "./items";
import { rollItemQuality, applyArtifactQualityStats, ARTIFACT_SLOT_MAP, rollBonusStats } from "./craftingUtils";
import type { RpsResult } from "./craftingUtils";

// ─── 스토리 플래그 ──────────────────────────────────────────────────────────────

/** always: 항상 충족되는 sentinel. floor_*: bestFloor에서 파생(저장 안 함). 나머지는 저장 대상. */
export type StoryFlag =
  | "always"
  | "met_orion"
  | "met_baros"
  | "first_capture"
  | "quest_baros_done"
  | "quest_orion_done"
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
  | "quest_orion_done";

const DEFAULT_STORY_FLAGS: Record<PersistedStoryFlag, boolean> = {
  met_orion: false,
  met_baros: false,
  first_capture: false,
  quest_baros_done: false,
  quest_orion_done: false,
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

const initialFlameling = monsterToOwned(monsters[0]);

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


}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      party:       [initialFlameling],
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


    }),
    {
      name: "monster-rpg-player",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.craftedItems))     state.craftedItems = [];
        if (!Array.isArray(state.craftedArtifacts)) state.craftedArtifacts = [];
        if (!Array.isArray(state.craftedPotions))   state.craftedPotions = [];
        if (typeof state.equippedArtifacts !== "object" || state.equippedArtifacts === null)
          state.equippedArtifacts = {};
        if (typeof state.storyFlags !== "object" || state.storyFlags === null)
          state.storyFlags = { ...DEFAULT_STORY_FLAGS };
        else
          state.storyFlags = { ...DEFAULT_STORY_FLAGS, ...state.storyFlags };
        if (typeof state.questStatus !== "object" || state.questStatus === null)
          state.questStatus = {};
      },
    }
  )
);
