import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster } from "../types/game";
import { monsters } from "../data/monsters";
import { POTIONS } from "../data/items";

// ─── OwnedMonster ────────────────────────────────────────────────────────────────

/** 플레이어가 보유한 몬스터 인스턴스 */
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

// 초기 파티: 플레미(lv1)
const initialFlameling = monsterToOwned(monsters[0]);

// ─── Store ────────────────────────────────────────────────────────────────────────

interface PlayerState {
  /** 전투에 데려가는 몬스터 (최대 3마리) */
  party: OwnedMonster[];
  /** 농장에 보관 중인 몬스터 (최대 30마리) */
  storage: OwnedMonster[];
  /** 조우한 적 있는 monsterID (이미지 공개) */
  dexSeen: string[];
  /** 포획에 성공한 monsterID (전체 정보 공개) */
  dexCaught: string[];
  /** 보유 재료 { materialId: count } */
  materials: Record<string, number>;
  /** 보유 물약 { potionId: count } */
  potions: Record<string, number>;
  /** 최고 도달 층 */
  bestFloor: number;

  // ── 도감 ──────────────────────────────────────────────────────────────────────
  addToDexSeen:   (id: string) => void;
  addToDexCaught: (id: string) => void;

  // ── 탑 ────────────────────────────────────────────────────────────────────────
  updateBestFloor: (floor: number) => void;

  // ── 포획 (항상 보관함/농장으로) ───────────────────────────────────────────────
  addCapturedMonster: (monster: Monster) => "storage" | "full";

  // ── 파티 관리 ─────────────────────────────────────────────────────────────────
  swapWithStorage:  (partyIndex: number, storageUid: string) => void;
  moveToStorage:    (partyIndex: number) => void;
  moveToParty:      (storageUid: string, partyIndex?: number) => void;
  swapPartySlots:   (indexA: number, indexB: number) => void;

  // ── 배틀 동기화 ───────────────────────────────────────────────────────────────
  updatePartyMemberHp:  (uid: string, currentHp: number) => void;
  updatePartyMember:    (updated: OwnedMonster) => void;
  restorePartyHp:       () => void;

  // ── 아이템 ────────────────────────────────────────────────────────────────────
  addMaterial:  (id: string, count?: number) => void;
  /** 레시피에 맞는 재료가 있으면 소모 후 물약 추가. 성공 여부 반환. */
  craftPotion:  (potionId: string) => boolean;
  /** 물약 1개 소모. 성공(있었으면) true 반환. */
  usePotion:    (potionId: string) => boolean;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      party:     [initialFlameling],
      storage:   [],
      dexSeen:   ["flameling"],
      dexCaught: ["flameling"],
      materials: {},
      potions:   {},
      bestFloor: 0,

      // ── 도감 ──
      addToDexSeen: (id) =>
        set((s) => ({
          dexSeen: s.dexSeen.includes(id) ? s.dexSeen : [...s.dexSeen, id],
        })),

      addToDexCaught: (id) =>
        set((s) => ({
          dexSeen:   s.dexSeen.includes(id)   ? s.dexSeen   : [...s.dexSeen, id],
          dexCaught: s.dexCaught.includes(id) ? s.dexCaught : [...s.dexCaught, id],
        })),

      // ── 최고층 ──
      updateBestFloor: (floor) =>
        set((s) => ({ bestFloor: Math.max(s.bestFloor, floor) })),

      // ── 포획 → 항상 보관함(농장)으로 ──
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

      // ── 파티 ↔ 보관함 ──
      swapWithStorage: (partyIndex, storageUid) =>
        set((s) => {
          const si = s.storage.findIndex((m) => m.uid === storageUid);
          if (si === -1 || partyIndex >= s.party.length) return s;
          const np = [...s.party];
          const ns = [...s.storage];
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

      // ── 배틀 동기화 ──
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

      // ── 아이템 ──
      addMaterial: (id, count = 1) =>
        set((s) => ({
          materials: { ...s.materials, [id]: (s.materials[id] ?? 0) + count },
        })),

      craftPotion: (potionId) => {
        const potion = POTIONS.find((p) => p.id === potionId);
        if (!potion) return false;
        const s = get();
        // 재료 충분한지 확인
        for (const [matId, needed] of Object.entries(potion.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        // 재료 소모 + 물약 추가
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(potion.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({
          materials: newMats,
          potions: { ...s.potions, [potionId]: (s.potions[potionId] ?? 0) + 1 },
        });
        return true;
      },

      usePotion: (potionId) => {
        const s = get();
        if ((s.potions[potionId] ?? 0) <= 0) return false;
        set({ potions: { ...s.potions, [potionId]: s.potions[potionId] - 1 } });
        return true;
      },
    }),
    { name: "monster-rpg-player" }
  )
);
