import type { Move } from "../shared/game";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  기술 전체 테이블. 타입별 스킬트리
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 각 원소 타입은 동일한 트리 골격을 가진다. 학습 테이블은 이 트리를 따라 오른다.
 *
 *   [기초]   T1 물리 / T1 특수   Lv1~4    위력 40~45
 *   [상태]   확정 상태이상        Lv14~18  위력 0, 상태이상 100%
 *   [중급]   T2 물리 / T2 특수   Lv8~14   위력 55~60
 *   [상급]   T3 물리 / T3 특수   Lv20~28  위력 70~75
 *   [최상급] T4 피니셔            Lv38~50  위력 85~95, 명중 하락
 *
 * 상태이상 정체성:
 *   fire→화상  electric→마비  ice→빙결  poison·grass→독
 *   water는 상태이상이 없는 대신 명중·위력이 안정적(범용 딜러)
 *   normal은 상성이 없는 대신 피니셔 위력이 최고
 */

// ═══ NORMAL: 상성 없음. 약점도 이점도 없다. ════════════════════════════════
export const tackle: Move = {
  id: "tackle", name: "몸통박치기", type: "normal", power: 40, accuracy: 100, category: "physical",
};
export const quickAttack: Move = {
  id: "quick-attack", name: "질풍", type: "normal", power: 40, accuracy: 100, category: "physical",
};
export const twister: Move = {
  id: "twister", name: "회오리", type: "normal", power: 55, accuracy: 100, category: "special",
};
export const headbutt: Move = {
  id: "headbutt", name: "두강", type: "normal", power: 60, accuracy: 100, category: "physical",
};
export const bodySlam: Move = {
  id: "body-slam", name: "압박", type: "normal", power: 70, accuracy: 100, category: "physical",
  statusEffect: "paralysis", statusChance: 20,
};
export const heavyBlow: Move = {
  id: "heavy-blow", name: "강타", type: "normal", power: 75, accuracy: 95, category: "physical",
};
export const gigaImpact: Move = {
  id: "giga-impact", name: "파멸격", type: "normal", power: 95, accuracy: 90, category: "physical",
};
export const hyperBeam: Move = {
  id: "hyper-beam", name: "초강력빔", type: "normal", power: 95, accuracy: 85, category: "special",
};

// ═══ FIRE: 풀·얼음에 강, 물에 약. 화상. ═══════════════════════════════════
export const ember: Move = {
  id: "ember", name: "불씨", type: "fire", power: 45, accuracy: 100, category: "special",
  statusEffect: "burn", statusChance: 10,
};
export const fireScratch: Move = {
  id: "fire-scratch", name: "불꽃할퀴기", type: "fire", power: 45, accuracy: 100, category: "physical",
  statusEffect: "burn", statusChance: 10,
};
export const cinderToss: Move = {
  id: "cinder-toss", name: "불티날림", type: "fire", power: 0, accuracy: 90, category: "status",
  statusEffect: "burn", statusChance: 100,
};
export const firePunch: Move = {
  id: "fire-punch", name: "화염권", type: "fire", power: 55, accuracy: 100, category: "physical",
  statusEffect: "burn", statusChance: 15,
};
export const heatWave: Move = {
  id: "heat-wave", name: "열풍", type: "fire", power: 60, accuracy: 95, category: "special",
  statusEffect: "burn", statusChance: 20,
};
export const flameSlash: Move = {
  id: "flame-slash", name: "화염참", type: "fire", power: 70, accuracy: 95, category: "physical",
  statusEffect: "burn", statusChance: 20,
};
export const flamethrower: Move = {
  id: "flamethrower", name: "화염방사", type: "fire", power: 75, accuracy: 100, category: "special",
  statusEffect: "burn", statusChance: 15,
};
export const overheat: Move = {
  id: "overheat", name: "오버히트", type: "fire", power: 90, accuracy: 90, category: "special",
  statusEffect: "burn", statusChance: 30,
};

// ═══ WATER: 불에 강, 풀·전기에 약. 안정형 딜러. ════════════════════════════
export const waterGun: Move = {
  id: "water-gun", name: "물총", type: "water", power: 45, accuracy: 100, category: "special",
};
export const aquaTail: Move = {
  id: "aqua-tail", name: "물꼬리", type: "water", power: 45, accuracy: 100, category: "physical",
};
export const bubbleCannon: Move = {
  id: "bubble-cannon", name: "거품포", type: "water", power: 55, accuracy: 100, category: "special",
};
export const waterPulse: Move = {
  id: "water-pulse", name: "수파문", type: "water", power: 60, accuracy: 100, category: "special",
  statusEffect: "paralysis", statusChance: 20,
};
export const aquaWhirl: Move = {
  id: "aqua-whirl", name: "소용돌이", type: "water", power: 70, accuracy: 100, category: "special",
  statusEffect: "paralysis", statusChance: 15,
};
export const surf: Move = {
  id: "surf", name: "파도", type: "water", power: 70, accuracy: 100, category: "special",
};
export const tidalCrash: Move = {
  id: "tidal-crash", name: "해일격", type: "water", power: 90, accuracy: 85, category: "physical",
};
export const hydroPump: Move = {
  id: "hydro-pump", name: "하이드로펌프", type: "water", power: 95, accuracy: 80, category: "special",
};

// ═══ ELECTRIC: 물에 강, 풀에 막힘. 마비. ══════════════════════════════════
export const spark: Move = {
  id: "spark", name: "전기불꽃", type: "electric", power: 45, accuracy: 100, category: "physical",
  statusEffect: "paralysis", statusChance: 10,
};
export const zap: Move = {
  id: "zap", name: "찌릿", type: "electric", power: 45, accuracy: 100, category: "special",
  statusEffect: "paralysis", statusChance: 10,
};
export const stunNeedle: Move = {
  id: "stun-needle", name: "마비침", type: "electric", power: 0, accuracy: 90, category: "status",
  statusEffect: "paralysis", statusChance: 100,
};
export const discharge: Move = {
  id: "discharge", name: "방전", type: "electric", power: 55, accuracy: 100, category: "special",
  statusEffect: "paralysis", statusChance: 25,
};
export const thunderbolt: Move = {
  id: "thunderbolt", name: "전격탄", type: "electric", power: 60, accuracy: 100, category: "special",
  statusEffect: "paralysis", statusChance: 30,
};
export const boltStrike: Move = {
  id: "bolt-strike", name: "낙뢰격", type: "electric", power: 75, accuracy: 90, category: "physical",
  statusEffect: "paralysis", statusChance: 20,
};
export const voltCrash: Move = {
  id: "volt-crash", name: "볼트크래시", type: "electric", power: 80, accuracy: 95, category: "special",
  statusEffect: "paralysis", statusChance: 40,
};
export const thunder: Move = {
  id: "thunder", name: "뇌격", type: "electric", power: 90, accuracy: 70, category: "special",
  statusEffect: "paralysis", statusChance: 50,
};
export const thunderStrike: Move = {
  id: "thunder-strike", name: "천둥강타", type: "electric", power: 95, accuracy: 85, category: "special",
  statusEffect: "paralysis", statusChance: 30,
};

// ═══ GRASS: 물에 강, 불·얼음에 약. 독 보조. ═══════════════════════════════
export const vineWhip: Move = {
  id: "vine-whip", name: "넝쿨채찍", type: "grass", power: 45, accuracy: 100, category: "physical",
};
export const leafGust: Move = {
  id: "leaf-gust", name: "잎바람", type: "grass", power: 45, accuracy: 100, category: "special",
};
export const sporeCloud: Move = {
  id: "spore-cloud", name: "포자구름", type: "grass", power: 0, accuracy: 85, category: "status",
  statusEffect: "poison", statusChance: 100,
};
export const leafBlade: Move = {
  id: "leaf-blade", name: "잎날", type: "grass", power: 60, accuracy: 100, category: "physical",
};
export const iceLeaf: Move = {
  id: "ice-leaf", name: "빙결잎", type: "grass", power: 55, accuracy: 90, category: "special",
  statusEffect: "freeze", statusChance: 15,
};
export const seedBomb: Move = {
  id: "seed-bomb", name: "씨앗폭탄", type: "grass", power: 70, accuracy: 100, category: "physical",
};
export const rootSpear: Move = {
  id: "root-spear", name: "뿌리창", type: "grass", power: 75, accuracy: 95, category: "physical",
};
export const solarBeam: Move = {
  id: "solar-beam", name: "광합성포", type: "grass", power: 90, accuracy: 90, category: "special",
};

// ═══ ICE: 풀에 강, 불에 약. 빙결. ═════════════════════════════════════════
export const frostBreath: Move = {
  id: "frost-breath", name: "서리숨결", type: "ice", power: 45, accuracy: 100, category: "special",
  statusEffect: "freeze", statusChance: 10,
};
export const iceShard: Move = {
  id: "ice-shard", name: "얼음뭉치", type: "ice", power: 45, accuracy: 100, category: "physical",
  statusEffect: "freeze", statusChance: 10,
};
export const frostMist: Move = {
  id: "frost-mist", name: "서리안개", type: "ice", power: 0, accuracy: 85, category: "status",
  statusEffect: "freeze", statusChance: 100,
};
export const icePunch: Move = {
  id: "ice-punch", name: "얼음주먹", type: "ice", power: 55, accuracy: 100, category: "physical",
  statusEffect: "freeze", statusChance: 10,
};
export const iceBeam: Move = {
  id: "ice-beam", name: "얼음살", type: "ice", power: 65, accuracy: 95, category: "special",
  statusEffect: "freeze", statusChance: 15,
};
export const crystalLance: Move = {
  id: "crystal-lance", name: "수정창", type: "ice", power: 75, accuracy: 95, category: "physical",
  statusEffect: "freeze", statusChance: 15,
};
export const crystalBurst: Move = {
  id: "crystal-burst", name: "수정파열", type: "ice", power: 75, accuracy: 95, category: "special",
  statusEffect: "freeze", statusChance: 15,
};
export const blizzard: Move = {
  id: "blizzard", name: "설풍", type: "ice", power: 85, accuracy: 85, category: "special",
  statusEffect: "freeze", statusChance: 20,
};
export const sheerCold: Move = {
  id: "sheer-cold", name: "절대영도", type: "ice", power: 90, accuracy: 75, category: "special",
  statusEffect: "freeze", statusChance: 30,
};

// ═══ POISON: 풀에 강. 지속 피해·포획 보조 전문. ═══════════════════════════
export const poisonSting: Move = {
  id: "poison-sting", name: "독침", type: "poison", power: 40, accuracy: 100, category: "physical",
  statusEffect: "poison", statusChance: 15,
};
export const acidSpray: Move = {
  id: "acid-spray", name: "산성분사", type: "poison", power: 45, accuracy: 100, category: "special",
  statusEffect: "poison", statusChance: 15,
};
export const toxic: Move = {
  id: "toxic", name: "독가시", type: "poison", power: 0, accuracy: 90, category: "status",
  statusEffect: "poison", statusChance: 100,
};
export const poisonFog: Move = {
  id: "poison-fog", name: "독안개", type: "poison", power: 55, accuracy: 100, category: "special",
  statusEffect: "poison", statusChance: 25,
};
export const poisonJab: Move = {
  id: "poison-jab", name: "독찌르기", type: "poison", power: 65, accuracy: 100, category: "physical",
  statusEffect: "poison", statusChance: 20,
};
export const venomFang: Move = {
  id: "venom-fang", name: "맹독니", type: "poison", power: 75, accuracy: 95, category: "physical",
  statusEffect: "poison", statusChance: 30,
};
export const venomStorm: Move = {
  id: "venom-storm", name: "맹독폭풍", type: "poison", power: 85, accuracy: 90, category: "special",
  statusEffect: "poison", statusChance: 30,
};

// ═══ 조회 유틸 ════════════════════════════════════════════════════════════
export const ALL_MOVES: Move[] = [
  tackle, quickAttack, twister, headbutt, bodySlam, heavyBlow, gigaImpact, hyperBeam,
  ember, fireScratch, cinderToss, firePunch, heatWave, flameSlash, flamethrower, overheat,
  waterGun, aquaTail, bubbleCannon, waterPulse, aquaWhirl, surf, tidalCrash, hydroPump,
  spark, zap, stunNeedle, discharge, thunderbolt, boltStrike, voltCrash, thunder, thunderStrike,
  vineWhip, leafGust, sporeCloud, leafBlade, iceLeaf, seedBomb, rootSpear, solarBeam,
  frostBreath, iceShard, frostMist, icePunch, iceBeam, crystalLance, crystalBurst, blizzard, sheerCold,
  poisonSting, acidSpray, toxic, poisonFog, poisonJab, venomFang, venomStorm,
];

export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(
  ALL_MOVES.map((m) => [m.id, m]),
);

