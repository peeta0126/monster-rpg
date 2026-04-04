import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";
import { RpsIcon, RPS_KO, type RpsChoice } from "../components/rps/RpsIcon";
import { scaleToLevel } from "../data/floorTable";
import { MATERIALS, getMaterial } from "../data/items";

// ─── 숲 탐험 상태 머신 ────────────────────────────────────────────────────────────

type ForestPhase =
  | "enter"         // 경로 선택
  | "exploring"     // 탐험 중 애니메이션
  | "no_encounter"  // 아무것도 없음
  | "item_drop"     // 아이템 발견 (추후 구현)
  | "encounter"     // 야생 몬스터 출현
  | "rps_select"    // 가위바위보 선택
  | "rps_result"    // 결과 공개
  | "catch_result"; // 포획 성공/실패

// ─── 가위바위보 로직 ──────────────────────────────────────────────────────────────

function getComputerChoice(): RpsChoice {
  const choices: RpsChoice[] = ["rock", "paper", "scissors"];
  return choices[Math.floor(Math.random() * 3)];
}

type RpsResult = "win" | "lose" | "draw";

function getRpsResult(player: RpsChoice, computer: RpsChoice): RpsResult {
  if (player === computer) return "draw";
  if (
    (player === "rock"     && computer === "scissors") ||
    (player === "scissors" && computer === "paper")   ||
    (player === "paper"    && computer === "rock")
  ) return "win";
  return "lose";
}

/** 가위바위보 결과 → 포획 성공 확률 */
const CATCH_RATE: Record<RpsResult, number> = {
  win:  0.72,
  draw: 0.42,
  lose: 0.18,
};

const RESULT_LABEL: Record<RpsResult, { text: string; color: string; desc: string }> = {
  win:  { text: "이겼다!", color: "text-emerald-400", desc: "포획 확률 +높음 (72%)" },
  draw: { text: "비겼다!", color: "text-yellow-400",  desc: "포획 확률 보통 (42%)" },
  lose: { text: "졌다...", color: "text-red-400",     desc: "포획 확률 낮음 (18%)" },
};

// ─── 숲 출현 몬스터 풀 ────────────────────────────────────────────────────────────

const FOREST_POOL_IDS = ["flameling", "aquabe", "leafy", "burno", "bubblet", "mossy"];

function pickForestMonster() {
  const id = FOREST_POOL_IDS[Math.floor(Math.random() * FOREST_POOL_IDS.length)];
  const base = monsters.find((m) => m.id === id)!;
  const level = Math.floor(Math.random() * 5) + 1; // lv 1~5
  return scaleToLevel(base, level);
}

// ─── 숲 배경 SVG ─────────────────────────────────────────────────────────────────

function ForestBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* Sky / depth gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, #1a3a0a 0%, #0d1f0d 40%, #060e06 100%)",
        }}
      />

      {/* Far background trees */}
      <svg
        className="absolute bottom-28 left-0 w-full"
        viewBox="0 0 960 260"
        preserveAspectRatio="xMidYMax meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[
          [30, 260, 70, 100],   [90, 260, 50, 130],  [150, 260, 65, 115],
          [220, 260, 55, 140],  [290, 260, 72, 105],  [360, 260, 48, 135],
          [420, 260, 62, 120],  [480, 260, 58, 128],  [540, 260, 70, 108],
          [610, 260, 52, 132],  [670, 260, 65, 118],  [730, 260, 58, 124],
          [790, 260, 72, 102],  [850, 260, 50, 136],  [910, 260, 65, 115],
          [960, 260, 58, 122],
        ].map(([cx, by, hw, h], i) => (
          <polygon
            key={i}
            points={`${cx - hw},${by} ${cx},${by - h} ${cx + hw},${by}`}
            fill={i % 3 === 0 ? "#0a1f0a" : i % 3 === 1 ? "#0d2a0d" : "#0b220b"}
            opacity="0.85"
          />
        ))}
      </svg>

      {/* Mid-ground trees */}
      <svg
        className="absolute bottom-24 left-0 w-full"
        viewBox="0 0 960 340"
        preserveAspectRatio="xMidYMax meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[
          [-30, 340, 88, 190],  [80, 340, 75, 210],   [190, 340, 92, 180],
          [310, 340, 78, 200],  [420, 340, 95, 195],   [530, 340, 70, 215],
          [640, 340, 88, 188],  [750, 340, 80, 205],   [860, 340, 90, 192],
          [970, 340, 76, 208],
        ].map(([cx, by, hw, h], i) => (
          <polygon
            key={i}
            points={`${cx - hw},${by} ${cx},${by - h} ${cx + hw},${by}`}
            fill={i % 2 === 0 ? "#061506" : "#081b08"}
            opacity="0.9"
          />
        ))}
      </svg>

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32"
        style={{
          background:
            "linear-gradient(to top, #1a0f05 0%, #2a1a0a 50%, #1f3012 100%)",
        }}
      />

      {/* Foreground grass tufts */}
      <svg
        className="absolute bottom-24 left-0 w-full"
        viewBox="0 0 960 60"
        preserveAspectRatio="xMidYMax meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        {Array.from({ length: 28 }).map((_, i) => {
          const x = (i * 35) + Math.sin(i * 1.7) * 8;
          const h = 18 + Math.sin(i * 2.3) * 10;
          return (
            <g key={i}>
              <polygon points={`${x},60 ${x - 6},${60 - h} ${x + 6},60`} fill="#1a3a0a" opacity="0.8" />
              <polygon points={`${x + 10},60 ${x + 4},${60 - h * 0.8} ${x + 16},60`} fill="#0d2a0d" opacity="0.7" />
            </g>
          );
        })}
      </svg>

      {/* Atmospheric fog overlay */}
      <div
        className="absolute inset-x-0 bottom-24 h-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, rgba(10,30,10,0.5) 0%, transparent 100%)",
        }}
      />

      {/* Light rays from top */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 30% at 50% 5%, rgba(100,200,60,0.06) 0%, transparent 80%)",
        }}
      />
    </div>
  );
}

// ─── 경로 선택 버튼 ───────────────────────────────────────────────────────────────

function PathButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-3 rounded-2xl border border-green-800/50 bg-black/40 px-10 py-8 backdrop-blur hover:border-green-500/70 hover:bg-black/55 transition-all active:scale-95"
    >
      <span className="text-4xl">{side === "left" ? "←" : "→"}</span>
      <span className="text-lg font-bold text-green-300 group-hover:text-green-200">
        {side === "left" ? "왼쪽 길" : "오른쪽 길"}
      </span>
      <span className="text-xs text-green-700 group-hover:text-green-500">
        탐험하기
      </span>
    </button>
  );
}

// ─── 가위바위보 선택 버튼 ─────────────────────────────────────────────────────────

const RPS_CHOICES: { id: RpsChoice; border: string; bg: string; hover: string }[] = [
  { id: "scissors", border: "border-red-600",    bg: "bg-red-950/60",    hover: "hover:bg-red-900/70" },
  { id: "rock",     border: "border-slate-500",  bg: "bg-slate-900/60",  hover: "hover:bg-slate-800/70" },
  { id: "paper",    border: "border-yellow-600", bg: "bg-yellow-950/60", hover: "hover:bg-yellow-900/70" },
];

function RpsSelectButton({
  choice,
  onClick,
  disabled,
}: {
  choice: (typeof RPS_CHOICES)[number];
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group flex flex-col items-center gap-2 rounded-2xl border px-6 py-5 transition-all active:scale-95 disabled:opacity-40
        ${choice.border} ${choice.bg} ${choice.hover}`}
    >
      <div className="transition-transform group-hover:scale-110">
        <RpsIcon choice={choice.id} className="w-20 h-20" />
      </div>
      <span className="text-base font-bold text-zinc-100">{RPS_KO[choice.id]}</span>
    </button>
  );
}

// ─── ForestPage ───────────────────────────────────────────────────────────────────

// 재료 드랍 풀 (탐험 시 랜덤 지급)
const MATERIAL_DROP_POOL = MATERIALS.map((m) => m.id);

function rollMaterialDrop(): { id: string; count: number } | null {
  if (Math.random() > 0.7) return null; // 30% 확률로 드랍 없음
  const id = MATERIAL_DROP_POOL[Math.floor(Math.random() * MATERIAL_DROP_POOL.length)];
  const count = Math.floor(Math.random() * 2) + 1; // 1~2개
  return { id, count };
}

export default function ForestPage() {
  const navigate = useNavigate();
  const { addCapturedMonster, addToDexSeen, addToDexCaught, addMaterial } = usePlayerStore();

  const [phase, setPhase] = useState<ForestPhase>("enter");
  const [wildMonster, setWildMonster] = useState<ReturnType<typeof pickForestMonster> | null>(null);
  const [playerChoice, setPlayerChoice] = useState<RpsChoice | null>(null);
  const [computerChoice, setComputerChoice] = useState<RpsChoice | null>(null);
  const [rpsResult, setRpsResult] = useState<RpsResult | null>(null);
  const [catchSuccess, setCatchSuccess] = useState<boolean | null>(null);
  const [catchPlace, setCatchPlace] = useState<"storage" | "full" | null>(null);
  const [droppedMaterial, setDroppedMaterial] = useState<{ id: string; count: number } | null>(null);
  // 가위바위보 공개 애니메이션
  const [showComputer, setShowComputer] = useState(false);

  // 탐험 시작
  const handleExplore = (_side: "left" | "right") => {
    setPhase("exploring");
  };

  useEffect(() => {
    if (phase !== "exploring") return;
    const t = setTimeout(() => {
      const roll = Math.random();
      if (roll < 0.60) {
        // 몬스터 출현 (+ 재료 드랍 가능)
        const mon = pickForestMonster();
        setWildMonster(mon);
        addToDexSeen(mon.id); // 도감: 조우 등록
        const drop = rollMaterialDrop();
        if (drop) {
          addMaterial(drop.id, drop.count);
          setDroppedMaterial(drop);
        }
        setPhase("encounter");
      } else if (roll < 0.85) {
        // 재료 드랍
        const drop = rollMaterialDrop() ?? { id: MATERIAL_DROP_POOL[0], count: 1 };
        addMaterial(drop.id, drop.count);
        setDroppedMaterial(drop);
        setPhase("item_drop");
      } else {
        setPhase("no_encounter");
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [phase, addToDexSeen, addMaterial]);

  // RPS 선택
  const handleRpsSelect = (choice: RpsChoice) => {
    const comp = getComputerChoice();
    const result = getRpsResult(choice, comp);
    setPlayerChoice(choice);
    setComputerChoice(comp);
    setRpsResult(result);
    setShowComputer(false);
    setPhase("rps_result");

    setTimeout(() => setShowComputer(true), 800);

    setTimeout(() => {
      const rate = CATCH_RATE[result];
      const success = Math.random() < rate;
      setCatchSuccess(success);
      if (success && wildMonster) {
        addToDexCaught(wildMonster.id); // 도감: 포획 등록
        const place = addCapturedMonster(wildMonster);
        setCatchPlace(place);
      }
      setPhase("catch_result");
    }, 2400);
  };

  // 다시 숲으로
  const resetForest = () => {
    setPhase("enter");
    setWildMonster(null);
    setPlayerChoice(null);
    setComputerChoice(null);
    setRpsResult(null);
    setCatchSuccess(null);
    setCatchPlace(null);
    setDroppedMaterial(null);
    setShowComputer(false);
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden text-white">
      <ForestBackground />

      {/* ── 뒤로 가기 ── */}
      <button
        onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-20 rounded-xl border border-green-800/50 bg-black/50 px-3 py-1.5 text-sm text-green-400 hover:bg-black/70 hover:text-green-300 backdrop-blur"
      >
        ← 베이스캠프
      </button>

      {/* ── 제목 ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <h1 className="text-2xl font-bold text-green-300 drop-shadow-[0_2px_8px_rgba(0,200,0,0.4)]">
          🌲 숲
        </h1>
      </div>

      {/* ═══════════════ ENTER ═══════════════ */}
      {phase === "enter" && (
        <div className="relative z-10 flex flex-col items-center gap-8">
          <p className="text-center text-sm text-green-400 opacity-80">
            어느 쪽 길로 탐험하겠습니까?
          </p>
          <div className="flex gap-8">
            <PathButton side="left"  onClick={() => handleExplore("left")}  />
            <PathButton side="right" onClick={() => handleExplore("right")} />
          </div>
          <p className="text-xs text-green-800">
            몬스터와 마주치면 가위바위보로 포획에 도전할 수 있습니다.
          </p>
        </div>
      )}

      {/* ═══════════════ EXPLORING ═══════════════ */}
      {phase === "exploring" && (
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full bg-green-400"
                style={{
                  animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
          <p className="text-lg text-green-300 font-semibold animate-pulse">
            탐험 중...
          </p>
          <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }`}</style>
        </div>
      )}

      {/* ═══════════════ NO ENCOUNTER ═══════════════ */}
      {phase === "no_encounter" && (
        <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-green-900/50 bg-black/55 px-10 py-8 backdrop-blur">
          <span className="text-4xl">🍃</span>
          <p className="text-green-400 text-lg font-semibold">조용한 숲길이었다...</p>
          <p className="text-sm text-zinc-500">몬스터를 만나지 못했습니다.</p>
          <button
            onClick={resetForest}
            className="rounded-xl border border-green-700 bg-green-950/60 px-6 py-2 text-green-300 hover:bg-green-900/70"
          >
            다시 탐험하기
          </button>
        </div>
      )}

      {/* ═══════════════ ITEM DROP ═══════════════ */}
      {phase === "item_drop" && (
        <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-yellow-900/50 bg-black/55 px-10 py-8 backdrop-blur">
          {droppedMaterial ? (
            <>
              <span className="text-4xl">{getMaterial(droppedMaterial.id)?.emoji ?? "🌿"}</span>
              <p className="text-yellow-400 text-lg font-semibold">
                {getMaterial(droppedMaterial.id)?.name ?? droppedMaterial.id} ×{droppedMaterial.count} 발견!
              </p>
              <p className="text-sm text-zinc-500">농장 → 제작 탭에서 물약을 만들 수 있습니다.</p>
            </>
          ) : (
            <>
              <span className="text-4xl">🌿</span>
              <p className="text-yellow-400 text-lg font-semibold">아무것도 없었다...</p>
            </>
          )}
          <button
            onClick={resetForest}
            className="rounded-xl border border-yellow-700 bg-yellow-950/60 px-6 py-2 text-yellow-300 hover:bg-yellow-900/70"
          >
            다시 탐험하기
          </button>
        </div>
      )}

      {/* ═══════════════ ENCOUNTER ═══════════════ */}
      {phase === "encounter" && wildMonster && (
        <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-green-800/50 bg-black/60 px-10 py-8 backdrop-blur max-w-sm w-full mx-4">
          {/* 몬스터 등장 */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ background: "radial-gradient(circle, #22c55e, transparent)" }}
            />
            <img
              src={MONSTER_IMAGE_MAP[wildMonster.id]}
              alt={wildMonster.name}
              className="relative h-28 w-28 object-contain drop-shadow-[0_0_16px_rgba(74,222,128,0.5)]"
              style={{ animation: "float 2s ease-in-out infinite" }}
            />
            <style>{`@keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>
          </div>

          <div className="text-center">
            <p className="text-lg font-bold text-green-300">
              야생 {wildMonster.name}이(가) 나타났다!
            </p>
            <p className="text-sm text-zinc-500 mt-1">Lv.{wildMonster.level}</p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => setPhase("rps_select")}
              className="flex-1 rounded-xl border border-emerald-600 bg-emerald-950/60 py-2.5 font-semibold text-emerald-300 hover:bg-emerald-900/70 transition active:scale-95"
            >
              포획 시도
            </button>
            <button
              onClick={resetForest}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 py-2.5 text-zinc-400 hover:bg-zinc-800/70 transition active:scale-95"
            >
              도망가기
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ RPS SELECT ═══════════════ */}
      {phase === "rps_select" && wildMonster && (
        <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-green-800/50 bg-black/60 px-8 py-8 backdrop-blur max-w-lg w-full mx-4">
          <div className="flex items-center gap-3">
            <img
              src={MONSTER_IMAGE_MAP[wildMonster.id]}
              alt={wildMonster.name}
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="font-bold text-green-300">{wildMonster.name} Lv.{wildMonster.level}</p>
              <p className="text-sm text-zinc-400">가위, 바위, 보 중 선택하세요!</p>
              {droppedMaterial && (
                <p className="text-xs text-yellow-400 mt-0.5">
                  {getMaterial(droppedMaterial.id)?.emoji} {getMaterial(droppedMaterial.id)?.name} ×{droppedMaterial.count} 획득!
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            {RPS_CHOICES.map((c) => (
              <RpsSelectButton
                key={c.id}
                choice={c}
                onClick={() => handleRpsSelect(c.id)}
              />
            ))}
          </div>

          <p className="text-xs text-zinc-600">
            이기면 포획 확률 72% · 비기면 42% · 지면 18%
          </p>
        </div>
      )}

      {/* ═══════════════ RPS RESULT ═══════════════ */}
      {(phase === "rps_result" || (phase === "catch_result" && rpsResult)) && playerChoice && computerChoice && rpsResult && (
        <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-zinc-700/60 bg-black/70 px-8 py-8 backdrop-blur max-w-md w-full mx-4">
          {/* 대결 표시 */}
          <div className="flex items-center gap-4 w-full justify-center">
            {/* 플레이어 */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">나</p>
              <div className="rounded-xl border border-zinc-600 bg-zinc-900/80 p-3">
                <RpsIcon choice={playerChoice} className="w-20 h-20" active />
              </div>
              <p className="text-sm font-bold text-zinc-200">{RPS_KO[playerChoice]}</p>
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-zinc-500">VS</span>
              {rpsResult && phase === "catch_result" && (
                <span className={`text-xl font-black mt-1 ${RESULT_LABEL[rpsResult].color}`}>
                  {RESULT_LABEL[rpsResult].text}
                </span>
              )}
            </div>

            {/* 몬스터(컴퓨터) */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                {wildMonster?.name ?? "몬스터"}
              </p>
              <div
                className={`rounded-xl border border-zinc-600 bg-zinc-900/80 p-3 transition-all duration-500
                  ${showComputer ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
              >
                <RpsIcon choice={computerChoice} className="w-20 h-20" active />
              </div>
              <p className={`text-sm font-bold text-zinc-200 transition-opacity duration-500 ${showComputer ? "opacity-100" : "opacity-0"}`}>
                {RPS_KO[computerChoice]}
              </p>
            </div>
          </div>

          {/* 결과 + 포획 */}
          {phase === "catch_result" && catchSuccess !== null && (
            <div className="text-center mt-2">
              {catchSuccess ? (
                <>
                  <p className="text-2xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">
                    포획 성공! 🎉
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {wildMonster?.name}이(가) {catchPlace === "storage" ? "농장(보관함)에 저장되었다!" : "농장이 가득 차서 놓아줬다..."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-400">
                    포획 실패... 😢
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {wildMonster?.name}이(가) 도망쳤다!
                  </p>
                </>
              )}

              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={resetForest}
                  className="rounded-xl border border-green-700 bg-green-950/60 px-6 py-2 text-green-300 hover:bg-green-900/70 transition"
                >
                  다시 탐험
                </button>
                <button
                  onClick={() => navigate("/")}
                  className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-2 text-zinc-400 hover:bg-zinc-800/70 transition"
                >
                  베이스캠프로
                </button>
              </div>
            </div>
          )}

          {/* 포획 시도 중 */}
          {phase === "rps_result" && showComputer && (
            <div className="text-center">
              <p className={`text-xl font-bold ${RESULT_LABEL[rpsResult].color}`}>
                {RESULT_LABEL[rpsResult].text}
              </p>
              <p className="text-sm text-zinc-400 mt-1">{RESULT_LABEL[rpsResult].desc}</p>
              <p className="text-xs text-zinc-600 mt-2 animate-pulse">포획 시도 중...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
