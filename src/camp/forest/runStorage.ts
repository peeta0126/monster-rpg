import { parseRun, runIsOver, type ForestRun, type RunBagEntry, type SettleReason } from "./runStore";
import type { ForestAreaId } from "./areas";

/**
 * 원정 저장.
 *
 * 규칙은 runStore 에 있고 여기는 그것을 디스크에 얹는 일만 한다. 저장하는 순간은
 * 둘뿐이다 — **런이 바뀔 때마다**(걸음 안의 시도 횟수까지 포함), 그리고 **정산 화면에
 * 들어갈 때**. 정산을 저장하지 않으면 가장 아까운 순간에 새로고침이 수확을 지운다.
 *
 * 서버 세이브(monster-rpg-player)에는 넣지 않았다. 진행 중인 원정은 기기에 매인
 * 상태라, 다른 기기에서 이어 걷게 하려면 소유권을 정하는 규칙이 따로 필요하다.
 */

const KEY = "monster-rpg-forest-run";

/** 정산 화면을 다시 그리는 데 필요한 것만. 런은 이미 끝났으니 걸음 정보는 버린다 */
export interface StoredSettlement {
  areaId: ForestAreaId;
  reason: SettleReason;
  bag: RunBagEntry[];
  caught: number;
  alertPeak: number;
}

export type LoadedForest =
  | { kind: "none" }
  | { kind: "run"; run: ForestRun }
  | { kind: "settle"; settlement: StoredSettlement };

/** 사생활 보호 모드는 접근 자체가 던진다 — 숲이 그것 때문에 안 열리면 안 된다 */
function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function write(blob: object): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(blob));
  } catch {
    // 용량 초과 등. 저장을 못 해도 지금 걷고 있는 원정은 계속돼야 한다
  }
}

export function saveForestRun(run: ForestRun): void {
  write({ run });
}

export function saveForestSettlement(settlement: StoredSettlement): void {
  write({ settled: settlement });
}

export function clearForest(): void {
  try {
    storage()?.removeItem(KEY);
  } catch { /* 위와 같다 */ }
}

function parseBag(raw: unknown): RunBagEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is RunBagEntry =>
    !!b && typeof b === "object" &&
    typeof (b as RunBagEntry).id === "string" &&
    typeof (b as RunBagEntry).count === "number" &&
    (b as RunBagEntry).count > 0);
}

function parseSettlement(raw: unknown): StoredSettlement | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.areaId !== "string" || typeof s.reason !== "string") return null;
  return {
    areaId: s.areaId as ForestAreaId,
    reason: s.reason as SettleReason,
    bag: parseBag(s.bag),
    caught: typeof s.caught === "number" ? s.caught : 0,
    alertPeak: typeof s.alertPeak === "number" ? s.alertPeak : 0,
  };
}

/**
 * 읽을 수 없는 런에서 건질 수 있는 것만 건진다.
 *
 * 스키마가 바뀌면 옛 런은 마이그레이션하지 않는다(runStore 의 RUN_VERSION 참조).
 * 그렇다고 가방까지 버리면 플레이어가 자기 잘못이 아닌 일로 수확을 잃는다. 그래서
 * 구역과 가방만 긁어 **자진 귀환과 똑같이 100%** 정산으로 보낸다.
 *
 * 아무 흔적도 못 찾으면 null 이다 — 원정한 적도 없는 사람에게 정산 화면을 띄우면
 * 그건 복구가 아니라 헛것이다.
 */
function salvage(raw: unknown): StoredSettlement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const bag = parseBag(r.bag);
  const hasTrace = typeof r.areaId === "string" || bag.length > 0 || typeof r.depth === "number";
  if (!hasTrace) return null;

  return {
    areaId: (typeof r.areaId === "string" ? r.areaId : "shallow") as ForestAreaId,
    reason: "stale",
    bag,
    caught: typeof r.caught === "number" ? r.caught : 0,
    alertPeak: typeof r.alertPeak === "number" ? r.alertPeak : 0,
  };
}

/** 저장된 원정을 읽는다. 이어 걸을 것 · 정산할 것 · 없음 셋 중 하나다 */
export function loadForest(): LoadedForest {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(KEY) ?? null;
  } catch {
    return { kind: "none" };
  }
  if (!raw) return { kind: "none" };

  let blob: unknown = null;
  try {
    blob = JSON.parse(raw);
  } catch {
    clearForest();
    return { kind: "none" };
  }
  if (!blob || typeof blob !== "object") {
    clearForest();
    return { kind: "none" };
  }

  const b = blob as { run?: unknown; settled?: unknown };

  // 정산 화면에서 끊긴 경우가 먼저다 — 런은 이미 끝났으니 이어 걸으면 안 된다
  const settled = parseSettlement(b.settled);
  if (settled) return { kind: "settle", settlement: settled };

  const parsed = parseRun(b.run);
  if (parsed.ok) {
    if (runIsOver(parsed.run)) return { kind: "settle", settlement: {
      areaId: parsed.run.areaId, reason: "forced", bag: parsed.run.bag,
      caught: parsed.run.caught, alertPeak: parsed.run.alertPeak,
    } };
    return { kind: "run", run: parsed.run };
  }

  const rescued = salvage(b.run);
  if (rescued) return { kind: "settle", settlement: rescued };

  clearForest();
  return { kind: "none" };
}
