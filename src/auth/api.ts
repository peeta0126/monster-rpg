import { useAuthStore } from "./authStore";
import { resolveApiBase } from "../shared/apiBase";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface SaveEnvelope {
  data: string | null;
  version: number | null;
  revision: number;
  updatedAt: string | null;
}

/** 다른 기기가 먼저 저장했다. 서버에 있던 내용을 함께 들고 온다 — 규칙상 이쪽이 이긴다 */
export class SaveConflictError extends ApiError {
  server: SaveEnvelope;
  constructor(message: string, server: SaveEnvelope) {
    super(409, message);
    this.server = server;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | ({ error?: string; conflict?: boolean } & Partial<SaveEnvelope>)
      | null;

    if (res.status === 409 && body?.conflict) {
      throw new SaveConflictError(body.error ?? "다른 기기에서 먼저 저장했습니다.", {
        data: body.data ?? null,
        version: body.version ?? null,
        revision: body.revision ?? 0,
        updatedAt: body.updatedAt ?? null,
      });
    }
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

export function meApi(): Promise<{ username: string }> {
  return request("/auth/me");
}

export function fetchSaveApi(): Promise<SaveEnvelope> {
  return request("/save");
}

export function putSaveApi(
  data: string,
  version: number,
  baseRevision: number | null,
  opts?: { keepalive?: boolean },
): Promise<SaveEnvelope> {
  return request("/save", {
    method: "PUT",
    body: JSON.stringify({ data, version, baseRevision }),
    // 창을 닫는 순간의 마지막 업로드는 keepalive 로 보내야 문서가 사라진 뒤에도 전송이 끝난다.
    keepalive: opts?.keepalive,
  });
}
