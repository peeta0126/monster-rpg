import type { Monster, Move } from "./game";
import { monsters } from "../monster/monsters";
import {
  ember, tackle, vineWhip, waterGun, thunderbolt, toxic, iceLeaf, spark,
  iceBeam, blizzard, bodySlam, flamethrower, surf,
  voltCrash, crystalBurst, aquaWhirl,
  quickAttack, icePunch, tidalCrash, solarBeam, overheat, thunderStrike,
  hydroPump, venomStorm, gigaImpact,
} from "../monster/moves";

// ─── 오름(Ormr) 전용 기술 풀 ──────────────────────────────────────────────────────

/** 오름이 보유한 7개 타입 대표 최상급 기술 (매 전투 이 중 4개만 사용) */
const ORMR_MOVE_POOL: Move[] = [
  overheat, hydroPump, thunderStrike, solarBeam, blizzard, venomStorm, gigaImpact,
];

/** 7개 중 4개를 무작위 추출 (7C4 = 35가지 조합 전체가 나올 수 있도록 균등 셔플 후 4개 슬라이스) */
function pickOrmrMoves(): Move[] {
  const pool = [...ORMR_MOVE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4);
}

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

// ─── 탑 최상층 ───────────────────────────────────────────────────────────────────

/** 무한의 탑 최상층. 50층 오름(Ormr)이 탑의 끝 — 51층 이상은 존재하지 않는다. */
export const MAX_TOWER_FLOOR = 50;

// ─── 탑의 비밀 — 스토리 보스 전용 이상 기술 연출 ───────────────────────────────────
/**
 * 10/20/30/40층 보스(분노한 모시·격노한 모치·고대의 프리로·전설의 모왕)는
 * 자기 종족의 학습 테이블에 없는 기술을 한둘 섞어 쓴다 — 정식으로 배운 게 아니라
 * 탑 정상에 잠든 존재(오름)의 기운을 받아 억지로 쓰는 것이라는 설정.
 * 그 기술을 전투 중 처음 쓰는 순간, 층수가 오를수록 탑의 비밀에 점점 가까워지는
 * 대사를 띄운다. moveIds는 반드시 해당 종족 LEARNSET에는 없어야 한다 — 있으면
 * "이상 기술"이 아니게 되어 이 연출 자체가 성립하지 않는다.
 */
export interface TowerSecretReveal {
  moveIds: string[];
  lines: string[];
}

export const TOWER_SECRET_REVEALS: Record<number, TowerSecretReveal> = {
  10: {
    moveIds: ["ice-punch"],
    lines: [
      "…어? 방금 그건 모시가 원래 쓸 수 없는 기술이었는데.",
      "기분 탓일까. 왠지 이 탑에서 뭔가 이상한 일이 벌어지고 있는 것 같다.",
    ],
  },
  20: {
    moveIds: ["flamethrower"],
    lines: [
      "이번엔 불꽃이라니… 모치는 분명 전기 늑대일 텐데.",
      "층을 오를수록 몬스터들이 원래 없던 힘을 쓰고 있다. 단순한 우연은 아닌 것 같다.",
    ],
  },
  30: {
    moveIds: ["tidal-crash", "solar-beam"],
    lines: [
      "물의 힘이든 태양의 힘이든, 원래 프리로의 것이 아니다.",
      "탑 깊은 곳에서 흘러나오는 기운이 몬스터들에게 낯선 힘을 나눠주고 있는 것 같다.",
    ],
  },
  40: {
    moveIds: ["overheat", "blizzard"],
    lines: [
      "이 압도적인 힘… 모왕 혼자만의 것이라고는 믿기지 않는다.",
      "탑의 정상에 잠들어 있는 무언가. 그 기운이 탑 전체의 몬스터들에게까지 미치고 있는 것이다.",
    ],
  },
};

/** 해당 층·기술 조합이 탑의 비밀 연출 대상이면 그 대사 묶음을 반환 */
export function getTowerSecretReveal(floor: number, moveId: string): TowerSecretReveal | null {
  const reveal = TOWER_SECRET_REVEALS[floor];
  if (!reveal || !reveal.moveIds.includes(moveId)) return null;
  return reveal;
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
      moves: [spark, thunderbolt, quickAttack, icePunch],
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
      moves: [voltCrash, thunderbolt, bodySlam, flamethrower],
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
      moves: [blizzard, crystalBurst, tidalCrash, solarBeam],
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
      moves: [thunderStrike, voltCrash, overheat, blizzard],
      maxHp: Math.floor(scaled.maxHp * 1.6),
      attack: Math.floor(scaled.attack * 1.5),
      defense: Math.floor(scaled.defense * 1.4),
      rewardExp: Math.floor(scaled.rewardExp * 2.5),
    };
  }
  if (floor === 50) {
    const base = monsters.find((m) => m.id === "ormr")!;
    const scaled = scaleToLevel(base, 60);
    return {
      ...scaled,
      name: "오름",
      moves: pickOrmrMoves(),
      maxHp: Math.floor(scaled.maxHp * 2.2),
      attack: Math.floor(scaled.attack * 1.8),
      defense: Math.floor(scaled.defense * 1.7),
      rewardExp: Math.floor(scaled.rewardExp * 3.5),
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
    const order = ["spark", "thunderbolt", "quick-attack", "spark", "ice-punch"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 20) {
    const order = ["thunderbolt", "volt-crash", "body-slam", "thunderbolt", "flamethrower"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 30) {
    const order = ["blizzard", "crystal-burst", "blizzard", "tidal-crash", "solar-beam"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 40) {
    const order = ["thunder-strike", "volt-crash", "thunder-strike", "overheat", "blizzard"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 50) {
    // 전투 시작 시 무작위로 정해진 4개 기술을 순환 사용
    return enemyMoves[turnIndex % enemyMoves.length] ?? enemyMoves[0] ?? null;
  }

  const cfg = FLOOR_FIXED[floor];
  if (!cfg) return null;

  const skillId = cfg.skillOrder[turnIndex % cfg.skillOrder.length];
  return enemyMoves.find((m) => m.id === skillId) ?? null;
}
