import { PALETTE } from "../../shared/palette";
import { AREA_MATERIAL_POOL } from "../../shared/dropTables";
import { applyMaterialMultiplier } from "./alert";
import type { ForestArea, ForestAreaId } from "./areas";
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

/**
 * 이 걸음에 나올 수 있는 사건과 가중치.
 *
 * `canCatch` 가 false 면 몬스터가 나오는 사건을 통째로 뺀다. 숲은 파티 최고 레벨보다
 * 센 놈을 내주지 않으므로(catchLevel.ts), 구역 최저 레벨에도 못 미치는 파티에게는
 * 내놓을 몬스터가 아예 없다. 그럴 때 조우를 띄우면 빈 화면이 나온다.
 */
function candidates(alert: number, depth: number, canCatch: boolean): [ForestStepKind, number][] {
  const list = (Object.values(STEP_DEFS) as StepDef[])
    .filter((d) => d.weight > 0 && (canCatch || !hasCatch(d.kind)))
    .map((d) => [d.kind, d.weight] as [ForestStepKind, number]);
  if (canCatch && wardenCanAppear(alert, depth)) list.push(["warden", WARDEN_WEIGHT]);
  return list;
}

export function rollStep(alert: number, depth: number, rng: Rng, canCatch = true): ForestStepKind {
  return weightedPick(candidates(alert, depth, canCatch), rng);
}

/** 갈림길에 놓을 두 갈래. 같은 사건이 두 번 나오면 고를 이유가 없어 서로 다르게 뽑는다 */
export function rollFork(
  alert: number, depth: number, rng: Rng, canCatch = true,
): [ForestStepKind, ForestStepKind] {
  const first = rollStep(alert, depth, rng, canCatch);
  const rest = candidates(alert, depth, canCatch).filter(([k]) => k !== first);
  if (rest.length === 0) return [first, first];
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
 * 이변 전용 보상 표.
 *
 * 이변의 정체는 "희귀 재료"가 아니라 **그 구역 기준으로 이례적으로 좋은 보상**이다.
 * 구역 일반 풀(AREA_MATERIAL_POOL)에서 뽑으면 얕은 숲에는 희귀 재료가 아예 없어서
 * 폴백이 걸리고, 이변이 흔적의 열화판이 된다(실제로 k 0.14 였다).
 *
 * 일반 풀을 건드리지 않는 것이 중요하다 — 얕은 숲 일반 풀에 수정을 넣으면 그쪽이
 * 수정 파밍 루트가 되어 깊은 숲의 존재 이유가 약해진다. 여기서만, 소란 +25 를 치른
 * 사람에게만 나온다.
 */
export const ANOMALY_POOL: Record<ForestAreaId, [string, number][]> = {
  // 얕은 숲 — 일반 재료 노다지. 수정은 12% 로 살짝 열어 둔다
  shallow: [["herb", 25], ["berry", 20], ["root", 20], ["wood_plank", 12], ["leather", 11], ["crystal", 12]],
  // 깊은 숲 — 수정 중심
  deep:    [["crystal", 40], ["magic_dust", 22], ["iron_fragment", 18], ["herb", 12], ["root", 8]],
  // 고대 숲 — 강화석 중심
  ancient: [["enhancement_stone", 35], ["monster_essence", 27], ["crystal", 22], ["magic_dust", 16]],
};

/**
 * 굴림 한 번이 주는 개수 배수.
 *
 * 굴림 횟수만으로 사건을 가르면 비싼 사건이 "여러 번 조금씩"이 되어, 소란을 크게
 * 쓰고도 수확이 흔적과 비슷해진다. 걸음 수를 소란이 정하는 구조에서는 그게 곧
 * 손해라서, 비싼 사건은 한 번에 크게 준다.
 */
export const STEP_YIELD: Record<ForestStepKind, number> = {
  trace:     1,
  encounter: 1,
  nest:      2,
  anomaly:   3,
  hideout:   0,
  champion:  3,
  warden:    3,
};

/** 이 사건이 재료를 몇 번 굴리는가. 0 이면 재료가 안 나온다 */
export const STEP_ROLLS: Record<ForestStepKind, number> = {
  trace:     2,
  encounter: 2,
  // 둥지는 몬스터 선택권이 핵심이지만 소란 +20 을 쓰면서 재료가 0 이면 안 된다.
  // 둥지 주변에서 긁어 오는 몫이다
  nest:      4,
  anomaly:   3,
  hideout:   0,
  champion:  5,
  warden:    4,
};

/** 이 사건에서 포획 기회가 있는가 */
export function hasCatch(kind: ForestStepKind): boolean {
  return kind === "encounter" || kind === "nest" || kind === "champion" || kind === "warden";
}

/**
 * 굴림이 다 빗나가도 한 번은 주는 사건.
 *
 * 흔적만 보장이 있었다. 소란을 두 배 쓰는 조우가 굴림 한 번에 성공률 40% 라
 * 기대 수확이 흔적의 1/3 이었다 — 비싼 길이 언제나 손해였다.
 * 재료를 내놓는 사건이면 전부 보장한다. 은신처만 예외다(수확이 없는 게 그 값이다).
 */
export function isGuaranteed(kind: ForestStepKind): boolean {
  return STEP_ROLLS[kind] > 0;
}

/**
 * 이 사건이 내놓는 재료.
 *
 * 화면(ForestRunView)과 시뮬(gameModel)이 각자 굴리고 있었다 — 한쪽에만 희귀 풀과
 * 확정 규칙이 있어서 시뮬이 게임보다 적게 쟀다. 굴림은 여기 한 벌뿐이다.
 *
 * 배수는 **소란이 오르기 전** 값으로 먹인다. 호출부가 그 값을 넘긴다.
 */
export function rollStepRewards(
  area: ForestArea,
  kind: ForestStepKind,
  alert: number,
  rng: Rng,
): { id: string; count: number }[] {
  const rolls = STEP_ROLLS[kind];
  if (rolls === 0) return [];

  const areaPool = AREA_MATERIAL_POOL[area.id] ?? AREA_MATERIAL_POOL.shallow;
  const anomalyPool = ANOMALY_POOL[area.id];

  const out: { id: string; count: number }[] = [];
  for (let i = 0; i < rolls; i++) {
    // 마지막 굴림까지 빈손이면 한 번은 준다
    const guaranteed = isGuaranteed(kind) && out.length === 0 && i === rolls - 1;
    if (rng() > area.materialRate && !guaranteed) continue;

    const id = usesRarePool(kind)
      ? weightedId(anomalyPool, rng)
      : areaPool[Math.floor(rng() * areaPool.length)];
    const base = 1 + area.materialBonus + (rng() < 0.3 ? 1 : 0);
    const count = applyMaterialMultiplier(base * STEP_YIELD[kind], alert);

    const at = out.findIndex((o) => o.id === id);
    if (at === -1) out.push({ id, count });
    else out[at] = { ...out[at], count: out[at].count + count };
  }
  return out;
}

/** 이변 전용 표를 쓰는 사건 */
export function usesRarePool(kind: ForestStepKind): boolean {
  return kind === "anomaly" || kind === "warden";
}

function weightedId(entries: [string, number][], rng: Rng): string {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [id, w] of entries) { r -= w; if (r <= 0) return id; }
  return entries[entries.length - 1][0];
}

/**
 * 놓쳤을 때 붙는 소란 — 쫓던 것의 등급에 비례한다.
 *
 * 예전엔 무조건 +30 이었다. 소란 예산의 24% 를 한 번에 태우는데 놓치는 건 상당 부분
 * 운이라, "실패는 내가 욕심냈기 때문이어야 한다"는 원칙에 어긋났다. 희귀한 놈을
 * 쫓다 놓치면 크게 시끄러워지는 건 자연스럽고, 무엇을 쫓을지는 플레이어가 골랐다.
 */
export function escapeAlert(kind: ForestStepKind): number {
  if (kind === "warden") return 25;
  return STEP_DEFS[kind].tier === "rare" ? 15 : 8;
}
