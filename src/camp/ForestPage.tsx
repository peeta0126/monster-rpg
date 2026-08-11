import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { monsters } from "../monster/monsters";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { usePlayerStore } from "../shared/playerStore";
import { RpsIcon } from "../workshop/RpsIcon";
import { RPS_KO, type RpsChoice } from "../workshop/rps";
import { scaleToLevel } from "../shared/floorTable";
import { getMaterial } from "../shared/items";
import { AREA_MATERIAL_POOL } from "../shared/dropTables";
import { PALETTE, rgba, ELEMENT_COLOR, ELEMENT_CHIP_CLASS } from "../shared/palette";
import { FOREST_AREAS, highestUnlockedArea, type ForestArea, type ForestAreaId } from "./forest/areas";
import { ForestBackdrop } from "./forest/ForestBackdrop";
import { ForestTierCard } from "./forest/ForestTierCard";
import { Particles } from "./forest/Particles";
import { NODE_META, isDangerousNode, type ForestNodeType } from "./forest/nodes";
import { generateDungeon, type ForestNode } from "./forest/dungeon";
import {
  NODE_ALERT, alertBand, clampAlert, isForcedRetreat, appliesAlertOnArrival,
  applyMaterialMultiplier, catchRateWithAlert, type ScoutLevel,
} from "./forest/alert";
import { AlertMeter } from "./forest/AlertMeter";

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
  | "node_arrived"
  | "item_drop" | "encounter" | "rps_select"
  | "rps_result" | "catch_result"
  | "rest" | "event" | "boss_cleared" | "forced_retreat";

// 노드 표시 정보(NODE_META)는 forest/nodes.ts 한 벌뿐이다. 여기에 다시 적지 말 것.

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
// 확률 문구는 여기 적지 않는다 — 소란도가 깎은 뒤의 실제 값을 화면에서 계산해 쓴다
const RPS_RESULT_DATA: Record<RpsResult,{text:string; color:string; bg:string}> = {
  win:  { text:"승리!",  color:"text-moss-500",  bg:"from-moss-500/80 to-moss-500/40" },
  draw: { text:"무승부", color:"text-ember-500", bg:"from-ember-700/80 to-ember-700/40" },
  lose: { text:"패배...", color:"text-ember-500", bg:"from-ember-700/80 to-ember-700/40" },
};

/**
 * 구역별 채집 재료.
 *
 * 예전에는 세 구역이 같은 표(herb/berry/root/crystal/wood_plank/leather)를 썼는데,
 * 그러면 슬라임 추출물·마법 가루·몬스터 정수가 어느 드랍 테이블에도 없어
 * 아티팩트와 상급 물약을 아예 만들 수 없었다(퀘스트 1회 보상이 평생 전부였다).
 * 깊이 들어갈수록 상위 재료가 나오도록 구역별로 나눠, 제작·모루가 실제로 돌아가게 한다.
 */

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
/**
 * 재료 굴림. 개수에 소란도 배수가 걸린다 — 소란은 이 노드를 **처리하기 전** 값이다.
 * 노드를 밟은 대가(소란 증가)는 판정이 끝난 뒤에 붙으므로, 방금 올린 소란으로
 * 그 노드의 수확을 불리는 일은 없다.
 */
function rollDrop(area: ForestArea, alert: number): {id:string; count:number}|null {
  if (Math.random()>area.materialRate) return null;
  const pool = AREA_MATERIAL_POOL[area.id] ?? AREA_MATERIAL_POOL.shallow;
  const id = pool[Math.floor(Math.random()*pool.length)];
  const base = 1 + area.materialBonus + (Math.random()<.3?1:0);
  return { id, count: applyMaterialMultiplier(base, alert) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 노드 맵 생성
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 던전 맵 화면
// ═══════════════════════════════════════════════════════════════════════════════

// 탐험 맵 디버그 (true 면 노드 id/좌표를 맵에 표시)
const SHOW_EXPLORE_MAP_DEBUG = false;

// y 좌표 기준 정렬된 다음 노드 방향 라벨
function getNextDirLabel(index: number, total: number): string {
  if (total === 1) return "앞으로";
  if (total === 2) return index === 0 ? "위쪽 길" : "아래쪽 길";
  const labels = ["위쪽 길", "중앙 길", "아래쪽 길"];
  return labels[index] ?? `${index + 1}번 길`;
}

/**
 * 정찰 결과 한 칸. 소란도가 낮을수록 더 많이 보인다 — 이게 소란을 낮게 유지할
 * 유일한 이유이자, 다이얼이 "항상 최대"로 수렴하지 않게 막는 안전장치다.
 */
function scoutNode(node: ForestNode, scout: ScoutLevel): { icon: string; title: string; sub: string } {
  const meta = NODE_META[node.type];
  const delta = NODE_ALERT[node.type];
  const deltaText = delta === 0 ? "소란 변화 없음" : delta > 0 ? `소란 +${delta}` : `소란 ${delta}`;

  // 주인만 소란이 도착 시점에 붙는다 — 같은 "+30"이라도 걸리는 자리가 다르다
  const when = appliesAlertOnArrival(node.type) ? `깨우면 ${deltaText}` : deltaText;

  if (scout === "detail") return { icon: meta.icon, title: meta.label, sub: `${meta.hint} · ${when}` };
  if (scout === "type")   return { icon: meta.icon, title: meta.label, sub: when };
  if (scout === "danger") {
    return isDangerousNode(node.type)
      ? { icon: "❗", title: "험한 기운", sub: "무언가 강한 것이 있다" }
      : { icon: "🌫️", title: "잠잠함",   sub: "특별한 기척은 없다" };
  }
  return { icon: "🌫️", title: "미지의 공간", sub: "아무것도 읽히지 않는다" };
}

function DungeonMapScreen({
  nodes, currentNodeId, area, alert, onSelectNode, onExit,
}: {
  nodes: ForestNode[];
  currentNodeId: string;
  area: ForestArea;
  alert: number;
  onSelectNode: (nodeId: string) => void;
  onExit: () => void;
}) {
  const band = alertBand(alert);
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

      {/* 헤더 — 판 없이 원화 위에 바로 놓이므로 글자마다 그림자를 깐다 */}
      <div className="text-center" style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
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
                // 정찰이 되는 만큼은 도착 전에도 아이콘이 보인다
                const scouted = isReachable && (band.scout === "detail" || band.scout === "type");
                const meta  = NODE_META[node.revealed || scouted ? node.type : "start"];
                const dimmed = !isCurrent && !isCleared && !isReachable;

                return (
                  <g key={node.id}
                    data-testid={`forest-node-${node.id}`}
                    data-reachable={isReachable ? "1" : "0"}
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
                      fontSize={node.revealed || scouted ? 11 : 12}
                      opacity={dimmed ? 0.22 : 1}
                      style={{ userSelect:"none", pointerEvents:"none" }}>
                      {node.revealed || scouted ? meta.icon : (isReachable ? "?" : "·")}
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
                <span className="text-pixel-sm text-sand-300">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 이동 선택 버튼 (y 좌표 순 정렬 → 위/중/아래 라벨) */}
      {sortedNext.length > 0 && (
        <div className="w-full flex flex-col gap-2">
          <p className="text-pixel-sm text-sand-200 text-center"
            style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
            {band.scout === "none"
              ? "숲이 너무 시끄러워 앞이 읽히지 않는다"
              : "어느 방향으로 탐사하시겠습니까?"}
          </p>
          <div className={`grid gap-2 ${
            sortedNext.length === 1 ? "grid-cols-1" :
            sortedNext.length === 2 ? "grid-cols-2" : "grid-cols-3"
          }`}>
            {sortedNext.map((node, i) => {
              const scout = scoutNode(node, band.scout);
              return (
                <button key={node.id}
                  data-testid={`forest-move-${node.id}`}
                  onClick={() => onSelectNode(node.id)}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 transition-all active:scale-95"
                  style={{
                    // 4% 크림 채움이었다. 옛 그라디언트 배경 위에서만 성립하던 값이라
                    // 원화로 바꾸자 버튼이 통째로 사라졌다 — 자기 판을 들게 한다.
                    background: rgba("shadow900", 0.82),
                    border: `2px solid ${area.accentColor}`,
                    color: area.accentColor,
                  }}>
                  <span className="text-pixel-md">{scout.icon}</span>
                  <span className="text-pixel-sm font-bold">
                    {getNextDirLabel(i, sortedNext.length)} · {scout.title}
                  </span>
                  <span className="text-pixel-sm text-sand-300">{scout.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 귀환 */}
      <button onClick={onExit}
        className="w-full rounded-xl border border-stone-600 bg-shadow-900/85 py-2.5 text-pixel-sm text-sand-300 hover:text-sand-200 transition">
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
            {node.type === "material" && "무언가 지나간 흔적이 남아 있습니다."}
            {node.type === "event"    && "수상한 기운이 감돌고 있습니다..."}
            {node.type === "rest"     && "몸을 숨길 만한 바위 그늘이 있습니다."}
            {node.type === "elite"    && "강력한 존재가 느껴집니다..."}
            {node.type === "boss"     && "숲의 주인이 깨어났다!"}
          </p>
          {/* 주인은 깨우는 순간 소란이 붙는다. 그 대가가 무엇인지 누르기 전에 말해 준다 */}
          {appliesAlertOnArrival(node.type) && (
            <p className="mt-3 text-pixel-sm font-bold text-ember-500">
              깨우는 순간 소란 +{NODE_ALERT[node.type]} · 그만큼 포획이 어려워진다
            </p>
          )}
        </div>
        <div className="px-6 pb-6 pt-2">
          <button onClick={onContinue}
            className="w-full rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${meta.color}25, ${meta.color}10)`,
              border:`1.5px solid ${meta.color}60`,
              color: meta.color,
            }}>
            {node.type === "rest" ? "몸을 숨긴다" : "진입하기"} →
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 휴식 화면
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 은신처. HP 회복처가 아니라 **소란을 되사는 자리**다.
 *
 * HP 를 돌려주면 숲이 소모전이 되고 그건 무한의 탑과 똑같아진다. 여기서 치르는 값은
 * 체력이 아니라 기회비용이다 — 이 노드에서는 아무것도 안 나온다.
 */
function RestScreen({ alertBefore, alertAfter, onContinue }: {
  area: ForestArea; alertBefore: number; alertAfter: number; onContinue: () => void;
}) {
  const gained = alertBefore - alertAfter;
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
      style={{ animation:"slideInUp .4s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden"
        style={{
          background: rgba("shadow900", 0.85),
          border: `1px solid ${rgba("mist500", 0.35)}`,
          backdropFilter:"blur(14px)",
        }}>
        <div className="px-6 pt-7 pb-5 text-center" style={{ background:`linear-gradient(to bottom, ${rgba("mist500", 0.08)}, transparent)` }}>
          <div className="text-pixel-lg mb-3" style={{ animation:"monsterFloat 3s ease-in-out infinite" }}>🔥</div>
          <p className="text-pixel-sm uppercase tracking-widest text-sand-300 mb-1">HIDEOUT</p>
          <p className="text-pixel-md font-black text-cream-100">은신처</p>
          <p className="text-pixel-sm text-sand-300 mt-2 leading-relaxed">
            바위 그늘에 몸을 숨기고 숨을 골랐다.<br/>
            숲이 다시 잠잠해진다.
          </p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl p-3"
            style={{ background: rgba("mist500", 0.08), border:`1px solid ${rgba("mist500", 0.2)}` }}>
            <p className="text-pixel-sm font-semibold text-mist-300">소란도</p>
            <p className="font-mono text-pixel-sm font-black text-mist-300">
              {alertBefore} → {alertAfter} <span className="text-earth-400">(-{gained})</span>
            </p>
          </div>
          <button onClick={onContinue}
            className="w-full rounded-xl py-3 text-pixel-sm font-bold transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${rgba("mist500", 0.2)}, ${rgba("mist500", 0.08)})`,
              border:`1.5px solid ${rgba("mist500", 0.5)}`,
              color:PALETTE.mist300,
            }}>
            계속 탐험하기 →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 강제 퇴각. 소란도가 100 에 닿으면 숲이 등을 떠민다.
 *
 * 지금은 여기서 그냥 나가는 것으로 끝난다 — 회수율 50% 와 지킬 것 1개 지정은
 * 채집망(STEP 3)과 정산(STEP 4)이 들어온 뒤에 붙는다.
 */
function ForcedRetreatScreen({ area, peak, onExit }: {
  area: ForestArea; peak: number; onExit: () => void;
}) {
  return (
    <div className="relative z-10 flex flex-col items-center gap-5 max-w-sm w-full mx-4"
      style={{ animation:"fadeInScale .45s ease both" }}>
      <div className="w-full rounded-2xl overflow-hidden text-center"
        style={{
          background: rgba("shadow900", 0.9),
          border: `2px solid ${rgba("ember700", 0.55)}`,
          backdropFilter:"blur(16px)",
          boxShadow: `0 0 40px ${rgba("ember700", 0.22)}`,
        }}>
        <div className="px-6 pt-8 pb-5" style={{ background:`linear-gradient(to bottom, ${rgba("ember700", 0.14)}, transparent)` }}>
          <div className="text-pixel-lg mb-3" style={{ animation:"catchShakeX .6s ease" }}>🌫️</div>
          <p className="text-pixel-sm uppercase tracking-widest text-ember-500 mb-1">FORCED RETREAT</p>
          <p className="text-title-sm font-black text-cream-100">숲이 깨어났다</p>
          <p className="text-pixel-sm text-sand-300 mt-2 leading-relaxed">
            사방에서 기척이 몰려든다.<br/>
            {area.name}에서 더 버틸 수 없다.
          </p>
          <p className="mt-3 font-mono text-pixel-sm text-ember-500">이번 원정 최고 소란 {peak}</p>
        </div>
        <div className="px-6 pb-7">
          <button onClick={onExit}
            data-testid="forced-retreat-exit"
            className="w-full rounded-xl py-3 text-pixel-sm font-black transition active:scale-95"
            style={{
              background:`linear-gradient(135deg, ${rgba("ember700", 0.3)}, ${rgba("ember700", 0.12)})`,
              border:`2px solid ${rgba("ember700", 0.6)}`,
              color:PALETTE.ember500,
            }}>
            숲에서 빠져나간다
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

function RpsSelectScreen({ monster, area, alert, onSelect }: {
  monster: ReturnType<typeof pickMonster>;
  area: ForestArea;
  alert: number;
  onSelect:(c:RpsChoice)=>void;
}) {
  const pct = (r: RpsResult) => Math.round(catchRateWithAlert(CATCH_RATE[r], alert) * 100);
  const penalty = Math.round(alertBand(alert).catchPenalty * 100);
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
          className="w-10 h-10 object-contain"/>
        <div>
          <p className="text-pixel-sm font-bold text-cream-100">{monster.name}</p>
          <p className="text-pixel-sm text-sand-300">Lv.{monster.level} · {TYPE_KO[monster.type ?? "normal"]??monster.type}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 text-pixel-sm text-earth-400">
          <span>이기면 <span className="text-moss-500 font-bold">{pct("win")}%</span></span>
          <span>비기면 <span className="text-ember-500 font-bold">{pct("draw")}%</span></span>
          <span>지면 <span className="text-ember-500 font-bold">{pct("lose")}%</span></span>
          {penalty > 0 && (
            <span className="text-ember-500">소란 때문에 -{penalty}%p</span>
          )}
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

function RpsResultScreen({ pChoice, cChoice, rpsResult, phase, alert, wildMonster, catchSuccess, catchPlace, triesLeft, onRetry, onContinue, onExit }: {
  pChoice:RpsChoice; cChoice:RpsChoice; rpsResult:RpsResult;
  phase: "rps_result"|"catch_result";
  alert: number;
  wildMonster: ReturnType<typeof pickMonster>|null;
  catchSuccess:boolean|null; catchPlace:"storage"|"full"|null;
  triesLeft:number; onRetry:()=>void;
  onContinue:()=>void; onExit:()=>void;
}) {
  const [showComp, setShowComp] = useState(false);
  useEffect(()=>{ const t = setTimeout(()=>setShowComp(true), 700); return ()=>clearTimeout(t); },[]);
  const res = RPS_RESULT_DATA[rpsResult];
  // 표에 적힌 확률이 아니라 실제로 굴린 확률을 적는다 — 소란도가 깎은 만큼 다르다
  const shownRate = Math.round(catchRateWithAlert(CATCH_RATE[rpsResult], alert) * 100);
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
            <p className="text-pixel-sm text-sand-300 mt-0.5">포획 확률 {shownRate}%</p>
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
                      style={{ animation:"catchBounce .6s ease 2", filter:"drop-shadow(0 0 12px rgba(122, 132, 85, .5))" }}/>
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

  /**
   * 구역 선택 화면에서 지금 보고 있는 티어. 배경과 카드 상태가 같이 이걸 따른다.
   * 처음에는 갈 수 있는 가장 높은 구역을 골라 둔다 — 플레이어가 이미 뚫어 놓은 곳을
   * 다시 찾아 내려가게 하지 않는다.
   */
  const [selectedTier, setSelectedTier] = useState<ForestAreaId>(() => highestUnlockedArea(bestFloor).id);

  // 던전 상태
  const [dungeonNodes, setDungeonNodes] = useState<ForestNode[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>("n0");
  const [pendingNodeId, setPendingNodeId] = useState<string|null>(null);

  /**
   * 소란도 — 이 탐험이 이월하는 유일한 자원. 구역을 나가면 0 으로 돌아간다.
   * 노드를 밟은 대가는 판정이 끝난 뒤(markCleared)에 붙고, 그 노드의 수확 배수는
   * 붙기 전 값으로 계산한다.
   */
  const [alert, setAlert] = useState(0);
  /** 이번 원정에서 가장 높았던 소란. 정산 화면이 "최고 긴장"으로 쓴다(STEP 5) */
  const [alertPeak, setAlertPeak] = useState(0);

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
    const nodes = generateDungeon();
    setArea(a);
    setDungeonNodes(nodes);
    setCurrentNodeId(nodes.find(n => n.depth === 0)!.id);
    // 깊은 곳은 이미 깨어 있다 — 0 에서 시작하면 런 앞쪽 절반이 늘 배수 1.0 이었다
    setAlert(a.startingAlert);
    setAlertPeak(a.startingAlert);
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

  /**
   * 현재 노드를 클리어 처리하고 그 노드의 소란 증감을 붙인다. 판정이 끝난 시점이다.
   *
   * handleEnterNode 보다 먼저 선언해야 한다 — 뒤에 두면 선언 전 참조(TDZ)가 되어,
   * 렌더 중 호출되는 경로가 하나라도 생기면 즉시 터진다.
   *
   * 이미 cleared 인 노드에는 다시 붙이지 않는다. 채집 실패처럼 한 노드에서
   * markCleared 가 두 번 불릴 수 있는 경로가 있어서, 안 막으면 소란이 두 번 오른다.
   */
  const markCleared = useCallback((): number => {
    const node = dungeonNodes.find(n => n.id === currentNodeId);
    if (!node || node.cleared) return alert;

    setDungeonNodes(prev => prev.map(n =>
      n.id === currentNodeId ? { ...n, cleared: true } : n
    ));

    // 도착할 때 이미 붙인 노드(주인)는 여기서 다시 올리지 않는다
    if (appliesAlertOnArrival(node.type)) return alert;

    const next = clampAlert(alert + NODE_ALERT[node.type]);
    setAlert(next);
    setAlertPeak(peak => Math.max(peak, next));
    // 소란 상태는 아직 반영 전이라, 이 판정의 결과를 보고 갈라야 하는 쪽은 이 값을 쓴다
    return next;
  }, [dungeonNodes, currentNodeId, alert]);

  // 노드 도착 후 진입
  const handleEnterNode = useCallback(() => {
    const node = dungeonNodes.find(n => n.id === currentNodeId);
    if (!node || !area) return;

    /**
     * 이 노드의 판정에 쓸 소란도.
     *
     * 주인은 깨우는 순간 숲이 뒤집힌다 — 그래서 여기서 먼저 올리고, 그 값으로
     * 수확과 포획 확률을 굴린다. 소란 100 에 닿아도 주인 앞에서는 쫓겨나지 않는다.
     * 여기까지 걸어온 판을 문턱에서 끊는 건 대가가 아니라 몰수다.
     */
    let judgeAlert = alert;
    if (appliesAlertOnArrival(node.type)) {
      judgeAlert = clampAlert(alert + NODE_ALERT[node.type]);
      setAlert(judgeAlert);
      setAlertPeak(peak => Math.max(peak, judgeAlert));
    }

    if (node.type === "rest") { setPhase("rest"); return; }
    if (node.type === "event") { setPhase("event"); return; }
    if (node.type === "material") {
      const collected: {id:string;count:number}[] = [];
      const d1 = rollDrop(area, judgeAlert); if (d1) collected.push(d1);
      const d2 = rollDrop(area, judgeAlert); if (d2 && d2.id !== d1?.id) collected.push(d2);
      if (collected.length > 0) {
        collected.forEach(d => addMaterial(d.id, d.count));
        setDrops(collected);
        setPhase("item_drop");
      } else {
        // 굴림이 다 빗나가도 발자국은 남는다 — 소란은 똑같이 오르고, 그 때문에
        // 강제 퇴각선을 넘길 수도 있다
        const nextAlert = markCleared();
        setPhase(isForcedRetreat(nextAlert) ? "forced_retreat" : "dungeon");
      }
      return;
    }
    if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
      const elite = node.type === "elite" || node.type === "boss";
      const mon = pickMonster(area, elite);
      const collected: {id:string;count:number}[] = [];
      const d = rollDrop(area, judgeAlert); if (d) { collected.push(d); collected.forEach(dd => addMaterial(dd.id, dd.count)); }
      setDrops(collected);
      setWildMonster(mon);
      setIsElite(elite);
      setCatchTriesLeft(CATCH_ATTEMPTS);
      addToDexSeen(mon.id);
      setPhase("encounter");
      return;
    }
  }, [dungeonNodes, currentNodeId, area, alert, addMaterial, addToDexSeen, markCleared]);

  // 노드 처리 완료 → 맵으로 복귀 or 던전 완료
  const returnToMap = useCallback(() => {
    const nextAlert = markCleared();
    const node = dungeonNodes.find(n => n.id === currentNodeId);
    // 주인을 잡았으면 소란이 얼마든 완주다 — 어차피 여기서 탐험이 끝난다
    if (node?.type === "boss") { setPhase("boss_cleared"); return; }
    if (isForcedRetreat(nextAlert)) { setPhase("forced_retreat"); return; }
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
      const ok = Math.random()<catchRateWithAlert(CATCH_RATE[res], alert);
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

  // 구역 선택 화면으로 되돌린다. 베이스캠프까지 나가는 건 호출부가 정한다 —
  // 상단 '탈출'은 여기까지고, 완주 화면의 '베이스캠프로 귀환'은 여기에 navigate 를 더한다.
  const exitDungeon = () => {
    if (rpsTimerRef.current) { clearTimeout(rpsTimerRef.current); rpsTimerRef.current = null; }
    setPhase("enter"); setArea(null); setDungeonNodes([]); setCurrentNodeId("n0");
    setWildMonster(null); setPChoice(null); setCChoice(null); setRpsResult(null);
    setCatchSuccess(null); setCatchPlace(null); setDrops([]); setIsElite(false);
    setCatchTriesLeft(CATCH_ATTEMPTS);
    // 소란은 숲을 나가면 가라앉는다. 구역 사이로는 이월하지 않는다
    setAlert(0); setAlertPeak(0);
  };

  const totalPotions = Object.values(potions).reduce((a,b)=>a+b, 0);
  const currentNode  = dungeonNodes.find(n => n.id === currentNodeId);
  const maxDepth     = dungeonNodes.length > 0
    ? Math.max(...dungeonNodes.map(n => n.depth))
    : 0;

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden text-cream-100">
      <style>{FOREST_STYLES}</style>
      {/* 탐험에 들어가면 그 구역이, 선택 화면에서는 지금 보고 있는 구역이 배경이 된다.
          안에 들어간 뒤로는 UI 가 화면 전체에 흩어져서 원화를 한 겹 눌러야 읽힌다. */}
      <ForestBackdrop
        tier={area?.id ?? selectedTier}
        dim={phase !== "enter"}
        tint={area ? alertBand(alert).tint : undefined}
      />
      {area && <Particles area={area} density={alertBand(alert).particleMul}/>}

      {/* 상단 UI — 구역 선택 화면에서는 스크림 없는 원화 위에 바로 뜬다.
          얕은 숲 캔버스 상단이 밝아서 반투명 판으로는 글자가 뜬다. */}
      <div className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-4">
        <button onClick={phase==="enter" ? ()=>navigate("/") : exitDungeon}
          className="rounded-xl border border-stone-600/60 bg-shadow-900/85 px-3 py-1.5 text-pixel-sm text-sand-300 hover:text-sand-200 hover:bg-shadow-900 backdrop-blur transition">
          {phase==="enter" ? "← 베이스캠프" : "← 탈출"}
        </button>
        <div className="flex items-center gap-2">
          {area && phase !== "enter" && <AlertMeter value={alert}/>}
          {area && (
            <div className="rounded-xl px-3 py-1.5 text-pixel-sm font-bold backdrop-blur"
              style={{ background: rgba("shadow900", 0.85), border:`1px solid ${area.borderGlow}`, color: area.accentColor }}>
              {area.name} {currentNode && phase!=="enter" ? `· ${currentNode.depth}/${maxDepth}` : ""}
            </div>
          )}
          {totalPotions>0 && (
            <div className="rounded-xl border border-stone-600/60 bg-shadow-900/85 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur">
              🎒 ×{totalPotions}
            </div>
          )}
        </div>
      </div>

      {/* 중앙 콘텐츠 */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-4 pt-16 pb-6 overflow-y-auto">

        {/* ── ENTER: 구역 선택 ── */}
        {phase==="enter" && (
          // gap 을 두지 않는다 — 물러난 카드가 scale(.75) 로 줄면서 자리에 여백을
          // 스스로 남긴다. 여기에 gap 을 더하면 카드 사이가 벌어져 한 묶음으로 안 읽힌다.
          <div className="flex flex-col items-center w-full max-w-lg">
            {/* 배경 원화의 밝은 안개 위에 놓이는 자리라 글자마다 그림자를 깐다 */}
            <div className="mb-2 text-center" style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
              <p className="text-pixel-sm uppercase tracking-[.25em] text-sand-300 mb-1">EXPEDITION</p>
              <h1 className="text-title-md font-black text-cream-100">숲 탐험</h1>
              <p className="text-pixel-sm text-sand-200 mt-1">탐험할 구역을 선택하세요</p>
            </div>
            {FOREST_AREAS.map((a)=>(
              <ForestTierCard
                key={a.id}
                area={a}
                selected={a.id === selectedTier}
                locked={bestFloor < a.unlockFloor}
                bestFloor={bestFloor}
                onSelect={()=>setSelectedTier(a.id)}
                onEnter={()=>handleEnterArea(a)}
              />
            ))}
          </div>
        )}

        {/* ── DUNGEON: 노드 맵 ── */}
        {phase==="dungeon" && area && (
          <DungeonMapScreen
            nodes={dungeonNodes}
            currentNodeId={currentNodeId}
            area={area}
            alert={alert}
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

        {/* ── 은신처 ── */}
        {phase==="rest" && area && (
          <RestScreen
            area={area}
            alertBefore={alert}
            alertAfter={clampAlert(alert + NODE_ALERT.rest)}
            onContinue={returnToMap}
          />
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
          <RpsSelectScreen monster={wildMonster} area={area} alert={alert} onSelect={handleRps}/>
        )}

        {/* ── RPS / CATCH RESULT ── */}
        {(phase==="rps_result"||phase==="catch_result") && pChoice && cChoice && rpsResult && (
          <RpsResultScreen
            pChoice={pChoice} cChoice={cChoice} rpsResult={rpsResult}
            phase={phase as "rps_result"|"catch_result"} alert={alert}
            wildMonster={wildMonster} catchSuccess={catchSuccess} catchPlace={catchPlace}
            triesLeft={catchTriesLeft}
            onRetry={() => { setPChoice(null); setCChoice(null); setRpsResult(null); setCatchSuccess(null); setPhase("rps_select"); }}
            onContinue={returnToMap} onExit={exitDungeon}
          />
        )}

        {/* ── BOSS CLEARED ── */}
        {phase==="boss_cleared" && area && (
          <BossClearedScreen area={area} onExit={() => { exitDungeon(); navigate("/"); }}/>
        )}

        {/* ── 강제 퇴각 ── */}
        {phase==="forced_retreat" && area && (
          <ForcedRetreatScreen area={area} peak={alertPeak} onExit={exitDungeon}/>
        )}
      </div>
    </div>
  );
}
