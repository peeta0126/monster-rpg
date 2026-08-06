import { useAuthStore } from "./authStore";

const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `요청에 실패했습니다. (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function authHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AuthResponse {
  token: string;
  username: string;
}

export function registerApi(username: string, password: string): Promise<AuthResponse> {
  return request("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function loginApi(username: string, password: string): Promise<AuthResponse> {
  return request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

export function fetchSaveApi(): Promise<{ data: string | null; updatedAt: string | null }> {
  return request("/save");
}

export function putSaveApi(data: string): Promise<{ data: string; updatedAt: string }> {
  return request("/save", { method: "PUT", body: JSON.stringify({ data }) });
}
