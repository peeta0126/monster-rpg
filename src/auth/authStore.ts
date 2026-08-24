import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  username: string | null;
  isGuest: boolean;
  isDev: boolean;
  hasHydrated: boolean;
  setAuthed: (token: string, username: string) => void;
  continueAsGuest: () => void;
  /** 개발자 코드 인증에 성공하면 부른다. 서버 토큰 없이 게스트 세션처럼 게임에 들여보낸다 */
  enterDevMode: () => void;
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

      setAuthed: (token, username) => set({ token, username, isGuest: false, isDev: false }),
      continueAsGuest: () => set({ token: null, username: null, isGuest: true, isDev: false }),
      enterDevMode: () => set({ token: null, username: "admin", isGuest: true, isDev: true }),
      logout: () => set({ token: null, username: null, isGuest: false, isDev: false }),
      setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "monster-rpg-auth",
      partialize: (s) => ({ token: s.token, username: s.username, isGuest: s.isGuest, isDev: s.isDev }),
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
