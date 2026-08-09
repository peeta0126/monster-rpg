import { useAuthStore } from "../auth/authStore";

/**
 * 충돌 박스 디버그 표시.
 *
 * 개발자 모드(로그인 화면의 개발자 코드)로 들어왔을 때만 켤 수 있다. 일반 플레이어
 * 세션에서는 F9 를 눌러도 아무 일도 일어나지 않는다.
 *
 * 기본값은 켜짐이다 — 개발자 모드에 들어오는 이유가 대개 이걸 보기 위해서다.
 * 잠깐 화면을 깨끗하게 보고 싶으면 F9.
 */

/** 판정선 색. 팔레트 밖의 순빨강을 일부러 쓴다 — 게임 화면에 없는 색이어야 눈에 띈다. */
export const DEBUG_LINE_CSS = "#FF0000"; // palette-ok: 개발용 판정선. 배경과 절대 안 섞이는 색이어야 한다
export const DEBUG_LINE_HEX = 0xff0000;  // palette-ok: 위와 같은 색의 Phaser 형태

const STORAGE_KEY = "monster-rpg-collision-debug";
const listeners = new Set<(on: boolean) => void>();

function stored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

let enabled = typeof window === "undefined" ? true : stored();

/** 개발자 모드이고 F9 로 꺼두지 않았을 때만 true */
export function isCollisionDebugOn(): boolean {
  return useAuthStore.getState().isDev && enabled;
}

/** 변화 알림. 해제 함수를 돌려준다. */
export function onCollisionDebugChange(fn: (on: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * F9 리스너를 붙인다. 화면(공방)·씬(베이스캠프) 어느 쪽에서 붙여도 같은 상태를 본다 —
 * 공방에서 끄고 베이스캠프로 걸어 나갔더니 다시 켜져 있으면 토글이 아니라 함정이다.
 */
export function bindCollisionDebugKey(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "F9" || !useAuthStore.getState().isDev) return;
    e.preventDefault();
    enabled = !enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch { /* 사생활 보호 모드 등 — 표시 상태를 못 남길 뿐이라 무시한다 */ }
    for (const fn of listeners) fn(enabled);
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
