import { useState, type FormEvent } from "react";
import { useAuthStore } from "./authStore";
import { usePlayerStore } from "../shared/playerStore";
import { sha256Hex } from "./sha256";

const pixelFont = { fontFamily: "var(--pixel-font, monospace)" };
// 개발자 코드의 SHA-256 해시. 번들에 평문 코드를 남기지 않기 위해 해시로만 비교한다.
const DEV_CODE_HASH = "324443b14fdeaf62156b4e58e2167c88f5d1e75c63f4f1f48c6757b2b9320615";

export default function DevCodeModal({ onClose }: { onClose: () => void }) {
  const enterDevMode = useAuthStore((s) => s.enterDevMode);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((await sha256Hex(code)) !== DEV_CODE_HASH) {
      setError("개발자 코드가 일치하지 않습니다.");
      return;
    }
    usePlayerStore.getState().loadDevPreset();
    enterDevMode();
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
            개발자 모드
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
            <span className="text-zinc-400" style={labelSize}>개발자 코드</span>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              autoFocus
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5 text-zinc-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] outline-none transition placeholder-zinc-600 focus:border-amber-500 focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.4),0_0_0_2px_rgba(245,158,11,0.18)]"
              style={fieldSize}
              placeholder="••••••••••••••••"
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
            className="mt-1 rounded-md border-2 border-amber-400/90 bg-gradient-to-b from-amber-500 to-amber-800 py-2 font-bold text-amber-50 transition [text-shadow:0_1px_1px_rgba(0,0,0,0.5)] hover:brightness-110 active:translate-y-px active:shadow-none"
            style={{ ...pixelFont, fontSize: "clamp(10px,1.05vw,13px)", boxShadow: "0 2px 0 rgba(120,53,15,0.7), 0 0 12px rgba(245,158,11,0.25)" }}
          >
            입장
          </button>
        </form>
      </div>
    </div>
  );
}
