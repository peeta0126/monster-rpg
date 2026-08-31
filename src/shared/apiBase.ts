/**
 * API 서버 주소를 정한다.
 *
 * 이 게임은 배포하지 않는다 — 화면과 서버가 같은 PC 에서 돈다. 그래서 주소를 런타임에
 * 알아낼 일이 없고, 개발 서버와 미리보기 서버가 `/api` 를 localhost:4000 으로 넘긴다
 * (`vite.config.ts` 의 proxy). 다른 곳에 띄우고 싶을 때만 `VITE_API_BASE` 를 준다.
 *
 * 한동안 여기에 `?api=` 쿼리와 `/server-config.json` 을 읽는 길이 있었다. 터널 주소가
 * 켤 때마다 바뀌어서 다시 빌드하지 않고 갈아 끼우려던 것인데, 배포를 걷어내면서 같이 지웠다.
 */

const DEFAULT_BASE = "/api";

function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function resolveApiBase(): string {
  const value = import.meta.env.VITE_API_BASE;
  return typeof value === "string" && value ? trimTrailingSlash(value) : DEFAULT_BASE;
}
