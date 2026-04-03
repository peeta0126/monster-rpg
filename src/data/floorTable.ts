import type { Monster, Move } from "../types/game";
import { monsters } from "./monsters";
import { ember, tackle, vineWhip, waterGun, thunderbolt, toxic, iceLeaf } from "./moves";

// ─── 1~10층 고정 구성 ─────────────────────────────────────────────────────────────

interface FloorFixedConfig {
  monsterId: string;
  moves: Move[];         // 이 층 적이 사용할 수 있는 기술 목록
  skillOrder: string[];  // 턴 순서대로 사용할 기술 ID (무한 반복)
}

/**
 * 1~10층 고정 적 구성표
 * - 플레이어가 기본 플레미(불꽃)를 사용하므로 물/풀 타입이 많음
 * - 층이 높을수록 공격적·다양한 기술 조합
 */
const FLOOR_FIXED: Record<number, FloorFixedConfig> = {
  1:  {
    monsterId: "aquabe",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "tackle", "water-gun"],
  },
  2:  {
    monsterId: "leafy",
    moves: [tackle, vineWhip],
    skillOrder: ["vine-whip", "tackle", "vine-whip", "vine-whip"],
  },
  3:  {
    monsterId: "bubblet",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "water-gun", "tackle"],
  },
  4:  {
    monsterId: "mossy",
    moves: [tackle, vineWhip],
    skillOrder: ["vine-whip", "vine-whip", "tackle", "vine-whip"],
  },
  5:  {
    monsterId: "burno",
    moves: [tackle, ember],
    skillOrder: ["tackle", "ember", "ember", "tackle"],
  },
  6:  {
    monsterId: "aquabe",
    moves: [tackle, waterGun, toxic],
    skillOrder: ["water-gun", "water-gun", "toxic", "water-gun"],
  },
  7:  {
    monsterId: "leafy",
    moves: [tackle, vineWhip, iceLeaf],
    skillOrder: ["vine-whip", "ice-leaf", "vine-whip", "tackle"],
  },
  8:  {
    monsterId: "bubblet",
    moves: [tackle, waterGun, toxic],
    skillOrder: ["water-gun", "toxic", "water-gun", "water-gun"],
  },
  9:  {
    monsterId: "burno",
    moves: [tackle, ember, thunderbolt],
    skillOrder: ["ember", "ember", "thunderbolt", "ember"],
  },
  // 10층은 보스: BOSS 강화 로직(아래 getFloorEnemy)에서 처리
};

// ─── 층 티어별 랜덤 풀 (11층+) ──────────────────────────────────────────────────

const POOL_TIER_1 = ["flameling", "aquabe", "leafy"];
const POOL_TIER_2 = ["burno", "bubblet", "mossy"];
const POOL_ALL    = [...POOL_TIER_1, ...POOL_TIER_2];

function getPool(floor: number): string[] {
  if (floor <= 13) return POOL_TIER_1;
  if (floor <= 19) return POOL_TIER_2;
  return POOL_ALL;
}

// ─── 스탯 레벨 스케일 ────────────────────────────────────────────────────────────

/** base Monster 스탯을 targetLevel 수준으로 성장시킨 복사본 반환 */
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

/**
 * 해당 층에 맞는 적 몬스터를 반환한다.
 * - 1~9층 : FLOOR_FIXED 테이블에서 고정 몬스터, level = floor
 * - 10층  : 보스 (mossy 기반), level = 15, HP×1.5, ATK/DEF×1.3
 * - 11층+ : 랜덤 풀, level = floor (보스층 = +5)
 */
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

  // ── 10층 보스 ──
  if (floor === 10) {
    const base = monsters.find((m) => m.id === "mossy")!;
    const scaled = scaleToLevel(base, 15);
    return {
      ...scaled,
      name: "강화된 모시",
      moves: [vineWhip, iceLeaf, toxic],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.3),
      defense: Math.floor(scaled.defense * 1.3),
      rewardExp: Math.floor(scaled.rewardExp * 2),
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

/**
 * 해당 층·턴 인덱스에 맞는 고정 스킬을 반환한다.
 * FLOOR_FIXED에 없는 층이면 null 반환 → 호출측이 AI 로직으로 폴백.
 */
export function getFloorEnemySkill(
  floor: number,
  turnIndex: number,
  enemyMoves: Move[]
): Move | null {
  // 10층 보스 스킬 순서
  if (floor === 10) {
    const bossOrder = ["vine-whip", "ice-leaf", "toxic", "vine-whip", "ice-leaf"];
    const id = bossOrder[turnIndex % bossOrder.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }

  const cfg = FLOOR_FIXED[floor];
  if (!cfg) return null;

  const skillId = cfg.skillOrder[turnIndex % cfg.skillOrder.length];
  return enemyMoves.find((m) => m.id === skillId) ?? null;
}
