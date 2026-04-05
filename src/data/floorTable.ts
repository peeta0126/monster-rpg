import type { Monster, Move } from "../types/game";
import { monsters } from "./monsters";
import {
  ember, tackle, vineWhip, waterGun, thunderbolt, toxic, iceLeaf, spark,
  iceBeam, blizzard, bodySlam, flamethrower, surf,
  voltCrash, crystalBurst, aquaWhirl,
} from "./moves";

// ─── 1~25층 고정 구성 ─────────────────────────────────────────────────────────────

interface FloorFixedConfig {
  monsterId: string;
  moves: Move[];
  skillOrder: string[];
}

const FLOOR_FIXED: Record<number, FloorFixedConfig> = {
  1: {
    monsterId: "aquabe",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "tackle", "water-gun"],
  },
  2: {
    monsterId: "leafy",
    moves: [tackle, vineWhip],
    skillOrder: ["vine-whip", "tackle", "vine-whip", "vine-whip"],
  },
  3: {
    monsterId: "bubblet",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "water-gun", "tackle"],
  },
  4: {
    monsterId: "mossy",
    moves: [tackle, spark],
    skillOrder: ["spark", "tackle", "spark", "spark"],
  },
  5: {
    monsterId: "burno",
    moves: [tackle, ember],
    skillOrder: ["tackle", "ember", "ember", "tackle"],
  },
  6: {
    monsterId: "aquabe",
    moves: [tackle, waterGun, toxic],
    skillOrder: ["water-gun", "water-gun", "toxic", "water-gun"],
  },
  7: {
    monsterId: "leafy",
    moves: [tackle, vineWhip, iceLeaf],
    skillOrder: ["vine-whip", "ice-leaf", "vine-whip", "tackle"],
  },
  8: {
    monsterId: "bubblet",
    moves: [tackle, waterGun, toxic],
    skillOrder: ["water-gun", "toxic", "water-gun", "water-gun"],
  },
  9: {
    monsterId: "burno",
    moves: [tackle, ember, thunderbolt],
    skillOrder: ["ember", "ember", "thunderbolt", "ember"],
  },
  // 10층은 보스: getFloorEnemy에서 처리
  11: {
    monsterId: "mossy",
    moves: [tackle, spark, thunderbolt],
    skillOrder: ["spark", "tackle", "thunderbolt", "spark"],
  },
  12: {
    monsterId: "crystafox",
    moves: [tackle, iceBeam],
    skillOrder: ["ice-beam", "tackle", "ice-beam", "ice-beam"],
  },
  13: {
    monsterId: "leafy",
    moves: [tackle, vineWhip, iceLeaf],
    skillOrder: ["tackle", "vine-whip", "ice-leaf", "vine-whip"],
  },
  14: {
    monsterId: "aquavern",
    moves: [tackle, waterGun, aquaWhirl],
    skillOrder: ["aqua-whirl", "water-gun", "tackle", "aqua-whirl"],
  },
  15: {
    monsterId: "frostorb",
    moves: [tackle, iceBeam, blizzard],
    skillOrder: ["ice-beam", "blizzard", "ice-beam", "tackle"],
  },
  16: {
    monsterId: "mossy",
    moves: [tackle, spark, thunderbolt, voltCrash],
    skillOrder: ["thunderbolt", "spark", "volt-crash", "tackle"],
  },
  17: {
    monsterId: "crystafox",
    moves: [tackle, iceBeam, crystalBurst],
    skillOrder: ["crystal-burst", "ice-beam", "crystal-burst", "tackle"],
  },
  18: {
    monsterId: "aquavern",
    moves: [tackle, aquaWhirl, surf],
    skillOrder: ["surf", "aqua-whirl", "surf", "tackle"],
  },
  19: {
    monsterId: "mossevo",
    moves: [tackle, spark, thunderbolt],
    skillOrder: ["thunderbolt", "spark", "thunderbolt", "tackle"],
  },
  // 20층은 보스: getFloorEnemy에서 처리
  21: {
    monsterId: "burno",
    moves: [tackle, ember, flamethrower],
    skillOrder: ["flamethrower", "ember", "flamethrower", "tackle"],
  },
  22: {
    monsterId: "bubblet",
    moves: [tackle, waterGun, surf],
    skillOrder: ["surf", "water-gun", "surf", "tackle"],
  },
  23: {
    monsterId: "mossevo",
    moves: [tackle, thunderbolt, voltCrash],
    skillOrder: ["volt-crash", "thunderbolt", "volt-crash", "tackle"],
  },
  24: {
    monsterId: "frostorb",
    moves: [tackle, blizzard, iceBeam],
    skillOrder: ["blizzard", "blizzard", "ice-beam", "tackle"],
  },
  25: {
    monsterId: "mossevo",
    moves: [tackle, thunderbolt, voltCrash],
    skillOrder: ["volt-crash", "thunderbolt", "tackle", "volt-crash"],
  },
};

// ─── 층 티어별 랜덤 풀 ──────────────────────────────────────────────────────────────

const POOL_TIER_1  = ["flameling", "aquabe", "leafy"];
const POOL_TIER_2  = ["burno", "bubblet", "mossy", "crystafox"];
const POOL_TIER_3  = ["mossevo", "frostorb", "aquavern"];
const POOL_TIER_4  = ["mossyfinal", "mossevo", "frostorb", "aquavern"];
const POOL_ALL     = [...POOL_TIER_1, ...POOL_TIER_2, ...POOL_TIER_3, ...POOL_TIER_4];

function getPool(floor: number): string[] {
  if (floor <= 13) return POOL_TIER_1;
  if (floor <= 19) return POOL_TIER_2;
  if (floor <= 29) return [...POOL_TIER_2, ...POOL_TIER_3];
  if (floor <= 39) return [...POOL_TIER_3, ...POOL_TIER_4];
  return POOL_ALL;
}

// ─── 스탯 레벨 스케일 ────────────────────────────────────────────────────────────

export function scaleToLevel(base: Monster, targetLevel: number): Monster {
  if (targetLevel <= 1) return { ...base };
  const n = targetLevel - 1;
  return {
    ...base,
    level: targetLevel,
    maxHp: base.maxHp + n * 10,
    attack: base.attack + n * 3,
    defense: base.defense + n * 2,
    speed: base.speed + n * 2,
    rewardExp: Math.floor(base.rewardExp * (1 + n * 0.15)),
    expToNextLevel: Math.floor(base.expToNextLevel * Math.pow(1.2, n)),
    exp: 0,
  };
}

// ─── 보스층 판별 ─────────────────────────────────────────────────────────────────

export function isBossFloor(floor: number): boolean {
  return floor % 10 === 0;
}

// ─── 층별 적 생성 ────────────────────────────────────────────────────────────────

export function getFloorEnemy(floor: number, excludeId?: string): Monster {
  // ── 1~9층: 고정 구성 ──
  if (floor <= 9 && FLOOR_FIXED[floor]) {
    const cfg = FLOOR_FIXED[floor];
    if (cfg.monsterId !== excludeId) {
      const base = monsters.find((m) => m.id === cfg.monsterId);
      if (base) {
        return { ...scaleToLevel(base, floor), moves: cfg.moves };
      }
    }
  }

  // ── 보스층 ──
  if (floor === 10) {
    const base = monsters.find((m) => m.id === "mossy")!;
    const scaled = scaleToLevel(base, 15);
    return {
      ...scaled,
      name: "분노한 모시",
      moves: [spark, thunderbolt, voltCrash],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.3),
      defense: Math.floor(scaled.defense * 1.3),
      rewardExp: Math.floor(scaled.rewardExp * 2),
    };
  }
  if (floor === 20) {
    const base = monsters.find((m) => m.id === "mossevo")!;
    const scaled = scaleToLevel(base, 25);
    return {
      ...scaled,
      name: "격노한 모치",
      moves: [spark, thunderbolt, voltCrash, bodySlam],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.35),
      defense: Math.floor(scaled.defense * 1.35),
      rewardExp: Math.floor(scaled.rewardExp * 2),
    };
  }
  if (floor === 30) {
    const base = monsters.find((m) => m.id === "frostorb")!;
    const scaled = scaleToLevel(base, 35);
    return {
      ...scaled,
      name: "고대의 프리로",
      moves: [iceBeam, blizzard, crystalBurst, bodySlam],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.4),
      defense: Math.floor(scaled.defense * 1.4),
      rewardExp: Math.floor(scaled.rewardExp * 2),
    };
  }
  if (floor === 40) {
    const base = monsters.find((m) => m.id === "mossyfinal")!;
    const scaled = scaleToLevel(base, 48);
    return {
      ...scaled,
      name: "전설의 모왕",
      moves: [thunderbolt, voltCrash, bodySlam, flamethrower],
      maxHp: Math.floor(scaled.maxHp * 1.6),
      attack: Math.floor(scaled.attack * 1.5),
      defense: Math.floor(scaled.defense * 1.4),
      rewardExp: Math.floor(scaled.rewardExp * 2.5),
    };
  }

  // ── 11층+: 랜덤 ──
  const boss = isBossFloor(floor);
  const poolIds = boss ? POOL_ALL : getPool(floor);
  const pool = poolIds
    .map((id) => monsters.find((m) => m.id === id)!)
    .filter((m) => !!m && m.id !== excludeId);
  const base = pool[Math.floor(Math.random() * pool.length)];
  const level = boss ? floor + 5 : floor;
  const scaled = scaleToLevel(base, level);

  if (boss) {
    return {
      ...scaled,
      name: `강화된 ${scaled.name}`,
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.3),
      defense: Math.floor(scaled.defense * 1.3),
      rewardExp: Math.floor(scaled.rewardExp * 2),
    };
  }
  return scaled;
}

// ─── 층별 고정 스킬 조회 ──────────────────────────────────────────────────────────

export function getFloorEnemySkill(
  floor: number,
  turnIndex: number,
  enemyMoves: Move[]
): Move | null {
  if (floor === 10) {
    const order = ["spark", "thunderbolt", "volt-crash", "spark", "thunderbolt"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 20) {
    const order = ["thunderbolt", "volt-crash", "body-slam", "spark", "volt-crash"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 30) {
    const order = ["blizzard", "ice-beam", "crystal-burst", "blizzard", "body-slam"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 40) {
    const order = ["volt-crash", "thunderbolt", "body-slam", "volt-crash", "flamethrower"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }

  const cfg = FLOOR_FIXED[floor];
  if (!cfg) return null;

  const skillId = cfg.skillOrder[turnIndex % cfg.skillOrder.length];
  return enemyMoves.find((m) => m.id === skillId) ?? null;
}
