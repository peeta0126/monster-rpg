import { create } from "zustand";
import type { CampMonsterData } from "../types/game";
import flamelingImg from "../assets/monsters/flameling.png";
import leafyImg from "../assets/monsters/leafy.png";

type SceneType = "basecamp" | "battle";

type GameStore = {
  scene: SceneType;
  setScene: (scene: SceneType) => void;

  ownedMonsters: CampMonsterData[];
  setOwnedMonsters: (monsters: CampMonsterData[]) => void;
};

export const useGameStore = create<GameStore>((set) => ({
  scene: "basecamp",
  setScene: (scene) => set({ scene }),

  ownedMonsters: [
    {
      id: "m1",
      name: "Flameling",
      image: flamelingImg,
      position: { x: 320, y: 420 },
    },
    {
      id: "m2",
      name: "Leafy",
      image: leafyImg,
      position: { x: 480, y: 520 },
    },
  ],

  setOwnedMonsters: (monsters) => set({ ownedMonsters: monsters }),
}));