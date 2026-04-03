import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster } from "../types/game";
import { monsters } from "../data/monsters";

// ─── OwnedMonster ────────────────────────────────────────────────────────────────

/** 플레이어가 보유한 몬스터 인스턴스 */
export interface OwnedMonster extends Monster {
  uid: string;       // 고유 인스턴스 ID (포획 시 uuid로 생성)
  nickname?: string;
  currentHp: number; // 현재 HP
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
  party: OwnedMonster[];    // 최대 3마리 (순서 = 전투 우선 순위)
  storage: OwnedMonster[];  // 보관함 (최대 30)
  dex: string[];            // 조우/포획한 monsterID 목록
  bestFloor: number;        // 최고 도달 층

  // ─── 도감 ────────────────────────────────────────────────────────────────────
  addToDex: (monsterId: string) => void;

  // ─── 탑 ──────────────────────────────────────────────────────────────────────
  updateBestFloor: (floor: number) => void;

  // ─── 포획 ────────────────────────────────────────────────────────────────────
  addCapturedMonster: (monster: Monster) => "party" | "storage" | "full";

  // ─── 파티 관리 ───────────────────────────────────────────────────────────────
  /**
   * storage[uid] ↔ party[partyIndex] 교체.
   * partyIndex가 빈 슬롯(-1 아닌 값)이어야 함.
   */
  swapWithStorage: (partyIndex: number, storageUid: string) => void;
  /** 파티에서 제거 → 보관함으로 이동 */
  moveToStorage: (partyIndex: number) => void;
  /** 보관함에서 빈 파티 슬롯(또는 지정 슬롯)으로 이동 */
  moveToParty: (storageUid: string, partyIndex?: number) => void;
  /** 파티 슬롯 재배치 (드래그 없는 클릭 교체 지원) */
  swapPartySlots: (indexA: number, indexB: number) => void;

  // ─── 배틀 동기화 ─────────────────────────────────────────────────────────────
  /** 파티 몬스터 하나의 현재 HP 업데이트 */
  updatePartyMemberHp: (uid: string, currentHp: number) => void;
  /** 파티 몬스터 하나를 완전 교체 (경험치/레벨업 반영 등) */
  updatePartyMember: (updated: OwnedMonster) => void;
  /** 배틀 후 파티 전원 HP 전회복 */
  restorePartyHp: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      party:     [initialFlameling],
      storage:   [],
      dex:       ["flameling"],
      bestFloor: 0,

      // ── 도감 ──
      addToDex: (monsterId) =>
        set((s) => ({
          dex: s.dex.includes(monsterId) ? s.dex : [...s.dex, monsterId],
        })),

      // ── 최고층 ──
      updateBestFloor: (floor) =>
        set((s) => ({ bestFloor: Math.max(s.bestFloor, floor) })),

      // ── 포획 ──
      addCapturedMonster: (monster) => {
        let result: "party" | "storage" | "full" = "full";
        set((s) => {
          const owned = monsterToOwned(monster);
          const newDex = s.dex.includes(monster.id) ? s.dex : [...s.dex, monster.id];
          if (s.party.length < 3) {
            result = "party";
            return { party: [...s.party, owned], dex: newDex };
          } else if (s.storage.length < 30) {
            result = "storage";
            return { storage: [...s.storage, owned], dex: newDex };
          }
          return { dex: newDex };
        });
        return result;
      },

      // ── 파티 ↔ 보관함 교체 ──
      swapWithStorage: (partyIndex, storageUid) =>
        set((s) => {
          const storageIdx = s.storage.findIndex((m) => m.uid === storageUid);
          if (storageIdx === -1 || partyIndex >= s.party.length) return s;
          const newParty   = [...s.party];
          const newStorage = [...s.storage];
          const tmp = newParty[partyIndex];
          newParty[partyIndex] = newStorage[storageIdx];
          newStorage[storageIdx] = tmp;
          return { party: newParty, storage: newStorage };
        }),

      moveToStorage: (partyIndex) =>
        set((s) => {
          if (s.party.length <= 1) return s; // 마지막 1마리는 이동 불가
          const newParty = [...s.party];
          const [removed] = newParty.splice(partyIndex, 1);
          return { party: newParty, storage: [...s.storage, removed] };
        }),

      moveToParty: (storageUid, partyIndex) =>
        set((s) => {
          if (s.party.length >= 3) return s;
          const storageIdx = s.storage.findIndex((m) => m.uid === storageUid);
          if (storageIdx === -1) return s;
          const newStorage = [...s.storage];
          const [moved] = newStorage.splice(storageIdx, 1);
          const newParty = [...s.party];
          if (partyIndex !== undefined && partyIndex <= newParty.length) {
            newParty.splice(partyIndex, 0, moved);
          } else {
            newParty.push(moved);
          }
          return { party: newParty, storage: newStorage };
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
    }),
    {
      name: "monster-rpg-player",
    }
  )
);
