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

const POOL_TIER_1  = ["flameling", "aquabe", "leafy", "venomcrow"];
const POOL_TIER_2  = ["burno", "bubblet", "mossy", "crystafox", "toxadon"];
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
    // 계수 0.22 → 0.30. 11~25층 고정 구성을 되살리자 그 층들이 전부 진짜 전투가 되면서
    // 30층 이후 도달 레벨이 전부 보스 아래로 내려갔다(-1.1 ~ -3.3). 예전엔 그 층들이
    // 공짜라 레벨을 미리 벌어뒀던 것이라, 그만큼을 경험치로 정직하게 메운다.
    // scripts/sim/expSweep.mjs (40판): 0.22 → 탑전투 124.9 / 재도전 15.6 / 레벨차 -1.1~-3.3
    //                                  0.30 → 탑전투  92.5 / 재도전  8.5 / 레벨차 +1.4~+2.9
    //                                  0.40 → 탑전투  79.1 / 재도전  6.2 / 레벨차 +3.6~+10.4 (헐거움)
    rewardExp: Math.floor(base.rewardExp * (1 + n * 0.30)),
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

// ─── 층 → 배경 구간 ──────────────────────────────────────────────────────────────

/**
 * 전투 배경이 바뀌는 구간. 파일 이름의 접두사이기도 하다.
 * z50 만 한 층짜리다 — 탑 정상은 올라가는 길의 연장이 아니라 도착한 자리라서.
 */
export type TowerZone = "z01" | "z11" | "z21" | "z31" | "z41" | "z50";

/**
 * 10층마다 방이 바뀌고, 50층만 자기 방을 따로 쓴다. 매핑은 여기 한 곳뿐 —
 * 씬이나 경로 헬퍼에 다시 적지 말 것.
 * 범위 밖(0 이하·51 이상)은 양 끝으로 접는다. 층은 라우트 state 로 들어와서
 * 이론상 아무 숫자나 올 수 있고, 그때 배경이 없는 것보다 첫 방이 나오는 게 낫다.
 */
export function getTowerZone(floor: number): TowerZone {
  if (floor <= 10) return "z01";
  if (floor <= 20) return "z11";
  if (floor <= 30) return "z21";
  if (floor <= 40) return "z31";
  if (floor < MAX_TOWER_FLOOR) return "z41";
  return "z50";
}

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
  // ── 고정 구성 층 (1~9, 11~25) ──
  // 예전에 조건이 `floor <= 9` 라서 11~25층 구성 15개가 통째로 죽어 있었다. 그 층들은
  // 랜덤 풀에서 뽑혔는데, getFloorEnemySkill 쪽에는 같은 제한이 없어 없는 몬스터의
  // 스킬 순서를 뒤졌다. 그러다 이름이 겹치는 몸통박치기를 찾아내 적이 자기 최약체
  // 기술만 반복하는 층이 생겼다 — 19층이 405전투 1패였던 이유다. 그렇게 공짜로 올라와
  // 20층 보스 앞에서 처음 제대로 맞았다.
  if (FLOOR_FIXED[floor]) {
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
    const scaled = scaleToLevel(base, 11);
    return {
      ...scaled,
      name: "분노한 모시",
      moves: [spark, thunderbolt, quickAttack, icePunch],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.3),
      defense: Math.floor(scaled.defense * 1.2),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 20) {
    const base = monsters.find((m) => m.id === "mossevo")!;
    const scaled = scaleToLevel(base, 20);
    return {
      ...scaled,
      name: "격노한 모치",
      moves: [voltCrash, thunderbolt, bodySlam, flamethrower],
      maxHp: Math.floor(scaled.maxHp * 1.2),
      attack: Math.floor(scaled.attack * 1.05),
      defense: Math.floor(scaled.defense * 1.15),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 30) {
    const base = monsters.find((m) => m.id === "frostorb")!;
    const scaled = scaleToLevel(base, 31);
    return {
      ...scaled,
      name: "고대의 프리로",
      moves: [blizzard, crystalBurst, tidalCrash, solarBeam],
      maxHp: Math.floor(scaled.maxHp * 1.45),
      attack: Math.floor(scaled.attack * 1.7),
      defense: Math.floor(scaled.defense * 1.2),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 40) {
    const base = monsters.find((m) => m.id === "mossyfinal")!;
    const scaled = scaleToLevel(base, 40);
    return {
      ...scaled,
      name: "전설의 모왕",
      moves: [thunderStrike, voltCrash, overheat, blizzard],
      maxHp: Math.floor(scaled.maxHp * 1.25),
      attack: Math.floor(scaled.attack * 1.1),
      defense: Math.floor(scaled.defense * 1.25),
      rewardExp: Math.floor(scaled.rewardExp * 2.8),
    };
  }
  if (floor === 50) {
    const base = monsters.find((m) => m.id === "ormr")!;
    const scaled = scaleToLevel(base, 51);
    return {
      ...scaled,
      name: "오름",
      moves: pickOrmrMoves(),
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.15),
      defense: Math.floor(scaled.defense * 1.05),
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
  const level = boss ? floor + 3 : floor;
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

/**
 * 오름이 몇 턴에 한 번 **겨냥하는가**. 그 턴만 AI 가 상성을 계산하고, 나머지 턴은
 * 가진 기술을 마구잡이로 던진다(직전에 쓴 것은 빼고).
 *
 * 오름은 7속성 최상급 기술을 전부 들고 있는 유일한 몬스터다. 모든 속성에 약점이 생긴
 * 지금(typeChart 참고) 매 턴 상성을 계산하게 두면 어떤 파티를 데려와도 2배를 맞는다 —
 * 시뮬(scripts/sim/floorProbe.ts, Lv55 파티 120판)에서 승률이 이렇게 갈렸다:
 *
 *      예전(1→2→3→4 순환) | 매 턴 겨냥 | 3턴에 한 번 겨냥
 *   섞은 파티      100%   |     57%    |      79%
 *   전기 편중       99%   |     44%    |      69%
 *
 * 매 턴 겨냥은 최종보스가 아니라 정답이 하나뿐인 문제가 된다. 반대로 예전처럼 순환만
 * 하면 두 바퀴에 다 읽힌다. 그래서 대부분은 읽을 수 없게 두되, 세 턴에 한 번은 정확히
 * 약점을 찌른다 — 그 한 방이 오는 걸 알기 때문에 교체와 물약 타이밍이 생긴다.
 */
export const ORMR_AIM_INTERVAL = 3;

export function getFloorEnemySkill(
  floor: number,
  turnIndex: number,
  enemyMoves: Move[],
  lastMoveId?: string,
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
    // 겨냥하는 턴은 null 을 돌려 AI(상성 계산)에 맡긴다
    if (turnIndex % ORMR_AIM_INTERVAL === ORMR_AIM_INTERVAL - 1) return null;
    // 나머지 턴은 마구잡이. 직전 기술만 빼서 같은 걸 두 번 연달아 보지 않게 한다
    const pool = enemyMoves.filter((m) => m.id !== lastMoveId);
    const from = pool.length > 0 ? pool : enemyMoves;
    return from[Math.floor(Math.random() * from.length)] ?? null;
  }

  const cfg = FLOOR_FIXED[floor];
  if (!cfg) return null;

  // 지정 순서에 나오는 기술을 적이 전부 갖고 있을 때만 이 표를 따른다.
  // 일부만 겹치면 그 층의 적이 아니라는 뜻이고, 겹치는 것만 골라 쓰면 대개
  // 몸통박치기 같은 최약체 기술만 반복하게 된다. 그럴 땐 null 을 주고 AI 에 맡긴다.
  const ids = new Set(enemyMoves.map((m) => m.id));
  if (!cfg.skillOrder.every((id) => ids.has(id))) return null;

  const skillId = cfg.skillOrder[turnIndex % cfg.skillOrder.length];
  return enemyMoves.find((m) => m.id === skillId) ?? null;
}
