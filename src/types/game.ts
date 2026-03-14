export type ElementType = "fire" | "water" | "grass" | "normal";

export interface Move {
  id: string;
  name: string;
  type: ElementType;
  power: number;
  accuracy: number;
  category: "physical" | "special" | "status";
}

export interface Monster {
  id: string;
  name: string;
  type: ElementType;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  moves: Move[];

  level: number;
  exp: number;
  expToNextLevel: number;
  rewardExp: number;
}

//베이스캠프
export type Position = {
  x: number;
  y: number;
};

export type CampMonsterData = {
  id: string;
  name: string;
  image: string;
  position: Position;
};

export type PortalData = {
  id: string;
  label: string;
  position: Position;
  target: "battle" | "forest" | "volcano";
};

export type UnlockZoneData = {
  id: string;
  name: string;
  position: Position;
  width: number;
  height: number;
  unlocked: boolean;
};