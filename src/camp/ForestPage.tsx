import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { monsters } from "../monster/monsters";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../monster/monsterImages";
import { usePlayerStore } from "../shared/playerStore";
import { RpsIcon } from "../workshop/RpsIcon";
import { RPS_KO, type RpsChoice } from "../workshop/rps";
import { scaleToLevel } from "../shared/floorTable";
import { getMaterial } from "../shared/items";
import { PALETTE, rgba, ELEMENT_COLOR, ELEMENT_CHIP_CLASS } from "../shared/palette";

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
@keyframes nodeReveal {
  0%  { transform:scale(0.5) rotate(-10deg); opacity:0; filter:brightness(3); }
  60% { transform:scale(1.15) rotate(2deg); opacity:1; }
  100%{ transform:scale(1) rotate(0deg); opacity:1; filter:brightness(1); }
}
@keyframes nodePulse {
  0%,100%{ box-shadow: 0 0 8px 2px currentColor; }
  50%    { box-shadow: 0 0 20px 6px currentColor; }
}
@keyframes lineGrow {
  from{ stroke-dashoffset: 200; }
  to  { stroke-dashoffset: 0; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// 타입 & 상수
// ═══════════════════════════════════════════════════════════════════════════════

type ForestPhase =
  | "enter" | "dungeon" | "exploring"
  | "node_arrived" | "no_encounter"
  | "item_drop" | "encounter" | "rps_select"
  | "rps_result" | "catch_result"
  | "rest" | "event" | "boss_cleared";

// ── 노드 타입 ──────────────────────────────────────────────────────────────────
type ForestNodeType = "start" | "battle" | "material" | "event" | "rest" | "elite" | "boss";

interface ForestNode {
  id: string;
  type: ForestNodeType;
  depth: number;
  col: number;       // 0-based column within this depth
  totalCols: number; // total columns in this depth
  nextIds: string[];
  cleared: boolean;
  revealed: boolean; // 도착 후 true
}

interface ForestArea {
  id: string; name: string; subtitle: string; description: string;
  monsterPool: string[]; levelRange: [number, number];
  encounterRate: number; materialRate: number; materialBonus: number;
  exploreTime: number;
  danger: number;
  particleType: "leaf" | "firefly" | "crystal";
  skyTop: string; skyBottom: string; fogColor: string; groundColor: string;
  accentColor: string; glowColor: string; borderGlow: string;
  recommendedText: string;
}

const FOREST_AREAS: ForestArea[] = [
  {
    id: "shallow", name: "얕은 숲", subtitle: "SHALLOW WOODS",
    description: "햇빛이 스며드는 고요한 숲. 초보 탐험가도 부담 없이 도전할 수 있습니다.",
    monsterPool: ["flameling", "aquabe", "leafy", "nobi", "venomcrow"],
    levelRange: [1, 8], encounterRate: 0.55, materialRate: 0.40, materialBonus: 0,
    exploreTime: 1200, danger: 1,
    particleType: "leaf",
    skyTop: PALETTE.shadow900, skyBottom: PALETTE.shadow700,
    fogColor: rgba("moss500", 0.14), groundColor: PALETTE.moss500,
    accentColor: PALETTE.moss500, glowColor: rgba("moss500", 0.25),
    borderGlow: rgba("moss500", 0.5),
    recommendedText: "추천: 처음 방문 탐험가",
  },
  {
    id: "deep", name: "깊은 숲", subtitle: "DEEP FOREST",
    description: "빛이 닿지 않는 울창한 구역. 강한 몬스터와 희귀 재료가 기다립니다.",
    monsterPool: ["burno", "bubblet", "mossy", "crystafox", "frostorb", "toxadon"],
    levelRange: [8, 18], encounterRate: 0.68, materialRate: 0.55, materialBonus: 1,
    exploreTime: 1500, danger: 3,
    particleType: "firefly",
    skyTop: PALETTE.shadow900, skyBottom: PALETTE.shadow800,
    fogColor: rgba("mist500", 0.10), groundColor: PALETTE.shadow700,
    accentColor: PALETTE.mist500, glowColor: rgba("mist500", 0.22),
    borderGlow: rgba("mist500", 0.55),
    recommendedText: "추천: Lv.5 이상 파티",
  },
  {
    id: "ancient", name: "고대 숲", subtitle: "ANCIENT DEPTHS",
    description: "마력이 깃든 태고의 숲. 전설적인 몬스터가 출몰하며, 생환을 장담할 수 없습니다.",
    monsterPool: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
    levelRange: [18, 32], encounterRate: 0.75, materialRate: 0.65, materialBonus: 2,
    exploreTime: 1800, danger: 5,
    particleType: "crystal",
    skyTop: PALETTE.shadow900, skyBottom: PALETTE.stone600,
    fogColor: rgba("ember700", 0.10), groundColor: PALETTE.earth500,
    accentColor: PALETTE.ember500, glowColor: rgba("ember500", 0.25),
    borderGlow: rgba("ember500", 0.6),
    recommendedText: "⚠ 경고: 고레벨 파티 필수",
  },
];

// ── 노드 스타일 ───────────────────────────────────────────────────────────────
// 노드 7종. 팔레트에 색상환이 다 없어서 색만으로는 7개를 못 가른다 —
// 아이콘(형태)이 1차 구분이고 색은 보조다. 글자색은 전부 4.5:1 을 넘기는 토큰만 썼다.
const NODE_META: Record<ForestNodeType, { icon: string; label: string; color: string; bg: string }> = {
  start:    { icon: "🌲", label: "입구",     color: PALETTE.sand300,  bg: rgba("moss500",  0.18) },
  battle:   { icon: "⚔️", label: "전투",     color: PALETTE.ember500, bg: rgba("ember600", 0.18) },
  material: { icon: "🌿", label: "채집",     color: PALETTE.sand200,  bg: rgba("moss500",  0.22) },
  event:    { icon: "❓", label: "이벤트",   color: PALETTE.mist300,  bg: rgba("mist500",  0.18) },
  rest:     { icon: "🔥", label: "휴식",     color: PALETTE.ember500, bg: rgba("ember500", 0.14) },
  elite:    { icon: "💀", label: "강적",     color: PALETTE.sand200,  bg: rgba("earth500", 0.28) },
  boss:     { icon: "👁", label: "보스",     color: PALETTE.cream100, bg: rgba("ember700", 0.32) },
};

// 속성 색은 shared/palette.ts 의 ELEMENT_COLOR 가 단일 출처다. 여기서 따로 정하지 않는다.
const TYPE_GLOW: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_COLOR).map(([type, token]) => [type, rgba(token, 0.55)]),
);
const TYPE_COLOR: Record<string, string> = ELEMENT_CHIP_CLASS;
const TYPE_KO: Record<string, string> = {
  fire:"불꽃", water:"물", grass:"풀", electric:"전기", ice:"얼음", normal:"노말",
  poison:"독",
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
/**
 * 한 마리에게 허용하는 포획 시도 횟수.
 * 예전에는 가위바위보 단판으로 끝나서, 파티를 꾸리는 일이 순전히 운이었다
 * (첫 조우에서 지면 그 몬스터는 그냥 사라졌다). 몇 번은 더 붙어볼 수 있게 한다.
 */
const CATCH_ATTEMPTS = 3;
const RPS_RESULT_DATA: Record<RpsResult,{text:string; color:string; desc:string; bg:string}> = {
  win:  { text:"승리!", color:"text-moss-500", desc:"포획 확률 72%", bg:"from-moss-500/80 to-moss-500/40" },
  draw: { text:"무승부", color:"text-ember-500",  desc:"포획 확률 42%", bg:"from-ember-700/80 to-ember-700/40" },
  lose: { text:"패배...", color:"text-ember-500",   desc:"포획 확률 18%", bg:"from-ember-700/80 to-ember-700/40" },
};

/**
 * 구역별 채집 재료.
 *
 * 예전에는 세 구역이 같은 표(herb/berry/root/crystal/wood_plank/leather)를 썼는데,
 * 그러면 슬라임 추출물·마법 가루·몬스터 정수가 어느 드랍 테이블에도 없어
 * 아티팩트와 상급 물약을 아예 만들 수 없었다(퀘스트 1회 보상이 평생 전부였다).
 * 깊이 들어갈수록 상위 재료가 나오도록 구역별로 나눠, 제작·모루가 실제로 돌아가게 한다.
 */
const AREA_MATERIAL_POOL: Record<string, string[]> = {
  shallow: ["herb", "herb", "berry", "root", "wood_plank", "leather", "slime_extract"],
  deep:    ["herb", "berry", "root", "crystal", "wood_plank", "leather",
            "slime_extract", "iron_fragment", "magic_dust"],
  ancient: ["herb", "root", "crystal", "crystal", "iron_fragment",
            "magic_dust", "monster_essence", "monster_essence", "enhancement_stone"],
};

function pickMonster(area: ForestArea, elite = false) {
  const pool = elite
    ? area.monsterPool.slice(-2) // 강적은 풀 후반부
    : area.monsterPool;
  const id = pool[Math.floor(Math.random()*pool.length)];
  const base = monsters.find((m)=>m.id===id)!;
  const lvMin = elite ? Math.floor((area.levelRange[0]+area.levelRange[1])/2) : area.levelRange[0];
  const level = lvMin + Math.floor(Math.random()*(area.levelRange[1]-lvMin+1));
  return scaleToLevel(base, level);
}
function rollDrop(area: ForestArea): {id:string; count:number}|null {
  if (Math.random()>area.materialRate) return null;
  const pool = AREA_MATERIAL_POOL[area.id] ?? AREA_MATERIAL_POOL.shallow;
  const id = pool[Math.floor(Math.random()*pool.length)];
  const count = 1 + area.materialBonus + (Math.random()<.3?1:0);
  return { id, count };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 노드 맵 생성
// ═══════════════════════════════════════════════════════════════════════════════

function weightedPick<T>(weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) { r -= w; if (r <= 0) return v; }
  return weights[weights.length - 1][0];
}

// ── 탐험 맵 디버그 (true 시 노드 id/좌표 표시) ─────────────────────────────────
const SHOW_EXPLORE_MAP_DEBUG = false;

function generateDungeon(_area: ForestArea): ForestNode[] {
  // 탐험마다 랜덤 총 컬럼 수 (6~8)
  const TOTAL_COLS = 6 + Math.floor(Math.random() * 3); // 6, 7, 8
  const MAX_DEPTH  = TOTAL_COLS - 1;

  // 각 column(depth) 별 row 수: 시작·보스=1, 중간=2~4
  const depthCols = Array.from({ length: TOTAL_COLS }, (_, d) => {
    if (d === 0 || d === MAX_DEPTH) return 1;
    return 2 + Math.floor(Math.random() * 3); // 2~4
  });

  // 진행도 기반 노드 타입 가중치
  function colWeights(depth: number): [ForestNodeType, number][] {
    if (depth === 0)         return [["start",  1]];
    if (depth === MAX_DEPTH) return [["boss",   1]];
    const p = depth / MAX_DEPTH;
    if (p < 0.35) return [["battle",4],["material",3],["event",2],["rest",1]];
    if (p < 0.65) return [["battle",3],["material",3],["event",2],["rest",2]];
    // 후반: elite 비율 증가, rest 증가
    return [["battle",3],["material",2],["event",2],["rest",2],["elite",3]];
  }

  const nodes: ForestNode[] = [];
  let idCounter = 0;
  const depthNodes: ForestNode[][] = [];

  for (let depth = 0; depth <= MAX_DEPTH; depth++) {
    const cols = depthCols[depth];
    const layer: ForestNode[] = [];
    for (let col = 0; col < cols; col++) {
      layer.push({
        id:        `n${idCounter++}`,
        type:      weightedPick(colWeights(depth)),
        depth,
        col,
        totalCols: cols,
        nextIds:   [],
        cleared:   depth === 0,
        revealed:  depth === 0,
      });
    }
    depthNodes.push(layer);
    nodes.push(...layer);
  }

  // 연결: 가까운 row 우선 + 일부 랜덤 + 미연결 노드 보정
  for (let d = 0; d < MAX_DEPTH; d++) {
    const curr = depthNodes[d];
    const next = depthNodes[d + 1];
    const assigned = new Set<string>();

    for (const cn of curr) {
      const closestIdx = Math.round(
        (cn.col / Math.max(cn.totalCols - 1, 1)) * (next.length - 1)
      );
      const closest = next[closestIdx];
      cn.nextIds.push(closest.id);
      assigned.add(closest.id);

      if (next.length > 1 && Math.random() < 0.45) {
        const others = next.filter(n => n.id !== closest.id);
        const extra  = others[Math.floor(Math.random() * others.length)];
        if (!cn.nextIds.includes(extra.id)) {
          cn.nextIds.push(extra.id);
          assigned.add(extra.id);
        }
      }
    }

    // 연결 없는 next 노드 보정 (항상 경로 존재 보장)
    for (const nn of next) {
      if (!assigned.has(nn.id)) {
        const src = curr[Math.floor(Math.random() * curr.length)];
        if (!src.nextIds.includes(nn.id)) src.nextIds.push(nn.id);
      }
    }
  }

  return nodes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 파티클 컴포넌트
// ═══════════════════════════════════════════════════════════════════════════════

function LeafParticles() {
  const [leaves] = useState(()=>Array.from({length:18},(_,i)=>({
    id:i,
    x: Math.random()*100,
    delay: Math.random()*10,
    dur: 7+Math.random()*7,
    size: 5+Math.random()*7,
    color: `rgba(${30+Math.floor(Math.random()*40)},${150+Math.floor(Math.random()*70)},${40+Math.floor(Math.random()*40)},${.5+Math.random()*.4})`,
    flip: Math.random()>.5,
  })));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {leaves.map(l=>(
        <div key={l.id} className="absolute" style={{
          left:`${l.x}%`, top:"-3%",
          width:l.size, height:l.size*.55,
          background:l.color,
          borderRadius:"50% 0 50% 0",
          animation:`${l.flip?"leafFallR":"leafFall"} ${l.dur}s linear ${l.delay}s infinite`,
        }}/>
      ))}
    </div>
  );
}

function FireflyParticles() {
  const [flies] = useState(()=>Array.from({length:22},(_,i)=>({
    id:i,
    x:Math.random()*100,
    y:20+Math.random()*65,
    delay:Math.random()*8,
    dur:4+Math.random()*5,
    size:2.5+Math.random()*2,
    hue:Math.random()>.5?"170,255,160":"220,255,120",
  })));
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
  const [crystals] = useState(()=>Array.from({length:16},(_,i)=>({
    id:i,
    x:5+Math.random()*90,
    y:10+Math.random()*80,
    delay:Math.random()*8,
    dur:3+Math.random()*5,
    size:3+Math.random()*4,
    hue:Math.random()>.5?"167,139,250":"196,181,253",
  })));
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

/** 고대숲 배경의 별. 렌더마다 뽑으면 상태가 바뀔 때마다 별 60개가 통째로 튀므로 한 번만 생성한다. */
function AncientStars() {
  const [stars] = useState(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 60,
        size: 1 + Math.random() * 1.5,
        opacity: 0.2 + Math.random() * 0.6,
        dur: 3 + Math.random() * 4,
        delay: Math.random() * 6,
      })),
  );

  return (
    <div className="absolute inset-0">
      {stars.map((s) => (
        <div key={s.id} className="absolute rounded-full bg-white"
          style={{
            left:`${s.left}%`, top:`${s.top}%`,
            width:s.size, height:s.size,
            opacity:s.opacity,
            animation:`crystalDrift ${s.dur}s ease-in-out ${s.delay}s infinite alternate`,
          }}/>
      ))}
    </div>
  );
}

function ForestBackground({ area }: { area: ForestArea | null }) {
  const a = area;
  const sky1 = a?.skyTop    ?? PALETTE.shadow900;
  const sky2 = a?.skyBottom ?? PALETTE.shadow700;
  const fog  = a?.fogColor  ?? rgba("moss500", 0.08);
  const gnd  = a?.groundColor ?? PALETTE.stone600;
  const ancient = a?.id==="ancient";
  const deep    = a?.id==="deep";

  // 나무 실루엣 2겹. 구역마다 다른 색을 줘야 "다른 숲에 왔다"가 읽힌다 —
  // 원경(far)은 하늘에 가까운 색, 근경(near)은 항상 가장 어두운 색으로 깊이를 만든다.
  const farTree  = ancient ? PALETTE.stone600 : deep ? PALETTE.shadow800 : PALETTE.shadow700;
  const nearTree = ancient ? PALETTE.earth500 : PALETTE.shadow900;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{
        background:`radial-gradient(ellipse at 50% 0%, ${sky1} 0%, ${sky2} 60%, ${PALETTE.shadow900} 100%)`,
      }}/>
      {ancient && <AncientStars />}
      <svg className="absolute bottom-32 left-0 w-full" viewBox="0 0 960 240" preserveAspectRatio="xMidYMax meet">
        {[[30,240,60,90],[85,240,45,120],[145,240,58,105],[210,240,50,130],[275,240,65,95],
          [345,240,42,125],[405,240,56,110],[465,240,52,118],[525,240,64,98],[595,240,46,122],
          [655,240,59,108],[715,240,52,114],[775,240,65,94],[835,240,44,126],[895,240,59,105],[950,240,52,112]]
          .map(([cx,by,hw,h],i)=>(
            <polygon key={i} points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
              fill={farTree}
              opacity={.7+Math.sin(i)*.1}/>
          ))}
      </svg>
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 320" preserveAspectRatio="xMidYMax meet">
        {[[-20,320,82,180],[75,320,70,200],[180,320,88,170],[300,320,74,190],[410,320,90,185],
          [520,320,66,205],[630,320,84,178],[740,320,76,195],[850,320,86,182],[960,320,72,198]]
          .map(([cx,by,hw,h],i)=>(
            <g key={i} style={{ animation:`treeSway ${3+i*.3}s ease-in-out ${i*.4}s infinite alternate` }}>
              <polygon points={`${cx-hw},${by} ${cx},${by-h} ${cx+hw},${by}`}
                fill={nearTree} opacity=".95"/>
              <polygon points={`${cx-hw*.3},${by} ${cx-hw*.08},${by-h*.65} ${cx},${by-h}`}
                fill={ancient?"rgba(168, 61, 31, .06)":deep?"rgba(92, 147, 150, .07)":"rgba(122, 132, 85, .07)"}/>
            </g>
          ))}
      </svg>
      <div className="absolute inset-x-0 bottom-24 h-40 pointer-events-none"
        style={{
          background:`linear-gradient(to top, ${gnd}cc 0%, ${fog} 60%, transparent 100%)`,
          animation:"fogDrift 8s ease-in-out infinite",
        }}/>
      <div className="absolute bottom-0 left-0 right-0 h-28"
        style={{ background:`linear-gradient(to top, ${gnd} 0%, ${gnd}cc 60%, transparent 100%)` }}/>
      <svg className="absolute bottom-24 left-0 w-full" viewBox="0 0 960 60" preserveAspectRatio="xMidYMax meet">
        {Array.from({length:32}).map((_,i)=>{
          const x=(i*31)+Math.sin(i*1.9)*9;
          const h=14+Math.sin(i*2.5)*9;
          const col = ancient?"rgba(168, 61, 31, .6)":deep?"rgba(92, 147, 150, .7)":"rgba(122, 132, 85, .8)";
          return (
            <g key={i}>
              <polygon points={`${x},60 ${x-5},${60-h} ${x+4},60`} fill={col}/>
              <polygon points={`${x+9},60 ${x+3},${60-h*.8} ${x+14},60`} fill={col} opacity=".7"/>
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: ancient
            ? "radial-gradient(ellipse 50% 25% at 50% 5%, rgba(168, 61, 31, .08) 0%, transparent 80%)"
            : deep
              ? "radial-gradient(ellipse 50% 20% at 50% 5%, rgba(92, 147, 150, .06) 0%, transparent 80%)"
              : "radial-gradient(ellipse 55% 22% at 50% 5%, rgba(122, 132, 85, .07) 0%, transparent 80%)",
        }}/>
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
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full pointer-events-none opacity-20 group-hover:opacity-35 transition-opacity"
        style={{ background:`radial-gradient(circle, ${area.accentColor}, transparent)` }}/>
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
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-pixel-sm font-bold tracking-widest" style={{ color:area.accentColor, opacity:.7 }}>
              {area.subtitle}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-pixel-md font-black" style={{ color:area.accentColor }}>{area.name}</h3>
            <span className="text-pixel-sm font-bold text-sand-300">
              {"★".repeat(area.danger)}{"☆".repeat(5-area.danger)}
            </span>
          </div>
          <p className="text-pixel-sm text-sand-300 leading-relaxed">{area.description}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {monsterTypes.map((t)=>(
              <span key={t}
                className={`border px-2 py-0.5 text-pixel-sm font-bold ${TYPE_COLOR[t]??TYPE_COLOR.normal}`}
                style={{ borderRadius:0, fontFamily:"var(--font-pixel)" }}>
                {TYPE_KO[t]??t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end shrink-0">
          <div className="text-right">
            <p className="text-pixel-sm text-earth-400 uppercase tracking-wider">레벨</p>
            <p className="text-pixel-sm font-bold" style={{ color:area.accentColor }}>
              {area.levelRange[0]}~{area.levelRange[1]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-pixel-sm text-earth-400 uppercase tracking-wider">맵 구조</p>
            <p className="text-pixel-sm font-bold text-sand-200">랜덤 생성</p>
          </div>
          <div className="mt-1 px-3 py-1.5 text-pixel-sm font-bold"
            style={{
              background:`linear-gradient(135deg, ${area.accentColor}30, ${area.accentColor}18)`,
              border:`2px solid ${area.accentColor}`,
              borderRadius: 0,
              color: area.accentColor,
              fontFamily: "var(--font-pixel)",
              fontSize: 12,
              boxShadow: `2px 2px 0 ${area.accentColor}60`,
            }}>
            탐험하기 →
          </div>
        </div>
      </div>
      {area.danger>=4 && (
        <div className="relative z-10 border-t px-5 py-2 text-pixel-sm font-bold flex items-center gap-1.5"
          style={{ borderColor:`${area.accentColor}30`, color:area.accentColor, background:`${area.accentColor}12` }}>
          <span>⚠</span><span>{area.recommendedText}</span>
        </div>
      )}
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
// 던전 맵 화면
// ═══════════════════════════════════════════════════════════════════════════════

// y 좌표 기준 정렬된 다음 노드 방향 라벨
function getNextDirLabel(index: number, total: number): string {
  if (total === 1) return "앞으로";
  if (total === 2) return index === 0 ? "위쪽 길" : "아래쪽 길";
  const labels = ["위쪽 길", "중앙 길", "아래쪽 길"];
  return labels[index] ?? `${index + 1}번 길`;
}

function DungeonMapScreen({
  nodes, currentNodeId, area, onSelectNode, onExit,
}: {
  nodes: ForestNode[];
  currentNodeId: string;
  area: ForestArea;
  onSelectNode: (nodeId: string) => void;
  onExit: () => void;
}) {
  const current    = nodes.find(n => n.id === currentNodeId)!;
  const nextNodes  = current.nextIds.map(id => nodes.find(n => n.id === id)!).filter(Boolean);
  const MAX_DEPTH  = Math.max(...nodes.map(n => n.depth));

  const clearedIds  = new Set(nodes.filter(n => n.cleared).map(n => n.id));
  const reachableIds = new Set(current.nextIds);

  // ── 가로형 SVG 좌표 (depth → x, col → y) ──────────────────────────────────
  const VW = 900, VH = 280;
  const PAD_X = 44, PAD_Y = 28;
  const nodeCoords = (node: ForestNode) => ({
    x: MAX_DEPTH === 0 ? VW / 2 : PAD_X + (node.depth / MAX_DEPTH) * (VW - PAD_X * 2),
    y: node.totalCols === 1 ? VH / 2 : PAD_Y + (node.col / (node.totalCols - 1)) * (VH - PAD_Y * 2),
  });

  // 다음 노드를 y 순으로 정렬 → 위/중/아래 라벨 부여
  const sortedNext = [...nextNodes].sort((a, b) => nodeCoords(a).y - nodeCoords(b).y);

  return (
    <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-3xl mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>

      {/* 헤더 */}
      <div className="text-center">
        <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-0.5">NODE MAP</p>
        <p className="text-title-sm font-black text-cream-100">{area.name} 탐험</p>
        <p className="text-pixel-sm text-sand-300">진행 {current.depth} / {MAX_DEPTH}</p>
      </div>

      {/* 가로 노드맵 */}
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background: "rgba(13, 18, 35, 0.88)",
          border: `1px solid ${area.borderGlow}`,
          backdropFilter: "blur(12px)",
        }}>

        {/* 수평 스크롤 컨테이너 */}
        <div className="overflow-x-auto">
          <div style={{ minWidth: 580 }}>
            <svg
              width="100%"
              viewBox={`0 0 ${VW} ${VH}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ display:"block", minWidth: 580 }}
            >
              {/* 연결선 (왼쪽 → 오른쪽) */}
              {nodes.map(node =>
                node.nextIds.map(nextId => {
                  const next = nodes.find(n => n.id === nextId);
                  if (!next) return null;
                  const from = nodeCoords(node);
                  const to   = nodeCoords(next);
                  const active = clearedIds.has(node.id);
                  return (
                    <line key={`${node.id}-${nextId}`}
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={active ? area.accentColor : "rgba(243, 229, 185, 0.08)"}
                      strokeWidth={active ? 1.5 : 0.8}
                      strokeDasharray={active ? "none" : "5 3"}
                      opacity={active ? 0.5 : 0.22}
                    />
                  );
                })
              )}

              {/* 노드 */}
              {nodes.map(node => {
                const { x, y } = nodeCoords(node);
                const isCurrent   = node.id === currentNodeId;
                const isCleared   = clearedIds.has(node.id);
                const isReachable = reachableIds.has(node.id);
                const meta  = NODE_META[node.revealed ? node.type : "start"];
                const dimmed = !isCurrent && !isCleared && !isReachable;

                return (
                  <g key={node.id}
                    style={{ cursor: isReachable ? "pointer" : "default" }}
                    onClick={() => isReachable && onSelectNode(node.id)}
                  >
                    {/* 현재 위치 펄스 링 */}
                    {isCurrent && (
                      <circle cx={x} cy={y} r={21}
                        fill="none" stroke={area.accentColor} strokeWidth={2} opacity={0.55}
                        style={{ animation:"pulseRing 2s ease-out infinite" }}/>
                    )}
                    {/* 도달 가능 강조 */}
                    {isReachable && !isCurrent && (
                      <circle cx={x} cy={y} r={19}
                        fill={area.accentColor} opacity={0.1}/>
                    )}
                    {/* 노드 원 */}
                    <circle cx={x} cy={y} r={15}
                      fill={isCleared ? meta.bg : isReachable ? "rgba(243, 229, 185, 0.06)" : "rgba(243, 229, 185, 0.02)"}
                      stroke={isCurrent ? area.accentColor : isReachable ? meta.color : "rgba(243, 229, 185, 0.12)"}
                      strokeWidth={isCurrent ? 2.5 : isReachable ? 1.5 : 0.8}
                      opacity={dimmed ? 0.22 : 1}
                    />
                    {/* 아이콘 */}
                    <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                      fontSize={node.revealed ? 11 : 12}
                      opacity={dimmed ? 0.22 : 1}
                      style={{ userSelect:"none", pointerEvents:"none" }}>
                      {node.revealed ? meta.icon : (isReachable ? "?" : "·")}
                    </text>
                    {/* BOSS 라벨 */}
                    {node.type === "boss" && node.revealed && (
                      <text x={x} y={y + 25} textAnchor="middle" dominantBaseline="middle"
                        fontSize={7} fill={PALETTE.ember500} opacity={0.8}
                        style={{ userSelect:"none", pointerEvents:"none" }}>
                        BOSS
                      </text>
                    )}
                    {/* 디버그 */}
                    {SHOW_EXPLORE_MAP_DEBUG && (
                      <text x={x} y={y - 20} textAnchor="middle" fontSize={6} fill={PALETTE.sand300}
                        style={{ userSelect:"none", pointerEvents:"none" }}>
                        {node.id}({node.depth},{node.col})
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 범례 */}
        <div className="px-4 pb-3 flex flex-wrap gap-x-3 gap-y-1">
          {(["battle","material","event","rest","elite","boss"] as ForestNodeType[]).map(t => {
            const m = NODE_META[t];
            return (
              <div key={t} className="flex items-center gap-1">
                <span className="text-pixel-sm">{m.icon}</span>
                <span className="text-pixel-sm text-earth-400">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 이동 선택 버튼 (y 좌표 순 정렬 → 위/중/아래 라벨) */}
      {sortedNext.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-pixel-sm text-sand-300 text-center">어느 방향으로 탐사하시겠습니까?</p>
          <div className={`grid gap-2 ${
            sortedNext.length === 1 ? "grid-cols-1" :
            sortedNext.length === 2 ? "grid-cols-2" : "grid-cols-3"
          }`}>
            {sortedNext.map((node, i) => (
              <button key={node.id}
                onClick={() => onSelectNode(node.id)}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 transition-all active:scale-95"
                style={{
                  background: "rgba(243, 229, 185, 0.04)",
                  border: `1.5px solid ${area.accentColor}50`,
                  color: area.accentColor,
                }}>
                <span className="text-pixel-md">🌫️</span>
                <span className="text-pixel-sm font-bold">
                  {getNextDirLabel(i, sortedNext.length)}
                </span>
                <span className="text-pixel-sm text-earth-400">미지의 공간</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 귀환 */}
      <button onClick={onExit}
        className="w-full rounded-xl border border-stone-600 bg-shadow-800/60 py-2.5 text-pixel-sm text-sand-300 hover:text-sand-200 transition">
        ← 숲 떠나기
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 탐험 중 화면
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
        <div className="flex gap-3 justify-center mt-3">
          {Array.from({length:5}).map((_,i)=>(
            <div key={i} className="text-title-sm transition-opacity duration-200"
              style={{ opacity: i<=dots ? .9 : .2, animation:i===dots?"pathWalk .4s ease infinite":"none" }}>
              👣
            </div>
          ))}
        </div>
      </div>
      <div className="text-center">
        <p className="text-pixel-sm uppercase tracking-widest mb-2" style={{ color:area.accentColor, opacity:.7 }}>
          {area.subtitle}
        </p>
        <p className="text-pixel-md font-black text-cream-100 mb-1">이동 중<span style={{ display:"inline-block", minWidth:"2.5ch", textAlign:"left" }}>{".".repeat(dots+1)}</span></p>
        <p className="text-pixel-sm text-sand-300">미지의 공간으로 향하고 있습니다</p>
      </div>
      <div className="w-full h-1 rounded-full bg-shadow-700 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{
            width:`${Math.min((step/(area.exploreTime/400*.8))*100,95)}%`,
            background:`linear-gradient(to right, ${area.accentColor}80, ${area.accentColor})`,
          }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 노드 도착 공개 화면
// ═══════════════════════════════════════════════════════════════════════════════

function NodeArrivedScreen({ node, onContinue }: {
  node: ForestNode; area: ForestArea; onContinue: () => void;
}) {
  const meta = NODE_META[node.type];
  return (
    <div className="relative z-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4"
      style={{ animation:"fadeInScale .4s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden text-center"
        style={{
          background:"rgba(13, 18, 35, 0.88)",
          border:`1px solid ${meta.color}50`,
          backdropFilter:"blur(14px)",
        }}>
        <div className="px-6 pt-8 pb-4" style={{ background:`linear-gradient(to bottom, ${meta.bg}, transparent)` }}>
          <div className="text-pixel-lg mb-3" style={{ animation:"nodeReveal .6s ease both" }}>{meta.icon}</div>
          <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-1">ARRIVED</p>
          <p className="text-pixel-md font-black" style={{ color: meta.color }}>{meta.label} 구역</p>
          <p className="text-pixel-sm text-sand-300 mt-2">
            {node.type === "battle"   && "야생 몬스터가 기다리고 있습니다!"}
            {node.type === "material" && "희귀 재료를 발견했습니다!"}
            {node.type === "event"    && "수상한 기운이 감돌고 있습니다..."}
            {node.type === "rest"     && "아늑한 모닥불이 보입니다."}
            {node.type === "elite"    && "강력한 존재가 느껴집니다..."}
            {node.type === "boss"     && "깊은 숲의 주인이 깨어났다!"}
          </p>
        </div>
        <div className="px-6 pb-6 pt-2">
          <button onClick={onContinue}
            className="w-full rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${meta.color}25, ${meta.color}10)`,
              border:`1.5px solid ${meta.color}60`,
              color: meta.color,
            }}>
            {node.type === "rest" ? "휴식하기" : "진입하기"} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 휴식 화면
// ═══════════════════════════════════════════════════════════════════════════════

function RestScreen({ onContinue }: { area: ForestArea; onContinue: () => void }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background:"rgba(13, 18, 35, 0.85)",
          border:"1px solid rgba(233, 148, 65, 0.35)",
          backdropFilter:"blur(14px)",
        }}>
        <div className="px-6 pt-7 pb-5 text-center" style={{ background:"linear-gradient(to bottom, rgba(233, 148, 65, 0.08), transparent)" }}>
          <div className="text-pixel-lg mb-3" style={{ animation:"monsterFloat 3s ease-in-out infinite" }}>🔥</div>
          <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-1">REST AREA</p>
          <p className="text-pixel-md font-black text-cream-100">모닥불 휴식처</p>
          <p className="text-pixel-sm text-sand-300 mt-2 leading-relaxed">
            숲 한가운데서 모닥불을 발견했다.<br/>
            잠시 쉬어가며 체력을 회복했다.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl p-3"
            style={{ background:"rgba(233, 148, 65, 0.08)", border:"1px solid rgba(233, 148, 65, 0.2)" }}>
            <span className="text-pixel-md">💚</span>
            <p className="text-pixel-sm text-ember-500 font-semibold">HP 소량 회복 (구현 예정)</p>
          </div>
          <button onClick={onContinue}
            className="w-full rounded-xl py-3 text-pixel-sm font-bold transition active:scale-95"
            style={{
              background:"linear-gradient(135deg, rgba(233, 148, 65, 0.2), rgba(233, 148, 65, 0.08))",
              border:"1.5px solid rgba(233, 148, 65, 0.5)",
              color:PALETTE.ember500,
            }}>
            계속 탐험하기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 이벤트 화면
// ═══════════════════════════════════════════════════════════════════════════════

const EVENTS = [
  { icon:"🍄", title:"수상한 버섯", desc:"독버섯인지 약초인지 모를 버섯이 자라고 있다.", reward:"별 일 없이 지나쳤다." },
  { icon:"🗺️", title:"낡은 지도 조각", desc:"누군가 버린 지도 조각을 발견했다.", reward:"어딘가 도움이 될 것 같다." },
  { icon:"🕳️", title:"의문의 구덩이", desc:"땅에 구멍이 뚫려 있다. 무언가 살고 있을지도.", reward:"조심스럽게 우회했다." },
  { icon:"🌸", title:"빛나는 꽃밭", desc:"이 깊은 숲에 꽃이 피어 있다. 기이한 일이다.", reward:"아름다운 광경에 기분이 나아졌다." },
  { icon:"👻", title:"정체불명의 기운", desc:"차가운 바람이 불어왔다. 뭔가 있는 것 같다.", reward:"두렵지만 계속 나아갔다." },
];

function EventScreen({ onContinue }: { area: ForestArea; onContinue: () => void }) {
  const [ev] = useState(() => EVENTS[Math.floor(Math.random() * EVENTS.length)]);
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
      style={{ animation:"fadeInScale .4s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background:"rgba(13, 18, 35, 0.88)",
          border:"1px solid rgba(92, 147, 150, 0.35)",
          backdropFilter:"blur(14px)",
        }}>
        <div className="px-6 pt-7 pb-4 text-center" style={{ background:"linear-gradient(to bottom, rgba(92, 147, 150, 0.08), transparent)" }}>
          <div className="text-pixel-lg mb-3" style={{ animation:"monsterFloat 3.5s ease-in-out infinite" }}>{ev.icon}</div>
          <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-1">RANDOM EVENT</p>
          <p className="text-pixel-md font-black text-mist-300">{ev.title}</p>
          <p className="text-pixel-sm text-sand-300 mt-2 leading-relaxed">{ev.desc}</p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-3">
          <div className="rounded-xl p-3 text-pixel-sm text-sand-200"
            style={{ background:"rgba(92, 147, 150, 0.06)", border:"1px solid rgba(92, 147, 150, 0.15)" }}>
            결과: {ev.reward}
          </div>
          <button onClick={onContinue}
            className="w-full rounded-xl py-3 text-pixel-sm font-bold transition active:scale-95"
            style={{
              background:"linear-gradient(135deg, rgba(92, 147, 150, 0.2), rgba(92, 147, 150, 0.08))",
              border:"1.5px solid rgba(92, 147, 150, 0.5)",
              color:PALETTE.mist300,
            }}>
            계속 탐험하기 →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 보스 클리어 화면
// ═══════════════════════════════════════════════════════════════════════════════

function BossClearedScreen({ area, onExit }: { area: ForestArea; onExit: () => void }) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
      style={{ animation:"fadeInScale .5s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden text-center"
        style={{
          background:"rgba(13, 18, 35, 0.9)",
          border:"2px solid rgba(168, 61, 31, 0.5)",
          backdropFilter:"blur(16px)",
          boxShadow:"0 0 40px rgba(168, 61, 31, 0.2)",
        }}>
        <div className="px-6 pt-8 pb-6" style={{ background:"linear-gradient(to bottom, rgba(168, 61, 31, 0.12), transparent)" }}>
          <div className="text-pixel-lg mb-4" style={{ animation:"nodeReveal .8s ease both" }}>🏆</div>
          <p className="text-pixel-sm uppercase tracking-widest text-ember-500 mb-1">DUNGEON CLEARED</p>
          <p className="text-title-md font-black text-cream-100 mb-2">{area.name} 정복!</p>
          <p className="text-pixel-sm text-sand-300 leading-relaxed">
            깊은 숲의 끝까지 탐사했습니다.<br/>모든 비밀을 밝혀냈습니다.
          </p>
        </div>
        <div className="px-6 pb-8">
          <button onClick={onExit}
            className="w-full rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
            style={{
              background:"linear-gradient(135deg, rgba(168, 61, 31, 0.3), rgba(168, 61, 31, 0.12))",
              border:"2px solid rgba(168, 61, 31, 0.6)",
              color:PALETTE.ember500,
              boxShadow:"0 4px 20px rgba(168, 61, 31, 0.2)",
            }}>
            베이스캠프로 귀환
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 아이템 드롭 화면
// ═══════════════════════════════════════════════════════════════════════════════

function ItemDropScreen({ drops, area, onContinue, onExit }: {
  drops:{id:string;count:number}[]; area:ForestArea; onContinue:()=>void; onExit:()=>void;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-md w-full mx-4"
      style={{ animation:"slideInUp .5s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background:"rgba(13, 18, 35, 0.82)",
          border:`1px solid ${area.accentColor}40`,
          backdropFilter:"blur(14px)",
        }}>
        <div className="px-6 pt-6 pb-4 text-center"
          style={{ background:`linear-gradient(to bottom, ${area.glowColor}, transparent)` }}>
          <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-1">ITEM FOUND</p>
          <p className="text-pixel-md font-black text-cream-100">재료 발견!</p>
        </div>
        <div className="px-6 pb-2 flex flex-col gap-3">
          {drops.map((d,i)=>{
            const mat = getMaterial(d.id);
            return (
              <div key={i} className="flex items-center gap-4 rounded-xl p-4"
                style={{
                  background:"rgba(243, 229, 185, 0.04)",
                  border:"1px solid rgba(243, 229, 185, 0.07)",
                  animation:`itemDrop .4s ease ${i*.12}s both`,
                }}>
                <div className="text-pixel-lg" style={{ filter:"drop-shadow(0 0 8px rgba(233, 148, 65, .4))" }}>
                  {mat?.emoji ?? "🌿"}
                </div>
                <div className="flex-1">
                  <p className="text-title-sm font-bold text-cream-100">{mat?.name ?? d.id}</p>
                  <p className="text-pixel-sm text-sand-300">{mat?.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-pixel-md font-black font-mono"
                    style={{ color:area.accentColor, animation:"numberPop .5s ease both" }}>
                    ×{d.count}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 px-6 pb-6 mt-2">
          <button onClick={onContinue}
            className="flex-1 rounded-xl py-3 text-pixel-sm font-bold transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${area.accentColor}25, ${area.accentColor}12)`,
              border:`1px solid ${area.accentColor}55`,
              color:area.accentColor,
            }}>
            계속 탐험
          </button>
          <button onClick={onExit}
            className="flex-1 rounded-xl border border-stone-600 bg-shadow-800/60 py-3 text-pixel-sm text-sand-300 hover:bg-shadow-700/80 transition active:scale-95">
            귀환
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 몬스터 조우 화면
// ═══════════════════════════════════════════════════════════════════════════════

function EncounterScreen({ monster, area, drops, isElite, onCapture, onFlee }: {
  monster: ReturnType<typeof pickMonster>;
  area: ForestArea;
  drops: {id:string;count:number}[];
  isElite: boolean;
  onCapture:()=>void; onFlee:()=>void;
}) {
  const glow = TYPE_GLOW[monster.type ?? "normal"] ?? TYPE_GLOW.normal;
  const typeColor = TYPE_COLOR[monster.type ?? "normal"] ?? TYPE_COLOR.normal;
  const typeKo = TYPE_KO[monster.type ?? "normal"] ?? monster.type;

  return (
    <div className="relative z-10 w-full max-w-sm mx-4 flex flex-col gap-0"
      style={{ animation:"fadeInScale .45s ease both" }}>
      <div className="text-center mb-4">
        <div className="inline-block text-pixel-lg mb-1"
          style={{ animation:"encounterFlash .6s ease both" }}>
          {isElite ? "💀" : "❕"}
        </div>
        <p className="text-pixel-sm uppercase tracking-[.25em] text-sand-300">
          {isElite ? "ELITE ENCOUNTER" : "WILD ENCOUNTER"}
        </p>
      </div>
      <div className="rounded-2xl overflow-hidden"
        style={{
          background:"rgba(13, 18, 35, 0.85)",
          border:`1px solid ${isElite ? "rgba(132, 75, 63, 0.5)" : area.borderGlow}`,
          backdropFilter:"blur(16px)",
          boxShadow:`0 0 40px ${isElite ? "rgba(132, 75, 63, 0.2)" : area.glowColor}, inset 0 0 30px rgba(13, 18, 35, .5)`,
        }}>
        <div className="relative flex items-center justify-center py-8"
          style={{ background:`radial-gradient(ellipse at 50% 60%, ${glow} 0%, transparent 70%)` }}>
          <div className="absolute rounded-full"
            style={{
              width:140, height:140,
              background:`radial-gradient(circle, transparent 45%, ${glow} 60%, transparent 75%)`,
              animation:"auraBreath 2.5s ease-in-out infinite",
            }}/>
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
        <div className="px-5 pb-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-pixel-md font-black text-cream-100">{monster.name}</p>
              <p className="text-pixel-sm text-sand-300 mt-0.5">
                {isElite ? "강적 · " : "야생 몬스터 · "}{area.name}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="rounded-full bg-shadow-700 border border-stone-600 px-2.5 py-1">
                <span className="text-pixel-sm font-bold text-sand-200">Lv.<span className="text-cream-100 font-black">{monster.level}</span></span>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-pixel-sm font-bold ${typeColor}`}>
                {typeKo}
              </span>
            </div>
          </div>
          {drops.length>0 && (
            <div className="flex items-center gap-2 rounded-xl p-2.5"
              style={{ background:"rgba(233, 148, 65, .06)", border:"1px solid rgba(233, 148, 65, .15)" }}>
              <span className="text-title-sm">🌿</span>
              <p className="text-pixel-sm text-ember-500 font-semibold">
                {drops.map((d)=>`${getMaterial(d.id)?.emoji??"🌿"} ${getMaterial(d.id)?.name??d.id} ×${d.count}`).join("  ")} 획득!
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onCapture}
              className="flex-1 rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
              style={{
                background:`linear-gradient(135deg, ${area.accentColor}35 0%, ${area.accentColor}18 100%)`,
                border:`1.5px solid ${area.accentColor}70`,
                color:area.accentColor,
                boxShadow:`0 4px 20px ${area.glowColor}`,
              }}>
              포획 시도
            </button>
            <button onClick={onFlee}
              className="flex-1 rounded-xl border border-stone-600/80 bg-shadow-800/70 py-3 text-pixel-sm font-bold text-sand-300 hover:text-sand-200 hover:bg-shadow-700/80 transition active:scale-95">
              도망가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 가위바위보 화면들
// ═══════════════════════════════════════════════════════════════════════════════

const RPS_CARD_STYLES: Record<RpsChoice, { border: string; shadow: string; label: string; bg: string }> = {
  scissors: { border:PALETTE.ember700, shadow:"rgba(168, 61, 31, .35)", label:"가위", bg:"rgba(168, 61, 31, .1)" },
  rock:     { border:PALETTE.stone600, shadow:"rgba(66, 61, 70, .35)", label:"바위", bg:"rgba(66, 61, 70, .1)" },
  paper:    { border:PALETTE.ember500, shadow:"rgba(233, 148, 65, .35)", label:"보",  bg:"rgba(233, 148, 65, .1)" },
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
      <div className="text-center">
        <p className="text-pixel-sm uppercase tracking-[.2em] text-sand-300 mb-1">CATCH ATTEMPT</p>
        <p className="text-pixel-md font-black text-cream-100">가위바위보!</p>
      </div>
      <div className="flex items-center gap-3 rounded-xl px-4 py-2.5"
        style={{ background:"rgba(13, 18, 35, .8)", border:`1px solid ${area.borderGlow}`, backdropFilter:"blur(10px)" }}>
        <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.name}
          className="w-10 h-10 object-contain" style={monsterImgStyle(monster.id)}/>
        <div>
          <p className="text-pixel-sm font-bold text-cream-100">{monster.name}</p>
          <p className="text-pixel-sm text-sand-300">Lv.{monster.level} · {TYPE_KO[monster.type ?? "normal"]??monster.type}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 text-pixel-sm text-earth-400">
          <span>이기면 <span className="text-moss-500 font-bold">72%</span></span>
          <span>비기면 <span className="text-ember-500 font-bold">42%</span></span>
          <span>지면 <span className="text-ember-500 font-bold">18%</span></span>
        </div>
      </div>
      <div className="flex gap-4 w-full">
        {choices.map((c)=>{
          const st = RPS_CARD_STYLES[c];
          const isHov = hovered===c;
          return (
            <button key={c}
              onClick={()=>onSelect(c)}
              onMouseEnter={()=>setHovered(c)}
              onMouseLeave={()=>setHovered(null)}
              className="flex-1 flex flex-col items-center gap-3 rounded-2xl py-5 px-2 transition-all duration-150"
              style={{
                background: isHov ? `linear-gradient(145deg, ${st.bg.replace('.1','.22')}, ${st.bg})` : `linear-gradient(145deg, ${st.bg}, rgba(13, 18, 35, .2))`,
                border:`1.5px solid ${isHov ? st.border : `${st.border}60`}`,
                boxShadow: isHov ? `0 8px 28px ${st.shadow}, 0 0 0 1px ${st.border}40` : "none",
                transform: isHov ? "translateY(-6px) scale(1.04)" : "none",
              }}>
              <RpsIcon choice={c} className="w-16 h-16" active={isHov}/>
              <span className="text-pixel-sm font-black text-sand-200">{st.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-pixel-sm text-earth-400 -mt-2">클릭해서 선택하세요</p>
    </div>
  );
}

function RpsResultScreen({ pChoice, cChoice, rpsResult, phase, wildMonster, catchSuccess, catchPlace, triesLeft, onRetry, onContinue, onExit }: {
  pChoice:RpsChoice; cChoice:RpsChoice; rpsResult:RpsResult;
  phase: "rps_result"|"catch_result";
  wildMonster: ReturnType<typeof pickMonster>|null;
  catchSuccess:boolean|null; catchPlace:"storage"|"full"|null;
  triesLeft:number; onRetry:()=>void;
  onContinue:()=>void; onExit:()=>void;
}) {
  const [showComp, setShowComp] = useState(false);
  useEffect(()=>{ const t = setTimeout(()=>setShowComp(true), 700); return ()=>clearTimeout(t); },[]);
  const res = RPS_RESULT_DATA[rpsResult];
  const winnerIsPlayer = rpsResult==="win";
  const winnerIsComp   = rpsResult==="lose";
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-md mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{ background:"rgba(13, 18, 35, 0.88)", border:"1px solid rgba(243, 229, 185, 0.08)", backdropFilter:"blur(16px)" }}>
        {phase==="catch_result" && (
          <div className={`px-6 py-4 text-center bg-gradient-to-b ${res.bg}`}>
            <p className={`text-title-md font-black ${res.color}`} style={{ animation:"numberPop .5s ease both" }}>{res.text}</p>
            <p className="text-pixel-sm text-sand-300 mt-0.5">{res.desc}</p>
          </div>
        )}
        <div className="flex items-center gap-3 px-6 py-5 justify-center">
          <div className={`flex flex-col items-center gap-2 flex-1 transition-all ${winnerIsPlayer?"scale-105":""}`}>
            <p className="text-pixel-sm uppercase tracking-widest text-sand-300">나</p>
            <div className="rounded-2xl p-4 transition-all"
              style={{
                background: winnerIsPlayer?"rgba(122, 132, 85, .12)":"rgba(243, 229, 185, .04)",
                border: winnerIsPlayer?"1px solid rgba(122, 132, 85, .4)":"1px solid rgba(243, 229, 185, .06)",
                boxShadow: winnerIsPlayer?"0 0 20px rgba(122, 132, 85, .15)":"none",
              }}>
              <RpsIcon choice={pChoice} className="w-16 h-16" active={winnerIsPlayer}/>
            </div>
            <p className="text-pixel-sm font-bold text-sand-200">{RPS_KO[pChoice]}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-pixel-md font-black text-earth-400">VS</p>
            {phase==="rps_result" && !showComp && (
              <p className="text-pixel-sm text-earth-400 animate-pulse">공개 중...</p>
            )}
          </div>
          <div className={`flex flex-col items-center gap-2 flex-1 transition-all ${winnerIsComp?"scale-105":""}`}>
            <p className="text-pixel-sm uppercase tracking-widest text-sand-300">{wildMonster?.name??"몬스터"}</p>
            <div className="rounded-2xl p-4 transition-all overflow-hidden"
              style={{
                background: winnerIsComp?"rgba(233, 148, 65, .12)":"rgba(243, 229, 185, .04)",
                border: winnerIsComp?"1px solid rgba(233, 148, 65, .4)":"1px solid rgba(243, 229, 185, .06)",
                opacity: showComp?1:0,
                animation: showComp?"rpsReveal .4s ease both":"none",
              }}>
              <RpsIcon choice={cChoice} className="w-16 h-16" active={winnerIsComp}/>
            </div>
            <p className={`text-pixel-sm font-bold text-sand-200 transition-opacity ${showComp?"opacity-100":"opacity-0"}`}>{RPS_KO[cChoice]}</p>
          </div>
        </div>
        {phase==="rps_result" && showComp && (
          <div className="px-6 pb-5 text-center">
            <p className={`text-title-sm font-black ${res.color}`}>{res.text}</p>
            <p className="text-pixel-sm text-earth-400 mt-1 animate-pulse">포획 시도 중...</p>
          </div>
        )}
        {phase==="catch_result" && catchSuccess!==null && (
          <div className="px-6 pb-6 flex flex-col items-center gap-4">
            {catchSuccess ? (
              <>
                <div className="relative flex items-center justify-center w-full">
                  <div className="absolute rounded-full"
                    style={{ width:80, height:80, background:"rgba(122, 132, 85, .15)", animation:"successBurst .8s ease both" }}/>
                  {wildMonster && (
                    <img src={MONSTER_IMAGE_MAP[wildMonster.id]} alt={wildMonster.name}
                      className="relative w-20 h-20 object-contain"
                      style={{ ...monsterImgStyle(wildMonster?.id??""), animation:"catchBounce .6s ease 2", filter:"drop-shadow(0 0 12px rgba(122, 132, 85, .5))" }}/>
                  )}
                  {Array.from({length:6}).map((_,i)=>(
                    <div key={i} className="absolute text-title-sm"
                      style={{ animation:`starTwinkle .8s ease ${i*.12}s both`, left:`${20+i*12}%`, top:`${10+Math.sin(i)*40}%` }}>✦</div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-pixel-md font-black text-moss-500" style={{ filter:"drop-shadow(0 0 8px rgba(122, 132, 85, .5))" }}>포획 성공! 🎉</p>
                  <p className="text-pixel-sm text-sand-300 mt-1">
                    {wildMonster?.name}이(가){" "}{catchPlace==="storage"?"농장 보관함에 저장되었습니다!":"농장이 가득 차서 놓아줬습니다..."}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-pixel-lg" style={{ animation:"catchShakeX .6s ease" }}>💨</div>
                <div className="text-center">
                  <p className="text-pixel-md font-black text-ember-500">
                    {triesLeft > 0 ? "놓쳤다!" : "도망쳤다..."}
                  </p>
                  <p className="text-pixel-sm text-sand-300 mt-1">
                    {triesLeft > 0
                      ? `${wildMonster?.name}이(가) 아직 근처에 있다. (남은 시도 ${triesLeft}회)`
                      : `${wildMonster?.name}이(가) 사라졌습니다.`}
                  </p>
                </div>
              </>
            )}
            <div className="flex gap-3 w-full">
              {!catchSuccess && triesLeft > 0 && (
                <button onClick={onRetry}
                  className="flex-1 rounded-xl py-2.5 text-pixel-sm font-bold transition active:scale-95"
                  style={{
                    background: "rgba(122, 132, 85, .18)",
                    border: "1px solid rgba(122, 132, 85, .5)",
                    color: PALETTE.moss500,
                  }}>
                  다시 시도 ({triesLeft})
                </button>
              )}
              <button onClick={onContinue}
                className="flex-1 rounded-xl py-2.5 text-pixel-sm font-bold transition active:scale-95"
                style={{
                  background:"linear-gradient(135deg, rgba(122, 132, 85, .18), rgba(122, 132, 85, .08))",
                  border:"1px solid rgba(122, 132, 85, .45)",
                  color:PALETTE.moss500,
                }}>
                계속 탐험
              </button>
              <button onClick={onExit}
                className="flex-1 rounded-xl border border-stone-600 bg-shadow-800/60 py-2.5 text-pixel-sm text-sand-300 hover:bg-shadow-700/80 transition active:scale-95">
                귀환
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

  // 던전 상태
  const [dungeonNodes, setDungeonNodes] = useState<ForestNode[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>("n0");
  const [pendingNodeId, setPendingNodeId] = useState<string|null>(null);

  // 기존 전투/드롭 상태
  const [wildMonster, setWildMonster] = useState<ReturnType<typeof pickMonster>|null>(null);
  const [isElite, setIsElite]         = useState(false);
  const [pChoice, setPChoice]         = useState<RpsChoice|null>(null);
  const [cChoice, setCChoice]         = useState<RpsChoice|null>(null);
  const [rpsResult, setRpsResult]     = useState<RpsResult|null>(null);
  const [catchSuccess, setCatchSuccess] = useState<boolean|null>(null);
  /** 지금 조우한 몬스터에게 남은 포획 시도 횟수 */
  const [catchTriesLeft, setCatchTriesLeft] = useState(CATCH_ATTEMPTS);
  const [catchPlace, setCatchPlace]   = useState<"storage"|"full"|null>(null);
  const [drops, setDrops]             = useState<{id:string;count:number}[]>([]);
  const rpsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (rpsTimerRef.current) clearTimeout(rpsTimerRef.current); }, []);

  // 구역 선택 → 던전 생성
  const handleEnterArea = (a: ForestArea) => {
    const nodes = generateDungeon(a);
    setArea(a);
    setDungeonNodes(nodes);
    setCurrentNodeId(nodes.find(n => n.depth === 0)!.id);
    setPhase("dungeon");
  };

  // 맵에서 노드 선택
  const handleSelectNode = (nodeId: string) => {
    setPendingNodeId(nodeId);
    setPhase("exploring");
  };

  // 이동 완료 → 노드 공개
  useEffect(() => {
    if (phase !== "exploring" || !pendingNodeId || !area) return;
    const t = setTimeout(() => {
      // 노드 revealed = true
      setDungeonNodes(prev => prev.map(n =>
        n.id === pendingNodeId ? { ...n, revealed: true } : n
      ));
      setCurrentNodeId(pendingNodeId);
      setPendingNodeId(null);
      setPhase("node_arrived");
    }, area.exploreTime);
    return () => clearTimeout(t);
  }, [phase, pendingNodeId, area]);

  // 현재 노드를 클리어 처리. handleEnterNode보다 먼저 선언해야 한다 —
  // 뒤에 두면 선언 전 참조(TDZ)가 되어, 렌더 중 호출되는 경로가 하나라도 생기면 즉시 터진다.
  const markCleared = useCallback(() => {
    setDungeonNodes(prev => prev.map(n =>
      n.id === currentNodeId ? { ...n, cleared: true } : n
    ));
  }, [currentNodeId]);

  // 노드 도착 후 진입
  const handleEnterNode = useCallback(() => {
    const node = dungeonNodes.find(n => n.id === currentNodeId);
    if (!node || !area) return;

    if (node.type === "rest") { setPhase("rest"); return; }
    if (node.type === "event") { setPhase("event"); return; }
    if (node.type === "material") {
      const collected: {id:string;count:number}[] = [];
      const d1 = rollDrop(area); if (d1) collected.push(d1);
      const d2 = rollDrop(area); if (d2 && d2.id !== d1?.id) collected.push(d2);
      if (collected.length > 0) {
        collected.forEach(d => addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("item_drop");
      } else {
        markCleared();
        setPhase("dungeon");
      }
      return;
    }
    if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
      const elite = node.type === "elite" || node.type === "boss";
      const mon = pickMonster(area, elite);
      const collected: {id:string;count:number}[] = [];
      const d = rollDrop(area); if (d) { collected.push(d); collected.forEach(dd => addMaterial(dd.id, dd.count)); }
      setDrops(collected);
      setWildMonster(mon);
      setIsElite(elite);
      setCatchTriesLeft(CATCH_ATTEMPTS);
      addToDexSeen(mon.id);
      setPhase("encounter");
      return;
    }
  }, [dungeonNodes, currentNodeId, area, addMaterial, addToDexSeen, markCleared]);

  // 노드 처리 완료 → 맵으로 복귀 or 던전 완료
  const returnToMap = useCallback(() => {
    markCleared();
    const node = dungeonNodes.find(n => n.id === currentNodeId);
    if (node?.type === "boss") {
      setPhase("boss_cleared");
      return;
    }
    // 다음 노드가 없으면 완료
    if (!node?.nextIds?.length) { setPhase("boss_cleared"); return; }
    setPhase("dungeon");
  }, [markCleared, dungeonNodes, currentNodeId]);

  const handleRps = (choice: RpsChoice) => {
    const comp = getComputerChoice();
    const res = getRpsResult(choice, comp);
    setPChoice(choice); setCChoice(comp); setRpsResult(res);
    setPhase("rps_result");
    rpsTimerRef.current = setTimeout(()=>{
      rpsTimerRef.current = null;
      const ok = Math.random()<CATCH_RATE[res];
      setCatchSuccess(ok);
      if (ok&&wildMonster) {
        addToDexCaught(wildMonster.id);
        setCatchPlace(addCapturedMonster(wildMonster));
      } else {
        setCatchTriesLeft((n) => Math.max(0, n - 1));
      }
      setPhase("catch_result");
    }, 2600);
  };

  const exitDungeon = () => {
    if (rpsTimerRef.current) { clearTimeout(rpsTimerRef.current); rpsTimerRef.current = null; }
    setPhase("enter"); setArea(null); setDungeonNodes([]); setCurrentNodeId("n0");
    setWildMonster(null); setPChoice(null); setCChoice(null); setRpsResult(null);
    setCatchSuccess(null); setCatchPlace(null); setDrops([]); setIsElite(false);
    setCatchTriesLeft(CATCH_ATTEMPTS);
  };

  const totalPotions = Object.values(potions).reduce((a,b)=>a+b, 0);
  const currentNode  = dungeonNodes.find(n => n.id === currentNodeId);
  const maxDepth     = dungeonNodes.length > 0
    ? Math.max(...dungeonNodes.map(n => n.depth))
    : 0;

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden text-white">
      <style>{FOREST_STYLES}</style>
      <ForestBackground area={area}/>
      {area && <Particles area={area}/>}

      {/* 상단 UI */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
        <button onClick={phase==="enter" ? ()=>navigate("/") : exitDungeon}
          className="rounded-xl border border-stone-600/60 bg-black/50 px-3 py-1.5 text-pixel-sm text-sand-300 hover:text-sand-200 hover:bg-black/70 backdrop-blur transition">
          {phase==="enter" ? "← 베이스캠프" : "← 탈출"}
        </button>
        <div className="flex items-center gap-2">
          {area && (
            <div className="rounded-xl px-3 py-1.5 text-pixel-sm font-bold backdrop-blur"
              style={{ background:"rgba(13, 18, 35, .5)", border:`1px solid ${area.borderGlow}`, color: area.accentColor }}>
              {area.name} {currentNode && phase!=="enter" ? `· ${currentNode.depth}/${maxDepth}` : ""}
            </div>
          )}
          {totalPotions>0 && (
            <div className="rounded-xl border border-stone-600/60 bg-black/50 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur">
              🎒 ×{totalPotions}
            </div>
          )}
        </div>
      </div>

      {/* 중앙 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-4 pt-16 pb-6 overflow-y-auto">

        {/* ── ENTER: 구역 선택 ── */}
        {phase==="enter" && (
          <div className="flex flex-col items-center gap-5 w-full max-w-lg">
            <div className="text-center mb-2">
              <p className="text-pixel-sm uppercase tracking-[.25em] text-earth-400 mb-1">EXPEDITION</p>
              <h1 className="text-title-md font-black text-cream-100">숲 탐험</h1>
              <p className="text-pixel-sm text-sand-300 mt-1">탐험할 구역을 선택하세요</p>
            </div>
            {FOREST_AREAS.map((a,i)=>{
              const locked =
                (a.id === "deep"    && bestFloor < 11) ||
                (a.id === "ancient" && bestFloor < 21);
              return (
                <div key={a.id} className="relative w-full">
                  <AreaCard area={a} index={i} onClick={()=>{ if(!locked) handleEnterArea(a); }}/>
                  {locked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                      style={{ background:"rgba(13, 18, 35, .72)", border:"2px solid rgba(132, 75, 63, .3)", borderRadius:0 }}>
                      <span className="text-pixel-md">🔒</span>
                      <p className="text-pixel-sm font-bold text-sand-300" style={{ fontFamily:"var(--font-pixel)", fontSize: 12 }}>
                        {a.id==="deep" ? "무한의 탑 11층 도달 시 해금" : "무한의 탑 21층 도달 시 해금"}
                      </p>
                      <p className="text-pixel-sm text-earth-400">현재 최고 층: {bestFloor}층</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── DUNGEON: 노드 맵 ── */}
        {phase==="dungeon" && area && (
          <DungeonMapScreen
            nodes={dungeonNodes}
            currentNodeId={currentNodeId}
            area={area}
            onSelectNode={handleSelectNode}
            onExit={exitDungeon}
          />
        )}

        {/* ── EXPLORING ── */}
        {phase==="exploring" && area && <ExploringScreen area={area}/>}

        {/* ── NODE ARRIVED ── */}
        {phase==="node_arrived" && currentNode && area && (
          <NodeArrivedScreen node={currentNode} area={area} onContinue={handleEnterNode}/>
        )}

        {/* ── REST ── */}
        {phase==="rest" && area && (
          <RestScreen area={area} onContinue={returnToMap}/>
        )}

        {/* ── EVENT ── */}
        {phase==="event" && area && (
          <EventScreen area={area} onContinue={returnToMap}/>
        )}

        {/* ── ITEM DROP ── */}
        {phase==="item_drop" && area && drops.length>0 && (
          <ItemDropScreen drops={drops} area={area} onContinue={returnToMap} onExit={exitDungeon}/>
        )}

        {/* ── ENCOUNTER ── */}
        {phase==="encounter" && wildMonster && area && (
          <EncounterScreen
            monster={wildMonster} area={area} drops={drops} isElite={isElite}
            onCapture={()=>setPhase("rps_select")} onFlee={returnToMap}
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
            triesLeft={catchTriesLeft}
            onRetry={() => { setPChoice(null); setCChoice(null); setRpsResult(null); setCatchSuccess(null); setPhase("rps_select"); }}
            onContinue={returnToMap} onExit={exitDungeon}
          />
        )}

        {/* ── BOSS CLEARED ── */}
        {phase==="boss_cleared" && area && (
          <BossClearedScreen area={area} onExit={exitDungeon}/>
        )}
      </div>
    </div>
  );
}
