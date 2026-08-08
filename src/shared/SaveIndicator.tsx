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

  // 색은 마스터 팔레트 토큰만 (ART_DIRECTION 1-2).
  // 텍스트는 어두운 배지 배경 위에서 4.5:1을 넘겨야 해서, 위험도 ember-700 대신
  // ember-500(5.3:1)을 쓴다 — 테두리 쪽에서 ember-700으로 위험을 구분한다.
  const color =
    status === "error"    ? { border: "rgba(168,61,31,.6)",  text: "var(--color-ember-500)" }
    : status === "saving" ? { border: "rgba(66,61,70,.5)",   text: "var(--color-sand-300)" }
    : { border: "rgba(122,132,85,.5)", text: "var(--color-moss-500)" };

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-[900] flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-opacity"
      style={{
        background: "rgba(13,18,35,.88)",   // shadow-900
        border: `1px solid ${color.border}`,
        color: color.text,
      }}
    >
      <span>{status === "saving" ? "◌" : status === "error" ? "!" : "✓"}</span>
      <span>{label}</span>
    </div>
  );
}
