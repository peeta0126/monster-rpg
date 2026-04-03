import type { Monster } from "../types/game";
import { monsters } from "./monsters";

// ─── 층 티어별 몬스터 풀 ─────────────────────────────────────────────────────────

const POOL_TIER_1 = ["flameling", "aquabe", "leafy"];    // 1~3층
const POOL_TIER_2 = ["burno", "bubblet", "mossy"];       // 4~9층
const POOL_ALL = [...POOL_TIER_1, ...POOL_TIER_2];       // 10층+

function getPool(floor: number): string[] {
  if (floor <= 3) return POOL_TIER_1;
  if (floor <= 9) return POOL_TIER_2;
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
 * - 일반층: 층 티어 풀에서 랜덤, level = floor
 * - 보스층(10의 배수): 풀 전체에서 랜덤, level = floor+5, HP×1.5, ATK×1.3, DEF×1.3
 * @param floor  현재 층수
 * @param excludeId  제외할 몬스터 ID (보통 플레이어 몬스터)
 */
export function getFloorEnemy(floor: number, excludeId?: string): Monster {
  const boss = isBossFloor(floor);
  // 보스층은 풀 전체에서 선택
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
