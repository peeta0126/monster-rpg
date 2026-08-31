/**
 * 세이브 JSON 에서 "얼마나 갔나" 를 숫자로만 뽑는다.
 *
 * 이름은 여기서 붙이지 않는다. 몬스터·재료·아티팩트 이름표는 전부 게임 쪽(`src/`)에 있고,
 * 그걸 서버로 복사해 오면 표가 두 벌이 된다 — 게임에서 이름을 고친 날 관리 화면만
 * 옛 이름을 계속 보여주게 된다. 서버는 원본 세이브를 그대로 넘기고, 이름은 관리 화면이
 * 게임 표를 읽어 붙인다(`src/admin/saveDigest.ts`).
 *
 * 세이브는 클라이언트가 만든 문자열이라 모양을 믿지 않는다. 깨져 있으면 요약만 null 이고,
 * 목록 자체는 떠야 한다 — 한 사람의 세이브가 상한다고 나머지 스무 명이 안 보이면 안 된다.
 */

export interface SaveSummary {
  bestFloor: number;
  towerCleared: boolean;
  partyCount: number;
  storageCount: number;
  dexSeen: number;
  dexCaught: number;
  artifacts: number;
  materials: number;
  potions: number;
  questsCompleted: number;
  questsInProgress: number;
  bytes: number;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/** 재료·물약은 { id: 개수 } 라 개수를 더해야 "몇 개 들고 있나" 가 된다 */
function sumCounts(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  let total = 0;
  for (const n of Object.values(value as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

function countStatus(value: unknown, wanted: string): number {
  if (!value || typeof value !== "object") return 0;
  return Object.values(value as Record<string, unknown>).filter((s) => s === wanted).length;
}

export function summarizeSave(raw: string | null | undefined): SaveSummary | null {
  if (!raw) return null;

  let state: Record<string, unknown>;
  try {
    state = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!state || typeof state !== "object") return null;

  const flags = (state.storyFlags ?? {}) as Record<string, unknown>;
  const bestFloor = typeof state.bestFloor === "number" ? state.bestFloor : 0;

  return {
    bestFloor,
    towerCleared: flags.tower_cleared === true,
    partyCount:   countArray(state.party),
    storageCount: countArray(state.storage),
    dexSeen:      countArray(state.dexSeen),
    dexCaught:    countArray(state.dexCaught),
    artifacts:    countArray(state.craftedArtifacts),
    materials:    sumCounts(state.materials),
    potions:      sumCounts(state.potions),
    questsCompleted:  countStatus(state.questStatus, "completed"),
    questsInProgress: countStatus(state.questStatus, "in_progress"),
    bytes: raw.length,
  };
}
