import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBaseCampGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";

// ─── 속성 한글/색상 ────────────────────────────────────────────────────────────────

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

const TYPE_GROUP_LABEL: Record<string, string> = {
  fire: "🔥 불꽃", water: "💧 물", grass: "🌿 풀",
  electric: "⚡ 전기", ice: "❄️ 얼음", normal: "⬜ 노말",
};

// ─── 도감 모달 ────────────────────────────────────────────────────────────────────

function DexModal({ onClose }: { onClose: () => void }) {
  const dexSeen   = usePlayerStore((s) => s.dexSeen);
  const dexCaught = usePlayerStore((s) => s.dexCaught);
  const [filter, setFilter] = useState<string>("all");

  const typeGroups = ["fire", "water", "grass", "electric", "ice", "normal"];

  const filteredMonsters = filter === "all"
    ? monsters
    : monsters.filter((m) => m.type === filter);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[92vh] rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">몬스터 도감</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              조우 {dexSeen.length}/{monsters.length} &nbsp;·&nbsp; 포획 {dexCaught.length}/{monsters.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
          >
            닫기 (P)
          </button>
        </div>

        {/* 속성 필터 탭 */}
        <div className="flex gap-1.5 px-5 py-3 overflow-x-auto shrink-0 border-b border-zinc-800/50">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition
              ${filter === "all" ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
          >
            전체
          </button>
          {typeGroups.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition
                ${filter === t ? "bg-zinc-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
            >
              {TYPE_GROUP_LABEL[t]}
            </button>
          ))}
        </div>

        {/* 몬스터 그리드 */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {filteredMonsters.map((m) => {
              const seen   = dexSeen.includes(m.id);
              const caught = dexCaught.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition
                    ${caught
                      ? "border-zinc-600 bg-zinc-900"
                      : seen
                        ? "border-zinc-700 bg-zinc-900/60"
                        : "border-zinc-800 bg-zinc-900/30"}`}
                >
                  {/* 포획 뱃지 */}
                  {caught && (
                    <span className="self-end text-xs text-emerald-400 font-bold -mb-1">포획</span>
                  )}

                  {/* 이미지 */}
                  <div className="relative h-20 w-20 flex items-center justify-center">
                    {seen ? (
                      <img
                        src={MONSTER_IMAGE_MAP[m.id]}
                        alt={m.name}
                        className="h-20 w-20 object-contain"
                        style={monsterImgStyle(m.id)}
                      />
                    ) : (
                      <img
                        src={MONSTER_IMAGE_MAP[m.id]}
                        alt="???"
                        className="h-20 w-20 object-contain"
                        style={{ filter: "brightness(0)", opacity: 0.4 }}
                      />
                    )}
                  </div>

                  {/* 이름/속성 */}
                  <div className="text-center w-full">
                    {seen ? (
                      <>
                        <p className="font-bold text-zinc-100 text-sm">{m.name}</p>
                        <span
                          className={`mt-0.5 inline-block rounded border px-2 py-0.5 text-xs ${TYPE_COLOR[m.type] ?? TYPE_COLOR.normal}`}
                        >
                          {TYPE_KO[m.type] ?? m.type}
                        </span>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-zinc-600 text-sm">???</p>
                        <span className="mt-0.5 inline-block rounded border px-2 py-0.5 text-xs border-zinc-700 bg-zinc-800/50 text-zinc-600">
                          미발견
                        </span>
                      </>
                    )}
                  </div>

                  {/* 스탯 (포획 시에만) */}
                  {caught && (
                    <div className="w-full text-xs text-zinc-500 space-y-0.5">
                      {[
                        ["HP", m.maxHp],
                        ["공격", m.attack],
                        ["방어", m.defense],
                        ["속도", m.speed],
                      ].map(([label, val]) => (
                        <div key={label as string} className="flex justify-between">
                          <span>{label}</span>
                          <span className="text-zinc-300">{val}</span>
                        </div>
                      ))}
                      <div className="flex justify-between">
                        <span>기술 수</span>
                        <span className="text-zinc-300">{m.moves.length}</span>
                      </div>
                    </div>
                  )}

                  {/* 조우만 된 경우 기본 정보 */}
                  {seen && !caught && (
                    <div className="w-full text-xs text-zinc-600 text-center">
                      포획 기록 없음
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 탑 층수 선택 모달 ────────────────────────────────────────────────────────────

function TowerModal({
  bestFloor,
  onSelect,
  onClose,
}: {
  bestFloor: number;
  onSelect: (floor: number) => void;
  onClose: () => void;
}) {
  const maxSelectable = bestFloor + 1;
  // 5층 단위 체크포인트 목록
  const checkpoints: number[] = [1];
  for (let f = 5; f <= maxSelectable; f += 5) checkpoints.push(f);
  if (!checkpoints.includes(maxSelectable)) checkpoints.push(maxSelectable);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-blue-900/60 bg-zinc-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-zinc-100 mb-1">무한의 탑</h2>
        <p className="text-xs text-zinc-500 mb-4">
          {bestFloor > 0 ? `최고 도달 층: ${bestFloor}층` : "아직 탑에 오른 기록이 없습니다."}
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(1)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/70 py-2.5 text-sm font-semibold text-zinc-200 hover:bg-zinc-700 transition"
          >
            1층부터 시작
          </button>

          {bestFloor >= 1 && (
            <>
              <div className="text-xs text-zinc-600 text-center pt-1">— 이어하기 —</div>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {checkpoints.filter((f) => f > 1).map((f) => (
                  <button
                    key={f}
                    onClick={() => onSelect(f)}
                    className={`rounded-xl border py-2 text-sm font-bold transition
                      ${f === maxSelectable
                        ? "border-blue-600 bg-blue-950/70 text-blue-300 hover:bg-blue-900/80"
                        : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700"}`}
                  >
                    {f}층
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-zinc-800 py-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
        >
          취소
        </button>
      </div>
    </div>
  );
}

// ─── BaseCampPage ─────────────────────────────────────────────────────────────────

export default function BaseCampPage() {
  const gameRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [dexOpen, setDexOpen] = useState(false);
  const [towerPayload, setTowerPayload] = useState<{ from: string; portalId: string; isCatchZone: boolean } | null>(null);
  const bestFloor = usePlayerStore((s) => s.bestFloor);

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: {
      from?: string;
      portalId?: string;
      isCatchZone?: boolean;
      floor?: number;
    }) => {
      // 탑 입구: 층 선택 모달 표시
      setTowerPayload({
        from: payload?.from ?? "basecamp",
        portalId: payload?.portalId ?? "none",
        isCatchZone: payload?.isCatchZone ?? false,
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

  // ESC/P 키 핸들링
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "p" || e.key === "P") && !dexOpen) setDexOpen(true);
      if (e.key === "Escape") {
        if (dexOpen) setDexOpen(false);
        if (towerPayload) setTowerPayload(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dexOpen, towerPayload]);

  const handleTowerSelect = (floor: number) => {
    if (!towerPayload) return;
    setTowerPayload(null);
    navigate("/battle", {
      state: {
        from: towerPayload.from,
        portalId: towerPayload.portalId,
        isCatchZone: towerPayload.isCatchZone,
        floor,
      },
    });
  };

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#111" }}>
      <div ref={gameRef} style={{ width: "100%", height: "100%" }} />

      {/* 도감 버튼 (우하단) */}
      <button
        onClick={() => setDexOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-2 text-sm font-semibold text-zinc-300 shadow-lg hover:bg-zinc-800 hover:text-zinc-100 backdrop-blur"
      >
        도감 (P)
      </button>

      {dexOpen && <DexModal onClose={() => setDexOpen(false)} />}

      {towerPayload && (
        <TowerModal
          bestFloor={bestFloor}
          onSelect={handleTowerSelect}
          onClose={() => setTowerPayload(null)}
        />
      )}
    </div>
  );
}
