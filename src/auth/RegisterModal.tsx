import { useState, type FormEvent } from "react";
import { registerApi, ApiError } from "./api";
import { useAuthStore } from "./authStore";

const pixelFont = { fontFamily: "var(--pixel-font, monospace)" };
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const USERNAME_HINT = "영문/숫자/밑줄 3~20자";
const PASSWORD_HINT = "4자 이상";

export default function RegisterModal({ onClose }: { onClose: () => void }) {
  const setAuthed = useAuthStore((s) => s.setAuthed);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;

    if (!USERNAME_RE.test(username)) {
      setError(`아이디: ${USERNAME_HINT}`);
      return;
    }
    if (password.length < 4) {
      setError(`비밀번호: ${PASSWORD_HINT}`);
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const { token, username: name } = await registerApi(username, password);
      setAuthed(token, name);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "서버에 연결할 수 없습니다.");
    } finally {
      setPending(false);
    }
  }

  const fieldSize = { fontSize: "clamp(11px,1.1vw,14px)" };
  const labelSize = { ...pixelFont, fontSize: "clamp(9px,0.9vw,11px)" };

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-xl border-2 border-amber-700/50 bg-gradient-to-b from-zinc-950/96 to-zinc-900/95 p-5 shadow-2xl"
        style={{ boxShadow: "0 0 30px rgba(180,140,60,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-zinc-100" style={{ ...pixelFont, fontSize: "clamp(11px,1.1vw,14px)" }}>
            여행자 등록
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-zinc-500 transition hover:text-zinc-200"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400" style={labelSize}>아이디</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
              style={fieldSize}
              placeholder="voyager"
            />
            <span className="text-[10px] text-zinc-600">{USERNAME_HINT}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-zinc-400" style={labelSize}>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
              style={fieldSize}
              placeholder="••••••••"
            />
            <span className="text-[10px] text-zinc-600">{PASSWORD_HINT}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-zinc-400" style={labelSize}>비밀번호 확인</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
              style={fieldSize}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p
              className="rounded border border-red-900/60 bg-red-950/40 px-2 py-1 text-red-400"
              style={{ fontSize: "clamp(10px,0.95vw,13px)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md border-2 border-amber-400/90 bg-gradient-to-b from-amber-500 to-amber-800 py-2 font-bold text-amber-50 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] hover:brightness-110 active:translate-y-px active:shadow-none disabled:opacity-40"
            style={{ ...pixelFont, fontSize: "clamp(10px,1.05vw,13px)", boxShadow: "0 2px 0 rgba(120,53,15,0.7), 0 0 12px rgba(245,158,11,0.25)" }}
          >
            {pending ? "…" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
