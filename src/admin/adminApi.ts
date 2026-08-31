import { resolveApiBase } from "../shared/apiBase";

/** 서버가 세이브에서 세어 준 진행 요약. 세이브가 없거나 못 읽으면 null 이다 */
export interface AdminSaveSummary {
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

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
  saveUpdatedAt: string | null;
  saveRevision: number | null;
  summary: AdminSaveSummary | null;
}

/** 한 사람의 세이브 원본. 이름을 붙이는 것은 `saveDigest.ts` 가 한다 */
export interface AdminUserSave {
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
  data: string | null;
  version: number | null;
  revision: number;
  updatedAt: string | null;
  summary: AdminSaveSummary | null;
}

export interface AdminSaveHistoryEntry {
  id: string;
  revision: number;
  version: number;
  size: number;
  createdAt: string;
}

export interface AdminStats {
  uptimeSeconds: number;
  startedAt: string;
  nodeVersion: string;
  /** 세이브 파일을 못 읽는 환경도 있다 */
  dbBytes: number | null;
  userCount: number;
  saveCount: number;
  historyCount: number;
  lastSavedAt: string | null;
}

async function adminRequest<T>(path: string, secret: string, init?: RequestInit): Promise<T> {
  const base = resolveApiBase();
  const res = await fetch(`${base}/admin${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": secret,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `요청에 실패했습니다. (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function fetchAdminUsers(secret: string): Promise<AdminUser[]> {
  return adminRequest("/users", secret);
}

/** 서버가 지금 어떤 상태인지. 읽기만 한다 */
export function fetchAdminStats(secret: string): Promise<AdminStats> {
  return adminRequest("/stats", secret);
}

export function deleteAdminUser(secret: string, id: string): Promise<void> {
  return adminRequest(`/users/${id}`, secret, { method: "DELETE" });
}

export function fetchUserSave(secret: string, id: string): Promise<AdminUserSave> {
  return adminRequest(`/users/${id}/save`, secret);
}

export function fetchSaveHistory(secret: string, id: string): Promise<AdminSaveHistoryEntry[]> {
  return adminRequest(`/users/${id}/history`, secret);
}

export function restoreSave(secret: string, id: string, historyId: string): Promise<{ revision: number }> {
  return adminRequest(`/users/${id}/restore/${historyId}`, secret, { method: "POST" });
}
