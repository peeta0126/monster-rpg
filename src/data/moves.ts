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

/** 전기 물리 기술: 20% 마비 */
export const spark: Move = {
  id: "spark",
  name: "스파크",
  type: "electric",
  power: 45,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 20,
};

/** 얼음 특수 기술: 10% 빙결 */
export const iceBeam: Move = {
  id: "ice-beam",
  name: "냉동빔",
  type: "ice",
  power: 60,
  accuracy: 95,
  category: "special",
  statusEffect: "freeze",
  statusChance: 10,
};

/** 얼음 강력 기술: 20% 빙결, 명중률 낮음 */
export const blizzard: Move = {
  id: "blizzard",
  name: "눈보라",
  type: "ice",
  power: 80,
  accuracy: 85,
  category: "special",
  statusEffect: "freeze",
  statusChance: 20,
};

/** 노말 선제 물리 기술 */
export const quickAttack: Move = {
  id: "quick-attack",
  name: "칼같은바람",
  type: "normal",
  power: 35,
  accuracy: 100,
  category: "physical",
};

/** 노말 강타: 30% 마비 */
export const bodySlam: Move = {
  id: "body-slam",
  name: "몸통치기",
  type: "normal",
  power: 60,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 불꽃 강화 기술 */
export const flamethrower: Move = {
  id: "flamethrower",
  name: "화염방사",
  type: "fire",
  power: 70,
  accuracy: 100,
  category: "special",
  statusEffect: "burn",
  statusChance: 15,
};

/** 물 강화 기술 */
export const surf: Move = {
  id: "surf",
  name: "파도타기",
  type: "water",
  power: 70,
  accuracy: 100,
  category: "special",
};

/** 풀 강화 기술 */
export const solarBeam: Move = {
  id: "solar-beam",
  name: "솔라빔",
  type: "grass",
  power: 75,
  accuracy: 100,
  category: "special",
};