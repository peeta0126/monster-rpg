import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuthStore, isSessionActive } from "./authStore";
import { useSaveSync } from "./useSaveSync";
import LoginPage from "./LoginPage";

export default function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);

  useSaveSync();

  // /admin은 플레이어 로그인과 무관한 별도 비밀키로 보호되므로 게이팅에서 제외
  if (location.pathname.startsWith("/admin")) return <>{children}</>;

  if (!hasHydrated) return null; // 로컬 저장된 토큰 확인 전까지 짧게 대기(깜빡임 방지)
  if (!isSessionActive({ token, isGuest })) return <LoginPage />;

  return <>{children}</>;
}
