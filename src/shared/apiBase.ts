/**
 * API 서버 주소를 정한다.
 *
 * 게임 화면과 서버가 다른 곳에 산다. 화면은 상시 호스팅에 올려 두고 서버는 노트북에서
 * 터널로 붙이는데, 터널 주소는 다시 켤 때마다 바뀐다. 주소를 코드에 박아 두면 그때마다
 * 다시 빌드해야 하므로, 배포된 파일 하나(`/server-config.json`)만 고쳐도 되게 한다.
 *
 * 우선순위: ?api= 쿼리 → /server-config.json → VITE_API_BASE → "/api"(개발 프록시)
 *
 * 파일 이름에 `api` 를 앞에 두지 않은 이유가 있다. vite 개발 서버가 `/api` 로 시작하는
 * 요청을 전부 백엔드로 넘기기 때문에, `/api-config.json` 은 개발 중에 404 가 된다.
 */

const DEFAULT_BASE = "/api";
const OVERRIDE_KEY = "monster-rpg-api-base";

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/** 주소창으로 한 번 넘겨 주면 그 브라우저에서는 계속 쓴다. 현장에서 서버를 갈아 끼울 때의 탈출구다 */
function readOverride(): string | null {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) {
      localStorage.setItem(OVERRIDE_KEY, fromQuery);
      return trimTrailingSlash(fromQuery);
    }
    const stored = localStorage.getItem(OVERRIDE_KEY);
    return stored ? trimTrailingSlash(stored) : null;
  } catch {
    return null;
  }
}

async function readConfigFile(): Promise<string | null> {
  try {
    const res = await fetch("/server-config.json", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { apiBase?: unknown };
    return typeof body.apiBase === "string" && body.apiBase ? trimTrailingSlash(body.apiBase) : null;
  } catch {
    return null;
  }
}

function readEnv(): string | null {
  const value = import.meta.env.VITE_API_BASE;
  return typeof value === "string" && value ? trimTrailingSlash(value) : null;
}

let cached: Promise<string> | null = null;

/** 주소를 바꾼 뒤에는 반드시 비운다. 안 비우면 그 탭은 옛 주소로 계속 요청한다 */
function clearCache(): void {
  cached = null;
}

export function resolveApiBase(): Promise<string> {
  if (!cached) {
    cached = (async () => {
      const override = readOverride();
      if (override) return override;
      return (await readConfigFile()) ?? readEnv() ?? DEFAULT_BASE;
    })();
  }
  return cached;
}

/** 지금 저장돼 있는 주소. 없으면 `server-config.json` 을 따르고 있다는 뜻이다 */
export function getApiBaseOverride(): string | null {
  try {
    const stored = localStorage.getItem(OVERRIDE_KEY);
    return stored ? trimTrailingSlash(stored) : null;
  } catch {
    return null;
  }
}

/**
 * 서버 주소를 이 브라우저에 고정한다. `null` 이면 지워서 `server-config.json` 으로 돌아간다.
 * 터널 주소는 다시 켤 때마다 바뀌는데, 이게 있으면 화면을 다시 배포하지 않고도 붙일 수 있다.
 */
export function setApiBaseOverride(url: string | null): void {
  try {
    if (url) localStorage.setItem(OVERRIDE_KEY, trimTrailingSlash(url));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // 저장을 못 해도(사생활 보호 모드 등) 이번 화면에서는 새 주소로 도는 편이 낫다
  }
  // 주소창의 ?api= 는 첫 진입용 한 번짜리다. 남겨 두면 다음 조회에서 그게 다시 이겨,
  // 방금 넣은 주소가 조용히 무시된다.
  try {
    const here = new URL(window.location.href);
    if (here.searchParams.has("api")) {
      here.searchParams.delete("api");
      window.history.replaceState(null, "", here.toString());
    }
  } catch {
    // 주소창을 못 고쳐도 저장 자체는 끝났다
  }
  clearCache();
}

/** 테스트에서 캐시를 비운다 */
export function resetApiBaseForTest(): void {
  clearCache();
}
