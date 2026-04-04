import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";
import { RpsIcon, RPS_KO, type RpsChoice } from "../components/rps/RpsIcon";
import { scaleToLevel } from "../data/floorTable";
import { MATERIALS, getMaterial } from "../data/items";

// ─── 상태 머신 ────────────────────────────────────────────────────────────────────

type ForestPhase =
  | "enter" | "exploring" | "no_encounter"
  | "item_drop" | "encounter" | "rps_select"
  | "rps_result" | "catch_result";

// ─── 구역 정의 ────────────────────────────────────────────────────────────────────

interface ForestArea {
  id: string; name: string; description: string; emoji: string;
  monsterPool: string[];
  levelRange: [number, number];
  encounterRate: number; materialRate: number; materialBonus: number;
  exploreTime: number; color: string; borderColor: string;
}

const FOREST_AREAS: ForestArea[] = [
  {
    id: "shallow", name: "얕은 숲",
    description: "초보 탐험가도 안전한 곳. 기본 재료를 얻을 수 있습니다.",
    emoji: "🌳",
    monsterPool: ["flameling", "aquabe", "leafy", "fluffin"],
    levelRange: [1, 5], encounterRate: 0.55, materialRate: 0.40, materialBonus: 0,
    exploreTime: 1400,
    color: "from-green-950/60 to-emerald-950/40", borderColor: "border-green-800/50",
  },
  {
    id: "deep", name: "깊은 숲",
    description: "강한 몬스터와 희귀 재료가 기다립니다.",
    emoji: "🌲",
    monsterPool: ["burno", "bubblet", "mossy", "voltiny", "frostlet", "stonepup"],
    levelRange: [5, 12], encounterRate: 0.68, materialRate: 0.55, materialBonus: 1,
    exploreTime: 1800,
    color: "from-emerald-950/60 to-teal-950/40", borderColor: "border-emerald-700/50",
  },
  {
    id: "ancient", name: "고대 숲",
    description: "전설적인 몬스터가 출몰합니다. 충분히 준비하세요.",
    emoji: "🌑",
    monsterPool: ["zapbear", "blizzwolf", "stonepup", "burno", "mossy"],
    levelRange: [12, 22], encounterRate: 0.75, materialRate: 0.65, materialBonus: 2,
    exploreTime: 2200,
    color: "from-zinc-900/80 to-zinc-950/60", borderColor: "border-zinc-600/50",
  },
];

// ─── 가위바위보 ───────────────────────────────────────────────────────────────────

function getComputerChoice(): RpsChoice {
  const c: RpsChoice[] = ["rock", "paper", "scissors"];
  return c[Math.floor(Math.random() * 3)];
}
type RpsResult = "win" | "lose" | "draw";
function getRpsResult(p: RpsChoice, c: RpsChoice): RpsResult {
  if (p === c) return "draw";
  if ((p==="rock"&&c==="scissors")||(p==="scissors"&&c==="paper")||(p==="paper"&&c==="rock")) return "win";
  return "lose";
}
const CATCH_RATE: Record<RpsResult, number> = { win: 0.72, draw: 0.42, lose: 0.18 };
const RESULT_LABEL: Record<RpsResult, { text: string; color: string; desc: string }> = {
  win:  { text: "이겼다!", color: "text-emerald-400", desc: "포획 확률 +높음 (72%)" },
  draw: { text: "비겼다!", color: "text-yellow-400",  desc: "포획 확률 보통 (42%)" },
  lose: { text: "졌다...", color: "text-red-400",     desc: "포획 확률 낮음 (18%)" },
};

// ─── 몬스터/재료 롤 ──────────────────────────────────────────────────────────────

function pickMonster(area: ForestArea) {
  const id = area.monsterPool[Math.floor(Math.random() * area.monsterPool.length)];
  const base = monsters.find((m) => m.id === id)!;
  const level = area.levelRange[0] + Math.floor(Math.random() * (area.levelRange[1] - area.levelRange[0] + 1));
  return scaleToLevel(base, level);
}
const MATERIAL_POOL = MATERIALS.map((m) => m.id);
function rollDrop(area: ForestArea): { id: string; count: number } | null {
  if (Math.random() > area.materialRate) return null;
  const id = MATERIAL_POOL[Math.floor(Math.random() * MATERIAL_POOL.length)];
  const count = 1 + area.materialBonus + (Math.random() < 0.3 ? 1 : 0);
  return { id, count };
}

// ─── 배경 ────────────────────────────────────────────────────────────────────────

function ForestBackground({ area }: { area: ForestArea | null }) {
  const ancient = area?.id === "ancient";
  const sky = ancient
    ? "radial-gradient(ellipse at 50% 0%, #0a0a14 0%, #060610 60%, #030308 100%)"
    : "radial-gradient(ellipse at 50% 0%, #1a3a0a 0%, #0d1f0d 40%, #060e06 100%)";
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: sky }} />
      <svg className="absolute bottom-28 left-0 w-full" viewBox="0 0 960 260" preserveAspectRatio="xMidYMax meet">
        {[[30,260,70,100],[90,260,50,130],[150,260,65,115],[220,260,55,140],[290,260,72,105],[360,260,48,135],
          [420,260,62,120],[480,260,58,128],[540,260,70,108],[610,260,52,132],[670,260,65,118],
          [730,260,58,124],[790,260,72,102],[850,260,50,136],[910,260,65,115],[960,260,58,122]]
          .map(([cx,by,hw,h],i)=>(
            <polygon key={i} points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
              fill={ancient?(i%2===0?"#0a0a14":"#0d0d1a"):(i%3===0?"#0a1f0a":i%3===1?"#0d2a0d":"#0b220b")} opacity="0.85"/>
          ))}
      </svg>
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 340" preserveAspectRatio="xMidYMax meet">
        {[[-30,340,88,190],[80,340,75,210],[190,340,92,180],[310,340,78,200],[420,340,95,195],
          [530,340,70,215],[640,340,88,188],[750,340,80,205],[860,340,90,192],[970,340,76,208]]
          .map(([cx,by,hw,h],i)=>(
            <polygon key={i} points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
              fill={ancient?(i%2===0?"#080812":"#0a0a1a"):(i%2===0?"#061506":"#081b08")} opacity="0.9"/>
          ))}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 h-32"
        style={{ background: ancient
          ? "linear-gradient(to top,#0a0810 0%,#14101e 50%,#0d0c14 100%)"
          : "linear-gradient(to top,#1a0f05 0%,#2a1a0a 50%,#1f3012 100%)" }}/>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: ancient
          ? "radial-gradient(ellipse 60% 30% at 50% 5%,rgba(60,40,200,0.06) 0%,transparent 80%)"
          : "radial-gradient(ellipse 60% 30% at 50% 5%,rgba(100,200,60,0.06) 0%,transparent 80%)" }}/>
    </div>
  );
}

// ─── RPS 버튼 ────────────────────────────────────────────────────────────────────

const RPS_CHOICES: { id: RpsChoice; border: string; bg: string; hover: string }[] = [
  { id: "scissors", border: "border-red-600",    bg: "bg-red-950/60",    hover: "hover:bg-red-900/70" },
  { id: "rock",     border: "border-slate-500",  bg: "bg-slate-900/60",  hover: "hover:bg-slate-800/70" },
  { id: "paper",    border: "border-yellow-600", bg: "bg-yellow-950/60", hover: "hover:bg-yellow-900/70" },
];

// ─── ForestPage ───────────────────────────────────────────────────────────────────

export default function ForestPage() {
  const navigate = useNavigate();
  const { addCapturedMonster, addToDexSeen, addToDexCaught, addMaterial, potions } = usePlayerStore();

  const [phase, setPhase]             = useState<ForestPhase>("enter");
  const [area, setArea]               = useState<ForestArea | null>(null);
  const [wildMonster, setWildMonster] = useState<ReturnType<typeof pickMonster> | null>(null);
  const [pChoice, setPChoice]         = useState<RpsChoice | null>(null);
  const [cChoice, setCChoice]         = useState<RpsChoice | null>(null);
  const [rpsResult, setRpsResult]     = useState<RpsResult | null>(null);
  const [catchSuccess, setCatchSuccess] = useState<boolean | null>(null);
  const [catchPlace, setCatchPlace]   = useState<"storage" | "full" | null>(null);
  const [drops, setDrops]             = useState<{ id: string; count: number }[]>([]);
  const [showComp, setShowComp]       = useState(false);

  const handleExplore = (a: ForestArea) => {
    setArea(a);
    setPhase("exploring");
  };

  useEffect(() => {
    if (phase !== "exploring" || !area) return;
    const t = setTimeout(() => {
      const collected: { id: string; count: number }[] = [];
      const d1 = rollDrop(area); if (d1) collected.push(d1);
      if (area.id === "ancient" && Math.random() < 0.35) {
        const d2 = rollDrop(area);
        if (d2 && d2.id !== d1?.id) collected.push(d2);
      }

      const roll = Math.random();
      if (roll < area.encounterRate) {
        const mon = pickMonster(area);
        setWildMonster(mon);
        addToDexSeen(mon.id);
        collected.forEach((d) => addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("encounter");
      } else if (collected.length > 0) {
        collected.forEach((d) => addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("item_drop");
      } else {
        setPhase("no_encounter");
      }
    }, area.exploreTime);
    return () => clearTimeout(t);
  }, [phase, area, addToDexSeen, addMaterial]);

  const handleRps = (choice: RpsChoice) => {
    const comp = getComputerChoice();
    const res = getRpsResult(choice, comp);
    setPChoice(choice); setCChoice(comp); setRpsResult(res);
    setShowComp(false); setPhase("rps_result");
    setTimeout(() => setShowComp(true), 800);
    setTimeout(() => {
      const ok = Math.random() < CATCH_RATE[res];
      setCatchSuccess(ok);
      if (ok && wildMonster) {
        addToDexCaught(wildMonster.id);
        setCatchPlace(addCapturedMonster(wildMonster));
      }
      setPhase("catch_result");
    }, 2400);
  };

  const reset = () => {
    setPhase("enter"); setArea(null); setWildMonster(null);
    setPChoice(null); setCChoice(null); setRpsResult(null);
    setCatchSuccess(null); setCatchPlace(null); setDrops([]); setShowComp(false);
  };

  const totalPotions = Object.values(potions).reduce((a, b) => a + b, 0);

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden text-white">
      <ForestBackground area={area} />

      <button onClick={() => navigate("/")}
        className="absolute top-4 left-4 z-20 rounded-xl border border-green-800/50 bg-black/50 px-3 py-1.5 text-sm text-green-400 hover:bg-black/70 hover:text-green-300 backdrop-blur">
        ← 베이스캠프
      </button>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center">
        <h1 className="text-2xl font-bold text-green-300 drop-shadow-[0_2px_8px_rgba(0,200,0,0.4)]">
          {area ? `${area.emoji} ${area.name}` : "🌲 숲 탐험"}
        </h1>
      </div>

      {totalPotions > 0 && (
        <div className="absolute top-4 right-4 z-20 rounded-xl border border-zinc-700 bg-black/60 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur">
          🎒 ×{totalPotions}
        </div>
      )}

      {/* ── ENTER: 구역 선택 ── */}
      {phase === "enter" && (
        <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-lg px-4">
          <p className="text-sm text-green-400/80">어느 구역을 탐험하겠습니까?</p>
          {FOREST_AREAS.map((a) => (
            <button key={a.id} onClick={() => handleExplore(a)}
              className={`w-full rounded-2xl border bg-gradient-to-br ${a.color} ${a.borderColor} px-5 py-4 text-left
                hover:opacity-90 backdrop-blur transition active:scale-[0.98]`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-base font-bold text-green-200">{a.emoji} {a.name}</span>
                <span className="text-xs text-zinc-400">Lv.{a.levelRange[0]}~{a.levelRange[1]}</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2">{a.description}</p>
              <div className="flex gap-3 text-xs text-zinc-500">
                <span>조우율 {Math.round(a.encounterRate*100)}%</span>
                <span>재료 {Math.round(a.materialRate*100)}%</span>
                {a.materialBonus > 0 && <span className="text-yellow-500">+{a.materialBonus} 보너스</span>}
              </div>
            </button>
          ))}
          <p className="text-xs text-green-900">포획 성공 시 농장(보관함)에 저장됩니다.</p>
        </div>
      )}

      {/* ── EXPLORING ── */}
      {phase === "exploring" && (
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="flex gap-2">
            {[0,1,2].map((i)=>(
              <div key={i} className="h-3 w-3 rounded-full bg-green-400"
                style={{ animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite` }}/>
            ))}
          </div>
          <p className="text-lg text-green-300 font-semibold animate-pulse">{area?.name} 탐험 중...</p>
          <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
        </div>
      )}

      {/* ── NO ENCOUNTER ── */}
      {phase === "no_encounter" && (
        <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-green-900/50 bg-black/55 px-10 py-8 backdrop-blur">
          <span className="text-4xl">🍃</span>
          <p className="text-green-400 text-lg font-semibold">조용한 숲길이었다...</p>
          <p className="text-sm text-zinc-500">몬스터도 재료도 발견하지 못했습니다.</p>
          <div className="flex gap-3">
            <button onClick={reset} className="rounded-xl border border-green-700 bg-green-950/60 px-6 py-2 text-green-300 hover:bg-green-900/70">다시 탐험하기</button>
            <button onClick={()=>navigate("/")} className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-5 py-2 text-zinc-400 hover:bg-zinc-800/70">베이스캠프로</button>
          </div>
        </div>
      )}

      {/* ── ITEM DROP ── */}
      {phase === "item_drop" && (
        <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-yellow-900/50 bg-black/55 px-10 py-8 backdrop-blur">
          <span className="text-3xl">🌿</span>
          <p className="text-yellow-400 text-lg font-semibold">재료를 발견했다!</p>
          <div className="flex flex-col gap-2 w-full">
            {drops.map((d,i)=>{
              const mat = getMaterial(d.id);
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-yellow-950/40 border border-yellow-900/50 px-4 py-2">
                  <span className="text-2xl">{mat?.emoji ?? "🌿"}</span>
                  <div><p className="text-yellow-300 font-semibold text-sm">{mat?.name ?? d.id}</p>
                    <p className="text-xs text-zinc-500">×{d.count} 획득</p></div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-zinc-600">농장 → 제작 탭에서 물약을 만들 수 있습니다.</p>
          <div className="flex gap-3">
            <button onClick={reset} className="rounded-xl border border-yellow-700 bg-yellow-950/60 px-6 py-2 text-yellow-300 hover:bg-yellow-900/70">다시 탐험하기</button>
            <button onClick={()=>navigate("/")} className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-5 py-2 text-zinc-400 hover:bg-zinc-800/70">베이스캠프로</button>
          </div>
        </div>
      )}

      {/* ── ENCOUNTER ── */}
      {phase === "encounter" && wildMonster && (
        <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-green-800/50 bg-black/60 px-10 py-8 backdrop-blur max-w-sm w-full mx-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ background:"radial-gradient(circle,#22c55e,transparent)" }}/>
            <img src={MONSTER_IMAGE_MAP[wildMonster.id]} alt={wildMonster.name}
              className="relative h-28 w-28 object-contain drop-shadow-[0_0_16px_rgba(74,222,128,0.5)]"
              style={{ ...monsterImgStyle(wildMonster.id), animation:"float 2s ease-in-out infinite" }}/>
            <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-300">야생 {wildMonster.name}이(가) 나타났다!</p>
            <p className="text-sm text-zinc-500 mt-1">Lv.{wildMonster.level} · {area?.name}</p>
            {drops.length > 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                {drops.map((d)=>`${getMaterial(d.id)?.emoji??"🌿"} ×${d.count}`).join("  ")} 획득!
              </p>
            )}
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={()=>setPhase("rps_select")}
              className="flex-1 rounded-xl border border-emerald-600 bg-emerald-950/60 py-2.5 font-semibold text-emerald-300 hover:bg-emerald-900/70 transition active:scale-95">
              포획 시도
            </button>
            <button onClick={reset}
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 py-2.5 text-zinc-400 hover:bg-zinc-800/70 transition active:scale-95">
              도망가기
            </button>
          </div>
        </div>
      )}

      {/* ── RPS SELECT ── */}
      {phase === "rps_select" && wildMonster && (
        <div className="relative z-10 flex flex-col items-center gap-6 rounded-2xl border border-green-800/50 bg-black/60 px-8 py-8 backdrop-blur max-w-lg w-full mx-4">
          <div className="flex items-center gap-3">
            <img src={MONSTER_IMAGE_MAP[wildMonster.id]} alt={wildMonster.name}
              className="h-12 w-12 object-contain" style={monsterImgStyle(wildMonster.id)}/>
            <div>
              <p className="font-bold text-green-300">{wildMonster.name} Lv.{wildMonster.level}</p>
              <p className="text-sm text-zinc-400">가위, 바위, 보 중 선택하세요!</p>
            </div>
          </div>
          <div className="flex gap-4">
            {RPS_CHOICES.map((c)=>(
              <button key={c.id} onClick={()=>handleRps(c.id)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border px-6 py-5 transition active:scale-95 ${c.border} ${c.bg} ${c.hover}`}>
                <div className="transition-transform group-hover:scale-110">
                  <RpsIcon choice={c.id} className="w-20 h-20"/>
                </div>
                <span className="text-base font-bold text-zinc-100">{RPS_KO[c.id]}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-600">이기면 72% · 비기면 42% · 지면 18%</p>
        </div>
      )}

      {/* ── RPS RESULT / CATCH RESULT ── */}
      {(phase === "rps_result" || phase === "catch_result") && pChoice && cChoice && rpsResult && (
        <div className="relative z-10 flex flex-col items-center gap-5 rounded-2xl border border-zinc-700/60 bg-black/70 px-8 py-8 backdrop-blur max-w-md w-full mx-4">
          <div className="flex items-center gap-4 w-full justify-center">
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">나</p>
              <div className="rounded-xl border border-zinc-600 bg-zinc-900/80 p-3">
                <RpsIcon choice={pChoice} className="w-20 h-20" active/>
              </div>
              <p className="text-sm font-bold text-zinc-200">{RPS_KO[pChoice]}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-zinc-500">VS</span>
              {phase === "catch_result" && (
                <span className={`text-xl font-black mt-1 ${RESULT_LABEL[rpsResult].color}`}>
                  {RESULT_LABEL[rpsResult].text}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                {wildMonster?.name ?? "몬스터"}
              </p>
              <div className={`rounded-xl border border-zinc-600 bg-zinc-900/80 p-3 transition-all duration-500
                ${showComp?"opacity-100 scale-100":"opacity-0 scale-75"}`}>
                <RpsIcon choice={cChoice} className="w-20 h-20" active/>
              </div>
              <p className={`text-sm font-bold text-zinc-200 transition-opacity duration-500 ${showComp?"opacity-100":"opacity-0"}`}>
                {RPS_KO[cChoice]}
              </p>
            </div>
          </div>

          {phase === "catch_result" && catchSuccess !== null && (
            <div className="text-center mt-2">
              {catchSuccess ? (
                <>
                  <p className="text-2xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]">포획 성공! 🎉</p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {wildMonster?.name}이(가) {catchPlace==="storage"?"농장(보관함)에 저장되었다!":"농장이 가득 차서 놓아줬다..."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-400">포획 실패... 😢</p>
                  <p className="text-sm text-zinc-400 mt-1">{wildMonster?.name}이(가) 도망쳤다!</p>
                </>
              )}
              <div className="mt-4 flex gap-3 justify-center">
                <button onClick={reset} className="rounded-xl border border-green-700 bg-green-950/60 px-6 py-2 text-green-300 hover:bg-green-900/70 transition">다시 탐험</button>
                <button onClick={()=>navigate("/")} className="rounded-xl border border-zinc-700 bg-zinc-900/60 px-6 py-2 text-zinc-400 hover:bg-zinc-800/70 transition">베이스캠프로</button>
              </div>
            </div>
          )}

          {phase === "rps_result" && showComp && (
            <div className="text-center">
              <p className={`text-xl font-bold ${RESULT_LABEL[rpsResult].color}`}>{RESULT_LABEL[rpsResult].text}</p>
              <p className="text-sm text-zinc-400 mt-1">{RESULT_LABEL[rpsResult].desc}</p>
              <p className="text-xs text-zinc-600 mt-2 animate-pulse">포획 시도 중...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
