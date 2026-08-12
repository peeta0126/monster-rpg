import { clampAlert, isForcedRetreat, stepAlertDelta, appliesAlertOnArrival } from "./alert";
import { rollStep, pathName, escapeAlert, type ForestStepKind, type Rng } from "./steps";
import type { ForestAreaId } from "./areas";
import type { RpsChoice } from "../../workshop/rps";

export const RUN_VERSION = 2;
export const BRANCH_WEIGHTS = { 2: 55, 3: 30, 4: 15 } as const;

export type ForestRisk = "low" | "medium" | "high" | "unknown";
export type ForestPhase =
  | { type: "choosing" }
  | { type: "moving"; pathId: string }
  | { type: "event"; eventId: string }
  | { type: "capture"; eventId: string; monsterId: string }
  | { type: "result"; eventId: string }
  | { type: "transition"; nextDepth: number }
  | { type: "settling"; reason: SettleReason };

export interface ForestPathOption {
  id: string;
  eventKind: ForestStepKind;
  title: string;
  risk: ForestRisk;
  preview: string;
  alertDelta: number | null;
}

export interface RunBagEntry { id: string; count: number }
export interface StepProgress {
  entered: boolean;
  pick: number | null;
  attempts: number;
  pending: { hand: RpsChoice; caught: boolean } | null;
  done: { caught: boolean; escaped: boolean } | null;
}
export const NEW_STEP: StepProgress = { entered: false, pick: null, attempts: 0, pending: null, done: null };

export interface ForestRun {
  runVersion: number;
  areaId: ForestAreaId;
  depth: number;
  alert: number;
  alertPeak: number;
  bag: RunBagEntry[];
  caught: number;
  current: ForestStepKind;
  fork: { kinds: [ForestStepKind, ForestStepKind]; names: [string, string] } | null;
  step: StepProgress;
  seed: number;
  sceneSeed: number;
  paths: ForestPathOption[];
  phase: ForestPhase;
  completedEventIds: string[];
  encounter?: { eventId: string; monsterId: string; level: number; resolved: boolean };
}

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
export function randomSeed(): number { return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0 }

export function rollBranchCount(rng: Rng): 2 | 3 | 4 {
  const total = BRANCH_WEIGHTS[2] + BRANCH_WEIGHTS[3] + BRANCH_WEIGHTS[4];
  const n = rng() * total;
  return n < BRANCH_WEIGHTS[2] ? 2 : n < BRANCH_WEIGHTS[2] + BRANCH_WEIGHTS[3] ? 3 : 4;
}

const riskFor = (kind: ForestStepKind): ForestRisk =>
  kind === "warden" || kind === "champion" ? "high" : kind === "encounter" || kind === "nest" || kind === "anomaly" ? "medium" : "low";

export function generatePaths(alert: number, depth: number, seed: number): ForestPathOption[] {
  const { rng } = makeRng((seed ^ Math.imul(depth + 1, 0x9E3779B1)) >>> 0);
  const count = rollBranchCount(rng);
  const used = new Set<ForestStepKind>();
  return Array.from({ length: count }, (_, index) => {
    let kind = rollStep(alert, depth, rng);
    for (let retry = 0; used.has(kind) && retry < 12; retry++) kind = rollStep(alert, depth, rng);
    used.add(kind);
    return {
      id: `${depth}-${index}-${kind}`,
      eventKind: kind,
      title: pathName(rng),
      risk: riskFor(kind),
      preview: kind === "trace" ? "재료 흔적" : kind === "hideout" ? "휴식처" : kind === "anomaly" ? "이상 현상" : kind === "warden" ? "숲의 주인" : kind === "champion" ? "강한 기척" : kind === "nest" ? "몬스터 둥지" : "몬스터 기척",
      alertDelta: stepAlertDelta(kind, depth),
    };
  });
}

export function startRun(areaId: ForestAreaId, startingAlert: number, seed = randomSeed()): ForestRun {
  const alert = clampAlert(startingAlert);
  const paths = generatePaths(alert, 0, seed);
  if (paths[1].title === paths[0].title) paths[1] = { ...paths[1], title: `${paths[1].title} 옆길` };
  return { runVersion: RUN_VERSION, areaId, depth: 0, alert, alertPeak: alert, bag: [], caught: 0,
    current: paths[0].eventKind, fork: { kinds: [paths[0].eventKind, paths[1].eventKind], names: [paths[0].title, paths[1].title] }, step: NEW_STEP, seed, sceneSeed: seed, paths,
    phase: { type: "choosing" }, completedEventIds: [] };
}

export function choosePath(run: ForestRun, pathId: string): ForestRun {
  if (run.phase.type !== "choosing") return run;
  const path = run.paths.find((p) => p.id === pathId);
  return path ? { ...run, current: path.eventKind, fork: null, phase: { type: "moving", pathId } } : run;
}
export function chooseFork(run: ForestRun, kind: ForestStepKind): ForestRun {
  const path = run.paths.find((p) => p.eventKind === kind) ?? run.paths[0];
  return path ? { ...choosePath(run, path.id), fork: null } : run;
}
export function advanceStep(run: ForestRun, patch: Partial<StepProgress>): ForestRun { return { ...run, step: { ...run.step, ...patch } } }
export function judgeAlert(run: ForestRun): number { return appliesAlertOnArrival(run.current) ? clampAlert(run.alert + stepAlertDelta(run.current, run.depth)) : run.alert }

export interface StepOutcome { gained?: RunBagEntry[]; caught?: boolean; escaped?: boolean }
export function resolveStep(run: ForestRun, outcome: StepOutcome): ForestRun {
  const eventId = run.phase.type === "event" ? run.phase.eventId : run.paths.find((p) => p.eventKind === run.current)?.id ?? `${run.depth}`;
  if (run.completedEventIds.includes(eventId)) return run;
  const { rng, nextSeed } = makeRng(run.seed ^ (run.depth + 1));
  let bag = run.bag;
  for (const item of outcome.gained ?? []) bag = addToBag(bag, item);
  let alert = judgeAlert(run);
  if (!appliesAlertOnArrival(run.current)) alert = clampAlert(alert + stepAlertDelta(run.current, run.depth));
  if (outcome.escaped) { alert = clampAlert(alert + escapeAlert(run.current)); bag = dropRandom(bag, 2, rng); }
  const depth = run.depth + 1;
  const seed = nextSeed();
  const { encounter: _finishedEncounter, ...baseRun } = run;
  void _finishedEncounter;
  if (isForcedRetreat(alert)) {
    return { ...baseRun, depth, alert, alertPeak: Math.max(run.alertPeak, alert), bag,
      caught: run.caught + (outcome.caught ? 1 : 0), seed, sceneSeed: seed,
      paths: run.paths, current: run.current, fork: null, step: NEW_STEP,
      completedEventIds: [...run.completedEventIds, eventId],
      phase: { type: "settling", reason: "forced" } };
  }
  return { ...baseRun, depth, alert, alertPeak: Math.max(run.alertPeak, alert), bag,
    caught: run.caught + (outcome.caught ? 1 : 0), seed, sceneSeed: seed,
    paths: generatePaths(alert, depth, seed), current: run.current, fork: null, step: NEW_STEP,
    completedEventIds: [...run.completedEventIds, eventId],
    phase: { type: "transition", nextDepth: depth } };
}

export function addToBag(bag: RunBagEntry[], entry: RunBagEntry): RunBagEntry[] {
  const i = bag.findIndex((b) => b.id === entry.id);
  if (i < 0) return [...bag, { ...entry }];
  return bag.map((b, index) => index === i ? { ...b, count: b.count + entry.count } : b);
}
export function dropRandom(bag: RunBagEntry[], n: number, rng: Rng): RunBagEntry[] {
  let next = bag.map((b) => ({ ...b }));
  for (let i = 0; i < n; i++) {
    const total = bagTotal(next); if (!total) break;
    let pick = Math.floor(rng() * total);
    for (const entry of next) { if (pick < entry.count) { entry.count--; break; } pick -= entry.count; }
    next = next.filter((b) => b.count > 0);
  }
  return next;
}
export function bagTotal(bag: RunBagEntry[]): number { return bag.reduce((sum, b) => sum + b.count, 0) }
export function runIsOver(run: ForestRun): boolean { return isForcedRetreat(run.alert) }
export type SettleReason = "voluntary" | "forced" | "warden" | "stale";
export function recoveryRate(reason: SettleReason): number { return reason === "forced" ? 0.5 : 1 }
export function settleBag(bag: RunBagEntry[], reason: SettleReason, keepId?: string): RunBagEntry[] {
  const rate = recoveryRate(reason);
  return bag.map((b) => b.id === keepId ? { ...b } : { ...b, count: Math.floor(b.count * rate) }).filter((b) => b.count > 0);
}

function validArea(value: unknown): value is ForestAreaId { return value === "shallow" || value === "deep" || value === "ancient" }
export function parseRun(raw: unknown): { ok: true; run: ForestRun } | { ok: false; reason: "empty" | "stale" } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: raw == null ? "empty" : "stale" };
  const r = raw as Record<string, unknown>;
  if ((r.runVersion !== 1 && r.runVersion !== RUN_VERSION) || !validArea(r.areaId) || typeof r.depth !== "number" || typeof r.seed !== "number") return { ok: false, reason: "stale" };
  const alert = clampAlert(typeof r.alert === "number" ? r.alert : 0);
  const paths = Array.isArray(r.paths) && r.paths.length >= 2 ? r.paths as ForestPathOption[] : generatePaths(alert, r.depth, r.seed);
  const current = typeof r.current === "string" ? r.current as ForestStepKind : paths[0].eventKind;
  const rawPhase = r.phase && typeof r.phase === "object" ? r.phase as Record<string, unknown> : null;
  const rawEncounter = r.encounter && typeof r.encounter === "object" ? r.encounter as Record<string, unknown> : null;
  const fallbackEventId = typeof rawEncounter?.eventId === "string"
    ? rawEncounter.eventId
    : paths.find((path) => path.eventKind === current)?.id ?? `${r.depth}`;
  // v2의 전투 브리지 저장값은 전투 페이지 대신 동일 조우의 포획 단계에서 안전하게 재개한다.
  const phase: ForestPhase = rawPhase?.type === "battle"
    ? { type: "capture", eventId: fallbackEventId, monsterId: String(rawEncounter?.monsterId ?? rawEncounter?.id ?? "") }
    : rawPhase && typeof rawPhase.type === "string" ? rawPhase as unknown as ForestPhase : { type: "choosing" };
  const encounter: ForestRun["encounter"] = rawEncounter && typeof (rawEncounter.monsterId ?? rawEncounter.id) === "string"
    ? {
        eventId: fallbackEventId,
        monsterId: String(rawEncounter.monsterId ?? rawEncounter.id),
        level: typeof rawEncounter.level === "number" ? rawEncounter.level : 1,
        resolved: rawEncounter.resolved === true,
      }
    : undefined;
  const rawStep = r.step as Partial<StepProgress> | undefined;
  const step: StepProgress = rawStep && typeof rawStep === "object" ? {
    entered: typeof rawStep.entered === "boolean" ? rawStep.entered : false,
    pick: typeof rawStep.pick === "number" ? rawStep.pick : null,
    attempts: typeof rawStep.attempts === "number" ? Math.max(0, Math.floor(rawStep.attempts)) : 0,
    pending: rawStep.pending && typeof rawStep.pending === "object" ? rawStep.pending : null,
    done: rawStep.done && typeof rawStep.done === "object" ? rawStep.done : null,
  } : NEW_STEP;
  return { ok: true, run: { runVersion: RUN_VERSION, areaId: r.areaId, depth: r.depth, alert,
    alertPeak: clampAlert(typeof r.alertPeak === "number" ? r.alertPeak : alert), bag: Array.isArray(r.bag) ? r.bag as RunBagEntry[] : [],
    caught: typeof r.caught === "number" ? r.caught : 0, current, fork: r.runVersion === RUN_VERSION ? r.fork as ForestRun["fork"] ?? null : null, step, seed: r.seed >>> 0,
    sceneSeed: typeof r.sceneSeed === "number" ? r.sceneSeed : r.seed >>> 0, paths, phase,
    completedEventIds: Array.isArray(r.completedEventIds) ? r.completedEventIds.filter((x): x is string => typeof x === "string") : [],
    ...(encounter ? { encounter } : {}) } };
}
