import { useState, type FormEvent } from "react";
import { useAuthStore } from "./authStore";
import { usePlayerStore } from "../shared/playerStore";
import { sha256Hex } from "./sha256";
import { loginApi, registerApi, ApiError } from "./api";

const pixelFont = { fontFamily: "var(--font-pixel)" };
// 개발자 코드의 SHA-256 해시. 번들에 평문 코드를 남기지 않기 위해 해시로만 비교한다.
const DEV_CODE_HASH = "324443b14fdeaf62156b4e58e2167c88f5d1e75c63f4f1f48c6757b2b9320615";

interface Props {
  onClose: () => void;
  /** 로그인 칸에 적었던 값. 「내 세이브로 입장」이 이 계정으로 서버에 붙는다 */
  username: string;
  password: string;
}

export default function DevCodeModal({ onClose, username, password }: Props) {
  const setAuthed = useAuthStore((s) => s.setAuthed);
  const enterDevPresetMode = useAuthStore((s) => s.enterDevPresetMode);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((await sha256Hex(code)) !== DEV_CODE_HASH) {
      setError("개발자 코드가 일치하지 않습니다.");
      return;
    }
    setError(null);
    setVerified(true);
  }

  /**
   * 개발자 모드도 서버 계정에 붙는다.
   * 예전에는 토큰 없이 들여보내서(게스트 취급) 개발자 모드로 논 진행이 한 번도 서버에
   * 안 올라갔다 — PC 와 노트북의 세이브가 갈리던 원인이 이거였다.
   */
  async function enterWithMySave() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { token, username: name } = await loginApi(username, password);
      setAuthed(token, name, { isDev: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          const created = await registerApi(username, password);
          setAuthed(created.token, created.username, { isDev: true });
          return;
        } catch (registerErr) {
          setError(registerErr instanceof ApiError ? registerErr.message : "계정을 만들지 못했습니다.");
          return;
        }
      }
      setError(err instanceof ApiError ? err.message : "서버에 연결할 수 없습니다.");
    } finally {
      setPending(false);
    }
  }

  /** 프리셋은 세이브를 통째로 갈아치우므로 서버에 올리지 않는다. 이 세션만 로컬 전용으로 둔다 */
  function enterWithPreset() {
    usePlayerStore.getState().loadDevPreset();
    enterDevPresetMode();
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
            개발자 모드
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

        {!verified ? (
          <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-1">
              <span className="text-sand-300" style={labelSize}>개발자 코드</span>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="off"
                autoFocus
                className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
                style={fieldSize}
                placeholder="••••••••••••••••"
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
              className="mt-1 rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition [text-shadow:0_1px_1px_rgba(13,18,35,0.6)] hover:brightness-110 active:translate-y-px active:shadow-none"
              style={{ ...pixelFont, fontSize: 12, boxShadow: "0 2px 0 rgba(168,61,31,0.7), 0 0 12px rgba(233,148,65,0.25)" }}
            >
              확인
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {error && (
              <p
                className="rounded border border-ember-700/60 bg-ember-700/11 px-2 py-1 text-ember-500"
                style={{ fontSize: 12 }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={pending}
              onClick={enterWithMySave}
              className="rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition [text-shadow:0_1px_1px_rgba(13,18,35,0.6)] hover:brightness-110 active:translate-y-px active:shadow-none disabled:opacity-40"
              style={{ ...pixelFont, fontSize: 12, boxShadow: "0 2px 0 rgba(168,61,31,0.7), 0 0 12px rgba(233,148,65,0.25)" }}
            >
              {pending ? "…" : "내 세이브로 입장"}
            </button>
            <p className="text-sand-300" style={{ fontSize: 12 }}>
              서버 계정에 붙어 다른 기기와 같은 진행을 본다.
            </p>

            <button
              type="button"
              disabled={pending}
              onClick={enterWithPreset}
              className="rounded-md border border-stone-600 bg-transparent py-2 font-medium text-sand-300 transition hover:border-sand-300 hover:bg-shadow-700/40 hover:text-sand-200 active:scale-[0.98] disabled:opacity-40"
              style={{ ...pixelFont, fontSize: 12 }}
            >
              테스트 프리셋으로 입장
            </button>
            <p className="text-sand-300" style={{ fontSize: 12 }}>
              50층 검증용 세팅. 이 브라우저에만 남고 서버에는 올라가지 않는다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
