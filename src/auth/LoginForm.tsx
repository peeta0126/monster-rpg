import { useState } from "react";
import { loginApi, ApiError } from "./api";
import { useAuthStore } from "./authStore";
import RegisterModal from "./RegisterModal";
import DevCodeModal from "./DevCodeModal";
import { sha256Hex } from "./sha256";
import { PixelIcon } from "../shared/ui/PixelIcon";

// "아이디:비밀번호"의 SHA-256 해시. 번들에 평문 계정을 남기지 않기 위해 해시로만 비교한다.
const DEV_LOGIN_HASH = "590c783dce35634a13f99f7b25482678536c9a39cf153f1bb83554aa0362e5d1";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const pos = {
    tl: "-left-1.5 -top-1.5 border-l-2 border-t-2",
    tr: "-right-1.5 -top-1.5 border-r-2 border-t-2",
    bl: "-left-1.5 -bottom-1.5 border-l-2 border-b-2",
    br: "-right-1.5 -bottom-1.5 border-r-2 border-b-2",
  }[position];
  return <span className={`pointer-events-none absolute h-4 w-4 border-ember-500/80 ${pos}`} />;
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
    if ((await sha256Hex(`${username.trim()}:${password}`)) === DEV_LOGIN_HASH) {
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

  const inputSize = { fontSize: 16 };
  const labelSize = { ...pixelFont, fontSize: 12 };
  const btnSize = { ...pixelFont, fontSize: 12 };

  return (
    <div className="relative">
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      <form
        className="flex flex-col gap-2 rounded-lg border-2 border-ember-700/50 bg-gradient-to-b from-shadow-900/92 to-shadow-800/85 p-4 backdrop-blur-sm"
        style={{ boxShadow: "0 0 26px rgba(233,148,65,0.2), inset 0 1px 0 rgba(243,229,185,0.06)" }}
        onSubmit={(e) => { e.preventDefault(); submitLogin(); }}
      >
        <div className="mb-0.5 flex items-center gap-2 text-ember-500/60">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ember-700/70" />
          <span style={{ ...pixelFont, fontSize: 12 }}>여행자 등록</span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ember-700/70" />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sand-300" style={labelSize}>아이디</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
            style={inputSize}
            placeholder="voyager"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sand-300" style={labelSize}>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="w-full rounded-md border border-stone-600 bg-shadow-800/80 px-2.5 py-1.5 text-cream-100 shadow-[inset_0_1px_3px_rgba(13,18,35,0.55)] outline-none transition placeholder-earth-400 focus:border-ember-500 focus:shadow-[inset_0_1px_3px_rgba(13,18,35,0.55),0_0_0_2px_rgba(233,148,65,0.18)]"
            style={inputSize}
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

        <div className="mt-1 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition [text-shadow:0_1px_1px_rgba(13,18,35,0.6)] hover:brightness-110 active:translate-y-px active:shadow-none disabled:opacity-40"
            style={{ ...btnSize, boxShadow: "0 2px 0 rgba(168,61,31,0.7), 0 0 12px rgba(233,148,65,0.25)" }}
          >
            {pending ? "…" : "로그인"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowRegister(true)}
            className="flex-1 rounded-md border border-stone-600 bg-transparent py-2 font-medium text-sand-300 transition hover:border-sand-300 hover:bg-shadow-700/40 hover:text-sand-200 active:scale-[0.98] disabled:opacity-40"
            style={btnSize}
          >
            회원가입
          </button>
        </div>

        <button
          type="button"
          onClick={continueAsGuest}
          className="mt-0.5 text-center text-sand-300 underline decoration-dotted decoration-earth-400 underline-offset-2 transition hover:text-ember-500 hover:decoration-ember-500"
          style={{ fontSize: 12 }}
        >
          <PixelIcon name="compass" size={16} className="mr-1 inline-block align-middle" />
          게스트로 시작
        </button>
      </form>

      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} />}
      {showDevCode && <DevCodeModal onClose={() => setShowDevCode(false)} />}
    </div>
  );
}
