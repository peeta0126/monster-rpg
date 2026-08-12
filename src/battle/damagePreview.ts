import type { ElementType, Move } from "../shared/game";
import { computeDamage, getTypeMultiplier, type BattleMonster } from "./battleUtils";

/**
 * 기술을 고르기 **전에** 결과를 보여주기 위한 예측.
 *
 * 계산은 한 줄도 여기서 하지 않는다 — battleUtils.computeDamage(전투가 실제로 쓰는
 * 그 함수)를 부를 뿐이다. 식을 고치면 표시도 같이 바뀐다.
 *
 * 치명타는 범위에 넣지 않는다. 확률 5% 짜리를 최대값에 섞으면 "이걸로 끝낼 수 있나"의
 * 답이 늘 "그럴 수도"가 되어 예측이 쓸모없어진다. 대신 확률과 치명타 시 데미지를
 * 따로 들고 나가서 화면이 작게 적는다.
 */

/** 장착 장비에서 온 공격 쪽 보너스. BattlePage.getEquipCombatBonus 의 부분집합이다. */
export interface AttackerBonus {
  attack?: number;
  critRate?: number;
  elementPower?: number;
  critDamage?: number;
  elementalDamage?: Partial<Record<ElementType, number>>;
}

export interface MovePreview {
  /** 비치명타 데미지의 최소/최대. 지금 공식엔 난수가 없어 둘이 같다(아래 주석 참고). */
  minDamage: number;
  maxDamage: number;
  /** 치명타가 뜰 수 있을 때의 데미지. 확률이 0이면 null */
  critDamage: number | null;
  /** 치명타 확률(%) */
  critChance: number;
  accuracy: number;
  multiplier: number;
  /** power 0 인 보조기 — 데미지 예측이 의미 없다 */
  isStatus: boolean;
  /**
   * 이 기술로 상대를 쓰러뜨릴 수 있는가.
   *  "sure"  최소 데미지 ≥ 잔여 HP  (빗나가지만 않으면 확정)
   *  "maybe" 치명타가 떠야 닿는다
   */
  ko: "sure" | "maybe" | null;
}

export function previewMove(
  attacker: BattleMonster,
  defender: BattleMonster,
  move: Move,
  bonus: AttackerBonus = {},
): MovePreview {
  const {
    attack = 0, critRate = 0, elementPower = 0, critDamage = 0, elementalDamage = {},
  } = bonus;

  // 전투가 하는 것과 같은 방식으로 장비 공격력을 얹는다(BattlePage.resolveAttack).
  const eff = attack ? { ...attacker, attack: attacker.attack + attack } : attacker;
  const mods = { elementPowerBonus: elementPower, elementalDamageBonus: elementalDamage };

  const isStatus = move.power === 0;
  // 지금 데미지 공식에는 난수가 없다(난수는 명중·치명타 굴림뿐). 그래서 최소=최대다.
  // 공식에 흔들림이 생기면 이 두 줄만 바꾸면 화면·테스트가 따라온다.
  const damage = isStatus ? 0 : computeDamage(eff, defender, move, mods);
  const minDamage = damage;
  const maxDamage = damage;

  const crit = !isStatus && critRate > 0
    ? computeDamage(eff, defender, move, { ...mods, isCrit: true, critDamageBonus: critDamage })
    : null;

  const hp = defender.currentHp;
  const ko: MovePreview["ko"] =
    isStatus || hp <= 0 ? null
    : minDamage >= hp ? "sure"
    : maxDamage >= hp || (crit !== null && crit >= hp) ? "maybe"
    : null;

  return {
    minDamage, maxDamage,
    critDamage: crit,
    critChance: critRate,
    accuracy: move.accuracy,
    multiplier: getTypeMultiplier(move.type, defender.type),
    isStatus,
    ko,
  };
}

/** `28~34` / 흔들림이 없으면 `34`. 화면 여러 곳이 같은 형식을 쓰도록 여기 한 벌만 둔다. */
export function formatDamageRange(p: MovePreview): string {
  return p.minDamage === p.maxDamage ? `${p.minDamage}` : `${p.minDamage}~${p.maxDamage}`;
}
