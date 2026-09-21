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

/**
 * 응답을 기다릴 상한.
 *
 * 서버가 죽어 연결이 거절되면 fetch 는 곧바로 실패하지만, 프로세스가 살아 있는 채로
 * 응답만 끊기면 fetch 는 영영 기다린다. 로그인 화면이 먹통으로 보이고, 서버를 못 쓸 때
 * 로컬 저장으로 넘어가는 길도 같이 막힌다.
 * 상한에 걸려 오프라인으로 떨어지는 쪽이 낫다. 게임은 로컬 저장으로 끝까지 돌아간다.
 */
const TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
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
    throw new ApiError(res.status, body?.error ?? fallbackMessage(res.status));
  }
  return res.json() as Promise<T>;
}

/**
 * 몸이 비어 있는 실패에 붙일 문구.
 *
 * 서버(4000)가 안 떠 있으면 vite 프록시가 **본문 없는 500** 을 대신 낸다. 우리 서버의
 * 에러 미들웨어를 안 거쳤으니 `{ error: ... }` 가 없다. 그걸 안 가르고 상태 코드만
 * 적으면 화면에 "요청에 실패했습니다. (500)" 만 떠서, 서버를 켜면 끝날 일을 가입
 * 로직의 버그로 읽게 된다. 실제로 한 번 그렇게 헤맸다.
 *
 * 서버가 자기 문구를 실어 보낸 500 은 여기까지 안 온다 — 그건 서버에 닿았다는 뜻이라
 * "켜져 있는지 확인하라"로 덮으면 진짜 오류가 가려진다.
 */
function fallbackMessage(status: number): string {
  if (status >= 500) return "세이브 서버가 켜져 있는지 확인해주세요.";
  return `요청에 실패했습니다. (${status})`;
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
