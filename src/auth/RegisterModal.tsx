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
        className="relative w-full max-w-xs rounded-xl border-2 border-ember-700/50 bg-gradient-to-b from-shadow-900/96 to-shadow-800/95 p-5 shadow-2xl"
        style={{ boxShadow: "0 0 30px rgba(233,148,65,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: "clamp(11px,1.1vw,14px)" }}>
            여행자 등록
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-sand-300 transition hover:text-sand-200"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-sand-300" style={labelSize}>아이디</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
              style={fieldSize}
              placeholder="voyager"
            />
            <span className="text-[10px] text-earth-400">{USERNAME_HINT}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sand-300" style={labelSize}>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
              style={fieldSize}
              placeholder="••••••••"
            />
            <span className="text-[10px] text-earth-400">{PASSWORD_HINT}</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sand-300" style={labelSize}>비밀번호 확인</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
              style={fieldSize}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p
              className="rounded border border-ember-700/60 bg-ember-700/11 px-2 py-1 text-ember-500"
              style={{ fontSize: "clamp(10px,0.95vw,13px)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-1 rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition [text-shadow:0_1px_1px_rgba(13,18,35,0.6)] hover:brightness-110 active:translate-y-px active:shadow-none disabled:opacity-40"
            style={{ ...pixelFont, fontSize: "clamp(10px,1.05vw,13px)", boxShadow: "0 2px 0 rgba(168,61,31,0.7), 0 0 12px rgba(233,148,65,0.25)" }}
          >
            {pending ? "…" : "가입하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
