const BASE = "/api/admin";

export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  saveUpdatedAt: string | null;
}

async function adminRequest<T>(path: string, secret: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
