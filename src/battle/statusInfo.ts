import type { StatusEffect } from "../shared/game";
import { STATUS_TICK_RATIO } from "./battleUtils";
import type { PaletteName } from "../shared/palette";

/**
 * 상태이상 표시의 단일 출처.
 *
 * 예전엔 BattlePage 와 BattleScene 이 각자 `{ paralysis: "⚡마비", ... }` 표를 들고 있었다.
 * 두 벌이면 한쪽만 고쳐도 티가 안 난다 — 실제로 색은 씬에만 있었다.
 *
 * ⚠️ **남은 턴 개념이 이 게임에 없다.** checkStatusEffects 를 보면 빙결만 1턴 뒤 스스로
 * 풀리고 마비·독·화상은 해독제를 쓰거나 전투가 끝날 때까지 남는다. 그래서 "3턴 남음" 같은
 * 표시는 만들 수 없고(만들면 거짓말이다), 대신 **풀리는 조건**을 적는다.
 */

type Status = NonNullable<StatusEffect>;

export interface StatusMeta {
  icon: string;
  name: string;
  /** 언제 풀리는가. 빙결만 확정이고 나머지는 스스로 풀리지 않는다 */
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
  paralysis: { icon: "⚡", name: "마비", duration: "지속", tickPercent: 0,                             color: "ember500" },
  poison:    { icon: "☠",  name: "독",   duration: "지속", tickPercent: STATUS_TICK_RATIO.poison * 100, color: "sand300"  },
  freeze:    { icon: "❄",  name: "빙결", duration: "1턴",  tickPercent: 0,                             color: "mist300"  },
  burn:      { icon: "🔥", name: "화상", duration: "지속", tickPercent: STATUS_TICK_RATIO.burn * 100,   color: "ember500" },
};

/** `⚡마비` — 로그처럼 이름만 필요한 자리 */
export function statusLabel(s: StatusEffect): string {
  if (!s) return "";
  const m = STATUS_META[s];
  return `${m.icon}${m.name}`;
}

/** `⚡마비 지속` — 좁은 배지(전투 캔버스 HP 패널) */
export function statusBadge(s: StatusEffect): string {
  if (!s) return "";
  return `${statusLabel(s)} ${STATUS_META[s].duration}`;
}

/** `☠독 지속 · 매 턴 -6%` — 자리가 있는 곳(하단 상태바) */
export function statusDetail(s: StatusEffect): string {
  if (!s) return "";
  const m = STATUS_META[s];
  const tick = m.tickPercent > 0 ? ` · 매 턴 -${Math.round(m.tickPercent)}%` : "";
  return `${statusBadge(s)}${tick}`;
}
