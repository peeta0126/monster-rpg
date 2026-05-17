import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Monster, HousingBonuses } from "../types/game";
import type { PlacedFurniture, PlacedWallDecoration, WallSide } from "../types/housing";
import { WALL_DECORATIONS } from "../data/wallDecorations";
import { WALLPAPERS } from "../data/wallpapers";
import { FLOOR_TILES } from "../data/floorTiles";
import { monsters } from "../data/monsters";
import { POTIONS } from "../data/items";
import { FURNITURE, calcHousingBonuses } from "../data/furniture";
import {
  makeInstanceId,
  canPlaceFurnitureAt,
  getRotatedSize,
} from "../utils/isometric";
import { ROOM_COLS, ROOM_ROWS } from "../constants/housing";

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

// ─── Store ────────────────────────────────────────────────────────────────────────

interface PlayerState {
  party: OwnedMonster[];
  storage: OwnedMonster[];
  dexSeen: string[];
  dexCaught: string[];
  materials: Record<string, number>;
  potions: Record<string, number>;
  bestFloor: number;

  furnitureInventory: Record<string, number>;
  placedFurniture: PlacedFurniture[];

  // ── 방 커스터마이징 ────────────────────────────────────────────────────────────
  wallpaperId: string;
  floorTileId: string;
  wallDecorations: PlacedWallDecoration[];
  wallDecoInventory: Record<string, number>;
  unlockedWallpapers: string[];
  unlockedFloorTiles: string[];

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
  craftFurniture:  (furnitureId: string) => boolean;
  placeFurniture:  (x: number, y: number, furnitureId: string, rotation?: 0 | 90) => boolean;
  moveFurniture:   (instanceId: string, x: number, y: number) => boolean;
  rotateFurniture: (instanceId: string) => void;
  removeFurniture: (instanceId: string) => void;
  getHousingBonuses: () => HousingBonuses;

  // ── 방 커스터마이징 메서드 ──────────────────────────────────────────────────────
  setWallpaper: (id: string) => void;
  setFloorTile: (id: string) => void;
  placeWallDecoration: (wall: WallSide, col: number, row: number, decorId: string) => boolean;
  removeWallDecoration: (instanceId: string) => void;
  craftWallDecoration: (id: string) => boolean;
  craftWallpaper: (id: string) => boolean;
  craftFloorTile: (id: string) => boolean;
  grantAllHousingItems: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      party:              [initialFlameling],
      storage:            [],
      dexSeen:            ["flameling"],
      dexCaught:          ["flameling"],
      materials:          {},
      potions:            {},
      bestFloor:          0,
      furnitureInventory: {},
      placedFurniture:    [],
      wallpaperId:         "wood",
      floorTileId:         "wood",
      wallDecorations:     [],
      wallDecoInventory:   {},
      unlockedWallpapers:  ["wood"],
      unlockedFloorTiles:  ["wood"],

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

      craftFurniture: (furnitureId) => {
        const furniture = FURNITURE.find((f) => f.id === furnitureId);
        if (!furniture) return false;
        const s = get();
        for (const [matId, needed] of Object.entries(furniture.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(furniture.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({
          materials: newMats,
          furnitureInventory: { ...s.furnitureInventory, [furnitureId]: (s.furnitureInventory[furnitureId] ?? 0) + 1 },
        });
        return true;
      },

      placeFurniture: (x, y, furnitureId, rotation = 0) => {
        const s = get();
        if ((s.furnitureInventory[furnitureId] ?? 0) <= 0) return false;

        // maxInRoom 체크
        const fd = FURNITURE.find((f) => f.id === furnitureId);
        if (!fd) return false;
        const alreadyPlaced = s.placedFurniture.filter((p) => p.furnitureId === furnitureId).length;
        if (alreadyPlaced >= fd.maxInRoom) return false;

        // 다중 타일 배치 가능 여부 확인 (회전 반영)
        if (!canPlaceFurnitureAt(furnitureId, x, y, rotation, s.placedFurniture, FURNITURE)) return false;

        const newItem: PlacedFurniture = {
          instanceId: makeInstanceId(),
          furnitureId, x, y,
          rotation,
          placedAt: Date.now(),
        };
        set((prev) => ({
          placedFurniture: [...prev.placedFurniture, newItem],
          furnitureInventory: {
            ...prev.furnitureInventory,
            [furnitureId]: Math.max(0, (prev.furnitureInventory[furnitureId] ?? 0) - 1),
          },
        }));
        return true;
      },

      moveFurniture: (instanceId, x, y) => {
        const s = get();
        const item = s.placedFurniture.find((p) => p.instanceId === instanceId);
        if (!item) return false;

        if (!canPlaceFurnitureAt(item.furnitureId, x, y, item.rotation, s.placedFurniture, FURNITURE, instanceId)) {
          return false;
        }
        set((prev) => ({
          placedFurniture: prev.placedFurniture.map((p) =>
            p.instanceId === instanceId ? { ...p, x, y } : p,
          ),
        }));
        return true;
      },

      rotateFurniture: (instanceId) => {
        const s = get();
        const item = s.placedFurniture.find((p) => p.instanceId === instanceId);
        if (!item) return;
        // 0 ↔ 90 두 상태만 토글 (1번 이미지 ↔ 원본 이미지)
        const nextRotation = (item.rotation === 0 ? 90 : 0) as 0 | 90;

        // 회전 후 배치 가능 여부 확인 (크기가 바뀌는 경우 공간 검사)
        if (!canPlaceFurnitureAt(item.furnitureId, item.x, item.y, nextRotation, s.placedFurniture, FURNITURE, instanceId)) {
          return; // 회전 불가
        }
        set((prev) => ({
          placedFurniture: prev.placedFurniture.map((p) =>
            p.instanceId === instanceId ? { ...p, rotation: nextRotation } : p,
          ),
        }));
      },

      removeFurniture: (instanceId) => {
        const s = get();
        const item = s.placedFurniture.find((p) => p.instanceId === instanceId);
        if (!item) return;
        set((prev) => ({
          placedFurniture: prev.placedFurniture.filter((p) => p.instanceId !== instanceId),
          furnitureInventory: {
            ...prev.furnitureInventory,
            [item.furnitureId]: (prev.furnitureInventory[item.furnitureId] ?? 0) + 1,
          },
        }));
      },

      getHousingBonuses: () =>
        calcHousingBonuses(get().placedFurniture.map((p) => p.furnitureId)),

      setWallpaper: (id) => set({ wallpaperId: id }),

      setFloorTile: (id) => set({ floorTileId: id }),

      placeWallDecoration: (wall, col, row, decorId) => {
        const s = get();
        if ((s.wallDecoInventory[decorId] ?? 0) <= 0) return false;
        // 같은 벽의 같은 셀에 이미 배치된 경우 제거 후 교체
        const existing = s.wallDecorations.find((d) => d.wall === wall && d.col === col && d.row === row);
        const filtered = s.wallDecorations.filter((d) => !(d.wall === wall && d.col === col && d.row === row));
        const newDeco: import("../types/housing").PlacedWallDecoration = {
          instanceId: makeInstanceId(),
          decorId, wall, col, row,
          placedAt: Date.now(),
        };
        const newInv = { ...s.wallDecoInventory, [decorId]: (s.wallDecoInventory[decorId] ?? 0) - 1 };
        if (existing) {
          newInv[existing.decorId] = (newInv[existing.decorId] ?? 0) + 1;
        }
        set({ wallDecorations: [...filtered, newDeco], wallDecoInventory: newInv });
        return true;
      },

      removeWallDecoration: (instanceId) => {
        const s = get();
        const item = s.wallDecorations.find((d) => d.instanceId === instanceId);
        if (!item) return;
        set({
          wallDecorations: s.wallDecorations.filter((d) => d.instanceId !== instanceId),
          wallDecoInventory: { ...s.wallDecoInventory, [item.decorId]: (s.wallDecoInventory[item.decorId] ?? 0) + 1 },
        });
      },

      craftWallpaper: (id) => {
        const wp = WALLPAPERS.find((w) => w.id === id);
        if (!wp) return false;
        const s = get();
        if (s.unlockedWallpapers.includes(id)) return false; // already unlocked
        for (const [matId, needed] of Object.entries(wp.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(wp.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({ materials: newMats, unlockedWallpapers: [...s.unlockedWallpapers, id] });
        return true;
      },

      craftFloorTile: (id) => {
        const ft = FLOOR_TILES.find((f) => f.id === id);
        if (!ft) return false;
        const s = get();
        if (s.unlockedFloorTiles.includes(id)) return false; // already unlocked
        for (const [matId, needed] of Object.entries(ft.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(ft.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({ materials: newMats, unlockedFloorTiles: [...s.unlockedFloorTiles, id] });
        return true;
      },

      grantAllHousingItems: () => {
        set((s) => {
          const newFurnitureInv = { ...s.furnitureInventory };
          for (const f of FURNITURE) newFurnitureInv[f.id] = Math.max(newFurnitureInv[f.id] ?? 0, 10);
          const newDecoInv = { ...s.wallDecoInventory };
          for (const d of WALL_DECORATIONS) newDecoInv[d.id] = Math.max(newDecoInv[d.id] ?? 0, 10);
          return {
            furnitureInventory: newFurnitureInv,
            wallDecoInventory: newDecoInv,
            unlockedWallpapers: WALLPAPERS.map((w) => w.id),
            unlockedFloorTiles: FLOOR_TILES.map((f) => f.id),
          };
        });
      },

      craftWallDecoration: (id) => {
        const decor = WALL_DECORATIONS.find((d) => d.id === id);
        if (!decor) return false;
        const s = get();
        for (const [matId, needed] of Object.entries(decor.recipe)) {
          if ((s.materials[matId] ?? 0) < needed) return false;
        }
        const newMats = { ...s.materials };
        for (const [matId, needed] of Object.entries(decor.recipe)) {
          newMats[matId] = (newMats[matId] ?? 0) - needed;
        }
        set({
          materials: newMats,
          wallDecoInventory: { ...s.wallDecoInventory, [id]: (s.wallDecoInventory[id] ?? 0) + 1 },
        });
        return true;
      },
    }),
    {
      name: "monster-rpg-player",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.furnitureInventory) state.furnitureInventory = {};
        if (!state.wallpaperId) state.wallpaperId = "wood";
        if (!state.floorTileId) state.floorTileId = "wood";
        if (!Array.isArray(state.wallDecorations)) state.wallDecorations = [];
        // 구형 slotIndex 기반 데이터 마이그레이션: col/row 시스템으로 변경되어 초기화
        else if (state.wallDecorations.some((d: any) => 'slotIndex' in d)) state.wallDecorations = [];
        if (!state.wallDecoInventory) state.wallDecoInventory = {};
        if (!Array.isArray(state.unlockedWallpapers)) state.unlockedWallpapers = ["wood"];
        if (!Array.isArray(state.unlockedFloorTiles)) state.unlockedFloorTiles = ["wood"];
        if (!Array.isArray(state.placedFurniture)) {
          state.placedFurniture = [];
        } else if (
          state.placedFurniture.length > 0 &&
          (state.placedFurniture[0] === null || typeof state.placedFurniture[0] === "string")
        ) {
          const legacyDefaultPositions = [
            { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 },
            { x: 1, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 },
          ];
          const migrated: PlacedFurniture[] = [];
          (state.placedFurniture as unknown as (string | null)[]).forEach((id, i) => {
            if (!id) return;
            const pos = legacyDefaultPositions[i] ?? { x: i * 2, y: 0 };
            migrated.push({
              instanceId: makeInstanceId(),
              furnitureId: id,
              x: pos.x, y: pos.y,
              rotation: 0,
              placedAt: Date.now(),
            });
          });
          state.placedFurniture = migrated;
        }
      },
    }
  )
);

// ─── 타일 이동 가능 여부 ─────────────────────────────────────────────────────────

export function isInsideRoom(x: number, y: number): boolean {
  return x >= 0 && x < ROOM_COLS && y >= 0 && y < ROOM_ROWS;
}

export function isTileWalkable(
  x: number,
  y: number,
  placedFurniture: PlacedFurniture[],
): boolean {
  if (!isInsideRoom(x, y)) return false;
  for (const pf of placedFurniture) {
    const fd = FURNITURE.find((f) => f.id === pf.furnitureId);
    const size = fd?.size ?? { width: 1, height: 1 };
    const rSize = getRotatedSize(size, pf.rotation);
    for (let dy = 0; dy < rSize.height; dy++) {
      for (let dx = 0; dx < rSize.width; dx++) {
        if (pf.x + dx === x && pf.y + dy === y) return false;
      }
    }
  }
  return true;
}

export function isDoorTile(x: number, y: number): "farm" | "exit" | null {
  if ((x === 4 || x === 5) && y === ROOM_ROWS - 1) return "farm";
  if (x === ROOM_COLS - 1 && (y === 4 || y === 5)) return "exit";
  return null;
}
