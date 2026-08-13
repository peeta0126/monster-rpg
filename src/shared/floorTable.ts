import type { Monster, Move } from "./game";
import { monsters } from "../monster/monsters";
import { expToNext } from "../battle/battleUtils";
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
    // 아쿠사(22레벨 진화체)가 서 있던 자리다. 플레이어 쪽은 아직 진화 전인데 상대만
    // 최종 진화체라 14층만 난이도가 튀었다 — 예전 시뮬에서도 이 층 패배율이 45% 로
    // 20층 보스와 비슷했다. 같은 물 계열의 미진화체로 되돌린다.
    monsterId: "bubblet",
    moves: [tackle, waterGun, surf],
    skillOrder: ["surf", "water-gun", "tackle", "surf"],
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
    // 계수 0.30 → 0.15. 0.30 은 레벨차 컷오프가 없던 시절의 값이다. 그때는 층이 올라도
    // 레벨이 안 따라와서 보상을 키워야 했는데, 지금은 반대로 **한 판이 10레벨**을 준다
    // (40층 모왕 보상 1778 vs Lv50 요구 683). 컷오프가 갈이를 막는 지금은 보상이 층을
    // 따라 붙기만 하면 된다.
    rewardExp: Math.floor(base.rewardExp * (1 + n * 0.15)),
    // 요구 경험치는 레벨 하나로 정해진다(battleUtils.expToNext). 여기서 따로 굴리면
    // 잡은 몬스터만 다른 곡선을 타게 된다 — 실제로 Lv40 잡은 개체가 122,480 을 요구했다.
    expToNextLevel: expToNext(targetLevel),
    exp: 0,
  };
}

// ─── 층의 성격 ───────────────────────────────────────────────────────────────────

/**
 * 이름 있는 보스가 서는 층. 10층마다 하나씩이고 이야기가 붙어 있다
 * (분노한 모시 · 격노한 모치 · 고대의 프리로 · 전설의 모왕 · 오름).
 *
 * ⚠️ 이 플래그는 난이도만 뜻하지 않는다 — 도망 금지·보스 드랍·배경 연출이 전부 여기
 * 물려 있다. 중간 관문을 여기에 끼워 넣으면 도망까지 같이 막히므로 따로 둔다.
 */
export function isBossFloor(floor: number): boolean {
  return floor % 10 === 0;
}

/**
 * 중간 관문. 5층마다 걸리되 n0층은 보스가 맡으므로 그 사이(15·25·35·45)만 관문이다.
 *
 * 보스가 "장비 없으면 못 넘는 벽"이라면 관문은 "장비 없으면 아픈 검문"이다. 5층마다
 * 벽돌담을 세우면 진행이 여덟 번 끊긴다 — 대부분은 물약과 정비로 넘고, 제작대까지
 * 돌아가야 하는 건 n0층뿐이어야 한다.
 *
 * 도망은 열어 둔다(isBossFloor 가 아니다). 드랍은 보스급으로 준다(dropTables).
 */
export const GATE_FLOORS = [15, 25, 35, 45] as const;

export function isGateFloor(floor: number): boolean {
  return (GATE_FLOORS as readonly number[]).includes(floor);
}

/**
 * 관문 배수. 층마다 다르다.
 *
 * 하나로 통일해 봤더니 층마다 체감이 딴판이었다 — 파티의 화력 곡선이 균일하지 않아서다.
 * 45층 파티(모왕 Lv45, 위력 95)는 25층 파티(모치)보다 훨씬 세게 때린다. 그래서 같은
 * 배수를 걸면 25층은 맨몸 100%, 45층은 맨몸 100% 로 둘 다 무너지는 게 아니라 **다른
 * 이유로** 무너진다. 배수는 파티가 그 층에서 실제로 내는 화력에 맞춰야 한다.
 *
 * 값은 scripts/sim/gateCheck.ts 로 맞췄다(맨몸 35~60% · 정규 장비 ≥82%).
 */
const GATE_MULT_BY_FLOOR: Record<number, { hp: number; attack: number; defense: number }> = {
  15: { hp: 1.55, attack: 1.28, defense: 1.62 },
  25: { hp: 1.95, attack: 1.45, defense: 2.00 },
  35: { hp: 1.36, attack: 1.15, defense: 1.45 },
  45: { hp: 2.00, attack: 1.50, defense: 2.00 },
};

export function gateMultiplier(floor: number) {
  return GATE_MULT_BY_FLOOR[floor] ?? { hp: 1.5, attack: 1.25, defense: 1.65 };
}

/**
 * 26층부터의 일반 층에 붙는 배수.
 *
 * 1~25층은 손으로 짠 구성인데 26층부터는 랜덤 풀만 돌아서, 무장비·자연 레벨로도
 * 승률 100% / 6턴이었다. 45개 층이 복도였다는 뜻이다. 1.4 를 넘기지 말 것 —
 * 그 위는 소모가 아니라 벽이 된다(43층 실측: ×1.5 에서 무장비 승률 85%).
 */
export function corridorMultiplier(floor: number): number {
  if (floor >= 41) return 1.40;
  if (floor >= 31) return 1.28;
  if (floor >= 26) return 1.15;
  return 1;
}

/** 보스든 관문이든 "각오하고 들어가는 층". 물약을 아끼지 않는 자리다 */
export function isHardFloor(floor: number): boolean {
  return isBossFloor(floor) || isGateFloor(floor);
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
  const enemy = buildFloorEnemy(floor, excludeId);
  // 관문은 그 층이 원래 내놓는 적을 **그대로 두고 무겁게 만든다**. 15·25층은 손으로 짠
  // 구성이 있는 층이라(프리로·모치) 여기서 종족을 갈아치우면 그 설계가 사라진다.
  if (!isGateFloor(floor)) return enemy;
  // ⚠️ scaleToLevel 을 다시 부르면 안 된다 — 이미 층 레벨로 부푼 값을 **다시 종족 기본값 취급**해서
  //    한 번 더 올린다. 35층 관문이 HP 1505 로 40층 보스(1007)를 넘어섰던 게 그 실수였다.
  const lifted = liftLevels(enemy, 2);
  const mult = gateMultiplier(floor);
  return {
    ...lifted,
    name: `관문의 ${enemy.name}`,
    maxHp: Math.floor(lifted.maxHp * mult.hp),
    attack: Math.floor(lifted.attack * mult.attack),
    defense: Math.floor(lifted.defense * mult.defense),
    rewardExp: Math.floor(lifted.rewardExp * 2),
  };
}

/** 이미 만들어진 적에게 레벨 n 만큼의 성장분만 더한다 (레벨당 HP+10/공+3/방+2/속+2) */
function liftLevels(m: Monster, n: number): Monster {
  return {
    ...m,
    level: m.level + n,
    maxHp: m.maxHp + n * 10,
    attack: m.attack + n * 3,
    defense: m.defense + n * 2,
    speed: m.speed + n * 2,
    expToNextLevel: expToNext(m.level + n),
  };
}

function buildFloorEnemy(floor: number, excludeId?: string): Monster {
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
    const scaled = scaleToLevel(base, 12);
    return {
      ...scaled,
      name: "분노한 모시",
      // 이 층의 전기불꽃만 마비를 크게 건다. 첫 관문의 답을 **해독제**로 잡으려는 것이다 —
      // 10층 시점에 만들 수 있는 건 소모품뿐이라(아티팩트 재료는 깊은 숲부터) 답도 거기 있어야 한다.
      moves: [{ ...spark, statusEffect: "paralysis", statusChance: 35 }, thunderbolt, quickAttack, icePunch],
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.25),
      defense: Math.floor(scaled.defense * 1.15),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 20) {
    const base = monsters.find((m) => m.id === "mossevo")!;
    const scaled = scaleToLevel(base, 22);
    return {
      ...scaled,
      name: "격노한 모치",
      moves: [voltCrash, thunderbolt, bodySlam, flamethrower],
      maxHp: Math.floor(scaled.maxHp * 1.38),
      attack: Math.floor(scaled.attack * 1.15),
      defense: Math.floor(scaled.defense * 1.5),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 30) {
    const base = monsters.find((m) => m.id === "frostorb")!;
    const scaled = scaleToLevel(base, 32);
    return {
      ...scaled,
      name: "고대의 프리로",
      // 설풍에 빙결을 크게 실었다. 빙결은 한 턴을 확실히 먹으므로 해독제나 방어가 답이 된다
      moves: [{ ...blizzard, statusEffect: "freeze", statusChance: 30 }, crystalBurst, tidalCrash, solarBeam],
      maxHp: Math.floor(scaled.maxHp * 1.95),
      attack: Math.floor(scaled.attack * 1.78),
      defense: Math.floor(scaled.defense * 1.95),
      rewardExp: Math.floor(scaled.rewardExp * 2.4),
    };
  }
  if (floor === 40) {
    const base = monsters.find((m) => m.id === "mossyfinal")!;
    const scaled = scaleToLevel(base, 42);
    return {
      ...scaled,
      name: "전설의 모왕",
      moves: [thunderStrike, voltCrash, overheat, blizzard],
      maxHp: Math.floor(scaled.maxHp * 1.7),
      attack: Math.floor(scaled.attack * 1.37),
      defense: Math.floor(scaled.defense * 1.94),
      rewardExp: Math.floor(scaled.rewardExp * 2.8),
    };
  }
  if (floor === 50) {
    const base = monsters.find((m) => m.id === "ormr")!;
    const scaled = scaleToLevel(base, 52);
    return {
      ...scaled,
      name: "오름",
      moves: pickOrmrMoves(),
      maxHp: Math.floor(scaled.maxHp * 2.15),
      attack: Math.floor(scaled.attack * 1.38),
      defense: Math.floor(scaled.defense * 1.75),
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
  const level = boss ? floor + 2 : floor;
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

  // 26층부터의 일반 층. 여기는 설계가 없어 랜덤 풀만 돌던 구간이라, 무장비 파티도
  // 6턴에 완승했다. **패배율이 아니라 소모율**을 올린다 — 층이 길어져 물약과 HP 가 닳는다.
  const zone = corridorMultiplier(floor);
  if (zone > 1) {
    return {
      ...scaled,
      maxHp: Math.floor(scaled.maxHp * zone),
      // 방어는 조금 더, 공격은 조금만. 공격을 같이 올리면 소모가 아니라 사고가 된다
      defense: Math.floor(scaled.defense * (1 + (zone - 1) * 1.15)),
      attack: Math.floor(scaled.attack * (1 + (zone - 1) * 0.4)),
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

// ─── 보스 전용 기믹 ──────────────────────────────────────────────────────────────

/**
 * 40층 전설의 모왕은 한 번, HP 가 절반 아래로 떨어질 때 몸을 추스른다.
 *
 * 숫자만 키운 보스는 "몇 대 더 때리면 되는" 문제라 장비가 있으나 없으나 결론이 같다.
 * 회복이 한 번 끼면 **정해진 턴 안에 그만큼을 더 넣을 수 있는가**가 되고, 그건 화력 —
 * 즉 장비를 갖췄는가 — 로만 답할 수 있는 질문이다.
 *
 * 회복 기술이 아니라 보스 전용 훅인 이유: moves.ts 에 회복기가 하나도 없고, 하나를 만들면
 * 그 기술을 배우는 모든 몬스터의 밸런스가 같이 움직인다.
 */
export const BOSS_REGEN: Record<number, { atHpRatio: number; healRatio: number; line: string }> = {
  40: {
    atHpRatio: 0.5,
    healRatio: 0.25,
    line: "전설의 모왕이 숨을 고른다 — 상처가 아물고 있다!",
  },
};

export function getBossRegen(floor: number) {
  return BOSS_REGEN[floor] ?? null;
}

/**
 * 지금 이 보스가 몸을 추스르는가. 회복량을 돌려주고, 아니면 0.
 * "한 번뿐"은 호출부가 기억한다(전투 상태라 여기서 들고 있을 수 없다).
 */
export function bossRegenAmount(floor: number, currentHp: number, maxHp: number): number {
  const regen = getBossRegen(floor);
  if (!regen || currentHp <= 0) return 0;
  if (currentHp > maxHp * regen.atHpRatio) return 0;
  return Math.min(maxHp - currentHp, Math.floor(maxHp * regen.healRatio));
}

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
  if (isGateFloor(floor)) {
    // 관문은 무작위 풀에서 나오므로 기술 id 를 고정할 수 없다. 대신 **가진 기술을 센 것부터
    // 순서대로** 돌린다 — 읽히되 아프다. 보스처럼 이야기가 붙은 패턴은 아니다.
    const ordered = [...enemyMoves].sort((a, b) => b.power - a.power);
    if (ordered.length === 0) return null;
    const cycle = [ordered[0], ordered[ordered.length - 1], ordered[0], ...ordered.slice(1)];
    return cycle[turnIndex % cycle.length];
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
