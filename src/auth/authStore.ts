import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  username: string | null;
  /**
   * 서버를 쓰지 않는 로컬 전용 세션.
   *
   * 화면에는 이 길로 들어가는 버튼이 없다 — 「바로 시작」이 익명 계정을 발급받아 서버에 붙는다.
   * 남겨 둔 건 둘 때문이다: 서버가 꺼져 있어 계정 발급이 실패했을 때의 폴백,
   * 그리고 세션을 localStorage 로 직접 심는 테스트들.
   */
  isGuest: boolean;
  isDev: boolean;
  /** 아이디 없이 발급받은 계정. 서버 동기화는 정식 계정과 똑같이 된다 */
  isAnonymous: boolean;
  hasHydrated: boolean;
  setAuthed: (token: string, username: string, opts?: { isAnonymous?: boolean; isDev?: boolean }) => void;
  /** 서버에 못 붙었을 때만 쓰는 폴백. 진행은 이 브라우저에만 남는다 */
  continueOffline: () => void;
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
      isAnonymous: false,
      hasHydrated: false,

      setAuthed: (token, username, opts) =>
        set({
          token,
          username,
          isGuest: false,
          isDev: opts?.isDev ?? false,
          isAnonymous: opts?.isAnonymous ?? false,
        }),
      continueOffline: () => set({ token: null, username: null, isGuest: true, isDev: false, isAnonymous: false }),
      enterDevPresetMode: () => set({ token: null, username: "admin", isGuest: true, isDev: true, isAnonymous: false }),
      logout: () => set({ token: null, username: null, isGuest: false, isDev: false, isAnonymous: false }),
      setHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "monster-rpg-auth",
      partialize: (s) => ({
        token: s.token,
        username: s.username,
        isGuest: s.isGuest,
        isDev: s.isDev,
        isAnonymous: s.isAnonymous,
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
