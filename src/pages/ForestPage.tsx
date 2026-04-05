import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { monsters } from "../data/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../data/monsterImages";
import { usePlayerStore } from "../store/playerStore";
import { RpsIcon, RPS_KO, type RpsChoice } from "../components/rps/RpsIcon";
import { scaleToLevel } from "../data/floorTable";
import { MATERIALS, getMaterial } from "../data/items";

// ═══════════════════════════════════════════════════════════════════════════════
// CSS 애니메이션 키프레임
// ═══════════════════════════════════════════════════════════════════════════════

const FOREST_STYLES = `
@keyframes leafFall {
  0%   { transform: translateY(-6vh) translateX(0px) rotate(0deg); opacity:0; }
  8%   { opacity:.85; }
  90%  { opacity:.5; }
  100% { transform: translateY(108vh) translateX(40px) rotate(540deg); opacity:0; }
}
@keyframes leafFallR {
  0%   { transform: translateY(-6vh) translateX(0px) rotate(0deg); opacity:0; }
  8%   { opacity:.7; }
  100% { transform: translateY(108vh) translateX(-30px) rotate(-360deg); opacity:0; }
}
@keyframes fireflyFloat {
  0%,100%{ transform:translate(0,0) scale(1); opacity:.2; }
  20%   { transform:translate(22px,-18px) scale(1.3); opacity:.95; }
  40%   { transform:translate(-8px,-30px) scale(.8); opacity:.75; }
  70%   { transform:translate(-20px,-8px) scale(1.1); opacity:.5; }
}
@keyframes crystalDrift {
  0%   { transform: translateY(0) rotate(0deg) scale(1); opacity:.1; }
  30%  { opacity:.8; }
  70%  { opacity:.4; }
  100% { transform: translateY(-70px) rotate(200deg) scale(.5); opacity:0; }
}
@keyframes monsterFloat {
  0%,100%{ transform:translateY(0px); }
  50%   { transform:translateY(-14px); }
}
@keyframes auraBreath {
  0%,100%{ transform:scale(.93); opacity:.35; }
  50%   { transform:scale(1.1); opacity:.7; }
}
@keyframes encounterFlash {
  0%  { opacity:0; transform:scale(.2) rotate(-20deg); }
  35% { opacity:1; transform:scale(1.4) rotate(5deg); }
  55% { transform:scale(.9) rotate(-2deg); }
  100%{ opacity:1; transform:scale(1) rotate(0deg); }
}
@keyframes slideInUp {
  from{ transform:translateY(36px); opacity:0; }
  to  { transform:translateY(0);    opacity:1; }
}
@keyframes fadeInScale {
  from{ transform:scale(.88); opacity:0; }
  to  { transform:scale(1);   opacity:1; }
}
@keyframes catchShakeX {
  0%,100%{ transform:translateX(0) rotate(0deg); }
  15%{ transform:translateX(-8px) rotate(-8deg); }
  30%{ transform:translateX(8px)  rotate(8deg); }
  45%{ transform:translateX(-6px) rotate(-5deg); }
  60%{ transform:translateX(6px)  rotate(5deg); }
  75%{ transform:translateX(-3px) rotate(-2deg); }
}
@keyframes successBurst {
  0%  { transform:scale(0); opacity:1; }
  100%{ transform:scale(5); opacity:0; }
}
@keyframes starTwinkle {
  0%,100%{ transform:scale(0) rotate(0deg);   opacity:0; }
  20%    { transform:scale(1) rotate(90deg);   opacity:1; }
  80%    { transform:scale(.8) rotate(200deg); opacity:.6; }
}
@keyframes shimmerPass {
  from{ transform:translateX(-150%) skewX(-18deg); }
  to  { transform:translateX(350%) skewX(-18deg); }
}
@keyframes mist {
  0%,100%{ opacity:.12; transform:translateX(0); }
  50%    { opacity:.3;  transform:translateX(14px); }
}
@keyframes groundScroll {
  from{ transform:translateX(0); }
  to  { transform:translateX(-50%); }
}
@keyframes treeSway {
  0%,100%{ transform:rotate(0deg); transform-origin:bottom center; }
  50%    { transform:rotate(1.5deg); transform-origin:bottom center; }
}
@keyframes fogDrift {
  0%  { opacity:.18; transform:translateX(0) scaleX(1); }
  50% { opacity:.38; transform:translateX(20px) scaleX(1.04); }
  100%{ opacity:.18; transform:translateX(0) scaleX(1); }
}
@keyframes rpsReveal {
  from{ transform:rotateY(90deg) scale(.7); opacity:0; }
  to  { transform:rotateY(0deg)  scale(1);  opacity:1; }
}
@keyframes pulseRing {
  0%  { transform:scale(1);   opacity:.6; }
  100%{ transform:scale(1.8); opacity:0; }
}
@keyframes numberPop {
  0%  { transform:scale(0) translateY(-10px); opacity:0; }
  60% { transform:scale(1.15); opacity:1; }
  100%{ transform:scale(1) translateY(0); opacity:1; }
}
@keyframes catchBounce {
  0%,100%{ transform:rotate(0deg) scale(1); }
  25%    { transform:rotate(-20deg) scale(1.05); }
  75%    { transform:rotate(20deg) scale(.97); }
}
@keyframes itemDrop {
  0%  { transform:translateY(-20px) scale(.7); opacity:0; }
  60% { transform:translateY(4px) scale(1.08); opacity:1; }
  100%{ transform:translateY(0) scale(1); opacity:1; }
}
@keyframes pathWalk {
  0%,100%{ transform:translateY(0) rotate(0); }
  25%    { transform:translateY(-3px) rotate(4deg); }
  75%    { transform:translateY(-1px) rotate(-4deg); }
}
@keyframes footstep {
  0%,49%,100%{ opacity:0; }
  50%,98%    { opacity:1; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// 타입 & 상수
// ═══════════════════════════════════════════════════════════════════════════════

type ForestPhase =
  | "enter" | "exploring" | "no_encounter"
  | "item_drop" | "encounter" | "rps_select"
  | "rps_result" | "catch_result";

interface ForestArea {
  id: string; name: string; subtitle: string; description: string;
  monsterPool: string[]; levelRange: [number, number];
  encounterRate: number; materialRate: number; materialBonus: number;
  exploreTime: number;
  danger: number;                // 1~5 별
  particleType: "leaf" | "firefly" | "crystal";
  skyTop: string; skyBottom: string; fogColor: string; groundColor: string;
  accentColor: string; glowColor: string; borderGlow: string;
  recommendedText: string;
}

const FOREST_AREAS: ForestArea[] = [
  {
    id: "shallow", name: "얕은 숲", subtitle: "SHALLOW WOODS",
    description: "햇빛이 스며드는 고요한 숲. 초보 탐험가도 부담 없이 도전할 수 있습니다.",
    monsterPool: ["flameling", "aquabe", "leafy", "fluffin"],
    levelRange: [1, 8], encounterRate: 0.55, materialRate: 0.40, materialBonus: 0,
    exploreTime: 1400, danger: 1,
    particleType: "leaf",
    skyTop: "#061a06", skyBottom: "#0d2e0d",
    fogColor: "rgba(34,197,94,0.08)", groundColor: "#1a2e10",
    accentColor: "#4ade80", glowColor: "rgba(74,222,128,0.25)",
    borderGlow: "rgba(74,222,128,0.5)",
    recommendedText: "추천: 처음 방문 탐험가",
  },
  {
    id: "deep", name: "깊은 숲", subtitle: "DEEP FOREST",
    description: "빛이 닿지 않는 울창한 구역. 강한 몬스터와 희귀 재료가 기다립니다.",
    monsterPool: ["burno", "bubblet", "mossy", "voltiny", "frostlet", "stonepup"],
    levelRange: [8, 18], encounterRate: 0.68, materialRate: 0.55, materialBonus: 1,
    exploreTime: 1800, danger: 3,
    particleType: "firefly",
    skyTop: "#020d08", skyBottom: "#051a10",
    fogColor: "rgba(20,184,166,0.08)", groundColor: "#0a1e15",
    accentColor: "#2dd4bf", glowColor: "rgba(45,212,191,0.22)",
    borderGlow: "rgba(45,212,191,0.55)",
    recommendedText: "추천: Lv.5 이상 파티",
  },
  {
    id: "ancient", name: "고대 숲", subtitle: "ANCIENT DEPTHS",
    description: "마력이 깃든 태고의 숲. 전설적인 몬스터가 출몰하며, 생환을 장담할 수 없습니다.",
    monsterPool: ["zapbear", "blizzwolf", "fluffin", "burno", "mossy"],
    levelRange: [18, 32], encounterRate: 0.75, materialRate: 0.65, materialBonus: 2,
    exploreTime: 2200, danger: 5,
    particleType: "crystal",
    skyTop: "#05020f", skyBottom: "#0e0520",
    fogColor: "rgba(139,92,246,0.1)", groundColor: "#0e0820",
    accentColor: "#a78bfa", glowColor: "rgba(167,139,250,0.25)",
    borderGlow: "rgba(167,139,250,0.6)",
    recommendedText: "⚠ 경고: 고레벨 파티 필수",
  },
];

const TYPE_GLOW: Record<string, string> = {
  fire:     "rgba(239,68,68,0.55)",
  water:    "rgba(59,130,246,0.55)",
  grass:    "rgba(34,197,94,0.55)",
  electric: "rgba(234,179,8,0.65)",
  ice:      "rgba(103,232,249,0.55)",
  normal:   "rgba(161,161,170,0.45)",
};
const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/80 text-red-200 border-red-700",
  water:    "bg-blue-900/80 text-blue-200 border-blue-700",
  grass:    "bg-green-900/80 text-green-200 border-green-700",
  electric: "bg-yellow-900/80 text-yellow-200 border-yellow-700",
  ice:      "bg-cyan-900/80 text-cyan-200 border-cyan-700",
  normal:   "bg-zinc-800/80 text-zinc-200 border-zinc-600",
};
const TYPE_KO: Record<string, string> = {
  fire:"불꽃", water:"물", grass:"풀", electric:"전기", ice:"얼음", normal:"노말",
};

type RpsResult = "win" | "lose" | "draw";
function getComputerChoice(): RpsChoice {
  const c: RpsChoice[] = ["rock","paper","scissors"];
  return c[Math.floor(Math.random()*3)];
}
function getRpsResult(p: RpsChoice, c: RpsChoice): RpsResult {
  if (p===c) return "draw";
  if ((p==="rock"&&c==="scissors")||(p==="scissors"&&c==="paper")||(p==="paper"&&c==="rock")) return "win";
  return "lose";
}
const CATCH_RATE: Record<RpsResult,number> = { win:.72, draw:.42, lose:.18 };
const RPS_RESULT_DATA: Record<RpsResult,{text:string; color:string; desc:string; bg:string}> = {
  win:  { text:"승리!", color:"text-emerald-300", desc:"포획 확률 72%", bg:"from-emerald-950/80 to-emerald-900/40" },
  draw: { text:"무승부", color:"text-yellow-300",  desc:"포획 확률 42%", bg:"from-yellow-950/80 to-yellow-900/40" },
  lose: { text:"패배...", color:"text-red-300",   desc:"포획 확률 18%", bg:"from-red-950/80 to-red-900/40" },
};

const MATERIAL_POOL = MATERIALS.map((m)=>m.id);

function pickMonster(area: ForestArea) {
  const id = area.monsterPool[Math.floor(Math.random()*area.monsterPool.length)];
  const base = monsters.find((m)=>m.id===id)!;
  const level = area.levelRange[0] + Math.floor(Math.random()*(area.levelRange[1]-area.levelRange[0]+1));
  return scaleToLevel(base, level);
}
function rollDrop(area: ForestArea): {id:string; count:number}|null {
  if (Math.random()>area.materialRate) return null;
  const id = MATERIAL_POOL[Math.floor(Math.random()*MATERIAL_POOL.length)];
  const count = 1 + area.materialBonus + (Math.random()<.3?1:0);
  return { id, count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 파티클 컴포넌트
// ═══════════════════════════════════════════════════════════════════════════════

function LeafParticles() {
  const leaves = useMemo(()=>Array.from({length:18},(_,i)=>({
    id:i,
    x: Math.random()*100,
    delay: Math.random()*10,
    dur: 7+Math.random()*7,
    size: 5+Math.random()*7,
    color: `rgba(${30+Math.floor(Math.random()*40)},${150+Math.floor(Math.random()*70)},${40+Math.floor(Math.random()*40)},${.5+Math.random()*.4})`,
    flip: Math.random()>.5,
  })),[]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {leaves.map(l=>(
        <div key={l.id} className="absolute" style={{
          left:`${l.x}%`, top:"-3%",
          width:l.size, height:l.size*.55,
          background:l.color,
          borderRadius:"50% 0 50% 0",
          transform:`rotate(${Math.random()*360}deg)`,
          animation:`${l.flip?"leafFallR":"leafFall"} ${l.dur}s linear ${l.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function FireflyParticles() {
  const flies = useMemo(()=>Array.from({length:22},(_,i)=>({
    id:i,
    x:Math.random()*100,
    y:20+Math.random()*65,
    delay:Math.random()*8,
    dur:4+Math.random()*5,
    size:2.5+Math.random()*2,
    hue:Math.random()>.5?"170,255,160":"220,255,120",
  })),[]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flies.map(f=>(
        <div key={f.id} className="absolute rounded-full" style={{
          left:`${f.x}%`, top:`${f.y}%`,
          width:f.size, height:f.size,
          background:`rgba(${f.hue},1)`,
          boxShadow:`0 0 ${f.size*3}px ${f.size}px rgba(${f.hue},.6)`,
          animation:`fireflyFloat ${f.dur}s ease-in-out ${f.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function CrystalParticles() {
  const crystals = useMemo(()=>Array.from({length:16},(_,i)=>({
    id:i,
    x:5+Math.random()*90,
    y:10+Math.random()*80,
    delay:Math.random()*8,
    dur:3+Math.random()*5,
    size:3+Math.random()*4,
    hue:Math.random()>.5?"167,139,250":"196,181,253",
  })),[]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {crystals.map(c=>(
        <div key={c.id} className="absolute" style={{
          left:`${c.x}%`, bottom:`${c.y}%`,
          width:c.size, height:c.size*1.5,
          clipPath:"polygon(50% 0%,100% 60%,50% 100%,0% 60%)",
          background:`rgba(${c.hue},.9)`,
          filter:`blur(.5px) drop-shadow(0 0 3px rgba(${c.hue},.8))`,
          animation:`crystalDrift ${c.dur}s ease-in ${c.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function Particles({ area }: { area: ForestArea }) {
  if (area.particleType==="leaf")    return <LeafParticles/>;
  if (area.particleType==="firefly") return <FireflyParticles/>;
  return <CrystalParticles/>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 배경
// ═══════════════════════════════════════════════════════════════════════════════

function ForestBackground({ area }: { area: ForestArea | null }) {
  const a = area;
  const sky1 = a?.skyTop    ?? "#061a06";
  const sky2 = a?.skyBottom ?? "#0d2e0d";
  const fog  = a?.fogColor  ?? "rgba(34,197,94,0.08)";
  const gnd  = a?.groundColor ?? "#1a2e10";
  const ancient = a?.id==="ancient";
  const deep    = a?.id==="deep";

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/* 하늘 */}
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at 50% 0%, ${sky1} 0%, ${sky2} 60%, #030806 100%)`,
      }}/>

      {/* 별 (고대 숲) */}
      {ancient && (
        <div className="absolute inset-0">
          {Array.from({length:60}).map((_,i)=>(
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                left:`${Math.random()*100}%`, top:`${Math.random()*60}%`,
                width:1+Math.random()*1.5, height:1+Math.random()*1.5,
                opacity:.2+Math.random()*.6,
                animation:`crystalDrift ${3+Math.random()*4}s ease-in-out ${Math.random()*6}s infinite alternate`,
              }}/>
          ))}
        </div>
      )}

      {/* 원거리 나무 */}
      <svg className="absolute bottom-32 left-0 w-full" viewBox="0 0 960 240" preserveAspectRatio="xMidYMax meet">
        {[[30,240,60,90],[85,240,45,120],[145,240,58,105],[210,240,50,130],[275,240,65,95],
          [345,240,42,125],[405,240,56,110],[465,240,52,118],[525,240,64,98],[595,240,46,122],
          [655,240,59,108],[715,240,52,114],[775,240,65,94],[835,240,44,126],[895,240,59,105],[950,240,52,112]]
          .map(([cx,by,hw,h],i)=>(
            <polygon key={i} points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
              fill={ancient?"#0a0618":deep?"#020d08":"#0a1f0a"}
              opacity={.7+Math.sin(i)*.1}/>
          ))}
      </svg>

      {/* 중경 나무 (흔들림) */}
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 320" preserveAspectRatio="xMidYMax meet">
        {[[-20,320,82,180],[75,320,70,200],[180,320,88,170],[300,320,74,190],[410,320,90,185],
          [520,320,66,205],[630,320,84,178],[740,320,76,195],[850,320,86,182],[960,320,72,198]]
          .map(([cx,by,hw,h],i)=>(
            <g key={i} style={{ animation:`treeSway ${3+i*.3}s ease-in-out ${i*.4}s infinite alternate` }}>
              <polygon points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
                fill={ancient?"#080412":deep?"#041208":"#061506"} opacity=".95"/>
              {/* 나무 하이라이트 */}
              <polygon points={`${cx-hw*.3},${by} ${cx-hw*.08},${by-h*.65} ${cx},${by-h}`}
                fill={ancient?"rgba(100,40,200,.06)":deep?"rgba(20,100,60,.07)":"rgba(30,100,30,.07)"}/>
            </g>
          ))}
      </svg>

      {/* 안개 */}
      <div className="absolute inset-x-0 bottom-24 h-40 pointer-events-none"
        style={{
          background:`linear-gradient(to top, ${gnd}cc 0%, ${fog} 60%, transparent 100%)`,
          animation:"fogDrift 8s ease-in-out infinite",
        }}/>

      {/* 지면 */}
      <div className="absolute bottom-0 left-0 right-0 h-28"
        style={{ background:`linear-gradient(to top, ${gnd} 0%, ${gnd}cc 60%, transparent 100%)` }}/>

      {/* 전경 풀 */}
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 60" preserveAspectRatio="xMidYMax meet">
        {Array.from({length:32}).map((_,i)=>{
          const x=(i*31)+Math.sin(i*1.9)*9;
          const h=14+Math.sin(i*2.5)*9;
          const col = ancient?"rgba(80,40,160,.6)":deep?"rgba(10,60,40,.7)":"rgba(20,80,20,.8)";
          return (
            <g key={i}>
              <polygon points={`${x},60 ${x-5},${60-h} ${x+4},60`} fill={col}/>
              <polygon points={`${x+9},60 ${x+3},${60-h*.8} ${x+14},60`} fill={col} opacity=".7"/>
            </g>
          );
        })}
      </svg>

      {/* 분위기 빛 */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: ancient
            ? "radial-gradient(ellipse 50% 25% at 50% 5%, rgba(120,60,220,.08) 0%, transparent 80%)"
            : deep
              ? "radial-gradient(ellipse 50% 20% at 50% 5%, rgba(20,160,100,.06) 0%, transparent 80%)"
              : "radial-gradient(ellipse 55% 22% at 50% 5%, rgba(80,200,70,.07) 0%, transparent 80%)",
        }}/>

      {/* 수평 안개 레이어 */}
      {[45,60,72].map((pct,i)=>(
        <div key={i} className="absolute inset-x-0 pointer-events-none h-8"
          style={{
            bottom:`${pct}%`,
            background:`linear-gradient(to right, transparent 0%, ${fog} 30%, ${fog} 70%, transparent 100%)`,
            opacity:.6,
            animation:`mist ${6+i*2}s ease-in-out ${i*1.5}s infinite`,
          }}/>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 구역 선택 카드
// ═══════════════════════════════════════════════════════════════════════════════

function AreaCard({ area, index, onClick }: { area: ForestArea; index: number; onClick: ()=>void }) {
  const monsterTypes = [...new Set(
    area.monsterPool.map((id)=>monsters.find((m)=>m.id===id)?.type ?? "normal")
  )];

  return (
    <button
      onClick={onClick}
      className="relative w-full overflow-hidden border-2 text-left transition-all
        hover:scale-[1.01] active:scale-[.99] group"
      style={{
        borderColor: area.borderGlow,
        borderRadius: 0,
        boxShadow: `4px 4px 0px ${area.glowColor}, inset 0 0 40px ${area.glowColor}`,
        background: `linear-gradient(135deg, ${area.skyTop}f0 0%, ${area.skyBottom}e0 100%)`,
        imageRendering: "pixelated",
        animationDelay: `${index*0.1}s`,
        animation: "slideInUp .5s ease both",
      }}
    >
      {/* 배경 원형 글로우 */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full pointer-events-none opacity-20 group-hover:opacity-35 transition-opacity"
        style={{ background:`radial-gradient(circle, ${area.accentColor}, transparent)` }}/>

      {/* 파티클 미리보기 (작은 장식) */}
      <div className="absolute right-4 top-4 flex gap-1.5">
        {Array.from({length:3}).map((_,i)=>(
          <div key={i} className="rounded-full"
            style={{
              width:4, height:4,
              background: area.accentColor,
              opacity:.5+i*.15,
              boxShadow:`0 0 6px 2px ${area.glowColor}`,
              animation:`crystalDrift ${2+i*.8}s ease-in-out ${i*.6}s infinite alternate`,
            }}/>
        ))}
      </div>

      <div className="relative z-10 flex gap-4 p-5">
        {/* 왼쪽: 난이도 + 이름 */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* 난이도 별 + SUBTITLE */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest" style={{ color:area.accentColor, opacity:.7 }}>
              {area.subtitle}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-black" style={{ color:area.accentColor }}>
              {area.name}
            </h3>
            <span className="text-xs font-bold text-zinc-500">
              {"★".repeat(area.danger)}{"☆".repeat(5-area.danger)}
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">{area.description}</p>

          {/* 속성 뱃지 */}
          <div className="flex flex-wrap gap-1 mt-1">
            {monsterTypes.map((t)=>(
              <span key={t}
                className={`border px-2 py-0.5 text-[9px] font-bold ${TYPE_COLOR[t]??TYPE_COLOR.normal}`}
                style={{ borderRadius:0, fontFamily:"var(--pixel-font, monospace)" }}>
                {TYPE_KO[t]??t}
              </span>
            ))}
          </div>
        </div>

        {/* 오른쪽: 스탯 요약 */}
        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">레벨</p>
            <p className="text-sm font-bold" style={{ color:area.accentColor }}>
              {area.levelRange[0]}~{area.levelRange[1]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">조우율</p>
            <p className="text-sm font-bold text-zinc-300">{Math.round(area.encounterRate*100)}%</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">재료</p>
            <p className="text-sm font-bold text-zinc-300">
              {Math.round(area.materialRate*100)}%
              {area.materialBonus>0 && <span className="text-yellow-400 ml-1">+{area.materialBonus}</span>}
            </p>
          </div>
          {/* 진입 버튼 */}
          <div className="mt-1 px-3 py-1.5 text-xs font-bold transition group-hover:opacity-100"
            style={{
              background:`linear-gradient(135deg, ${area.accentColor}30, ${area.accentColor}18)`,
              border:`2px solid ${area.accentColor}`,
              borderRadius: 0,
              color: area.accentColor,
              fontFamily: "var(--pixel-font, monospace)",
              fontSize: 9,
              boxShadow: `2px 2px 0 ${area.accentColor}60`,
            }}>
            탐험하기 →
          </div>
        </div>
      </div>

      {/* 하단 알림 */}
      {area.danger>=4 && (
        <div className="relative z-10 border-t px-5 py-2 text-xs font-bold flex items-center gap-1.5"
          style={{ borderColor:`${area.accentColor}30`, color:area.accentColor, background:`${area.accentColor}12` }}>
          <span>⚠</span>
          <span>{area.recommendedText}</span>
        </div>
      )}

      {/* 호버 시 shimmer */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity overflow-hidden">
        <div className="absolute inset-y-0 w-16"
          style={{
            background:`linear-gradient(to right, transparent, ${area.accentColor}20, transparent)`,
            animation:"shimmerPass 1.2s ease once",
          }}/>
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 탐험 화면
// ═══════════════════════════════════════════════════════════════════════════════

function ExploringScreen({ area }: { area: ForestArea }) {
  const [step, setStep] = useState(0);
  useEffect(()=>{
    const t = setInterval(()=>setStep((s)=>s+1), 400);
    return ()=>clearInterval(t);
  },[]);

  const dots = Math.min(step % 4, 3);

  return (
    <div className="relative z-10 flex flex-col items-center gap-8 px-8 py-10 max-w-sm w-full mx-4">
      {/* 경로 시각화 */}
      <div className="w-full relative">
        <div className="flex items-end gap-1 h-16 justify-center">
          {Array.from({length:12}).map((_,i)=>{
            const h = 20+Math.sin(i*0.9+step*0.3)*16;
            return (
              <div key={i} className="rounded-sm transition-all duration-300"
                style={{
                  width:14, height:h,
                  background:`linear-gradient(to top, ${area.accentColor}60, ${area.accentColor}20)`,
                  borderTop:`1px solid ${area.accentColor}80`,
                  opacity:.4+Math.sin(i*0.5+step*0.4)*0.3,
                }}/>
            );
          })}
        </div>
        {/* 발자국 */}
        <div className="flex gap-3 justify-center mt-3">
          {Array.from({length:5}).map((_,i)=>(
            <div key={i} className="text-lg transition-opacity duration-200"
              style={{ opacity: i<=dots ? .9 : .2, animation:i===dots?"pathWalk .4s ease infinite":"none" }}>
              👣
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color:area.accentColor, opacity:.7 }}>
          {area.subtitle}
        </p>
        <p className="text-2xl font-black text-zinc-100 mb-1">탐험 중<span style={{
          display:"inline-block",
          minWidth:"2.5ch",
          textAlign:"left",
        }}>{".".repeat(dots+1)}</span></p>
        <p className="text-sm text-zinc-500">{area.name}의 깊은 곳을 헤치고 있습니다</p>
      </div>

      {/* 진행 바 */}
      <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{
            width:`${Math.min((step/((area.exploreTime/400)*.8))*100,95)}%`,
            background:`linear-gradient(to right, ${area.accentColor}80, ${area.accentColor})`,
          }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 결과 없음 화면
// ═══════════════════════════════════════════════════════════════════════════════

function NoEncounterScreen({ area, onReset, onExit }: { area: ForestArea; onReset:()=>void; onExit:()=>void }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4"
      style={{ animation:"fadeInScale .4s ease both" }}>
      <div className="w-full rounded-2xl border p-8 flex flex-col items-center gap-4"
        style={{
          background:"rgba(10,14,10,0.75)",
          borderColor:"rgba(74,222,128,0.15)",
          backdropFilter:"blur(12px)",
        }}>
        <div className="text-5xl" style={{ animation:"monsterFloat 3s ease-in-out infinite" }}>🍃</div>
        <div className="text-center">
          <p className="text-sm uppercase tracking-widest text-zinc-500 mb-1">EMPTY PATH</p>
          <p className="text-xl font-bold text-zinc-200">고요한 숲길이었다</p>
          <p className="text-sm text-zinc-500 mt-2">아무것도 발견하지 못했습니다.</p>
        </div>
        <div className="w-full h-px" style={{ background:"rgba(74,222,128,0.1)" }}/>
        <div className="flex gap-3 w-full">
          <button onClick={onReset}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${area.accentColor}20, ${area.accentColor}10)`,
              border:`1px solid ${area.accentColor}50`,
              color:area.accentColor,
            }}>
            다시 탐험
          </button>
          <button onClick={onExit}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/80 transition active:scale-95">
            귀환
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 아이템 드롭 화면
// ═══════════════════════════════════════════════════════════════════════════════

function ItemDropScreen({ drops, area, onReset, onExit }: {
  drops:{id:string;count:number}[]; area:ForestArea; onReset:()=>void; onExit:()=>void;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-md w-full mx-4"
      style={{ animation:"slideInUp .5s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background:"rgba(8,12,8,0.82)",
          border:`1px solid ${area.accentColor}40`,
          backdropFilter:"blur(14px)",
        }}>
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ background:`linear-gradient(to bottom, ${area.glowColor}, transparent)` }}>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-1">ITEM FOUND</p>
          <p className="text-2xl font-black text-zinc-100">재료 발견!</p>
        </div>

        {/* 아이템 목록 */}
        <div className="px-6 pb-2 flex flex-col gap-3">
          {drops.map((d,i)=>{
            const mat = getMaterial(d.id);
            return (
              <div key={i} className="flex items-center gap-4 rounded-xl p-4"
                style={{
                  background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  animation:`itemDrop .4s ease ${i*.12}s both`,
                }}>
                <div className="text-4xl" style={{ filter:"drop-shadow(0 0 8px rgba(255,200,50,.4))" }}>
                  {mat?.emoji ?? "🌿"}
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-zinc-100">{mat?.name ?? d.id}</p>
                  <p className="text-xs text-zinc-500">{mat?.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black font-mono"
                    style={{ color:area.accentColor, animation:"numberPop .5s ease both" }}>
                    ×{d.count}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-3 text-xs text-zinc-600 text-center">
          농장 → 제작소 탭에서 물약으로 변환할 수 있습니다
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onReset}
            className="flex-1 rounded-xl py-3 text-sm font-bold transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${area.accentColor}25, ${area.accentColor}12)`,
              border:`1px solid ${area.accentColor}55`,
              color:area.accentColor,
            }}>
            다시 탐험
          </button>
          <button onClick={onExit}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 py-3 text-sm text-zinc-400 hover:bg-zinc-800/80 transition active:scale-95">
            베이스캠프로
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 몬스터 조우 화면
// ═══════════════════════════════════════════════════════════════════════════════

function EncounterScreen({ monster, area, drops, onCapture, onFlee }: {
  monster: ReturnType<typeof pickMonster>;
  area: ForestArea;
  drops: {id:string;count:number}[];
  onCapture:()=>void; onFlee:()=>void;
}) {
  const glow = TYPE_GLOW[monster.type] ?? TYPE_GLOW.normal;
  const typeColor = TYPE_COLOR[monster.type] ?? TYPE_COLOR.normal;
  const typeKo = TYPE_KO[monster.type] ?? monster.type;

  return (
    <div className="relative z-10 w-full max-w-sm mx-4 flex flex-col gap-0"
      style={{ animation:"fadeInScale .45s ease both" }}>

      {/* 조우 배너 */}
      <div className="text-center mb-4">
        <div className="inline-block text-4xl mb-1"
          style={{ animation:"encounterFlash .6s ease both" }}>❕</div>
        <p className="text-xs uppercase tracking-[.25em] text-zinc-500">WILD ENCOUNTER</p>
      </div>

      {/* 몬스터 카드 */}
      <div className="rounded-2xl overflow-hidden"
        style={{
          background:"rgba(8,10,8,0.85)",
          border:`1px solid ${area.borderGlow}`,
          backdropFilter:"blur(16px)",
          boxShadow:`0 0 40px ${area.glowColor}, inset 0 0 30px rgba(0,0,0,.5)`,
        }}>
        {/* 몬스터 이미지 영역 */}
        <div className="relative flex items-center justify-center py-8"
          style={{ background:`radial-gradient(ellipse at 50% 60%, ${glow} 0%, transparent 70%)` }}>
          {/* 오라 링 */}
          <div className="absolute rounded-full"
            style={{
              width:140, height:140,
              background:`radial-gradient(circle, transparent 45%, ${glow} 60%, transparent 75%)`,
              animation:"auraBreath 2.5s ease-in-out infinite",
            }}/>
          {/* 펄스 링 */}
          <div className="absolute rounded-full pointer-events-none"
            style={{
              width:120, height:120,
              border:`2px solid ${area.accentColor}40`,
              animation:"pulseRing 2s ease-out infinite",
            }}/>
          <img
            src={MONSTER_IMAGE_MAP[monster.id]}
            alt={monster.name}
            className="relative w-36 h-36 object-contain drop-shadow-2xl"
            style={{
              ...monsterImgStyle(monster.id),
              animation:"monsterFloat 2.5s ease-in-out infinite",
              filter:`drop-shadow(0 0 20px ${glow})`,
            }}
          />
        </div>

        {/* 몬스터 정보 */}
        <div className="px-5 pb-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-black text-zinc-100">{monster.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">야생 몬스터 · {area.name}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1">
                <span className="text-xs font-bold text-zinc-300">Lv.<span className="text-zinc-100 font-black">{monster.level}</span></span>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${typeColor}`}>
                {typeKo}
              </span>
            </div>
          </div>

          {/* 드롭 재료 미리보기 */}
          {drops.length>0 && (
            <div className="flex items-center gap-2 rounded-xl p-2.5"
              style={{ background:"rgba(255,200,50,.06)", border:"1px solid rgba(255,200,50,.15)" }}>
              <span className="text-base">🌿</span>
              <p className="text-xs text-yellow-400 font-semibold">
                {drops.map((d)=>`${getMaterial(d.id)?.emoji??"🌿"} ${getMaterial(d.id)?.name??d.id} ×${d.count}`).join("  ")} 획득!
              </p>
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button onClick={onCapture}
              className="flex-1 rounded-xl py-3 text-sm font-black transition active:scale-95"
              style={{
                background:`linear-gradient(135deg, ${area.accentColor}35 0%, ${area.accentColor}18 100%)`,
                border:`1.5px solid ${area.accentColor}70`,
                color:area.accentColor,
                boxShadow:`0 4px 20px ${area.glowColor}`,
              }}>
              포획 시도
            </button>
            <button onClick={onFlee}
              className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-900/70 py-3 text-sm font-bold text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80 transition active:scale-95">
              도망가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 가위바위보 선택 화면
// ═══════════════════════════════════════════════════════════════════════════════

const RPS_CARD_STYLES: Record<RpsChoice, { border: string; shadow: string; label: string; bg: string }> = {
  scissors: { border:"#ef4444", shadow:"rgba(239,68,68,.35)", label:"가위", bg:"rgba(239,68,68,.1)" },
  rock:     { border:"#6b7280", shadow:"rgba(107,114,128,.35)", label:"바위", bg:"rgba(107,114,128,.1)" },
  paper:    { border:"#eab308", shadow:"rgba(234,179,8,.35)", label:"보",  bg:"rgba(234,179,8,.1)" },
};

function RpsSelectScreen({ monster, area, onSelect }: {
  monster: ReturnType<typeof pickMonster>;
  area: ForestArea;
  onSelect:(c:RpsChoice)=>void;
}) {
  const [hovered, setHovered] = useState<RpsChoice|null>(null);
  const choices: RpsChoice[] = ["scissors","rock","paper"];

  return (
    <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-md mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>
      {/* 제목 */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-[.2em] text-zinc-500 mb-1">CATCH ATTEMPT</p>
        <p className="text-2xl font-black text-zinc-100">가위바위보!</p>
      </div>

      {/* 몬스터 미니 정보 */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5"
        style={{
          background:"rgba(10,12,10,.8)",
          border:`1px solid ${area.borderGlow}`,
          backdropFilter:"blur(10px)",
        }}>
        <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.name}
          className="w-10 h-10 object-contain"
          style={monsterImgStyle(monster.id)}/>
        <div>
          <p className="text-sm font-bold text-zinc-100">{monster.name}</p>
          <p className="text-xs text-zinc-500">Lv.{monster.level} · {TYPE_KO[monster.type]??monster.type}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 text-[10px] text-zinc-600">
          <span>이기면 <span className="text-emerald-400 font-bold">72%</span></span>
          <span>비기면 <span className="text-yellow-400 font-bold">42%</span></span>
          <span>지면 <span className="text-red-400 font-bold">18%</span></span>
        </div>
      </div>

      {/* RPS 카드 3개 */}
      <div className="flex gap-4 w-full">
        {choices.map((c)=>{
          const st = RPS_CARD_STYLES[c];
          const isHov = hovered===c;
          return (
            <button
              key={c}
              onClick={()=>onSelect(c)}
              onMouseEnter={()=>setHovered(c)}
              onMouseLeave={()=>setHovered(null)}
              className="flex-1 flex flex-col items-center gap-3 rounded-2xl py-5 px-2 transition-all duration-150"
              style={{
                background: isHov
                  ? `linear-gradient(145deg, ${st.bg.replace('.1','.22')}, ${st.bg})`
                  : `linear-gradient(145deg, ${st.bg}, rgba(0,0,0,.2))`,
                border:`1.5px solid ${isHov ? st.border : `${st.border}60`}`,
                boxShadow: isHov ? `0 8px 28px ${st.shadow}, 0 0 0 1px ${st.border}40` : "none",
                transform: isHov ? "translateY(-6px) scale(1.04)" : "none",
              }}
            >
              <RpsIcon choice={c} className="w-16 h-16" active={isHov}/>
              <span className="text-sm font-black text-zinc-200">{st.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-zinc-700 -mt-2">클릭해서 선택하세요</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 가위바위보 결과 + 포획 결과 화면
// ═══════════════════════════════════════════════════════════════════════════════

function RpsResultScreen({ pChoice, cChoice, rpsResult, phase, wildMonster, catchSuccess, catchPlace, onReset, onExit }: {
  pChoice:RpsChoice; cChoice:RpsChoice; rpsResult:RpsResult;
  phase: "rps_result"|"catch_result";
  wildMonster: ReturnType<typeof pickMonster>|null;
  catchSuccess:boolean|null; catchPlace:"storage"|"full"|null;
  onReset:()=>void; onExit:()=>void;
}) {
  const [showComp, setShowComp] = useState(false);
  useEffect(()=>{
    const t = setTimeout(()=>setShowComp(true), 700);
    return ()=>clearTimeout(t);
  },[]);

  const res = RPS_RESULT_DATA[rpsResult];
  const winnerIsPlayer = rpsResult==="win";
  const winnerIsComp   = rpsResult==="lose";

  return (
    <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-md mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>

      {/* RPS 대결 패널 */}
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background:"rgba(8,10,8,0.88)",
          border:"1px solid rgba(255,255,255,0.08)",
          backdropFilter:"blur(16px)",
        }}>
        {/* 결과 헤더 */}
        {phase==="catch_result" && (
          <div className={`px-6 py-4 text-center bg-gradient-to-b ${res.bg}`}>
            <p className={`text-3xl font-black ${res.color}`}
              style={{ animation:"numberPop .5s ease both" }}>
              {res.text}
            </p>
            <p className="text-sm text-zinc-400 mt-0.5">{res.desc}</p>
          </div>
        )}

        {/* VS 대결 */}
        <div className="flex items-center gap-3 px-6 py-5 justify-center">
          {/* 플레이어 */}
          <div className={`flex flex-col items-center gap-2 flex-1 transition-all ${winnerIsPlayer?"scale-105":""}`}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">나</p>
            <div className="rounded-2xl p-4 transition-all"
              style={{
                background: winnerIsPlayer?"rgba(52,211,153,.12)":"rgba(255,255,255,.04)",
                border: winnerIsPlayer?"1px solid rgba(52,211,153,.4)":"1px solid rgba(255,255,255,.06)",
                boxShadow: winnerIsPlayer?"0 0 20px rgba(52,211,153,.15)":"none",
              }}>
              <RpsIcon choice={pChoice} className="w-16 h-16" active={winnerIsPlayer}/>
            </div>
            <p className="text-xs font-bold text-zinc-300">{RPS_KO[pChoice]}</p>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xl font-black text-zinc-600">VS</p>
            {phase==="rps_result" && !showComp && (
              <p className="text-xs text-zinc-600 animate-pulse">공개 중...</p>
            )}
          </div>

          {/* 몬스터 (컴퓨터) */}
          <div className={`flex flex-col items-center gap-2 flex-1 transition-all ${winnerIsComp?"scale-105":""}`}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">
              {wildMonster?.name??"몬스터"}
            </p>
            <div className="rounded-2xl p-4 transition-all overflow-hidden"
              style={{
                background: winnerIsComp?"rgba(248,113,113,.12)":"rgba(255,255,255,.04)",
                border: winnerIsComp?"1px solid rgba(248,113,113,.4)":"1px solid rgba(255,255,255,.06)",
                opacity: showComp?1:0,
                animation: showComp?"rpsReveal .4s ease both":"none",
              }}>
              <RpsIcon choice={cChoice} className="w-16 h-16" active={winnerIsComp}/>
            </div>
            <p className={`text-xs font-bold text-zinc-300 transition-opacity ${showComp?"opacity-100":"opacity-0"}`}>
              {RPS_KO[cChoice]}
            </p>
          </div>
        </div>

        {/* 포획 대기 */}
        {phase==="rps_result" && showComp && (
          <div className="px-6 pb-5 text-center">
            <p className={`text-lg font-black ${res.color}`}>{res.text}</p>
            <p className="text-xs text-zinc-600 mt-1 animate-pulse">포획 시도 중...</p>
          </div>
        )}

        {/* 포획 결과 */}
        {phase==="catch_result" && catchSuccess!==null && (
          <div className="px-6 pb-6 flex flex-col items-center gap-4">
            {catchSuccess ? (
              <>
                {/* 성공 */}
                <div className="relative flex items-center justify-center w-full">
                  <div className="absolute rounded-full"
                    style={{
                      width:80, height:80,
                      background:"rgba(52,211,153,.15)",
                      animation:"successBurst .8s ease both",
                    }}/>
                  {wildMonster && (
                    <img src={MONSTER_IMAGE_MAP[wildMonster.id]} alt={wildMonster.name}
                      className="relative w-20 h-20 object-contain"
                      style={{
                        ...monsterImgStyle(wildMonster?.id??""),
                        animation:"catchBounce .6s ease 2",
                        filter:"drop-shadow(0 0 12px rgba(52,211,153,.5))",
                      }}/>
                  )}
                  {/* 별 파티클 */}
                  {Array.from({length:6}).map((_,i)=>(
                    <div key={i} className="absolute text-lg"
                      style={{
                        animation:`starTwinkle .8s ease ${i*.12}s both`,
                        left:`${20+i*12}%`, top:`${10+Math.sin(i)*40}%`,
                      }}>✦</div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-emerald-300"
                    style={{ filter:"drop-shadow(0 0 8px rgba(52,211,153,.5))" }}>
                    포획 성공! 🎉
                  </p>
                  <p className="text-sm text-zinc-400 mt-1">
                    {wildMonster?.name}이(가){" "}
                    {catchPlace==="storage"?"농장 보관함에 저장되었습니다!":"농장이 가득 차서 놓아줬습니다..."}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-5xl" style={{ animation:"catchShakeX .6s ease" }}>💨</div>
                <div className="text-center">
                  <p className="text-2xl font-black text-red-400">도망쳤다...</p>
                  <p className="text-sm text-zinc-500 mt-1">{wildMonster?.name}이(가) 사라졌습니다.</p>
                </div>
              </>
            )}

            <div className="flex gap-3 w-full">
              <button onClick={onReset}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-95"
                style={{
                  background:"linear-gradient(135deg, rgba(74,222,128,.18), rgba(74,222,128,.08))",
                  border:"1px solid rgba(74,222,128,.45)",
                  color:"#4ade80",
                }}>
                다시 탐험
              </button>
              <button onClick={onExit}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/60 py-2.5 text-sm text-zinc-400 hover:bg-zinc-800/80 transition active:scale-95">
                베이스캠프로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 메인 ForestPage
// ═══════════════════════════════════════════════════════════════════════════════

export default function ForestPage() {
  const navigate = useNavigate();
  const { addCapturedMonster, addToDexSeen, addToDexCaught, addMaterial, potions, bestFloor } = usePlayerStore();

  const [phase, setPhase]             = useState<ForestPhase>("enter");
  const [area, setArea]               = useState<ForestArea|null>(null);
  const [wildMonster, setWildMonster] = useState<ReturnType<typeof pickMonster>|null>(null);
  const [pChoice, setPChoice]         = useState<RpsChoice|null>(null);
  const [cChoice, setCChoice]         = useState<RpsChoice|null>(null);
  const [rpsResult, setRpsResult]     = useState<RpsResult|null>(null);
  const [catchSuccess, setCatchSuccess] = useState<boolean|null>(null);
  const [catchPlace, setCatchPlace]   = useState<"storage"|"full"|null>(null);
  const [drops, setDrops]             = useState<{id:string;count:number}[]>([]);

  const handleExplore = (a: ForestArea) => { setArea(a); setPhase("exploring"); };

  useEffect(()=>{
    if (phase!=="exploring"||!area) return;
    const t = setTimeout(()=>{
      const collected: {id:string;count:number}[] = [];
      const d1 = rollDrop(area); if (d1) collected.push(d1);
      if (area.id==="ancient"&&Math.random()<.35) {
        const d2 = rollDrop(area);
        if (d2&&d2.id!==d1?.id) collected.push(d2);
      }
      const roll = Math.random();
      if (roll<area.encounterRate) {
        const mon = pickMonster(area);
        setWildMonster(mon);
        addToDexSeen(mon.id);
        collected.forEach((d)=>addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("encounter");
      } else if (collected.length>0) {
        collected.forEach((d)=>addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("item_drop");
      } else {
        setPhase("no_encounter");
      }
    }, area.exploreTime);
    return ()=>clearTimeout(t);
  },[phase, area, addToDexSeen, addMaterial]);

  const handleRps = (choice: RpsChoice) => {
    const comp = getComputerChoice();
    const res = getRpsResult(choice, comp);
    setPChoice(choice); setCChoice(comp); setRpsResult(res);
    setPhase("rps_result");
    setTimeout(()=>{
      const ok = Math.random()<CATCH_RATE[res];
      setCatchSuccess(ok);
      if (ok&&wildMonster) {
        addToDexCaught(wildMonster.id);
        setCatchPlace(addCapturedMonster(wildMonster));
      }
      setPhase("catch_result");
    }, 2600);
  };

  const reset = () => {
    setPhase("enter"); setArea(null); setWildMonster(null);
    setPChoice(null); setCChoice(null); setRpsResult(null);
    setCatchSuccess(null); setCatchPlace(null); setDrops([]);
  };

  const totalPotions = Object.values(potions).reduce((a,b)=>a+b, 0);

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden text-white">
      <style>{FOREST_STYLES}</style>
      <ForestBackground area={area}/>
      {area && <Particles area={area}/>}

      {/* 상단 UI */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
        <button onClick={()=>navigate("/")}
          className="rounded-xl border border-zinc-700/60 bg-black/50 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-black/70 backdrop-blur transition">
          ← 베이스캠프
        </button>

        <div className="flex items-center gap-2">
          {area && (
            <div className="rounded-xl px-3 py-1.5 text-xs font-bold backdrop-blur"
              style={{
                background:"rgba(0,0,0,.5)",
                border:`1px solid ${area.borderGlow}`,
                color: area.accentColor,
              }}>
              {area.name}
            </div>
          )}
          {totalPotions>0 && (
            <div className="rounded-xl border border-zinc-700/60 bg-black/50 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur">
              🎒 ×{totalPotions}
            </div>
          )}
        </div>
      </div>

      {/* 중앙 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-16 pb-6">

        {/* ── ENTER: 구역 선택 ── */}
        {phase==="enter" && (
          <div className="flex flex-col items-center gap-5 w-full max-w-lg">
            <div className="text-center mb-2">
              <p className="text-xs uppercase tracking-[.25em] text-zinc-600 mb-1">EXPEDITION</p>
              <h1 className="text-3xl font-black text-zinc-100">숲 탐험</h1>
              <p className="text-sm text-zinc-500 mt-1">탐험할 구역을 선택하세요</p>
            </div>
            {FOREST_AREAS.map((a,i)=>{
              const locked =
                (a.id === "deep"    && bestFloor < 11) ||
                (a.id === "ancient" && bestFloor < 21);
              return (
                <div key={a.id} className="relative">
                  <AreaCard area={a} index={i} onClick={()=>{ if(!locked) handleExplore(a); }}/>
                  {locked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{
                        background:"rgba(0,0,0,.72)",
                        border:"2px solid rgba(100,80,20,.3)",
                        borderRadius:0,
                      }}>
                      <span className="text-2xl">🔒</span>
                      <p className="text-xs font-bold text-zinc-400"
                        style={{ fontFamily:"var(--pixel-font,monospace)", fontSize:9 }}>
                        {a.id==="deep" ? "무한의 탑 11층 도달 시 해금" : "무한의 탑 21층 도달 시 해금"}
                      </p>
                      <p className="text-[9px] text-zinc-600">
                        현재 최고 층: {bestFloor}층
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── EXPLORING ── */}
        {phase==="exploring" && area && <ExploringScreen area={area}/>}

        {/* ── NO ENCOUNTER ── */}
        {phase==="no_encounter" && area && (
          <NoEncounterScreen area={area} onReset={reset} onExit={()=>navigate("/")}/>
        )}

        {/* ── ITEM DROP ── */}
        {phase==="item_drop" && area && drops.length>0 && (
          <ItemDropScreen drops={drops} area={area} onReset={reset} onExit={()=>navigate("/")}/>
        )}

        {/* ── ENCOUNTER ── */}
        {phase==="encounter" && wildMonster && area && (
          <EncounterScreen
            monster={wildMonster} area={area} drops={drops}
            onCapture={()=>setPhase("rps_select")} onFlee={reset}
          />
        )}

        {/* ── RPS SELECT ── */}
        {phase==="rps_select" && wildMonster && area && (
          <RpsSelectScreen monster={wildMonster} area={area} onSelect={handleRps}/>
        )}

        {/* ── RPS / CATCH RESULT ── */}
        {(phase==="rps_result"||phase==="catch_result") && pChoice && cChoice && rpsResult && (
          <RpsResultScreen
            pChoice={pChoice} cChoice={cChoice} rpsResult={rpsResult}
            phase={phase as "rps_result"|"catch_result"}
            wildMonster={wildMonster} catchSuccess={catchSuccess} catchPlace={catchPlace}
            onReset={reset} onExit={()=>navigate("/")}
          />
        )}
      </div>
    </div>
  );
}
