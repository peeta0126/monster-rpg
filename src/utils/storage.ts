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
}

