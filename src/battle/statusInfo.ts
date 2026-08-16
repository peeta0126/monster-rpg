import type { StatusEffect } from "../shared/game";
import { STATUS_DURATION, STATUS_TICK_RATIO } from "./battleUtils";
import type { PaletteName } from "../shared/palette";
import type { IconName } from "../shared/ui/icons";

/**
 * 상태이상 표시의 단일 출처.
 *
 * 예전엔 BattlePage 와 BattleScene 이 각자 `{ paralysis: "마비", ... }` 표를 들고 있었다.
 * 두 벌이면 한쪽만 고쳐도 티가 안 난다 — 실제로 색은 씬에만 있었다.
 *
 * 지속 턴 수와 매 턴 피해율은 전투가 쓰는 상수(battleUtils)를 그대로 읽는다. 화면이
 * "4턴"이라고 적는데 실제로는 5턴 가는 일이 없어야 한다.
 */

type Status = NonNullable<StatusEffect>;

export interface StatusMeta {
  /** DOM 에서 그릴 픽셀 아이콘. 캔버스 쪽은 글자만 쓴다 */
  icon: IconName;
  name: string;
  /** 걸린 직후 몇 턴 가는가 */
  duration: string;
  /** 매 턴 최대 HP 의 몇 %를 깎는가 (없으면 0) */
  tickPercent: number;
  color: PaletteName;
}

/**
 * 색은 밝은 토큰만 쓴다. 예전엔 독이 earth-500, 화상이 ember-600 이었는데 둘 다 어두운
 * 패널 위에서 3:1 언저리라 12px 글자로는 읽히지 않았다. 마비와 화상이 같은 색이지만
 * 아이콘이 다르므로 구분은 남는다(색맹 대응이기도 하다).
 */
export const STATUS_META: Record<Status, StatusMeta> = {
  paralysis: { icon: "status-paralysis", name: "마비", duration: `${STATUS_DURATION.paralysis}턴`, tickPercent: 0,                             color: "ember500" },
  poison:    { icon: "status-poison",    name: "독",   duration: `${STATUS_DURATION.poison}턴`,    tickPercent: STATUS_TICK_RATIO.poison * 100, color: "sand300"  },
  freeze:    { icon: "status-freeze",    name: "빙결", duration: `${STATUS_DURATION.freeze}턴`,    tickPercent: 0,                             color: "mist300"  },
  burn:      { icon: "status-burn",      name: "화상", duration: `${STATUS_DURATION.burn}턴`,      tickPercent: STATUS_TICK_RATIO.burn * 100,   color: "ember500" },
};

/**
 * `마비` — 글자만 나가는 자리(전투 로그·캔버스 배지).
 *
 * 예전엔 이름 앞에 이모지를 붙였다. 캔버스 로그는 픽셀 폰트로 그려지는데 그 폰트에
 * 이모지가 없어 그 글자만 다른 서체로 떨어졌다. 그림이 필요한 DOM 자리는
 * `STATUS_META.icon` 을 PixelIcon 으로 그린다.
 */
export function statusLabel(s: StatusEffect): string {
  return s ? STATUS_META[s].name : "";
}

/**
 * `마비 2턴` — 좁은 배지(전투 캔버스 HP 패널).
 * 남은 턴을 알면 그 값을, 모르면(0 이하) 걸렸을 때의 총 지속을 적는다.
 */
export function statusBadge(s: StatusEffect, turnsLeft = 0): string {
  if (!s) return "";
  const left = turnsLeft > 0 ? `${turnsLeft}턴` : STATUS_META[s].duration;
  return `${statusLabel(s)} ${left}`;
}

/** `독 3턴 · 매 턴 -6%` — 자리가 있는 곳(하단 상태바) */
export function statusDetail(s: StatusEffect, turnsLeft = 0): string {
  if (!s) return "";
  const m = STATUS_META[s];
  const tick = m.tickPercent > 0 ? ` · 매 턴 -${Math.round(m.tickPercent)}%` : "";
  return `${statusBadge(s, turnsLeft)}${tick}`;
}
