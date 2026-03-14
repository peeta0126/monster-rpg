import type { Move } from "../types/game";

export const tackle: Move = {
  id: "tackle",
  name: "몸통박치기",
  type: "normal",
  power: 40,
  accuracy: 100,
  category: "physical",
};

export const ember: Move = {
  id: "ember",
  name: "불꽃",
  type: "fire",
  power: 50,
  accuracy: 95,
  category: "special",
};

export const waterGun: Move = {
  id: "water-gun",
  name: "물대포",
  type: "water",
  power: 50,
  accuracy: 95,
  category: "special",
};

export const vineWhip: Move = {
  id: "vine-whip",
  name: "덩굴채찍",
  type: "grass",
  power: 45,
  accuracy: 100,
  category: "physical",
};