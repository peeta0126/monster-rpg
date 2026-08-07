import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "./playerStore";
import { useAuthStore } from "../auth/authStore";
import { useSaveStatusStore } from "./saveStatusStore";

/**
 * 화면 구석의 자동 저장 표시.
 *
 * 게스트는 로컬 저장만 하므로 스토어가 바뀌는 순간을 저장 시점으로 본다(zustand persist가
 * 같은 시점에 로컬 스토리지에 쓴다). 로그인 사용자는 서버 업로드 결과를 `saveStatusStore`에서 받는다.
 */
const VISIBLE_MS = 2200;

export default function SaveIndicator() {
  const isGuest = useAuthStore((s) => s.isGuest);
  const token = useAuthStore((s) => s.token);
  const { status, mode, message, seq } = useSaveStatusStore();
  const setStatus = useSaveStatusStore((s) => s.setStatus);
  /** 이미 지나간 알림의 seq. 표시 여부는 이 값과 현재 seq를 비교해 "계산"한다
   *  (렌더 중 setState를 유발하지 않기 위해 boolean 상태로 들고 있지 않는다) */
  const [dismissedSeq, setDismissedSeq] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 게스트(또는 서버 미사용) — 상태가 바뀌면 곧 로컬에 저장된다
  useEffect(() => {
    if (!isGuest && token) return;
    const unsub = usePlayerStore.subscribe(() => {
      setStatus("saved", { mode: "local" });
    });
    return unsub;
  }, [isGuest, token, setStatus]);

  // 저장이 끝난 알림은 잠깐 보여주고 스스로 사라진다 ("저장 중…"은 결과가 올 때까지 유지)
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (status === "idle" || status === "saving") return;
    hideTimer.current = setTimeout(() => setDismissedSeq(seq), VISIBLE_MS);
    return () => clearTimeout(hideTimer.current);
  }, [status, seq]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const visible = status !== "idle" && seq !== dismissedSeq;
  if (!visible) return null;

  const label =
    status === "saving" ? (mode === "server" ? "서버에 저장 중…" : "저장 중…")
    : status === "saved" ? (mode === "server" ? "서버에 저장됨" : "저장됨")
    : (message ?? "저장 실패 — 로컬에는 보관됨");

  const color =
    status === "error" ? { border: "rgba(248,113,113,.5)", text: "#fca5a5" }
    : status === "saving" ? { border: "rgba(161,161,170,.4)", text: "#a1a1aa" }
    : { border: "rgba(52,211,153,.45)", text: "#6ee7b7" };

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-[900] flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-opacity"
      style={{
        background: "rgba(8,8,10,.85)",
        border: `1px solid ${color.border}`,
        color: color.text,
      }}
    >
      <span>{status === "saving" ? "◌" : status === "error" ? "!" : "✓"}</span>
      <span>{label}</span>
    </div>
  );
}
