import { typeChart } from "./typeChart";
import type { Monster, Move, StatusEffect, ElementType } from "../shared/game";

// ─── BattleMonster 타입 ─────────────────────────────────────────────────────────

/** 전투 중 몬스터 상태 (Monster 기반 확장) */
export interface BattleMonster extends Monster {
  currentHp: number;
  /** 현재 적용된 상태이상. null이면 정상 상태 */
  status: StatusEffect;
  /** 상태이상이 몇 턴 더 남았는가. 0 이면 상태이상이 없다 (STATUS_DURATION 참고) */
  statusTurns: number;
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
    statusTurns: 0,
    attackBuffMult: 1.0,
    attackBuffTurns: 0,
  };
}

/** OwnedMonster의 currentHp를 유지하면서 BattleMonster로 변환 */
export function createBattleMonsterFromOwned(monster: Monster & { currentHp: number }): BattleMonster {
  return {
    ...monster,
    status: null,
    statusTurns: 0,
    attackBuffMult: 1.0,
    attackBuffTurns: 0,
  };
}

// ─── 속성 상성 ──────────────────────────────────────────────────────────────────

/**
 * 공격 속성과 방어 속성의 상성 배율 반환
 * typeChart에 정의된 값이 없으면 1배(보통)를 반환한다
 * 방어자 타입이 null(오름 전용 무속성)이면 약점도 저항도 없이 항상 1배
 */
export function getTypeMultiplier(
  moveType: Move["type"],
  targetType: Monster["type"]
): number {
  if (targetType === null) return 1;
  return typeChart[moveType]?.[targetType] ?? 1;
}

// ─── 데미지 계산 ────────────────────────────────────────────────────────────────

/** 치명타 발생 시 데미지 배율 (장비 critRate로만 발동 — 몬스터 기본 치명타율은 0) */
const CRIT_DAMAGE_MULTIPLIER = 1.5;

/** 데미지 계산에 얹히는 장비 보너스. 굴림과 무관한 값만 모았다. */
export interface DamageModifiers {
  /** 자속 보정(%) */
  elementPowerBonus?: number;
  /** 기술 속성별 데미지 증가(%) */
  elementalDamageBonus?: Partial<Record<ElementType, number>>;
  /** 치명타가 떴다고 보고 계산할지 */
  isCrit?: boolean;
  /** 치명타 배율 가산(%) */
  critDamageBonus?: number;
}

/**
 * 명중·치명타 **굴림을 뺀** 데미지 본체. 공식은 아래 calculateDamage 주석 참고.
 *
 * calculateDamage 에서 떼어낸 이유는 하나다. 기술 선택 화면이 "이 기술로 몇 대미지가
 * 들어가는가"를 보여주려면 같은 계산이 필요한데, 거기서 식을 베껴 적으면 나중에 식을
 * 고쳐도 표시는 옛 값을 계속 보여준다(이 저장소에서 이미 겪은 사고다).
 * 굴림이 없어 부작용도 없으므로 화면에서 몇 번을 불러도 안전하다.
 */
export function computeDamage(
  attacker: BattleMonster,
  defender: BattleMonster,
  move: Move,
  mods: DamageModifiers = {},
): number {
  // 상태기(power = 0)는 데미지 없음
  if (move.power === 0) return 0;

  const { elementPowerBonus = 0, elementalDamageBonus = {}, isCrit = false, critDamageBonus = 0 } = mods;
  const multiplier = getTypeMultiplier(move.type, defender.type);

  // 명세 공식 적용 (공격 버프 반영)
  const effectiveAttack = attacker.attack * (attacker.attackBuffMult ?? 1.0);
  let baseDamage = (effectiveAttack * move.power) / defender.defense;

  // 속성 능력(자속 보정): 사용 기술이 자신의 속성과 같을 때만 적용
  if (elementPowerBonus > 0 && move.type === attacker.type) {
    baseDamage *= 1 + elementPowerBonus / 100;
  }

  // 부가 능력치: 기술 속성별 데미지 증가 (자속 여부와 무관)
  const typeDamageBonus = elementalDamageBonus[move.type] ?? 0;
  if (typeDamageBonus > 0) {
    baseDamage *= 1 + typeDamageBonus / 100;
  }

  if (isCrit) baseDamage *= CRIT_DAMAGE_MULTIPLIER + critDamageBonus / 100;

  return Math.max(1, Math.floor(baseDamage * multiplier));
}

/**
 * 데미지 계산
 * 공식: finalDamage = (attacker.attack * skill.power / defender.defense)
 *                      * (자속 시 1 + elementPowerBonus/100)
 *                      * (기술 속성 데미지 부가 능력치 시 1 + elementalDamageBonus[move.type]/100)
 *                      * (치명타 시 1.5 + critDamageBonus/100) * typeMultiplier
 * power가 0인 상태기 스킬은 데미지 없음
 * critRateBonus/elementPowerBonus/critDamageBonus/elementalDamageBonus: 장착 장비의 능력치
 * 합산치(%). 몬스터 기본값은 0이다.
 * - elementPower는 사용 기술의 속성이 공격자 자신의 속성과 같을 때만 적용된다(자속 보정).
 * - elementalDamageBonus는 자속 여부와 무관하게 해당 속성 기술이면 항상 적용된다(부가 능력치
 *   fireDamage/waterDamage 등). 이 게임에 존재하지 않는 속성(풍속/대지)은 애초에 어떤 기술도
 *   해당 타입을 가질 수 없어 windDamage/earthDamage는 호출부에서 매핑되지 않는다.
 */
export function calculateDamage(
  attacker: BattleMonster,
  defender: BattleMonster,
  move: Move,
  critRateBonus = 0,
  elementPowerBonus = 0,
  elementalDamageBonus: Partial<Record<ElementType, number>> = {},
  critDamageBonus = 0,
): { damage: number; isHit: boolean; multiplier: number; isCrit: boolean } {
  const multiplier = getTypeMultiplier(move.type, defender.type);

  // 명중률 체크 (0~100 난수)
  const hitRoll = Math.random() * 100;
  const isHit = hitRoll <= move.accuracy;

  if (!isHit) {
    return { damage: 0, isHit: false, multiplier, isCrit: false };
  }

  // 상태기(power = 0)는 데미지 없음
  if (move.power === 0) {
    return { damage: 0, isHit: true, multiplier, isCrit: false };
  }

  // 치명타
  const isCrit = critRateBonus > 0 && Math.random() * 100 < critRateBonus;

  const damage = computeDamage(attacker, defender, move, {
    elementPowerBonus, elementalDamageBonus, isCrit, critDamageBonus,
  });

  return { damage, isHit: true, multiplier, isCrit };
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
 * 매 턴 최대 HP 의 몇 할을 깎는가. 화면이 "매 턴 -6%"를 적으려면 같은 값이 필요해서
 * 상수로 뽑았다(statusInfo.ts). 값을 여기서 고치면 표시도 같이 바뀐다.
 */
export const STATUS_TICK_RATIO = { poison: 0.06, burn: 0.08 } as const;

/**
 * 상태이상이 몇 턴 만에 저절로 풀리는가. **여기 한 곳에서만 정한다** —
 * 화면(statusInfo)도 전투도 시뮬도 이 표를 읽는다.
 *
 * 예전엔 자동 해제가 빙결(1턴)뿐이었다. 화상 8%/턴 이면 12턴에 최대 HP 전부가
 * 날아가는데 그게 전투 끝까지 갔으니, 한 번 걸리면 그 전투는 이미 진 것이었다.
 * 반대로 너무 짧으면 상태기를 쓰는 턴이 아깝다 — 걸어도 의미가 없으면 안 된다.
 *
 * 그래서 "아프지만 버틸 수 있는" 총량으로 잡았다.
 *   화상 4턴 × 8% = 최대 HP 의 32%
 *   독   5턴 × 6% = 30% (덜 아픈 대신 오래 간다 — 둘의 성격이 갈린다)
 *   마비 4턴 × 30% 스킵 = 기대 1.2턴 상실
 *   빙결 1턴 (확정 행동 불가라 짧다 — 예전 그대로)
 */
export const STATUS_DURATION: Record<NonNullable<StatusEffect>, number> = {
  burn: 4,
  poison: 5,
  paralysis: 4,
  freeze: 1,
};

/**
 * 몬스터에게 상태이상 적용
 * 이미 다른 상태이상이 걸려 있으면 적용하지 않는다(그 사실은 호출부가
 * status 가 그대로인 것으로 알 수 있다 — 화면은 "효과가 없었다"를 띄운다)
 */
export function applyStatusEffect(
  monster: BattleMonster,
  effect: NonNullable<StatusEffect>
): BattleMonster {
  // 이미 상태이상 존재 시 중복 적용 불가
  if (monster.status !== null) return monster;
  return { ...monster, status: effect, statusTurns: STATUS_DURATION[effect] };
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
  const updated = { ...monster };
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
        const poisonDmg = Math.max(1, Math.floor(monster.maxHp * STATUS_TICK_RATIO.poison));
        updated.currentHp = Math.max(0, updated.currentHp - poisonDmg);
        logs.push(`${monster.name}은(는) 독 피해를 ${poisonDmg} 받았다.`);
      }
      break;

    case "freeze":
      // 빙결: 행동 불가
      skipTurn = true;
      logs.push(`${monster.name}은(는) 빙결 상태라 움직일 수 없다!`);
      break;

    case "burn":
      // 화상: 매 턴 최대HP의 8% 감소
      {
        const burnDmg = Math.max(1, Math.floor(monster.maxHp * STATUS_TICK_RATIO.burn));
        updated.currentHp = Math.max(0, updated.currentHp - burnDmg);
        logs.push(`${monster.name}은(는) 화상으로 ${burnDmg}의 피해를 받았다.`);
      }
      break;
  }

  // 남은 턴을 깎는다. 다 쓰면 풀린다 — 기절한 몬스터에게는 해제 로그를 띄우지 않는다
  // (그 줄이 "쓰러졌다" 뒤에 붙으면 되살아난 것처럼 읽힌다).
  updated.statusTurns = Math.max(0, updated.statusTurns - 1);
  if (updated.statusTurns === 0) {
    const cured = updated.status;
    updated.status = null;
    if (updated.currentHp > 0) {
      logs.push(`${monster.name}의 ${STATUS_NAME[cured!]} 상태가 풀렸다.`);
    }
  }

  return { monster: updated, skipTurn, logs };
}

/**
 * 로그에 적을 상태이상 이름. 화면 표시용 표(statusInfo)는 아이콘까지 들고 있지만
 * 그쪽이 이 파일을 import 하고 있어서, 로그 한 줄을 위해 반대로 부르면 순환이 된다.
 */
const STATUS_NAME: Record<NonNullable<StatusEffect>, string> = {
  burn: "화상", poison: "독", paralysis: "마비", freeze: "빙결",
};

// ─── 포획 ───────────────────────────────────────────────────────────────────────

/** 기본 포획률. HP 문턱을 넘긴 뒤에는 이 값이 바닥이다 */
export const CATCH_BASE_RATE = 0.4;
/** 상태이상이 걸려 있을 때의 배수 */
export const CATCH_STATUS_MULT = 1.5;
/** 아무리 겹쳐도 여기까지 */
export const CATCH_MAX_RATE = 0.95;
/** 이 비율 이하로 깎아야 시도할 수 있다 */
export const CATCH_HP_THRESHOLD = 0.3;

/**
 * 지금 던지면 잡힐 확률(0~1). 굴림이 없어 화면에서 몇 번을 불러도 안전하다.
 *
 * checkCatchCondition 에서 떼어낸 것이라 판정과 표시가 같은 값을 본다 — 버튼에 적힌
 * 숫자와 실제 확률이 어긋나는 것만큼 사람을 속이는 UI 도 없다.
 *
 * ⚠️ HP 는 확률에 들어가지 않는다. 30% 이하라는 **문을 여는 조건**일 뿐이고, 29% 든
 * 1% 든 확률은 같다. 화면에서 "더 깎으면 잘 잡힌다"고 말하면 거짓말이 된다.
 */
export function catchChance(target: BattleMonster): number {
  const statusMultiplier = target.status !== null ? CATCH_STATUS_MULT : 1;
  return Math.min(CATCH_MAX_RATE, CATCH_BASE_RATE * statusMultiplier);
}

/**
 * 포획 가능 여부 및 성공 여부 판단
 * - isCatchZone 플래그가 false면 포획 불가
 * - 대상 HP가 30% 초과면 포획 시도 불가
 * - 확률은 catchChance 가 정한다
 */
export function checkCatchCondition(
  target: BattleMonster,
  isCatchZone: boolean,
): { canAttempt: boolean; success: boolean; message: string } {
  if (target.id === "ormr") {
    return {
      canAttempt: false,
      success: false,
      message: "오름은 포획할 수 없다!",
    };
  }

  if (!isCatchZone) {
    return {
      canAttempt: false,
      success: false,
      message: "이 곳에서는 포획할 수 없다!",
    };
  }

  // HP 30% 초과 시 포획 시도 불가
  const hpRatio = target.currentHp / target.maxHp;
  if (hpRatio > CATCH_HP_THRESHOLD) {
    return {
      canAttempt: false,
      success: false,
      message: "HP가 너무 높아 포획할 수 없다! (30% 이하로 줄여야 함)",
    };
  }

  const success = Math.random() < catchChance(target);
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
/**
 * 레벨업 시 다음 레벨에 필요한 경험치가 불어나는 배율.
 *
 * 이 값이 1.2였을 때는 요구 경험치가 지수로 늘어나는데(100 × 1.2^(레벨-1)) 적이 주는 경험치는
 * 층수에 비례해 선형으로만 늘어나서(rewardExp × (1 + 0.15n)), 층이 오를수록 격차가 벌어졌다.
 * 40층 무렵엔 한 레벨에 100전투가 넘게 필요해 사실상 진행이 멈춘다.
 * 시뮬레이션(scripts/sim)으로 1.20 / 1.14 / 1.12 / 1.10을 비교해 정한 값이다.
 */
export const EXP_GROWTH_RATE = 1.04;

/**
 * 출전하지 않은 파티원이 받는 경험치 비율.
 *
 * 예전엔 0.5 고정이었는데, 그러면 뒤처진 몬스터가 영원히 못 따라잡는다. 시뮬레이션에서
 * 50층 도달 시 파티가 "Lv57 · Lv34 · Lv40" 이었다 — 선봉 하나로 보스를 상대하다 쓰러지면
 * 남은 둘은 20레벨 아래라 그대로 끝났다. 보스층 패배율이 69~87% 였던 주된 이유다.
 *
 * 그래서 뒤처진 만큼 더 준다. 선봉과 같은 레벨이면 절반, 10레벨 이상 벌어지면 동등까지.
 * 앞서 있는 몬스터는 더 받지 않으므로, 이 보정이 격차를 벌리는 쪽으로 작동할 일은 없다.
 *
 * 후보 비교는 scripts/sim/benchSweep.mjs (40판 · 독립 시드):
 *
 *            방식 | 보스 재도전 | 최종 레벨 격차
 *         고정 0.5 |        16.3 |          23.7   ← 이전
 *         고정 0.7 |        11.7 |          22.0
 *     0.5 + .05/lv |        11.9 |          17.1   ← 채택
 *     0.7 + .10/lv |        12.8 |          16.5
 *
 * 재도전은 0.5만 아니면 다 비슷하게 떨어진다(11.7~12.8, 노이즈 범위). 갈리는 건 격차 쪽이고,
 * 거기서 따라잡기가 이긴다. 단순히 다 같이 빨리 크는 게 아니라 뒤처진 쪽만 당기기 때문이다.
 */
export function benchExpShare(benchLevel: number, leadLevel: number): number {
  const gap = Math.max(0, leadLevel - benchLevel);
  return Math.min(1, 0.5 + gap * 0.05);
}

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
      expToNextLevel: Math.floor(nextMonster.expToNextLevel * EXP_GROWTH_RATE),
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
