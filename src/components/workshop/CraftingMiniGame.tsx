import { useEffect, useMemo, useRef, useState } from "react";
import type { CraftingDifficulty } from "../../types/crafting";

interface CraftingMiniGameProps {
  difficulty: CraftingDifficulty;
  onFinish: (success: boolean) => void;
}

const CONFIG: Record<CraftingDifficulty, { speed: number; targetWidth: number; targetStart: number }> = {
  easy: { speed: 0.55, targetWidth: 28, targetStart: 36 },
  normal: { speed: 0.82, targetWidth: 20, targetStart: 42 },
  hard: { speed: 1.12, targetWidth: 14, targetStart: 47 },
};

export function CraftingMiniGame({ difficulty, onFinish }: CraftingMiniGameProps) {
  const config = CONFIG[difficulty];
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(true);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const targetEnd = useMemo(() => config.targetStart + config.targetWidth, [config]);

  useEffect(() => {
    startedAtRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = ((now - startedAtRef.current) / 1000) * config.speed;
      const wave = (Math.sin(elapsed * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      setProgress(wave * 100);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [config.speed]);

  const handleStop = () => {
    if (!running) return;
    setRunning(false);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    onFinish(progress >= config.targetStart && progress <= targetEnd);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleStop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="rounded-xl border border-amber-900/50 bg-black/35 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500/70">Mini Game</p>
          <p className="text-sm font-bold text-zinc-100">노란 성공 구간에 맞춰 정지하세요.</p>
        </div>
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-300">
          Space 또는 클릭
        </span>
      </div>

      <div className="relative h-12 rounded-lg border border-zinc-700 bg-zinc-950 shadow-inner">
        <div
          className="absolute top-1 bottom-1 rounded-md"
          style={{
            left: `${config.targetStart}%`,
            width: `${config.targetWidth}%`,
            background: "linear-gradient(180deg, rgba(251,191,36,0.95), rgba(217,119,6,0.85))",
            boxShadow: "0 0 18px rgba(251,191,36,0.45)",
          }}
        />
        <div
          className="absolute top-0 h-full w-1 rounded-full bg-cyan-300"
          style={{
            left: `${progress}%`,
            transform: "translateX(-50%)",
            boxShadow: "0 0 14px rgba(103,232,249,0.9)",
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleStop}
        disabled={!running}
        className="mt-4 w-full rounded-lg border border-amber-600/60 bg-amber-700/25 py-2 text-sm font-black text-amber-200 transition hover:bg-amber-700/40 disabled:cursor-default disabled:opacity-50"
      >
        정지
      </button>
    </div>
  );
}
