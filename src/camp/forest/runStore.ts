import { clampAlert, isForcedRetreat, stepAlertDelta, appliesAlertOnArrival } from "./alert";
import { rollStep, rollFork, pathName, escapeAlert, FORK_CHANCE, type ForestStepKind, type Rng } from "./steps";
import type { ForestAreaId } from "./areas";
import type { RpsChoice } from "../../workshop/rps";

/**
 * 한 번의 원정 상태.
 *
 * 화면(ForestRunView)은 이 값을 읽기만 하고, 규칙은 전부 여기 있다. 판정을 화면에
 * 두면 저장·시뮬·테스트가 각자 자기 사본을 갖게 된다 — 그러면 시뮬이 게임이 아니라
 * 사본을 잰다.
 */

/**
 * 런 상태 스키마 버전.
 *
 * 올리면 예전 런은 **마이그레이션하지 않는다.** 자진 귀환과 똑같이 100% 정산하고
 * 숲 선택 화면으로 보낸다(`loadRun` 참조). 스키마가 자주 바뀌는 동안 마이그레이션
 * 코드를 쌓는 것보다 안전하고, 플레이어는 손해를 안 본다.
 */
export const RUN_VERSION = 2;

export interface RunBagEntry {
  id: string;
  count: number;
}

/**
 * 걸음 **안**에서 어디까지 왔는가.
 *
 * 이걸 안 적으면 새로고침이 곧 리롤이 된다. 사건의 굴림은 (seed, depth) 로 고정돼
 * 있어서 다시 들어가면 같은 몬스터가 같은 수를 낸다 — 진 다음에 되돌아가 이길 수
 * 있다는 뜻이다. 그래서 "몇 번 걸었는가"까지 런의 일부로 둔다.
 *
 * 반대로 여기 없는 것(수확 목록·상대 몬스터·둥지 후보)은 저장하지 않는다. 전부
 * 같은 시드에서 다시 나오므로, 적어 두면 표가 두 벌이 된다.
 */
export interface StepProgress {
  /** 사건에 들어갔는가. 들어간 순간 굴림이 끝난 것이라 재입장이 곧 리롤이다 */
  entered: boolean;
  /** 둥지에서 고른 후보 번호. 아직 안 골랐으면 null */
  pick: number | null;
  /** 포획을 몇 번 걸었는가. 상대의 수가 공개되는 순간 늘어난다 */
  attempts: number;
  /**
   * 굴림은 끝났는데 플레이어가 아직 안 넘긴 시도.
   *
   * 포획 결과 화면은 **기다리는 화면**이라 여기서 탭이 오래 열려 있다. 적어 두지
   * 않으면 그 사이의 새로고침이 방금 잡은 몬스터를 지운다.
   */
  pending: { hand: RpsChoice; caught: boolean } | null;
  /** 판정이 끝났으면 그 결과. 포획이 없는 사건은 끝나도 null 이다 */
  done: { caught: boolean; escaped: boolean } | null;
  /**
   * 둥지에 들어선 시점의 보유 계열 스냅샷. 둥지가 아니면 null.
   *
   * 후보 굴림이 보유 여부를 보기 때문에 필요하다 — 지금 보유 상태를 그대로 읽으면
   * 런 도중 한 마리 잡는 순간 이미 굴린 후보가 바뀐다. 그건 곧 새로고침 리롤이다.
   */
  ownedChains: string[] | null;
  /**
   * 보관함이 가득 차서 못 받은 포획을 어떻게 했는가.
   *
   * 화면 상태로 두면 안 된다 — 결정하기 전에 새로고침하면 흡수를 두 번 태울 수 있다.
   * pending 동안에는 아무것도 지급되지 않았으므로 다시 물어도 손해가 없다.
   */
  overflow: "pending" | "absorbed" | "released" | null;
}

/** 아직 아무것도 안 한 걸음 */
export const NEW_STEP: StepProgress = {
  entered: false, pick: null, attempts: 0, pending: null, done: null,
  ownedChains: null, overflow: null,
};

export interface ForestRun {
  runVersion: number;
  areaId: ForestAreaId;
  /** 지금까지 걸은 걸음 수. 0 이면 아직 첫 사건 전 */
  depth: number;
  alert: number;
  /** 이번 원정에서 가장 높았던 소란 (정산 화면의 "최고 긴장") */
  alertPeak: number;
  /** 아직 확정되지 않은 수확. 귀환해야 내 것이 된다 */
  bag: RunBagEntry[];
  /** 이번 원정에서 잡은 몬스터 수. 몬스터는 즉시 확정이라 세기만 한다 */
  caught: number;
  /** 지금 눈앞의 사건. 갈림길이면 아직 고르지 않은 잠정값이다 */
  current: ForestStepKind;
  /**
   * 갈림길이면 두 갈래와 그 이름. null 이면 단일 사건이다.
   *
   * 길 이름은 사건 정체를 흘리지 않는 중립적인 것만 쓴다 — 정보를 얼마나 줄지는
   * 정찰 등급이 정하지 정 이름이 정하는 게 아니다.
   */
  fork: { kinds: [ForestStepKind, ForestStepKind]; names: [string, string] } | null;
  /**
   * 이 원정에서 마주칠 수 있는 최고 레벨 — 들어설 때의 파티 최고 레벨이다.
   *
   * 굴림이 이 값을 보므로 스냅샷이어야 한다. 지금 파티를 그대로 읽으면 런 도중에
   * 레벨이 움직이는 순간 이미 굴린 사건이 바뀐다(ownedChains 와 같은 이유).
   */
  capLevel: number;
  /** 지금 걸음을 어디까지 치렀는가. 새로고침이 리롤이 되지 않게 하는 자리다 */
  step: StepProgress;
  /** 다음 사건을 뽑을 시드. 걸음마다 굴러간다 */
  seed: number;
}

// ── 시드 난수 ────────────────────────────────────────────────────────────────
//
// Math.random 을 쓰면 새로고침했을 때 다른 결과가 나온다. 판정이 끝난 뒤에 저장하고
// 다음 시드까지 같이 저장해 두면, 복원해도 같은 걸음이 나온다 — 리롤이 불가능하다.

/** mulberry32. 상태 32비트 하나뿐이라 저장하기 쉽다 */
export function makeRng(seed: number): { rng: Rng; nextSeed: () => number } {
  let s = seed >>> 0;
  const rng: Rng = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rng, nextSeed: () => s };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
}

// ── 런 시작 ──────────────────────────────────────────────────────────────────

export function startRun(
  areaId: ForestAreaId,
  startingAlert: number,
  options: { capLevel: number; canCatch: boolean },
  seed = randomSeed(),
): ForestRun {
  const { rng, nextSeed } = makeRng(seed);
  const alert = clampAlert(startingAlert);
  return {
    runVersion: RUN_VERSION,
    areaId,
    depth: 0,
    alert,
    alertPeak: alert,
    bag: [],
    caught: 0,
    capLevel: options.capLevel,
    ...nextEncounter(alert, 0, rng, options.canCatch),
    step: NEW_STEP,
    seed: nextSeed(),
  };
}

/**
 * 다음에 만날 것. 갈림길이면 두 갈래를, 아니면 단일 사건을 준다.
 *
 * 갈림길 비율(FORK_CHANCE)이 이 게임에서 "선택이 얼마나 자주 있는가"를 혼자 정한다 —
 * 예전 노드 그래프에서는 갈림길의 절반 이상이 외길이라 플레이어가 실려 갔다.
 */
function nextEncounter(
  alert: number, depth: number, rng: Rng, canCatch: boolean,
): Pick<ForestRun, "current" | "fork"> {
  if (rng() < FORK_CHANCE) {
    const kinds = rollFork(alert, depth, rng, canCatch);
    const first = pathName(rng);
    let second = pathName(rng);
    if (second === first) second = `${second} 안쪽`;   // 같은 이름 둘은 고를 수가 없다
    // 잡을 게 없는 구역은 후보가 좁아 두 갈래가 같아질 수 있다. 그러면 갈림길이 아니다
    if (kinds[0] === kinds[1]) return { current: kinds[0], fork: null };
    return { current: kinds[0], fork: { kinds, names: [first, second] } };
  }
  return { current: rollStep(alert, depth, rng, canCatch), fork: null };
}

/** 갈림길에서 한 갈래를 고른다. 아직 판정 전이라 소란은 움직이지 않는다 */
export function chooseFork(run: ForestRun, kind: ForestStepKind): ForestRun {
  return { ...run, current: kind, fork: null };
}

/** 걸음 안에서 한 칸 나아간다. 화면이 자기 상태로 들고 있으면 새로고침에 날아간다 */
export function advanceStep(run: ForestRun, patch: Partial<StepProgress>): ForestRun {
  return { ...run, step: { ...run.step, ...patch } };
}

// ── 한 걸음 ──────────────────────────────────────────────────────────────────

/** 이번 걸음의 판정에 쓸 소란도. 주인만 깨우는 순간(판정 전) 먼저 오른다 */
export function judgeAlert(run: ForestRun): number {
  return appliesAlertOnArrival(run.current)
    ? clampAlert(run.alert + stepAlertDelta(run.current, run.depth))
    : run.alert;
}

export interface StepOutcome {
  /** 이번 걸음에서 가방에 담을 것 */
  gained?: RunBagEntry[];
  /** 몬스터를 잡았는가 (즉시 확정이라 개수만 센다) */
  caught?: boolean;
  /** 놓쳤는가 — 소란이 크게 오르고 가방에서 두 칸이 떨어진다 */
  escaped?: boolean;
  /**
   * 이번 걸음에서 건 포획 시도가 쌓은 소란 (catchRules.attemptAlertTotal).
   *
   * 조우 도중에 올리지 않고 걸음이 끝날 때 한 번에 붙인다 — 판정 중에 소란이 오르면
   * 그 걸음의 수확 배수와 남은 시도의 포획 확률이 같이 움직인다. 물러서면 여기까지가
   * 값이고 escaped 는 안 붙는다.
   */
  attemptAlert?: number;
}

/**
 * 판정이 끝난 사건을 런에 반영하고 다음 걸음을 뽑는다.
 *
 * 수확 배수는 이미 호출부가 judgeAlert() 로 계산했다 — 소란은 여기서 오른다.
 * 그 순서를 뒤집으면 방금 올린 소란으로 그 걸음의 수확을 불리게 된다.
 */
export function resolveStep(run: ForestRun, outcome: StepOutcome, canCatch = true): ForestRun {
  const { rng, nextSeed } = makeRng(run.seed);

  let bag = run.bag;
  for (const g of outcome.gained ?? []) bag = addToBag(bag, g);

  let alert = judgeAlert(run);
  if (!appliesAlertOnArrival(run.current)) {
    alert = clampAlert(alert + stepAlertDelta(run.current, run.depth));
  }

  // 재도전은 공짜가 아니다. 물러섰든 놓쳤든 건 만큼은 치른다
  if (outcome.attemptAlert) alert = clampAlert(alert + outcome.attemptAlert);

  // 놓침은 전투 패배가 아니다. 런은 계속되고, 대신 짐을 흘린다
  if (outcome.escaped) {
    alert = clampAlert(alert + escapeAlert(run.current));
    bag = dropRandom(bag, 2, rng);
  }

  const depth = run.depth + 1;
  return {
    ...run,
    depth,
    alert,
    alertPeak: Math.max(run.alertPeak, alert),
    bag,
    caught: run.caught + (outcome.caught ? 1 : 0),
    ...nextEncounter(alert, depth, rng, canCatch),
    step: NEW_STEP,
    seed: nextSeed(),
  };
}

export function addToBag(bag: RunBagEntry[], entry: RunBagEntry): RunBagEntry[] {
  const i = bag.findIndex((b) => b.id === entry.id);
  if (i === -1) return [...bag, { ...entry }];
  const next = [...bag];
  next[i] = { ...next[i], count: next[i].count + entry.count };
  return next;
}

/**
 * 가방에서 무작위 n 칸을 흘린다.
 *
 * "칸"은 스택 하나가 아니라 개수 하나다 — 스택째 날리면 흔적 한 번에 모은 5개가
 * 통째로 사라져 손실이 널을 뛴다.
 */
export function dropRandom(bag: RunBagEntry[], n: number, rng: Rng): RunBagEntry[] {
  let next = bag.map((b) => ({ ...b }));
  for (let i = 0; i < n; i++) {
    const total = next.reduce((s, b) => s + b.count, 0);
    if (total === 0) break;
    let pick = Math.floor(rng() * total);
    for (const entry of next) {
      if (pick < entry.count) { entry.count -= 1; break; }
      pick -= entry.count;
    }
    next = next.filter((b) => b.count > 0);
  }
  return next;
}

export function bagTotal(bag: RunBagEntry[]): number {
  return bag.reduce((s, b) => s + b.count, 0);
}

/** 소란이 100 에 닿았는가 — 주인 앞에서는 예외다(문턱에서 끊는 건 몰수다) */
export function runIsOver(run: ForestRun): boolean {
  return isForcedRetreat(run.alert);
}

// ── 정산 ─────────────────────────────────────────────────────────────────────

export type SettleReason = "voluntary" | "forced" | "warden" | "stale";

/** 회수율 — 자진 귀환은 전부, 쫓겨나면 절반 */
export function recoveryRate(reason: SettleReason): number {
  return reason === "forced" ? 0.5 : 1;
}

/**
 * 실제로 집에 가져가는 것.
 *
 * `keepId` 는 강제 퇴각 때 플레이어가 지목한 한 종류다 — 그것만 온전히 남기고
 * 나머지에 회수율을 먹인다. 지킬 것을 고르게 하는 건 50% 를 덜 아프게 하려는 게
 * 아니라, 쫓겨나는 순간에도 결정할 게 하나 남아 있게 하려는 것이다.
 */
export function settleBag(bag: RunBagEntry[], reason: SettleReason, keepId?: string): RunBagEntry[] {
  const rate = recoveryRate(reason);
  if (rate >= 1) return bag.map((b) => ({ ...b }));

  return bag
    .map((b) => b.id === keepId
      ? { ...b }
      : { ...b, count: Math.floor(b.count * rate) })
    .filter((b) => b.count > 0);
}

// ── 저장 / 복원 ──────────────────────────────────────────────────────────────

/**
 * 저장된 런을 읽는다.
 *
 * 읽을 수 없으면(버전이 다르거나, 옛 노드 그래프 세이브거나, 아예 깨졌거나)
 * **파싱을 시도하지 않는다.** 그 자리에서 "stale" 로 알리고 호출부가 자진 귀환과
 * 똑같이 100% 정산해 보낸다. 마이그레이션 코드를 쌓지 않으면서 플레이어도 안 잃는다.
 */
function parseFork(raw: unknown): ForestRun["fork"] {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as { kinds?: unknown; names?: unknown };
  if (!Array.isArray(f.kinds) || f.kinds.length !== 2) return null;
  if (!Array.isArray(f.names) || f.names.length !== 2) return null;
  return {
    kinds: [f.kinds[0], f.kinds[1]] as [ForestStepKind, ForestStepKind],
    names: [String(f.names[0]), String(f.names[1])],
  };
}

/**
 * 걸음 진행 기록.
 *
 * 모양이 어긋나면 "안 걸은 걸음"으로 되돌린다. 세이브를 손으로 고쳐 시도 횟수를
 * 0 으로 만드는 건 막지 못하지만, 그건 시드를 고치는 것과 같은 부류라 애초에 막을
 * 수 없다. 여기서 막는 것은 **새로고침**이다.
 */
function parseStep(raw: unknown): StepProgress {
  if (!raw || typeof raw !== "object") return NEW_STEP;
  const s = raw as Record<string, unknown>;
  const done = s.done && typeof s.done === "object"
    ? {
      caught: !!(s.done as Record<string, unknown>).caught,
      escaped: !!(s.done as Record<string, unknown>).escaped,
    }
    : null;

  const p = s.pending as Record<string, unknown> | null | undefined;
  const pending = p && typeof p === "object" && typeof p.hand === "string"
    ? { hand: p.hand as RpsChoice, caught: !!p.caught }
    : null;

  const overflow = s.overflow === "pending" || s.overflow === "absorbed" || s.overflow === "released"
    ? s.overflow
    : null;

  return {
    entered: !!s.entered,
    pick: typeof s.pick === "number" ? s.pick : null,
    attempts: typeof s.attempts === "number" ? Math.max(0, Math.floor(s.attempts)) : 0,
    pending,
    done,
    // 스냅샷이 없는 옛 런은 빈 목록처럼 다뤄진다 — 대비 없이 중복만 걸러진 후보가 나온다
    ownedChains: Array.isArray(s.ownedChains)
      ? s.ownedChains.filter((x): x is string => typeof x === "string")
      : null,
    overflow,
  };
}

export function parseRun(raw: unknown): { ok: true; run: ForestRun } | { ok: false; reason: "empty" | "stale" } {
  if (raw === null || raw === undefined) return { ok: false, reason: "empty" };
  if (typeof raw !== "object") return { ok: false, reason: "stale" };

  const r = raw as Record<string, unknown>;
  if (r.runVersion !== RUN_VERSION) return { ok: false, reason: "stale" };

  const okShape =
    typeof r.areaId === "string" &&
    typeof r.depth === "number" &&
    typeof r.alert === "number" &&
    typeof r.alertPeak === "number" &&
    typeof r.caught === "number" &&
    typeof r.current === "string" &&
    typeof r.seed === "number" &&
    typeof r.capLevel === "number" &&
    Array.isArray(r.bag);
  if (!okShape) return { ok: false, reason: "stale" };

  const bag = (r.bag as unknown[]).filter((b): b is RunBagEntry =>
    !!b && typeof b === "object" &&
    typeof (b as RunBagEntry).id === "string" &&
    typeof (b as RunBagEntry).count === "number");

  return {
    ok: true,
    run: {
      runVersion: RUN_VERSION,
      areaId: r.areaId as ForestAreaId,
      depth: r.depth as number,
      alert: clampAlert(r.alert as number),
      alertPeak: clampAlert(r.alertPeak as number),
      bag,
      caught: r.caught as number,
      current: r.current as ForestStepKind,
      capLevel: Math.max(0, Math.floor(r.capLevel as number)),
      fork: parseFork(r.fork),
      step: parseStep(r.step),
      seed: (r.seed as number) >>> 0,
    },
  };
}
