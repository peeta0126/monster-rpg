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

// ─── 추가 기술들 ──────────────────────────────────────────────────────────────

/** 불꽃 물리: 15% 화상 */
export const firePunch: Move = {
  id: "fire-punch",
  name: "화염펀치",
  type: "fire",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "burn",
  statusChance: 15,
};

/** 노말 물리: 강력 기본기 */
export const headbutt: Move = {
  id: "headbutt",
  name: "박치기",
  type: "normal",
  power: 55,
  accuracy: 100,
  category: "physical",
};

/** 노말 상태이상: 독 확정 */
export const poisonPowder: Move = {
  id: "poison-powder",
  name: "독가루",
  type: "normal",
  power: 0,
  accuracy: 85,
  category: "status",
  statusEffect: "poison",
  statusChance: 100,
};

/** 물 물리: 20% 마비 */
export const waterPulse: Move = {
  id: "water-pulse",
  name: "파문",
  type: "water",
  power: 50,
  accuracy: 100,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 20,
};

/** 풀 물리: 씨앗 공격 */
export const seedBomb: Move = {
  id: "seed-bomb",
  name: "씨앗폭탄",
  type: "grass",
  power: 60,
  accuracy: 100,
  category: "physical",
};

/** 얼음 물리: 10% 빙결 */
export const icePunch: Move = {
  id: "ice-punch",
  name: "냉동펀치",
  type: "ice",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "freeze",
  statusChance: 10,
};

/** 전기 강타: 30% 마비 */
export const thunderPunch: Move = {
  id: "thunder-punch",
  name: "번개펀치",
  type: "electric",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 노말 강타: 높은 위력 */
export const hyperBeam: Move = {
  id: "hyper-beam",
  name: "하이퍼빔",
  type: "normal",
  power: 90,
  accuracy: 90,
  category: "special",
};

/** 불꽃 최강: 화상 확률 높음 */
export const overheat: Move = {
  id: "overheat",
  name: "오버히트",
  type: "fire",
  power: 90,
  accuracy: 90,
  category: "special",
  statusEffect: "burn",
  statusChance: 30,
};

/** 물 최강: 파도 */
export const hydropump: Move = {
  id: "hydropump",
  name: "하이드로펌프",
  type: "water",
  power: 90,
  accuracy: 80,
  category: "special",
};

/** 풀 독: 20% 독 */
export const poisonJab: Move = {
  id: "poison-jab",
  name: "독침찌르기",
  type: "grass",
  power: 60,
  accuracy: 100,
  category: "physical",
  statusEffect: "poison",
  statusChance: 20,
};

/** 전기 최강: 50% 마비 */
export const thunder: Move = {
  id: "thunder",
  name: "천둥",
  type: "electric",
  power: 90,
  accuracy: 70,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 50,
};

/** 얼음 최강: 30% 빙결 */
export const sheerCold: Move = {
  id: "sheer-cold",
  name: "절대영도",
  type: "ice",
  power: 85,
  accuracy: 75,
  category: "special",
  statusEffect: "freeze",
  statusChance: 30,
};

/** 노말 필살: 반동 없는 강타 */
export const giga_impact: Move = {
  id: "giga-impact",
  name: "기가임팩트",
  type: "normal",
  power: 85,
  accuracy: 90,
  category: "physical",
};