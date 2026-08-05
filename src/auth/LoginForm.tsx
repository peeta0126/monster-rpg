import { useState } from "react";
import { loginApi, ApiError } from "./api";
import { useAuthStore } from "./authStore";
import RegisterModal from "./RegisterModal";
import DevCodeModal from "./DevCodeModal";

const DEV_LOGIN_ID = "admin";
const DEV_LOGIN_PW = "admin1234";

const pixelFont = { fontFamily: "var(--pixel-font, monospace)" };

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const pos = {
    tl: "-left-1.5 -top-1.5 border-l-2 border-t-2",
    tr: "-right-1.5 -top-1.5 border-r-2 border-t-2",
    bl: "-left-1.5 -bottom-1.5 border-l-2 border-b-2",
    br: "-right-1.5 -bottom-1.5 border-r-2 border-b-2",
  }[position];
  return <span className={`pointer-events-none absolute h-4 w-4 border-amber-500/80 ${pos}`} />;
}

export default function LoginForm() {
  const setAuthed = useAuthStore((s) => s.setAuthed);
  const continueAsGuest = useAuthStore((s) => s.continueAsGuest);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showDevCode, setShowDevCode] = useState(false);

  async function submitLogin() {
    if (pending) return;
    if (!username.trim() || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    if (username.trim() === DEV_LOGIN_ID && password === DEV_LOGIN_PW) {
      setError(null);
      setShowDevCode(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { token, username: name } = await loginApi(username.trim(), password);
      setAuthed(token, name);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("서버에 연결할 수 없습니다. 게스트로 시작해보세요.");
      }
    } finally {
      setPending(false);
    }
  }

  const inputSize = { fontSize: "clamp(12px,1.25vw,16px)" };
  const labelSize = { ...pixelFont, fontSize: "clamp(9px,0.95vw,12px)" };
  const btnSize = { ...pixelFont, fontSize: "clamp(10px,1.05vw,13px)" };

  return (
    <div className="relative">
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      <form
        className="flex flex-col gap-2 rounded-lg border-2 border-amber-700/50 bg-gradient-to-b from-zinc-950/92 to-zinc-900/85 p-[clamp(11px,1.7vw,18px)] backdrop-blur-sm"
        style={{ boxShadow: "0 0 26px rgba(180,140,60,0.2), inset 0 1px 0 rgba(255,255,255,0.06)" }}
        onSubmit={(e) => { e.preventDefault(); submitLogin(); }}
      >
        <div className="mb-0.5 flex items-center gap-2 text-amber-500/60">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-amber-700/70" />
          <span style={{ ...pixelFont, fontSize: "clamp(10px,1vw,13px)" }}>여행자 등록</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-700/70" />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-zinc-400" style={labelSize}>아이디</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
            style={inputSize}
            placeholder="voyager"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-zinc-400" style={labelSize}>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
            style={inputSize}
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

        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md border-2 border-amber-400/90 bg-gradient-to-b from-amber-500 to-amber-800 py-2 font-bold text-amber-50 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] hover:brightness-110 active:translate-y-px active:shadow-none disabled:opacity-40"
            style={{ ...btnSize, boxShadow: "0 2px 0 rgba(120,53,15,0.7), 0 0 12px rgba(245,158,11,0.25)" }}
          >
            {pending ? "…" : "로그인"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowRegister(true)}
            className="flex-1 rounded-md border border-zinc-600 bg-transparent py-2 font-medium text-zinc-400 transition hover:border-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 active:scale-[0.98] disabled:opacity-40"
            style={btnSize}
          >
            회원가입
          </button>
        </div>

        <button
          type="button"
          onClick={continueAsGuest}
          className="mt-0.5 text-center text-zinc-500 underline decoration-dotted decoration-zinc-700 underline-offset-2 transition hover:text-amber-300 hover:decoration-amber-500"
          style={{ fontSize: "clamp(10px,0.95vw,13px)" }}
        >
          🧭 게스트로 시작
        </button>
      </form>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      {showDevCode && <DevCodeModal onClose={() => setShowDevCode(false)} />}
    </div>
  );
}
