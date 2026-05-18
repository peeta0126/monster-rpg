import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster, HousingBonuses } from "../types/game";
import type { CraftingRecipe, CraftedItem, ArtifactInstance, CraftedPotionStack } from "../types/crafting";
import { monsters } from "../data/monsters";
import { POTIONS } from "../data/items";
import { rollItemQuality, applyArtifactQualityStats, ARTIFACT_SLOT_MAP } from "../utils/crafting";
import type { RpsResult } from "../utils/crafting";

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

  // ── 제작 공방 ─────────────────────────────────────────────────────────────────
  craftedItems: CraftedItem[];
  craftedArtifacts: ArtifactInstance[];
  craftedPotions: CraftedPotionStack[];

  // ── 아티팩트 장착 ─────────────────────────────────────────────────────────────
  equippedArtifacts: Record<string, ArtifactInstance[]>; // monsterUid → 장착 목록

  addToDexSeen:   (id: string) => void;
  addToDexCaught: (id: string) => void;
  updateBestFloor: (floor: number) => void;
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
  craftWorkshopRecipe: (recipe: CraftingRecipe, rpsResult: RpsResult) => CraftedItem;
  grantWorkshopTestMaterials: () => void;
  addCraftedArtifact: (instance: ArtifactInstance) => void;
  removeCraftedArtifact: (instanceId: string) => void;

  // ── 아티팩트 장착/해제 ────────────────────────────────────────────────────────
  equipArtifact: (monsterUid: string, artifact: ArtifactInstance) => void;
  unequipArtifact: (monsterUid: string, instanceId: string) => void;

  // ── 버리기 / 놓아주기 ─────────────────────────────────────────────────────────
  discardMaterial: (id: string, amount: number) => void;
  discardPotion: (stackId: string, amount: number) => void;
  discardArtifact: (instanceId: string) => void;
  releaseMonster: (uid: string) => boolean;

  // ── 하우징 보너스 (보전용 스텁) ───────────────────────────────────────────────
  getHousingBonuses: () => HousingBonuses;
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
        const s = get();
        // ── 재료 소모 ──────────────────────────────────────────────────────────────
        const newMats = { ...s.materials };
        for (const cost of recipe.costs) {
          newMats[cost.itemId] = (newMats[cost.itemId] ?? 0) - cost.amount;
        }
        // ── 품질 결정 ─────────────────────────────────────────────────────────────
        const quality = rollItemQuality(rpsResult);
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
        // TODO: 아티팩트 장착 시스템 연결 예정
      },

      addCraftedArtifact: (instance) =>
        set((s) => ({ craftedArtifacts: [...s.craftedArtifacts, instance] })),

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

      getHousingBonuses: () => ({
        hpPercent: 0,
        attackPercent: 0,
        defensePercent: 0,
        speedPercent: 0,
        expBonusPercent: 0,
        potionBonusPercent: 0,
      }),
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
      },
    }
  )
);
