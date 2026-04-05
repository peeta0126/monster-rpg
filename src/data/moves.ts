import type { Move } from "../types/game";

/** 노말 기본 돌진 */
export const tackle: Move = {
  id: "tackle",
  name: "돌진",
  type: "normal",
  power: 40,
  accuracy: 100,
  category: "physical",
};

/** 불꽃 씨앗: 10% 화상 */
export const ember: Move = {
  id: "ember",
  name: "불씨",
  type: "fire",
  power: 50,
  accuracy: 95,
  category: "special",
  statusEffect: "burn",
  statusChance: 10,
};

/** 물 줄기 특수 */
export const waterGun: Move = {
  id: "water-gun",
  name: "수사포",
  type: "water",
  power: 50,
  accuracy: 95,
  category: "special",
};

/** 풀 덩굴 물리 */
export const vineWhip: Move = {
  id: "vine-whip",
  name: "넝쿨채찍",
  type: "grass",
  power: 45,
  accuracy: 100,
  category: "physical",
};

/** 전기 특수: 30% 마비 */
export const thunderbolt: Move = {
  id: "thunderbolt",
  name: "전격탄",
  type: "electric",
  power: 60,
  accuracy: 100,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 독 상태이상: 독 100% */
export const toxic: Move = {
  id: "toxic",
  name: "독가시",
  type: "poison",
  power: 0,
  accuracy: 90,
  category: "status",
  statusEffect: "poison",
  statusChance: 100,
};

/** 풀+얼음 복합: 10% 빙결 */
export const iceLeaf: Move = {
  id: "ice-leaf",
  name: "빙결잎",
  type: "grass",
  power: 55,
  accuracy: 90,
  category: "special",
  statusEffect: "freeze",
  statusChance: 10,
};

/** 전기 물리: 20% 마비 */
export const spark: Move = {
  id: "spark",
  name: "전기불꽃",
  type: "electric",
  power: 45,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 20,
};

/** 얼음 특수: 10% 빙결 */
export const iceBeam: Move = {
  id: "ice-beam",
  name: "얼음살",
  type: "ice",
  power: 60,
  accuracy: 95,
  category: "special",
  statusEffect: "freeze",
  statusChance: 10,
};

/** 얼음 강타: 20% 빙결, 낮은 명중 */
export const blizzard: Move = {
  id: "blizzard",
  name: "설풍",
  type: "ice",
  power: 80,
  accuracy: 85,
  category: "special",
  statusEffect: "freeze",
  statusChance: 20,
};

/** 노말 선제 물리 */
export const quickAttack: Move = {
  id: "quick-attack",
  name: "질풍",
  type: "normal",
  power: 35,
  accuracy: 100,
  category: "physical",
};

/** 노말 강타: 30% 마비 */
export const bodySlam: Move = {
  id: "body-slam",
  name: "압박",
  type: "normal",
  power: 60,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 불꽃 강화: 15% 화상 */
export const flamethrower: Move = {
  id: "flamethrower",
  name: "화염",
  type: "fire",
  power: 70,
  accuracy: 100,
  category: "special",
  statusEffect: "burn",
  statusChance: 15,
};

/** 물 강화 특수 */
export const surf: Move = {
  id: "surf",
  name: "파도",
  type: "water",
  power: 70,
  accuracy: 100,
  category: "special",
};

/** 풀 강화 특수 */
export const solarBeam: Move = {
  id: "solar-beam",
  name: "광합성포",
  type: "grass",
  power: 75,
  accuracy: 100,
  category: "special",
};

// ─── 추가 기술들 ──────────────────────────────────────────────────────────────

/** 불꽃 물리: 15% 화상 */
export const firePunch: Move = {
  id: "fire-punch",
  name: "화염권",
  type: "fire",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "burn",
  statusChance: 15,
};

/** 노말 박치기 물리 */
export const headbutt: Move = {
  id: "headbutt",
  name: "두강",
  type: "normal",
  power: 55,
  accuracy: 100,
  category: "physical",
};

/** 독 가루: 독 100% (독 타입) */
export const poisonPowder: Move = {
  id: "poison-powder",
  name: "독분말",
  type: "poison",
  power: 0,
  accuracy: 85,
  category: "status",
  statusEffect: "poison",
  statusChance: 100,
};

/** 물 파동: 20% 마비 */
export const waterPulse: Move = {
  id: "water-pulse",
  name: "수파문",
  type: "water",
  power: 50,
  accuracy: 100,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 20,
};

/** 풀 씨앗 폭발 물리 */
export const seedBomb: Move = {
  id: "seed-bomb",
  name: "씨앗폭발",
  type: "grass",
  power: 60,
  accuracy: 100,
  category: "physical",
};

/** 얼음 물리: 10% 빙결 */
export const icePunch: Move = {
  id: "ice-punch",
  name: "빙권",
  type: "ice",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "freeze",
  statusChance: 10,
};

/** 전기 물리: 30% 마비 */
export const thunderPunch: Move = {
  id: "thunder-punch",
  name: "전권",
  type: "electric",
  power: 55,
  accuracy: 100,
  category: "physical",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 노말 극광선 특수 */
export const hyperBeam: Move = {
  id: "hyper-beam",
  name: "극광선",
  type: "normal",
  power: 90,
  accuracy: 90,
  category: "special",
};

/** 불꽃 최강: 30% 화상 */
export const overheat: Move = {
  id: "overheat",
  name: "폭염",
  type: "fire",
  power: 90,
  accuracy: 90,
  category: "special",
  statusEffect: "burn",
  statusChance: 30,
};

/** 물 고압 최강 */
export const hydropump: Move = {
  id: "hydropump",
  name: "고압수류",
  type: "water",
  power: 90,
  accuracy: 80,
  category: "special",
};

/** 독 찌르기: 20% 독 */
export const poisonJab: Move = {
  id: "poison-jab",
  name: "독공",
  type: "poison",
  power: 60,
  accuracy: 100,
  category: "physical",
  statusEffect: "poison",
  statusChance: 20,
};

/** 전기 최강: 50% 마비 */
export const thunder: Move = {
  id: "thunder",
  name: "낙뢰",
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
  name: "극한냉기",
  type: "ice",
  power: 85,
  accuracy: 75,
  category: "special",
  statusEffect: "freeze",
  statusChance: 30,
};

/** 노말 초강타 물리 */
export const giga_impact: Move = {
  id: "giga-impact",
  name: "초강타",
  type: "normal",
  power: 85,
  accuracy: 90,
  category: "physical",
};

/** 전기 차지 방전: 40% 마비 */
export const voltCrash: Move = {
  id: "volt-crash",
  name: "전하방전",
  type: "electric",
  power: 75,
  accuracy: 95,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 40,
};

/** 전기 최종 폭발: 높은 위력 */
export const thunderStrike: Move = {
  id: "thunder-strike",
  name: "뇌전폭",
  type: "electric",
  power: 95,
  accuracy: 85,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 30,
};

/** 물 회오리: 15% 마비 */
export const aquaWhirl: Move = {
  id: "aqua-whirl",
  name: "수류회오리",
  type: "water",
  power: 65,
  accuracy: 100,
  category: "special",
  statusEffect: "paralysis",
  statusChance: 15,
};

/** 물 폭류 최종 */
export const tidalCrash: Move = {
  id: "tidal-crash",
  name: "폭류충격",
  type: "water",
  power: 95,
  accuracy: 85,
  category: "physical",
};

/** 얼음 수정 포격 */
export const crystalBurst: Move = {
  id: "crystal-burst",
  name: "수정포",
  type: "ice",
  power: 70,
  accuracy: 95,
  category: "special",
  statusEffect: "freeze",
  statusChance: 15,
};
