import { rgba } from "../../shared/palette";
import type { ForestNodeType } from "./nodes";

/**
 * 소란도 — 숲이 유일하게 이월하는 자원.
 *
 * HP 를 이월하면 숲이 무한의 탑의 열화판이 된다(소모전은 탑의 것이다). 그래서
 * 이월하는 건 체력이 아니라 **숲이 나를 얼마나 눈치챘는가** 하나뿐이다.
 * 낮으면 안전하고 정보가 보이고, 높으면 수확이 늘고 위험해진다.
 *
 * ⚠️ 이 다이얼이 "항상 최대"로 수렴하면 결정이 사라진다. 그래서 낮은 쪽에 고유한
 *    이득을 둔다 — **소란도가 낮을수록 다음 노드가 더 많이 보인다**(scout).
 *    Darkest Dungeon 의 횃불이 밝을수록 정찰이 잘 되는 것과 같은 자리다.
 *    수확 배수만 남기고 이걸 빼면 최대로 올리는 게 언제나 정답이 된다. 빼지 마라.
 *
 * 수치는 실측 기준으로 환산한 제안값이다(얕은 2.84 · 깊은 6.95 · 고대 11.65개/탐험).
 * 바꿀 일이 생기면 이 표만 고친다.
 */

export const ALERT_MAX = 100;

/** 다음 노드에 대해 얼마나 보여 줄지. 낮은 소란도의 고유 이득이다. */
export type ScoutLevel =
  /** 종류 + 무엇을 얻는지 + 소란 증감까지 */
  | "detail"
  /** 종류와 소란 증감까지 */
  | "type"
  /** 위험한지 아닌지 두 갈래만 */
  | "danger"
  /** 아무것도 */
  | "none";

export type AlertBandId = "calm" | "stir" | "wary" | "uproar";

export interface AlertBand {
  id: AlertBandId;
  label: string;
  /** 구간 하한 (상한은 다음 구간의 min - 1, 마지막은 ALERT_MAX - 1) */
  min: number;
  /** 재료 개수 배수 */
  materialMul: number;
  /** 희귀 조우 가산 확률 (STEP 2 의 둥지·이변이 쓴다) */
  rareBonus: number;
  /** 포획 성공률에서 그대로 빼는 값 (확률의 절대치) */
  catchPenalty: number;
  /** 강적이 난입할 확률 (STEP 2) */
  intruderChance: number;
  scout: ScoutLevel;
  /** 배경 위에 까는 틴트. 소란이 오를수록 숲이 붉게 달아오른다 */
  tint: string;
  /** 파티클 밀도 배수 — 술렁이는 정도를 움직임으로도 보여 준다 */
  particleMul: number;
}

/**
 * 구간 표. min 오름차순이며 첫 구간의 min 은 0 이어야 한다(alertBand 가 이 순서를 믿는다).
 */
export const ALERT_BANDS: AlertBand[] = [
  {
    id: "calm", label: "조용함", min: 0,
    materialMul: 1.0, rareBonus: 0, catchPenalty: 0, intruderChance: 0,
    scout: "detail", tint: rgba("shadow900", 0), particleMul: 1,
  },
  {
    id: "stir", label: "술렁임", min: 26,
    materialMul: 1.3, rareBonus: 0.10, catchPenalty: 0, intruderChance: 0,
    scout: "type", tint: rgba("ember500", 0.05), particleMul: 1.3,
  },
  {
    id: "wary", label: "경계", min: 51,
    materialMul: 1.6, rareBonus: 0.25, catchPenalty: 0.10, intruderChance: 0.25,
    scout: "danger", tint: rgba("ember700", 0.10), particleMul: 1.6,
  },
  {
    id: "uproar", label: "소란", min: 76,
    materialMul: 2.0, rareBonus: 0.50, catchPenalty: 0.20, intruderChance: 1,
    scout: "none", tint: rgba("ember700", 0.18), particleMul: 2,
  },
];

/**
 * 노드를 처리하면 소란도가 이만큼 움직인다.
 *
 * 은신처만 음수다 — HP 회복이 아니라 **소란을 되사는 자리**다. 그래서 은신처를
 * 밟는 값은 그 노드에서 아무것도 못 얻는다는 기회비용으로 치른다.
 * event 는 0 이다. 보상이 없는 노드라 대가도 없어야 하고, STEP 2 에서 삭제된다.
 */
export const NODE_ALERT: Record<ForestNodeType, number> = {
  start:    0,
  material: 5,
  battle:   10,
  event:    0,
  rest:     -25,
  elite:    25,
  boss:     30,
};

/** 전투에서 지면 붙는 소란. 런이 끝나지는 않지만 대가는 확실하다. */
export const DEFEAT_ALERT = 30;

export function clampAlert(value: number): number {
  return Math.max(0, Math.min(ALERT_MAX, Math.round(value)));
}

/** 지금 소란도가 속한 구간. 100(강제 퇴각)도 마지막 구간으로 친다. */
export function alertBand(value: number): AlertBand {
  const v = clampAlert(value);
  let band = ALERT_BANDS[0];
  for (const b of ALERT_BANDS) if (v >= b.min) band = b;
  return band;
}

/** 강제 퇴각선에 닿았는가 */
export function isForcedRetreat(value: number): boolean {
  return clampAlert(value) >= ALERT_MAX;
}

/** 재료 개수에 배수를 먹인다. 반올림이라 배수 1.3 이 1개짜리를 1개로 두는 일은 없다. */
export function applyMaterialMultiplier(count: number, alert: number): number {
  return Math.max(1, Math.round(count * alertBand(alert).materialMul));
}

/**
 * 소란도가 반영된 포획 성공률.
 * 뺀 값이 0 밑으로 내려가면 "절대 못 잡는다"가 되어 시도 자체가 무의미해지므로 하한을 둔다.
 */
export function catchRateWithAlert(baseRate: number, alert: number): number {
  return Math.max(0.05, baseRate - alertBand(alert).catchPenalty);
}
