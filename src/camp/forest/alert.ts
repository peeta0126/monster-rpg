import { PALETTE, rgba } from "../../shared/palette";
import type { ForestStepKind } from "./steps";

/**
 * 소란도. 숲이 유일하게 이월하는 자원이다.
 *
 * HP 를 이월하면 숲이 무한의 탑의 열화판이 된다(소모전은 탑의 것이다). 그래서
 * 이월하는 건 체력이 아니라 숲이 나를 얼마나 눈치챘는가 하나뿐이다.
 * 낮으면 안전하고 정보가 보이고, 높으면 수확이 늘고 위험해진다.
 *
 * ⚠️ 이 다이얼이 "항상 최대"로 수렴하면 결정이 사라진다. 그래서 낮은 쪽에 고유한
 *    이득을 둔다. 소란도가 낮을수록 다음 노드가 더 많이 보인다(scout).
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
  /** 파티클 밀도 배수. 술렁이는 정도를 움직임으로도 보여 준다 */
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
 * 걸음 사건 하나를 치르면 소란도가 이만큼 움직인다(깊이 배율 적용 전 기본값).
 *
 * 은신처만 음수다. HP 회복이 아니라 소란을 되사는 자리다. 그래서 은신처를
 * 고르는 값은 그 걸음에서 아무것도 못 얻는다는 기회비용으로 치른다.
 */
export const STEP_ALERT: Record<ForestStepKind, number> = {
  trace:     5,
  encounter: 10,
  nest:      20,
  anomaly:   25,
  hideout:   -25,
  champion:  30,
  warden:    30,
};

// 놓쳤을 때 붙는 소란은 쫓던 것의 등급에 비례한다. steps.ts 의 escapeAlert() 가 정한다.
// 숲에서 일어나는 실패는 전투 패배가 아니라 "못 가져옴"이다. 그래서 이름도 escape 다.

/**
 * 깊이가 붙이는 압력.
 *
 * 걸음 상한이 없고 은신처로 계속 깎을 수 있으면 안전한 무한 파밍이 된다. 그러면
 * 다이얼이 무의미하다. 인위적인 벽 대신 깊이가 값을 올린다. "얼마나 오래 버티느냐"가
 * 실력이 되고, 은신처는 초반에 크고 후반에 작아진다.
 */
const ALERT_DEPTH_DIVISOR = 20;
const HIDEOUT_DECAY_DEPTH = 40;

/** 이 깊이에서 이 사건이 실제로 올리는(내리는) 소란 */
export function stepAlertDelta(kind: ForestStepKind, depth: number): number {
  const base = STEP_ALERT[kind];
  if (base < 0) {
    // 은신처: 깊이가 깊을수록 덜 회복된다. 40 걸음이면 아예 안 듣는다
    const decay = Math.max(0, 1 - depth / HIDEOUT_DECAY_DEPTH);
    // + 0 은 -0 을 지운다. 화면에 "소란 -0" 이라고 적히고 테스트도 -0 을 잡는다
    return Math.round(base * decay) + 0;
  }
  return Math.round(base * (1 + depth / ALERT_DEPTH_DIVISOR));
}

/**
 * 소란이 판정 전에 붙는 사건.
 *
 * 보통은 판정이 끝난 뒤에 붙는다. 방금 올린 소란으로 그 걸음의 수확을 불리면
 * 앞뒤가 안 맞아서다. 주인만 반대인데, 주인을 만나면 거기서 런이 끝나니까
 * 판정 후에 붙이면 그 +30 이 아무 데도 걸리지 않는 죽은 값이 된다.
 *
 * 도착 시점으로 당기면 "주인을 깨웠다 → 숲이 뒤집혔다 → 그 상태로 붙는다"가 되어
 * 자기 포획 확률에 스스로 걸린다. 탐욕이 치르는 마지막 청구서다.
 */
export function appliesAlertOnArrival(kind: ForestStepKind): boolean {
  return kind === "warden";
}

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

/**
 * 구간을 나타내는 색. 게이지와 요약 줄이 같은 색을 써야 같은 것을 말하는 걸로 읽힌다.
 * 조용함만 서늘한 쪽(mist)에 두고 위로 갈수록 붉어진다.
 */
export function bandColor(alert: number): string {
  const id = alertBand(alert).id;
  if (id === "calm") return PALETTE.mist300;
  if (id === "stir") return PALETTE.sand200;
  if (id === "wary") return PALETTE.ember500;
  return PALETTE.ember700;
}
