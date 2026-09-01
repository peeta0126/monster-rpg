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
  /** 접속 기록이 켜진 뒤로 센 횟수. 그 전 접속은 세지 못하므로 0 을 "안 들어옴" 으로 읽으면 안 된다 */
  loginCount: number;
  summary: AdminSaveSummary | null;
}

/** 로그인·가입·실패 한 줄. 실패는 계정이 없을 수 있어 userId 가 null 이다 */
export interface AdminLoginEvent {
  id: string;
  userId?: string | null;
  username: string;
  kind: "login" | "register" | "fail";
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AdminAccessUser {
  id: string;
  username: string;
  createdAt: string;
  lastLoginAt: string | null;
  saveUpdatedAt: string | null;
  loginCount: number;
  failCount: number;
  recentLoginCount: number;
  lastEventAt: string | null;
}

export interface AdminAccess {
  days: number;
  /**
   * 접속 기록이 쌓이기 시작한 시각. null 이면 아직 한 줄도 없다.
   * 이게 없으면 화면이 "0회" 를 "한 번도 안 들어옴" 으로 잘못 읽는다.
   */
  trackingSince: string | null;
  users: AdminAccessUser[];
  recent: AdminLoginEvent[];
  truncated: boolean;
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
  loginCount: number;
  failCount: number;
  trackingSince: string | null;
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

/** 누가 언제 들어왔나. 화면 한 벌이 필요한 것을 한 번에 받는다 */
export function fetchAdminAccess(secret: string, days = 7): Promise<AdminAccess> {
  return adminRequest(`/access?days=${days}`, secret);
}

export function fetchUserLogins(secret: string, id: string): Promise<AdminLoginEvent[]> {
  return adminRequest(`/users/${id}/logins`, secret);
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
