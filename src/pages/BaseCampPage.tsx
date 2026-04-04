import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBaseCampGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";

// ─── 도감 모달 ────────────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말",
};

const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/70 text-red-200 border-red-700",
  water:    "bg-blue-900/70 text-blue-200 border-blue-700",
  grass:    "bg-green-900/70 text-green-200 border-green-700",
  electric: "bg-yellow-900/70 text-yellow-200 border-yellow-700",
  ice:      "bg-cyan-900/70 text-cyan-200 border-cyan-700",
  normal:   "bg-zinc-800/70 text-zinc-200 border-zinc-600",
};

function DexModal({ onClose }: { onClose: () => void }) {
  const dex = usePlayerStore((s) => s.dexSeen);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">몬스터 도감</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              발견 {dex.length}/{monsters.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            닫기 (P)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {monsters.map((m) => {
            const discovered = dex.includes(m.id);
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3 flex flex-col items-center gap-2
                  ${discovered ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-zinc-900/50"}`}
              >
                {discovered ? (
                  <img
                    src={MONSTER_IMAGE_MAP[m.id]}
                    alt={m.name}
                    className="h-20 w-20 object-contain"
                  />
                ) : (
                  <div className="h-20 w-20 flex items-center justify-center">
                    <img
                      src={MONSTER_IMAGE_MAP[m.id]}
                      alt="???"
                      className="h-20 w-20 object-contain"
                      style={{ filter: "brightness(0) invert(0.1)", opacity: 0.5 }}
                    />
                  </div>
                )}
                <div className="text-center">
                  {discovered ? (
                    <>
                      <p className="font-bold text-zinc-100">{m.name}</p>
                      <span
                        className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-xs ${TYPE_COLOR[m.type] ?? TYPE_COLOR.normal}`}
                      >
                        {TYPE_KO[m.type] ?? m.type}
                      </span>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-zinc-600">???</p>
                      <span className="mt-0.5 inline-block rounded border px-2 py-0.5 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-600">
                        미발견
                      </span>
                    </>
                  )}
                </div>
                {discovered && (
                  <div className="w-full text-xs text-zinc-500 space-y-0.5">
                    <div className="flex justify-between">
                      <span>HP</span><span className="text-zinc-300">{m.maxHp}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>공격</span><span className="text-zinc-300">{m.attack}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>방어</span><span className="text-zinc-300">{m.defense}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>스피드</span><span className="text-zinc-300">{m.speed}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── BaseCampPage ─────────────────────────────────────────────────────────────────

export default function BaseCampPage() {
  const gameRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [dexOpen, setDexOpen] = useState(false);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: {
      from?: string;
      portalId?: string;
      isCatchZone?: boolean;
      floor?: number;
    }) => {
      navigate("/battle", {
        state: {
          from: payload?.from ?? "basecamp",
          portalId: payload?.portalId ?? "none",
          isCatchZone: payload?.isCatchZone ?? false,
          floor: payload?.floor ?? 1,
        },
      });
    };

    const handleEnterFarm   = () => navigate("/farm");
    const handleEnterForest = () => navigate("/forest");
    const handleOpenDex = () => setDexOpen(true);

    gameEvents.on(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
    gameEvents.on(GAME_EVENT.ENTER_FARM, handleEnterFarm);
    gameEvents.on(GAME_EVENT.ENTER_FOREST, handleEnterForest);
    gameEvents.on("open-dex", handleOpenDex);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
      gameEvents.off(GAME_EVENT.ENTER_FARM, handleEnterFarm);
      gameEvents.off(GAME_EVENT.ENTER_FOREST, handleEnterForest);
      gameEvents.off("open-dex", handleOpenDex);
      game.destroy(true);
    };
  }, [navigate]);

  // ESC로도 도감 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !dexOpen) setDexOpen(true);
      if (e.key === "Escape" && dexOpen) setDexOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dexOpen]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#111" }}>
      <div ref={gameRef} style={{ width: "100%", height: "100%" }} />

      {/* 도감 버튼 (우하단 고정) */}
      <button
        onClick={() => setDexOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-zinc-300 shadow-lg hover:bg-zinc-800 hover:text-zinc-100 backdrop-blur"
      >
        도감 (P)
      </button>

      {dexOpen && <DexModal onClose={() => setDexOpen(false)} />}
    </div>
  );
}
