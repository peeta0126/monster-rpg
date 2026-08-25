import { useState, type FormEvent } from "react";
import { linkAccountApi, ApiError } from "./api";
import { useAuthStore } from "./authStore";
import { clearRecovery } from "./anonSession";

/**
 * 「바로 시작」으로 만들어진 계정에 아이디와 비밀번호를 붙인다.
 *
 * 익명 계정은 이 브라우저에 보관된 복구용 비밀번호에만 매여 있다. 저장소를 지우거나
 * 다른 기기로 옮기면 그 세이브로 돌아갈 길이 없다. 아이디를 붙이면 그때부터
 * 어느 기기에서든 로그인으로 같은 진행을 이어받는다. 세이브는 그대로 남는다.
 */
const pixelFont = { fontFamily: "var(--font-pixel)" };

export default function LinkAccountModal({ onClose }: { onClose: () => void }) {
  const setAuthed = useAuthStore((s) => s.setAuthed);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!username.trim() || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { token, username: name } = await linkAccountApi(username.trim(), password);
      setAuthed(token, name);
      // 익명 복구용 비밀번호는 더 필요 없다. 남겨 두면 다음에 「바로 시작」을 눌렀을 때
      // 이미 정식 계정이 된 그 계정으로 다시 로그인하려 든다.
      clearRecovery();
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "서버에 연결할 수 없습니다.");
    } finally {
      setPending(false);
    }
  }

  const fieldSize = { fontSize: 16 };
  const labelSize = { ...pixelFont, fontSize: 12 };

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-shadow-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xs rounded-xl border-2 border-ember-700/50 bg-gradient-to-b from-shadow-900/96 to-shadow-800/95 p-5 shadow-2xl"
        style={{ boxShadow: "0 0 30px rgba(233,148,65,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: 16 }}>
            계정 연결
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-title-sm leading-none text-sand-300 transition hover:text-sand-200"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="text-sand-200" style={{ fontSize: 12 }}>
              연결했습니다. 이제 다른 기기에서도 이 아이디로 같은 진행을 이어받습니다.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition hover:brightness-110 active:translate-y-px"
              style={{ ...pixelFont, fontSize: 12 }}
            >
              닫기
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <p className="text-sand-300" style={{ fontSize: 12 }}>
              지금 진행에 아이디를 붙입니다. 진행은 그대로 이어집니다.
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-sand-300" style={labelSize}>아이디</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500"
                style={fieldSize}
                placeholder="voyager"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sand-300" style={labelSize}>비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500"
                style={fieldSize}
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p
                className="rounded border border-ember-700/60 bg-ember-700/11 px-2 py-1 text-ember-500"
                style={{ fontSize: 12 }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="mt-1 rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition hover:brightness-110 active:translate-y-px disabled:opacity-40"
              style={{ ...pixelFont, fontSize: 12 }}
            >
              {pending ? "…" : "연결"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
