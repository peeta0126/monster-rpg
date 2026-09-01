import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  username: string | null;
  /**
   * 서버를 쓰지 않는 로컬 전용 세션.
   *
   * 화면에는 이 길로 들어가는 버튼이 없다 — 사람은 아이디·비밀번호로만 들어온다.
   * 남겨 둔 것은 둘 때문이다: 개발자 프리셋 모드, 그리고 세션을 localStorage 로
   * 직접 심는 테스트들(`design/`·`e2e/`가 전부 이 모양을 쓴다).
   */
  isGuest: boolean;
  isDev: boolean;
  hasHydrated: boolean;
  setAuthed: (token: string, username: string, opts?: { isDev?: boolean }) => void;
  /** 개발자 코드로 테스트 프리셋을 볼 때. 프리셋이 서버 세이브를 덮지 않도록 일부러 로컬 전용이다 */
  enterDevPresetMode: () => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      username: null,
      isGuest: false,
      isDev: false,
      hasHydrated: false,

      setAuthed: (token, username, opts) =>
        set({ token, username, isGuest: false, isDev: opts?.isDev ?? false }),
      enterDevPresetMode: () => set({ token: null, username: "admin", isGuest: true, isDev: true }),
      logout: () => set({ token: null, username: null, isGuest: false, isDev: false }),
      setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "monster-rpg-auth",
      partialize: (s) => ({
        token: s.token,
        username: s.username,
        isGuest: s.isGuest,
        isDev: s.isDev,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/** 서명 검증 없이 exp만 훑어보는 클라이언트 측 만료 체크. 실제 인증은 항상 서버가 검증한다. */
export function isTokenLikelyValid(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function isSessionActive(s: Pick<AuthState, "token" | "isGuest">): boolean {
  return s.isGuest || isTokenLikelyValid(s.token);
}
