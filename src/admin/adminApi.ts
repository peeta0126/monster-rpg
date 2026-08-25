import { resolveApiBase } from "../shared/apiBase";

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  isAnonymous: boolean;
  saveUpdatedAt: string | null;
  saveRevision: number | null;
}

export interface AdminSaveHistoryEntry {
  id: string;
  revision: number;
  version: number;
  size: number;
  createdAt: string;
}

async function adminRequest<T>(path: string, secret: string, init?: RequestInit): Promise<T> {
  const base = await resolveApiBase();
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

export function deleteAdminUser(secret: string, id: string): Promise<void> {
  return adminRequest(`/users/${id}`, secret, { method: "DELETE" });
}

export function fetchSaveHistory(secret: string, id: string): Promise<AdminSaveHistoryEntry[]> {
  return adminRequest(`/users/${id}/history`, secret);
}

export function restoreSave(secret: string, id: string, historyId: string): Promise<{ revision: number }> {
  return adminRequest(`/users/${id}/restore/${historyId}`, secret, { method: "POST" });
}

/** 세이브가 한 번도 안 올라온 익명 계정을 지운다 */
export function cleanupAnonUsers(secret: string, hours = 24): Promise<{ deleted: number }> {
  return adminRequest(`/cleanup-anon?hours=${hours}`, secret, { method: "POST" });
}
