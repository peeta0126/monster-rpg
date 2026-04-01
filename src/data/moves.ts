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
  // 10% 확률로 화상 유발
  statusEffect: "burn",
  statusChance: 10,
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

/** 전기 속성 기술: 30% 확률로 마비 유발 */
export const thunderbolt: Move = {
  id: "thunderbolt",
  name: "10만볼트",
  type: "electric",
  power: 60,
  accuracy: 100,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 상태이상 전용 기술: 독 확정 유발 (power 0) */
export const toxic: Move = {
  id: "toxic",
  name: "독침",
  type: "normal",
  power: 0,
  accuracy: 90,
  category: "status",
  statusEffect: "poison",
  statusChance: 100,
};

/** 풀 속성 기술: 10% 확률로 빙결 유발 */
export const iceLeaf: Move = {
  id: "ice-leaf",
  name: "얼음잎새",
  type: "grass",
  power: 55,
  accuracy: 90,
  category: "special",
  statusEffect: "freeze",
  statusChance: 10,
};