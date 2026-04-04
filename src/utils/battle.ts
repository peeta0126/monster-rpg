import { typeChart } from "../data/typeChart";
import type { Monster, Move, StatusEffect } from "../types/game";

// ─── BattleMonster 타입 ─────────────────────────────────────────────────────────

/** 전투 중 몬스터 상태 (Monster 기반 확장) */
export interface BattleMonster extends Monster {
  currentHp: number;
  /** 현재 적용된 상태이상. null이면 정상 상태 */
  status: StatusEffect;
  /** 이번 턴에 행동을 건너뛸지 여부 (빙결/마비 처리 후 설정) */
  skipNextTurn: boolean;
  /** 공격 버프 배율 (1.0 = 없음) */
  attackBuffMult: number;
  /** 공격 버프 남은 턴 (0 = 없음) */
  attackBuffTurns: number;
}

/** Monster → BattleMonster 변환 (전투 시작 시 사용) */
export function createBattleMonster(monster: Monster): BattleMonster {
  return {
    ...monster,
    currentHp: monster.maxHp,
    status: null,
    skipNextTurn: false,
    attackBuffMult: 1.0,
    attackBuffTurns: 0,
  };
}

/** OwnedMonster의 currentHp를 유지하면서 BattleMonster로 변환 */
export function createBattleMonsterFromOwned(monster: Monster & { currentHp: number }): BattleMonster {
  return {
    ...monster,
    status: null,
    skipNextTurn: false,
    attackBuffMult: 1.0,
    attackBuffTurns: 0,
  };
}

// ─── 속성 상성 ──────────────────────────────────────────────────────────────────

/**
 * 공격 속성과 방어 속성의 상성 배율 반환
 * typeChart에 정의된 값이 없으면 1배(보통)를 반환한다
 */
export function getTypeMultiplier(
  moveType: Move["type"],
  targetType: Monster["type"]
): number {
  return typeChart[moveType]?.[targetType] ?? 1;
}

// ─── 데미지 계산 ────────────────────────────────────────────────────────────────

/**
 * 데미지 계산
 * 공식: finalDamage = (attacker.attack * skill.power / defender.defense) * typeMultiplier
 * power가 0인 상태기 스킬은 데미지 없음
 */
export function calculateDamage(
  attacker: BattleMonster,
  defender: BattleMonster,
  move: Move
): { damage: number; isHit: boolean; multiplier: number } {
  const multiplier = getTypeMultiplier(move.type, defender.type);

  // 명중률 체크 (0~100 난수)
  const hitRoll = Math.random() * 100;
  const isHit = hitRoll <= move.accuracy;

  if (!isHit) {
    return { damage: 0, isHit: false, multiplier };
  }

  // 상태기(power = 0)는 데미지 없음
  if (move.power === 0) {
    return { damage: 0, isHit: true, multiplier };
  }

  // 명세 공식 적용 (공격 버프 반영)
  const effectiveAttack = attacker.attack * (attacker.attackBuffMult ?? 1.0);
  const baseDamage = (effectiveAttack * move.power) / defender.defense;
  const damage = Math.max(1, Math.floor(baseDamage * multiplier));

  return { damage, isHit: true, multiplier };
}

// ─── 피해 적용 ──────────────────────────────────────────────────────────────────

/** 대상에게 데미지를 입히고 갱신된 BattleMonster 반환 (HP 최소 0) */
export function applyDamage(target: BattleMonster, damage: number): BattleMonster {
  return { ...target, currentHp: Math.max(0, target.currentHp - damage) };
}

// ─── 기절 확인 ──────────────────────────────────────────────────────────────────

/** HP가 0 이하면 기절 판정 */
export function isFainted(monster: BattleMonster): boolean {
  return monster.currentHp <= 0;
}

// ─── 상태이상 ───────────────────────────────────────────────────────────────────

/**
 * 몬스터에게 상태이상 적용
 * 이미 다른 상태이상이 걸려 있으면 적용하지 않는다
 */
export function applyStatusEffect(
  monster: BattleMonster,
  effect: NonNullable<StatusEffect>
): BattleMonster {
  // 이미 상태이상 존재 시 중복 적용 불가
  if (monster.status !== null) return monster;
  return { ...monster, status: effect };
}

/**
 * 매 턴 시작 시 현재 상태이상 처리
 * 반환값:
 *  - monster: 상태이상 효과가 반영된 갱신 상태
 *  - skipTurn: true면 이 턴 행동 불가
 *  - logs: 화면에 출력할 로그 메시지 배열
 */
export function checkStatusEffects(monster: BattleMonster): {
  monster: BattleMonster;
  skipTurn: boolean;
  logs: string[];
} {
  // 상태이상 없으면 그대로 반환
  if (monster.status === null) {
    return { monster, skipTurn: false, logs: [] };
  }

  const logs: string[] = [];
  let updated = { ...monster };
  let skipTurn = false;

  switch (monster.status) {
    case "paralysis":
      // 마비: 30% 확률로 턴 스킵
      if (Math.random() < 0.3) {
        skipTurn = true;
        logs.push(`${monster.name}은(는) 마비로 인해 움직일 수 없다!`);
      }
      break;

    case "poison":
      // 독: 매 턴 최대HP의 6% 감소
      {
        const poisonDmg = Math.max(1, Math.floor(monster.maxHp * 0.06));
        updated.currentHp = Math.max(0, updated.currentHp - poisonDmg);
        logs.push(`${monster.name}은(는) 독 피해를 ${poisonDmg} 받았다.`);
      }
      break;

    case "freeze":
      // 빙결: 1턴 행동 불가 후 자동 해제
      skipTurn = true;
      updated.status = null;
      logs.push(`${monster.name}은(는) 빙결 상태라 움직일 수 없다!`);
      break;

    case "burn":
      // 화상: 매 턴 최대HP의 8% 감소
      {
        const burnDmg = Math.max(1, Math.floor(monster.maxHp * 0.08));
        updated.currentHp = Math.max(0, updated.currentHp - burnDmg);
        logs.push(`${monster.name}은(는) 화상으로 ${burnDmg}의 피해를 받았다.`);
      }
      break;
  }

  return { monster: updated, skipTurn, logs };
}

// ─── 포획 ───────────────────────────────────────────────────────────────────────

/**
 * 포획 가능 여부 및 성공 여부 판단
 * - isCatchZone 플래그가 false면 포획 불가
 * - 대상 HP가 30% 초과면 포획 시도 불가
 * - 기본 포획률 40%, 상태이상 적용 시 1.5배 (최대 95%)
 */
export function checkCatchCondition(
  target: BattleMonster,
  isCatchZone: boolean
): { canAttempt: boolean; success: boolean; message: string } {
  if (!isCatchZone) {
    return {
      canAttempt: false,
      success: false,
      message: "이 곳에서는 포획할 수 없다!",
    };
  }

  // HP 30% 초과 시 포획 시도 불가
  const hpRatio = target.currentHp / target.maxHp;
  if (hpRatio > 0.3) {
    return {
      canAttempt: false,
      success: false,
      message: "HP가 너무 높아 포획할 수 없다! (30% 이하로 줄여야 함)",
    };
  }

  // 기본 포획 확률 40%, 상태이상 시 1.5배
  const baseCatchRate = 0.4;
  const statusMultiplier = target.status !== null ? 1.5 : 1;
  const catchRate = Math.min(0.95, baseCatchRate * statusMultiplier);

  const success = Math.random() < catchRate;
  const message = success
    ? `${target.name} 포획 성공!`
    : `${target.name}이(가) 탈출했다!`;

  return { canAttempt: true, success, message };
}

// ─── AI 로직 ────────────────────────────────────────────────────────────────────

/**
 * AI 적의 최선 스킬 선택
 * 1. 자신 HP 30% 이하: 회복 스킬(category="status", power<=0) 우선 사용
 * 2. 그 외: 상성표 기준 플레이어에게 가장 효과적인 스킬 선택
 */
export function getAIAction(
  enemy: BattleMonster,
  player: BattleMonster
): Move {
  const { moves } = enemy;

  // HP 30% 이하 → 회복 스킬 탐색
  const enemyHpRatio = enemy.currentHp / enemy.maxHp;
  if (enemyHpRatio <= 0.3) {
    const healMove = moves.find(
      (m) => m.category === "status" && (m.power ?? 0) <= 0
    );
    if (healMove) return healMove;
  }

  // 속성 상성표 기반 최선 스킬 선택
  let bestMove = moves[0];
  let bestMultiplier = getTypeMultiplier(bestMove.type, player.type);

  for (const move of moves) {
    const multiplier = getTypeMultiplier(move.type, player.type);
    if (multiplier > bestMultiplier) {
      bestMultiplier = multiplier;
      bestMove = move;
    }
  }

  return bestMove;
}

// ─── 경험치 / 레벨업 ────────────────────────────────────────────────────────────

/** 경험치 획득 처리. 레벨업 시 스탯 자동 증가 및 HP 전회복 */
export function gainExp(monster: BattleMonster, gainedExp: number) {
  let nextMonster: BattleMonster = {
    ...monster,
    exp: monster.exp + gainedExp,
  };

  let leveledUp = false;

  while (nextMonster.exp >= nextMonster.expToNextLevel) {
    nextMonster = {
      ...nextMonster,
      exp: nextMonster.exp - nextMonster.expToNextLevel,
      level: nextMonster.level + 1,
      expToNextLevel: Math.floor(nextMonster.expToNextLevel * 1.2),
      maxHp: nextMonster.maxHp + 10,
      attack: nextMonster.attack + 3,
      defense: nextMonster.defense + 2,
      speed: nextMonster.speed + 2,
    };

    nextMonster.currentHp = nextMonster.maxHp;
    leveledUp = true;
  }

  return { updatedMonster: nextMonster, leveledUp };
}
