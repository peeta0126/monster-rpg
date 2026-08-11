import { PALETTE } from "../../shared/palette";
import { STEP_ALERT, stepAlertDelta, appliesAlertOnArrival, type ScoutLevel } from "./alert";

/**
 * 걸음 사건 한 벌.
 *
 * 숲은 지도가 아니라 걸음이다. 예전에는 노드 그래프를 미리 깔고 그 위를 걸었는데,
 * 여러 걸음 앞을 계획하게 하려고 그리는 UI 를 한 걸음씩만 고르는 게임에 쓴 것이라
 * 지도가 늘 헛돌았다. 이제 한 걸음마다 사건을 뽑는다.
 */

export type ForestStepKind =
  /** 흔적 — 재료 확정 소량 */
  | "trace"
  /** 조우 — 야생 몬스터, 포획 기회 */
  | "encounter"
  /** 둥지 — 2~3마리 중 골라 노린다 */
  | "nest"
  /** 이변 — 희귀 테이블 전용 */
  | "anomaly"
  /** 은신처 — 소란을 되산다. 그 외 수확 없음 */
  | "hideout"
  /** 강적 — 대량 재료 + 특수 포획 */
  | "champion"
  /** 숲의 주인 — 구역 고유. 만나면 거기서 런이 끝난다 */
  | "warden";

/** 사건 등급. 아이콘 색이 여기서 나온다 (moss 일반 · mist 희귀 · ember 주인) */
export type StepTier = "common" | "rare" | "warden";

export interface StepDef {
  kind: ForestStepKind;
  /** 사건 패널 제목 */
  title: string;
  /** 정찰이 가장 좋을 때 보여 주는 한 줄 — 무엇을 얻는지만 적는다 */
  hint: string;
  tier: StepTier;
  /** 추첨 가중치. 주인은 조건부라 여기 없다 */
  weight: number;
}

export const STEP_DEFS: Record<ForestStepKind, StepDef> = {
  trace:     { kind: "trace",     title: "무언가 지나간 흔적",   hint: "재료 확정 소량",        tier: "common", weight: 30 },
  encounter: { kind: "encounter", title: "덤불 속에서 무언가 움직인다", hint: "야생 몬스터 · 포획 기회", tier: "common", weight: 30 },
  hideout:   { kind: "hideout",   title: "몸을 숨길 바위 그늘",  hint: "숨을 고른다 · 소란을 되산다", tier: "common", weight: 15 },
  nest:      { kind: "nest",      title: "둥지를 찾았다",        hint: "여러 마리 중 골라 노린다", tier: "rare",   weight: 10 },
  anomaly:   { kind: "anomaly",   title: "숲의 결이 어긋나 있다", hint: "희귀 재료만 나온다",     tier: "rare",   weight: 10 },
  champion:  { kind: "champion",  title: "커다란 그림자가 선다",  hint: "대량 재료 · 특수 포획",   tier: "rare",   weight: 5 },
  warden:    { kind: "warden",    title: "숲의 주인이 깨어났다",  hint: "구역의 주인 · 여기서 끝난다", tier: "warden", weight: 0 },
};

export const TIER_COLOR: Record<StepTier, string> = {
  common: PALETTE.moss500,
  rare:   PALETTE.mist300,
  warden: PALETTE.ember500,
};

/**
 * 주인이 나올 수 있는 조건.
 *
 * 소란만 조건으로 두면 조심스럽게 걷는 사람은 주인을 영원히 못 본다. 가장 좋은
 * 콘텐츠가 한 가지 플레이 스타일에만 열려 있으면 안 된다 — 위험을 감수하거나
 * 끈기를 발휘하거나, 두 경로가 같은 클라이맥스에 닿는다.
 */
export const WARDEN_ALERT_MIN = 76;
export const WARDEN_DEPTH_MIN = 15;

export function wardenCanAppear(alert: number, depth: number): boolean {
  return alert >= WARDEN_ALERT_MIN || depth >= WARDEN_DEPTH_MIN;
}

/** 조건이 찼을 때 주인이 실제로 나올 가중치. 조건을 채워도 바로는 아니다 */
const WARDEN_WEIGHT = 8;

/** 갈림길이 뜨는 비율. 나머지는 단일 사건이다 */
export const FORK_CHANCE = 0.4;

/** 0~1 난수를 받는다 — 런 스토어가 시드 RNG 를 넘긴다(같은 런은 같은 결과) */
export type Rng = () => number;

function weightedPick(entries: [ForestStepKind, number][], rng: Rng): ForestStepKind {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [kind, w] of entries) { r -= w; if (r <= 0) return kind; }
  return entries[entries.length - 1][0];
}

/** 이 걸음에 나올 수 있는 사건과 가중치 */
function candidates(alert: number, depth: number): [ForestStepKind, number][] {
  const list = (Object.values(STEP_DEFS) as StepDef[])
    .filter((d) => d.weight > 0)
    .map((d) => [d.kind, d.weight] as [ForestStepKind, number]);
  if (wardenCanAppear(alert, depth)) list.push(["warden", WARDEN_WEIGHT]);
  return list;
}

export function rollStep(alert: number, depth: number, rng: Rng): ForestStepKind {
  return weightedPick(candidates(alert, depth), rng);
}

/** 갈림길에 놓을 두 갈래. 같은 사건이 두 번 나오면 고를 이유가 없어 서로 다르게 뽑는다 */
export function rollFork(alert: number, depth: number, rng: Rng): [ForestStepKind, ForestStepKind] {
  const first = rollStep(alert, depth, rng);
  const rest = candidates(alert, depth).filter(([k]) => k !== first);
  const second = weightedPick(rest, rng);
  return [first, second];
}

/** 길 이름 — 갈림길 카드의 제목. 사건 정체를 흘리지 않는 중립적인 이름만 쓴다 */
export const PATH_NAMES = [
  "이끼 낀 오솔길", "뿌리 틈새", "무너진 돌담 너머", "물소리 나는 쪽",
  "가시덤불 사이", "쓰러진 나무 아래", "안개가 옅은 쪽", "새 울음이 멎은 쪽",
];

export function pathName(rng: Rng): string {
  return PATH_NAMES[Math.floor(rng() * PATH_NAMES.length)];
}

/**
 * 정찰 등급에 따라 이 사건에 대해 보여 줄 것.
 *
 * 소란이 낮을수록 많이 보인다. 이게 소란을 낮게 유지할 유일한 이유이자, 다이얼이
 * "항상 최대"로 수렴하지 않게 막는 안전장치다.
 */
export function scoutStep(kind: ForestStepKind, depth: number, scout: ScoutLevel): {
  title: string; detail: string; alertText: string; tier: StepTier;
} {
  const def = STEP_DEFS[kind];
  const delta = stepAlertDelta(kind, depth);
  const alertText = delta === 0 ? "소란 변화 없음" : delta > 0 ? `소란 +${delta}` : `소란 ${delta}`;
  const when = appliesAlertOnArrival(kind) ? `깨우면 ${alertText}` : alertText;

  if (scout === "detail") return { title: def.title, detail: def.hint, alertText: when, tier: def.tier };
  if (scout === "type")   return { title: def.title, detail: "???",     alertText: when, tier: def.tier };
  if (scout === "danger") {
    return isDangerous(kind)
      ? { title: "무언가 큰 것이 있다", detail: "???", alertText: "???", tier: "rare" }
      : { title: "잠잠하다",           detail: "???", alertText: "???", tier: "common" };
  }
  return { title: "???", detail: "???", alertText: "???", tier: "common" };
}

/** 정찰이 흐릿할 때(경계 구간) 쓰는 두 갈래. 소란을 크게 올리는 사건이 '위험'이다 */
export function isDangerous(kind: ForestStepKind): boolean {
  return STEP_ALERT[kind] >= 25;
}

// ── 사건 보상 ────────────────────────────────────────────────────────────────

/**
 * 희귀로 치는 재료.
 *
 * 이변은 이 표에서만 뽑는다 — "희귀 테이블 전용"이 구역 풀을 그대로 쓰면서
 * 개수만 늘리는 것이면 흔적과 다를 게 없다.
 */
export const RARE_MATERIALS = [
  "crystal", "magic_dust", "monster_essence", "enhancement_stone", "iron_fragment",
];

/** 이 사건이 재료를 몇 번 굴리는가. 0 이면 재료가 안 나온다 */
export const STEP_ROLLS: Record<ForestStepKind, number> = {
  trace:     2,
  encounter: 1,
  nest:      0,
  anomaly:   2,
  hideout:   0,
  champion:  4,
  warden:    3,
};

/** 이 사건에서 포획 기회가 있는가 */
export function hasCatch(kind: ForestStepKind): boolean {
  return kind === "encounter" || kind === "nest" || kind === "champion" || kind === "warden";
}

/** 흔적은 "확정 소량"이라 빗나가도 한 번은 준다 */
export function isGuaranteed(kind: ForestStepKind): boolean {
  return kind === "trace";
}
