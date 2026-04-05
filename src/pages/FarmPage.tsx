import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type OwnedMonster } from "../store/playerStore";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "../data/monsterImages";
import { MATERIALS, POTIONS, type Potion, getMaterial } from "../data/items";

// ═══════════════════════════════════════════════════════════════════════════════
// CSS 애니메이션
// ═══════════════════════════════════════════════════════════════════════════════

const FARM_STYLES = `
@keyframes farmIn {
  from { transform: translateY(14px) scale(.97); opacity: 0; }
  to   { transform: translateY(0)    scale(1);   opacity: 1; }
}
@keyframes glowBreathe {
  0%,100%{ opacity: .55; }
  50%    { opacity: .9; }
}
@keyframes shimmerFarm {
  from { transform: translateX(-150%) skewX(-18deg); }
  to   { transform: translateX(400%)  skewX(-18deg); }
}
@keyframes craftSuccess {
  0%  { transform: scale(1);    background: rgba(245,158,11,.3); }
  40% { transform: scale(1.04); background: rgba(245,158,11,.55); }
  100%{ transform: scale(1);    background: transparent; }
}
@keyframes countPop {
  0%  { transform: scale(.5);  opacity: 0; }
  65% { transform: scale(1.2); }
  100%{ transform: scale(1);   opacity: 1; }
}
@keyframes hpLoad {
  from { width: 0; }
}
@keyframes selectRing {
  0%,100%{ box-shadow: 0 0 0 2px var(--sel-color,#f59e0b), 0 0 16px var(--sel-glow,rgba(245,158,11,.4)); }
  50%    { box-shadow: 0 0 0 2px var(--sel-color,#f59e0b), 0 0 28px var(--sel-glow,rgba(245,158,11,.55)); }
}
@keyframes bubblePop {
  0%  { transform: scale(0); opacity: 1; }
  100%{ transform: scale(3); opacity: 0; }
}
@keyframes slideRight {
  from { transform: translateX(-8px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════════
// 타입/색상 상수
// ═══════════════════════════════════════════════════════════════════════════════

const TYPE_KO: Record<string, string> = {
  fire:"불꽃", water:"물", grass:"풀", electric:"전기", ice:"얼음", normal:"노말",
};

const TYPE_ACCENT: Record<string, { glow: string; border: string; bg: string; label: string }> = {
  fire:     { glow:"rgba(239,68,68,.45)",   border:"#ef4444", bg:"rgba(239,68,68,.1)",   label:"bg-red-900/80 text-red-200 border-red-700" },
  water:    { glow:"rgba(59,130,246,.45)",  border:"#3b82f6", bg:"rgba(59,130,246,.1)",  label:"bg-blue-900/80 text-blue-200 border-blue-700" },
  grass:    { glow:"rgba(34,197,94,.45)",   border:"#22c55e", bg:"rgba(34,197,94,.1)",   label:"bg-green-900/80 text-green-200 border-green-700" },
  electric: { glow:"rgba(234,179,8,.5)",   border:"#eab308", bg:"rgba(234,179,8,.1)",   label:"bg-yellow-900/80 text-yellow-200 border-yellow-700" },
  ice:      { glow:"rgba(103,232,249,.45)", border:"#67e8f9", bg:"rgba(103,232,249,.1)", label:"bg-cyan-900/80 text-cyan-200 border-cyan-700" },
  normal:   { glow:"rgba(161,161,170,.35)", border:"#a1a1aa", bg:"rgba(161,161,170,.08)",label:"bg-zinc-800/80 text-zinc-200 border-zinc-600" },
};

const POTION_STYLE: Record<string, { bg: string; border: string; glow: string; accent: string }> = {
  heal:        { bg:"rgba(16,90,40,.4)",   border:"rgba(34,197,94,.4)",   glow:"rgba(34,197,94,.2)",   accent:"#4ade80" },
  full_heal:   { bg:"rgba(8,60,80,.4)",    border:"rgba(6,182,212,.4)",   glow:"rgba(6,182,212,.2)",   accent:"#22d3ee" },
  cure_status: { bg:"rgba(30,30,90,.4)",   border:"rgba(99,102,241,.4)",  glow:"rgba(99,102,241,.2)",  accent:"#818cf8" },
  buff_attack: { bg:"rgba(90,30,10,.4)",   border:"rgba(249,115,22,.4)",  glow:"rgba(249,115,22,.2)",  accent:"#fb923c" },
};

function hpGradient(pct: number): string {
  if (pct > 65) return "linear-gradient(90deg, #15803d, #22c55e)";
  if (pct > 35) return "linear-gradient(90deg, #a16207, #eab308)";
  if (pct > 15) return "linear-gradient(90deg, #c2410c, #f97316)";
  return "linear-gradient(90deg, #991b1b, #ef4444)";
}

function effectLabel(potion: Potion): string {
  const e = potion.effect;
  if (e.type === "heal")        return `HP +${e.amount} 회복`;
  if (e.type === "full_heal")   return "HP 완전 회복";
  if (e.type === "cure_status") return "상태이상 즉시 치료";
  if (e.type === "buff_attack") return `공격 ×${e.multiplier} · ${e.turns}턴`;
  return "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// 몬스터 카드
// ═══════════════════════════════════════════════════════════════════════════════

function MonsterCard({
  monster, size = "md", selected, dimmed, onClick, showStats = false,
}: {
  monster: OwnedMonster; size?: "sm" | "md" | "lg";
  selected?: boolean; dimmed?: boolean;
  onClick: () => void; showStats?: boolean;
}) {
  const hpPct    = monster.maxHp === 0 ? 0 : Math.round((monster.currentHp / monster.maxHp) * 100);
  const isFainted = hpPct === 0;
  const acc       = TYPE_ACCENT[monster.type] ?? TYPE_ACCENT.normal;
  const imgSize   = size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-11 h-11";

  return (
    <button
      onClick={onClick}
      className="relative rounded-xl flex flex-col items-center gap-1.5 transition-all w-full overflow-hidden"
      style={{
        padding: size === "lg" ? "14px 10px" : "10px 8px",
        background: selected
          ? `linear-gradient(145deg, ${acc.bg}, rgba(10,6,2,.9))`
          : dimmed
            ? "rgba(10,7,3,.5)"
            : "rgba(14,9,3,.85)",
        border: selected
          ? `1.5px solid ${acc.border}`
          : `1px solid rgba(140,90,20,.2)`,
        boxShadow: selected
          ? `0 0 20px ${acc.glow}, inset 0 0 12px rgba(0,0,0,.4)`
          : "inset 0 0 8px rgba(0,0,0,.3)",
        opacity: dimmed ? .45 : 1,
        animation: selected ? "selectRing 2.2s ease-in-out infinite" : "none",
      } as React.CSSProperties}
    >
      {/* 기절 오버레이 */}
      {isFainted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          style={{ background:"rgba(0,0,0,.55)", backdropFilter:"blur(1px)" }}>
          <span className="text-xs font-black text-red-400 tracking-widest rotate-[-15deg] opacity-90">기절</span>
        </div>
      )}

      {/* 이미지 */}
      <div className="relative flex-shrink-0">
        {selected && (
          <div className="absolute inset-0 rounded-full"
            style={{
              background:`radial-gradient(circle, ${acc.glow}, transparent 65%)`,
              animation:"glowBreathe 2s ease-in-out infinite",
            }}/>
        )}
        <img
          src={MONSTER_IMAGE_MAP[monster.id]}
          alt={monster.nickname ?? monster.name}
          className={`${imgSize} object-contain relative pixel-img`}
          style={{
            ...monsterImgStyle(monster.id),
            filter: isFainted ? "grayscale(.8) brightness(.6)" : selected ? `drop-shadow(0 0 8px ${acc.glow})` : "none",
          }}
        />
      </div>

      {/* 이름 + 레벨 */}
      <div className="text-center w-full px-0.5">
        <p className="font-bold text-zinc-100 truncate leading-tight"
          style={{ fontSize: size === "sm" ? 10 : 11 }}>
          {monster.nickname ?? monster.name}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[9px] font-bold text-zinc-500">Lv.{monster.level}</span>
          <span className={`rounded-full border px-1 text-[8px] font-bold ${acc.label}`}
            style={{ paddingTop:0, paddingBottom:0 }}>
            {TYPE_KO[monster.type]??""}
          </span>
        </div>
      </div>

      {/* HP 바 */}
      <div className="w-full px-0.5">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[8px] text-zinc-600 font-bold">HP</span>
          <span className="text-[8px] text-zinc-500">{monster.currentHp}/{monster.maxHp}</span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height:4, background:"rgba(0,0,0,.5)" }}>
          <div className="h-full rounded-full transition-all" style={{
            width:`${hpPct}%`,
            background: hpGradient(hpPct),
            animation: "hpLoad .6s ease both",
          }}/>
        </div>
      </div>

      {/* 추가 스탯 (파티 큰 카드) */}
      {showStats && (
        <div className="w-full px-0.5 grid grid-cols-3 gap-0.5 mt-0.5">
          {[["공", monster.attack],["방", monster.defense],["속", monster.speed]].map(([l,v])=>(
            <div key={l as string} className="flex flex-col items-center rounded py-0.5"
              style={{ background:"rgba(0,0,0,.3)" }}>
              <span className="text-[8px] text-zinc-600">{l}</span>
              <span className="text-[10px] font-bold text-zinc-300">{v}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

function EmptyPartySlot({ index, selected, onClick }: { index:number; selected?:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick}
      className="rounded-xl w-full h-32 flex flex-col items-center justify-center gap-2 transition-all"
      style={{
        background: selected ? "rgba(245,158,11,.08)" : "rgba(10,7,3,.5)",
        border: selected ? "1.5px solid #f59e0b" : "1px dashed rgba(140,90,20,.25)",
        boxShadow: selected ? "0 0 16px rgba(245,158,11,.25)" : "none",
      }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background:selected?"rgba(245,158,11,.15)":"rgba(80,50,10,.15)", border:"1px dashed rgba(140,90,20,.3)" }}>
        <span className="text-xl" style={{ color:selected?"#f59e0b":"rgba(120,80,20,.5)" }}>+</span>
      </div>
      <span className="text-[10px] font-semibold" style={{ color:selected?"#f59e0b":"rgba(120,80,20,.5)" }}>
        슬롯 {index+1}
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 내 몬스터 탭
// ═══════════════════════════════════════════════════════════════════════════════

type SortKey = "level" | "hp" | "type";

function MonstersTab() {
  const { party, storage, moveToStorage, swapWithStorage, moveToParty, swapPartySlots } = usePlayerStore();
  const [selParty,   setSelParty]   = useState<number|null>(null);
  const [selStorage, setSelStorage] = useState<string|null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy,     setSortBy]     = useState<SortKey>("level");

  const handlePartyClick = (idx: number) => {
    if (selStorage !== null) {
      idx < party.length ? swapWithStorage(idx, selStorage) : moveToParty(selStorage, idx);
      setSelStorage(null); setSelParty(null); return;
    }
    if (selParty !== null && selParty !== idx) {
      swapPartySlots(selParty, idx); setSelParty(null); return;
    }
    setSelParty(idx === selParty ? null : idx);
  };

  const handleStorageClick = (uid: string) => {
    if (selParty !== null) {
      selParty < party.length ? swapWithStorage(selParty, uid) : moveToParty(uid, selParty);
      setSelParty(null); setSelStorage(null); return;
    }
    setSelStorage(uid === selStorage ? null : uid);
  };

  const handleRemove = (idx: number) => {
    if (party.length <= 1) return;
    moveToStorage(idx); setSelParty(null);
  };

  const storageTypes = [...new Set(storage.map((m) => m.type))];

  const filteredStorage = [...storage]
    .filter((m) => typeFilter === "all" || m.type === typeFilter)
    .sort((a, b) => {
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "hp")    return (b.currentHp/b.maxHp) - (a.currentHp/a.maxHp);
      return a.type.localeCompare(b.type);
    });

  const hint = selParty !== null
    ? "📦 보관함의 몬스터를 선택해 교체"
    : selStorage !== null
      ? "👥 파티 슬롯을 선택해 교체하거나 추가"
      : "슬롯 또는 보관함 몬스터를 클릭해 선택";

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── 파티 패널 ── */}
      <div className="w-64 flex-shrink-0 flex flex-col"
        style={{ background:"rgba(10,6,2,.5)", borderRight:"1px solid rgba(140,90,20,.15)" }}>
        {/* 파티 헤더 */}
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom:"1px solid rgba(140,90,20,.1)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:"rgba(180,120,30,.6)" }}>PARTY</p>
            <p className="text-sm font-black text-zinc-200">전투 파티 <span className="text-zinc-500 font-normal">({party.length}/3)</span></p>
          </div>
        </div>

        {/* 파티 슬롯 */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {[0,1,2].map(idx => {
            const m = party[idx];
            return m ? (
              <div key={m.uid} className="flex flex-col gap-1">
                <MonsterCard
                  monster={m} size="md"
                  selected={selParty===idx}
                  dimmed={selStorage!==null && selParty===null}
                  showStats
                  onClick={()=>handlePartyClick(idx)}
                />
                <button onClick={()=>handleRemove(idx)}
                  disabled={party.length<=1}
                  className="text-[10px] text-right pr-1 transition"
                  style={{ color:party.length<=1?"rgba(120,80,20,.2)":"rgba(120,80,20,.55)" }}
                  onMouseEnter={e=>{if(party.length>1)(e.target as HTMLElement).style.color="#ef4444";}}
                  onMouseLeave={e=>{if(party.length>1)(e.target as HTMLElement).style.color="rgba(120,80,20,.55)";}}>
                  보관함으로 ↓
                </button>
              </div>
            ) : (
              <EmptyPartySlot key={`empty-${idx}`} index={idx}
                selected={selParty===idx}
                onClick={()=>handlePartyClick(idx)}/>
            );
          })}
        </div>

        {/* 힌트 */}
        <div className="px-4 py-3" style={{ borderTop:"1px solid rgba(140,90,20,.1)" }}>
          <p className="text-[10px] text-center" style={{ color:"rgba(140,90,20,.6)" }}>{hint}</p>
        </div>
      </div>

      {/* ── 보관함 ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 보관함 헤더 */}
        <div className="px-4 py-3 flex flex-wrap items-center gap-2"
          style={{ borderBottom:"1px solid rgba(140,90,20,.1)", background:"rgba(8,5,2,.3)" }}>
          <div className="mr-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color:"rgba(180,120,30,.6)" }}>STORAGE</p>
            <p className="text-sm font-black text-zinc-200">보관함 <span className="text-zinc-500 font-normal">({storage.length}/30)</span></p>
          </div>

          {/* 타입 필터 */}
          <div className="flex gap-1 flex-wrap">
            {["all", ...storageTypes].map((t) => {
              const acc = t === "all" ? null : TYPE_ACCENT[t];
              return (
                <button key={t}
                  onClick={()=>setTypeFilter(t)}
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold transition"
                  style={{
                    background: typeFilter===t
                      ? (acc ? acc.bg : "rgba(245,158,11,.15)")
                      : "rgba(20,12,4,.6)",
                    border: typeFilter===t
                      ? `1px solid ${acc?.border ?? "#f59e0b"}`
                      : "1px solid rgba(140,90,20,.2)",
                    color: typeFilter===t
                      ? (acc?.border ?? "#f59e0b")
                      : "rgba(120,80,20,.7)",
                  }}>
                  {t==="all" ? "전체" : TYPE_KO[t]??t}
                </button>
              );
            })}
          </div>

          {/* 정렬 */}
          <div className="flex gap-1 ml-auto">
            {([["level","레벨"],["hp","HP"],["type","속성"]] as [SortKey,string][]).map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)}
                className="rounded-lg px-2 py-0.5 text-[10px] font-bold transition"
                style={{
                  background: sortBy===k ? "rgba(245,158,11,.12)" : "rgba(20,12,4,.6)",
                  border: `1px solid ${sortBy===k ? "rgba(245,158,11,.45)" : "rgba(140,90,20,.2)"}`,
                  color: sortBy===k ? "#f59e0b" : "rgba(120,80,20,.6)",
                }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* 보관함 그리드 */}
        <div className="flex-1 overflow-y-auto p-3">
          {storage.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <div className="text-5xl opacity-20">📦</div>
              <div>
                <p className="font-bold text-zinc-500 mb-1">보관함이 비어 있습니다</p>
                <p className="text-xs text-zinc-700">숲 탐험에서 몬스터를 포획하면<br/>이곳에 자동으로 저장됩니다.</p>
              </div>
            </div>
          ) : filteredStorage.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <p className="text-sm text-zinc-600">{TYPE_KO[typeFilter]} 속성 몬스터가 없습니다.</p>
            </div>
          ) : (
            <div className="grid gap-2" style={{ gridTemplateColumns:"repeat(auto-fill, minmax(90px, 1fr))" }}>
              {filteredStorage.map((m,i)=>(
                <div key={m.uid} style={{ animation:`farmIn .3s ease ${i*.04}s both` }}>
                  <MonsterCard monster={m} size="sm"
                    selected={selStorage===m.uid}
                    onClick={()=>handleStorageClick(m.uid)}/>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 가방 탭
// ═══════════════════════════════════════════════════════════════════════════════

const EFFECT_GROUPS: { key: string; label: string; icon: string; desc: string }[] = [
  { key:"heal",        label:"회복 물약",  icon:"💚", desc:"전투 중 HP를 회복합니다" },
  { key:"full_heal",   label:"완전 회복",  icon:"✨", desc:"HP를 완전히 채웁니다" },
  { key:"cure_status", label:"상태이상 치료",icon:"💙",desc:"독·화상·마비·빙결을 제거합니다" },
  { key:"buff_attack", label:"전투 강화",  icon:"🔥", desc:"일시적으로 공격력을 높입니다" },
];

function BagTab() {
  const { potions } = usePlayerStore();
  const totalCount = Object.values(potions).reduce((a,b)=>a+b, 0);

  const grouped = EFFECT_GROUPS.map(g => ({
    ...g,
    items: POTIONS.filter(p => p.effect.type === g.key && (potions[p.id]??0) > 0),
  })).filter(g => g.items.length > 0);

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
        <div className="relative">
          <div className="text-6xl opacity-15">🎒</div>
          <div className="absolute inset-0 rounded-full opacity-10"
            style={{ background:"radial-gradient(circle, #f59e0b, transparent)" }}/>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-zinc-500 mb-1">가방이 비어 있습니다</p>
          <p className="text-xs text-zinc-700 leading-relaxed">
            제작소에서 재료를 모아<br/>물약을 만들어 보세요.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {POTIONS.slice(0,3).map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl px-4 py-2.5 opacity-35"
              style={{ background:"rgba(20,12,4,.6)", border:"1px solid rgba(140,90,20,.15)" }}>
              <span className="text-xl">{p.emoji}</span>
              <div>
                <p className="text-xs font-bold text-zinc-400">{p.name}</p>
                <p className="text-[10px] text-zinc-600">{effectLabel(p)}</p>
              </div>
              <span className="ml-auto text-xs text-zinc-700 font-mono">×0</span>
            </div>
          ))}
          <p className="text-[10px] text-zinc-700 text-center mt-1">보유 물약 미리보기</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* 요약 헤더 */}
      <div className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom:"1px solid rgba(140,90,20,.1)", background:"rgba(8,5,2,.3)" }}>
        <span className="text-2xl">🎒</span>
        <div>
          <p className="text-[10px] uppercase tracking-widest" style={{ color:"rgba(180,120,30,.6)" }}>INVENTORY</p>
          <p className="text-sm font-black text-zinc-200">보유 물약 <span className="text-amber-400 font-mono">×{totalCount}</span></p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-6">
        {grouped.map((g, gi) => {
          const style = POTION_STYLE[g.key] ?? POTION_STYLE.heal;
          return (
            <section key={g.key} style={{ animation:`farmIn .4s ease ${gi*.1}s both` }}>
              {/* 카테고리 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{g.icon}</span>
                <div>
                  <p className="text-xs font-black text-zinc-200">{g.label}</p>
                  <p className="text-[10px] text-zinc-600">{g.desc}</p>
                </div>
                <div className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{ background:style.bg, border:`1px solid ${style.border}`, color:style.accent }}>
                  {g.items.reduce((s,p)=>s+(potions[p.id]??0),0)}개
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.items.map((p, pi) => {
                  const cnt = potions[p.id] ?? 0;
                  return (
                    <div key={p.id} className="rounded-2xl overflow-hidden"
                      style={{
                        background:`linear-gradient(145deg, ${style.bg}, rgba(8,5,2,.8))`,
                        border:`1px solid ${style.border}`,
                        boxShadow:`0 0 20px ${style.glow}`,
                        animation:`farmIn .35s ease ${pi*.07}s both`,
                      }}>
                      <div className="p-4 flex items-center gap-3">
                        <div className="text-3xl flex-shrink-0 relative">
                          {p.emoji}
                          {/* count badge */}
                          <div className="absolute -top-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center"
                            style={{
                              background: style.accent,
                              fontSize:9, fontWeight:900, color:"#000",
                              animation:`countPop .4s ease both`,
                            }}>
                            {cnt}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-zinc-100 truncate">{p.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{p.description}</p>
                        </div>
                      </div>
                      {/* 효과 바 */}
                      <div className="px-4 pb-3">
                        <div className="rounded-lg px-3 py-2 flex items-center gap-2"
                          style={{ background:"rgba(0,0,0,.35)" }}>
                          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold">효과</span>
                          <span className="text-xs font-bold ml-1" style={{ color:style.accent }}>{effectLabel(p)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 제작소 탭
// ═══════════════════════════════════════════════════════════════════════════════

function CraftTab() {
  const { materials, potions, craftPotion } = usePlayerStore();
  const [craftMsg, setCraftMsg] = useState<{id:string; ok:boolean}|null>(null);
  const [animId,   setAnimId]   = useState<string|null>(null);

  const handleCraft = (potionId: string) => {
    const ok = craftPotion(potionId);
    setCraftMsg({ id:potionId, ok });
    if (ok) { setAnimId(potionId); setTimeout(()=>setAnimId(null), 600); }
    setTimeout(()=>setCraftMsg(null), 2000);
  };

  const totalMats = Object.values(materials).reduce((a,b)=>a+b, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── 재료 섹션 ── */}
      <div className="px-5 py-4" style={{ borderBottom:"1px solid rgba(140,90,20,.1)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color:"rgba(180,120,30,.6)" }}>MATERIALS</p>
            <p className="text-sm font-black text-zinc-200">보유 재료</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-600">총 보유</p>
            <p className="text-lg font-black font-mono"
              style={{ color: totalMats>0?"#f59e0b":"rgba(120,80,20,.4)" }}>
              {totalMats}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MATERIALS.map((mat, i) => {
            const cnt = materials[mat.id] ?? 0;
            return (
              <div key={mat.id} className="rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all"
                style={{
                  background: cnt>0 ? "rgba(20,40,10,.5)" : "rgba(10,7,3,.4)",
                  border: cnt>0 ? "1px solid rgba(34,197,94,.25)" : "1px solid rgba(80,50,10,.2)",
                  animation: `farmIn .35s ease ${i*.08}s both`,
                }}>
                <span className="text-2xl"
                  style={{ filter: cnt>0?"drop-shadow(0 0 6px rgba(34,197,94,.4))":"grayscale(.8) opacity(.4)" }}>
                  {mat.emoji}
                </span>
                <p className="text-[10px] font-bold text-zinc-300 text-center">{mat.name}</p>
                <p className="text-[9px] text-zinc-600 text-center leading-tight">{mat.description}</p>
                <p className={`text-xl font-black font-mono mt-1 transition-all ${cnt>0?"":"opacity-25"}`}
                  style={{ color: cnt>0 ? "#4ade80" : "rgba(120,80,20,.4)" }}>
                  ×{cnt}
                </p>
              </div>
            );
          })}
        </div>

        {totalMats === 0 && (
          <p className="text-xs text-zinc-700 text-center mt-3">
            숲 탐험 → 깊은숲/고대숲에서 재료를 획득할 수 있습니다
          </p>
        )}
      </div>

      {/* ── 레시피 섹션 ── */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color:"rgba(180,120,30,.6)" }}>RECIPES</p>
            <p className="text-sm font-black text-zinc-200">물약 제작</p>
          </div>
          <div className="ml-auto text-[10px] text-zinc-600">
            제작 가능:{" "}
            <span className="font-bold text-amber-400">
              {POTIONS.filter(p=>Object.entries(p.recipe).every(([id,n])=>(materials[id]??0)>=n)).length}
            </span>/{POTIONS.length}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POTIONS.map((potion, pi) => {
            const owned    = potions[potion.id] ?? 0;
            const canCraft = Object.entries(potion.recipe).every(([id,n])=>(materials[id]??0)>=n);
            const isMsg    = craftMsg?.id === potion.id;
            const isAnim   = animId === potion.id;
            const pStyle   = POTION_STYLE[potion.effect.type] ?? POTION_STYLE.heal;
            const effLabel = effectLabel(potion);

            return (
              <div key={potion.id} className="rounded-2xl overflow-hidden flex flex-col"
                style={{
                  background: canCraft
                    ? `linear-gradient(145deg, rgba(20,14,4,.9) 0%, ${pStyle.bg} 100%)`
                    : "rgba(10,7,3,.75)",
                  border: canCraft
                    ? `1px solid ${pStyle.border}`
                    : "1px solid rgba(80,50,10,.2)",
                  boxShadow: canCraft ? `0 0 24px ${pStyle.glow}` : "none",
                  animation: `farmIn .35s ease ${pi*.06}s both`,
                }}>

                {/* can-craft shimmer */}
                {canCraft && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                    <div className="absolute inset-y-0 w-12 opacity-0 hover:opacity-100"
                      style={{ background:`linear-gradient(to right, transparent, ${pStyle.accent}18, transparent)` }}/>
                  </div>
                )}

                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* 헤더 */}
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <span className="text-3xl">{potion.emoji}</span>
                      {owned > 0 && (
                        <div className="absolute -top-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center"
                          style={{ background:pStyle.accent, fontSize:9, fontWeight:900, color:"#000" }}>
                          {owned}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-100">{potion.name}</p>
                      <p className="text-[10px] text-zinc-500">{potion.description}</p>
                    </div>
                    {canCraft && (
                      <div className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                        style={{ background:`${pStyle.accent}22`, color:pStyle.accent, border:`1px solid ${pStyle.accent}50` }}>
                        제작 가능
                      </div>
                    )}
                  </div>

                  {/* 효과 */}
                  <div className="rounded-lg px-3 py-2"
                    style={{ background:"rgba(0,0,0,.35)", border:"1px solid rgba(255,255,255,.04)" }}>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-0.5">효과</p>
                    <p className="text-xs font-bold" style={{ color: canCraft ? pStyle.accent : "#71717a" }}>
                      {effLabel}
                    </p>
                  </div>

                  {/* 재료 */}
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold mb-1.5">필요 재료</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(potion.recipe).map(([matId, need]) => {
                        const mat  = getMaterial(matId);
                        const have = materials[matId] ?? 0;
                        const ok   = have >= need;
                        return (
                          <div key={matId}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px]"
                            style={{
                              background: ok ? "rgba(16,60,20,.6)" : "rgba(30,10,10,.5)",
                              border: `1px solid ${ok?"rgba(34,197,94,.4)":"rgba(239,68,68,.3)"}`,
                            }}>
                            <span>{mat?.emoji??""}</span>
                            <span style={{ color: ok?"#86efac":"#fca5a5" }}>{mat?.name??matId}</span>
                            <span className="font-black font-mono" style={{ color: ok?"#4ade80":"#ef4444" }}>
                              {have}/{need}
                            </span>
                            {ok && <span style={{ color:"#4ade80" }}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 제작 버튼 */}
                <button
                  onClick={()=>canCraft && handleCraft(potion.id)}
                  disabled={!canCraft}
                  className="relative w-full py-3 text-sm font-black transition-all overflow-hidden"
                  style={{
                    background: isMsg && craftMsg?.ok
                      ? `linear-gradient(90deg, ${pStyle.bg}, ${pStyle.accent}40)`
                      : canCraft
                        ? `linear-gradient(90deg, ${pStyle.bg}, rgba(0,0,0,.3))`
                        : "rgba(10,7,3,.4)",
                    borderTop: `1px solid ${canCraft ? pStyle.border : "rgba(80,50,10,.15)"}`,
                    color: isMsg && !craftMsg?.ok ? "#ef4444" : canCraft ? pStyle.accent : "#3f3f46",
                    cursor: canCraft ? "pointer" : "not-allowed",
                    animation: isAnim ? "craftSuccess .6s ease" : "none",
                  }}>
                  {isMsg
                    ? craftMsg?.ok ? `✓ ${potion.name} 제작 완료!` : "재료가 부족합니다"
                    : canCraft ? `${potion.emoji} 제작하기` : "재료 부족"
                  }
                  {/* shimmer on can-craft */}
                  {canCraft && !isMsg && (
                    <div className="absolute inset-y-0 w-8 pointer-events-none opacity-40"
                      style={{
                        background:`linear-gradient(to right,transparent,${pStyle.accent}50,transparent)`,
                        animation:"shimmerFarm 3s ease-in-out 1s infinite",
                      }}/>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FarmPage
// ═══════════════════════════════════════════════════════════════════════════════

type FarmTab = "monsters" | "potions" | "craft";

const TAB_DATA: { id: FarmTab; label: string; icon: string; subtitle: string }[] = [
  { id:"monsters", label:"내 몬스터",  icon:"🐾", subtitle:"파티 & 보관함" },
  { id:"potions",  label:"가방",       icon:"🎒", subtitle:"물약 인벤토리" },
  { id:"craft",    label:"제작소",     icon:"⚗️", subtitle:"재료 & 레시피" },
];

export default function FarmPage() {
  const navigate  = useNavigate();
  const { party, storage, bestFloor, potions, materials, restorePartyHp } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<FarmTab>("monsters");
  const [restoreAnim, setRestoreAnim] = useState(false);

  const totalPotions  = Object.values(potions).reduce((a,b)=>a+b, 0);
  const totalMaterials = Object.values(materials).reduce((a,b)=>a+b, 0);
  const faintedCount  = party.filter(m=>m.currentHp===0).length;

  const handleRestore = () => {
    restorePartyHp();
    setRestoreAnim(true);
    setTimeout(()=>setRestoreAnim(false), 800);
  };

  return (
    <div className="h-screen flex flex-col text-zinc-100 overflow-hidden"
      style={{ background:"linear-gradient(160deg,#0d0906 0%,#0b0705 50%,#0d0906 100%)" }}>
      <style>{FARM_STYLES}</style>

      {/* ── 헤더 ── */}
      <header style={{
        background:"rgba(10,6,2,.92)",
        borderBottom:"1px solid rgba(140,90,20,.18)",
        boxShadow:"0 1px 0 rgba(245,158,11,.06)",
      }}>
        {/* 최상단 얇은 황금 라인 */}
        <div style={{ height:2, background:"linear-gradient(90deg,transparent,rgba(217,119,6,.5),transparent)" }}/>

        <div className="flex items-center justify-between px-6 py-3">
          {/* 왼쪽 */}
          <div className="flex items-center gap-4">
            <button onClick={()=>navigate("/")}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold transition"
              style={{
                background:"rgba(20,12,4,.8)",
                border:"1px solid rgba(140,90,20,.3)",
                color:"rgba(200,150,50,.8)",
              }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(245,158,11,.5)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="rgba(140,90,20,.3)")}>
              ← 베이스캠프
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color:"rgba(180,120,30,.5)" }}>FARM</p>
              <p className="text-base font-black text-zinc-100">농장 관리</p>
            </div>
          </div>

          {/* 오른쪽: 스탯 + 회복 */}
          <div className="flex items-center gap-3">
            {/* 빠른 스탯 */}
            <div className="hidden sm:flex items-center gap-3">
              {[
                { icon:"🐾", label:"파티", value:`${party.length}/3` },
                { icon:"📦", label:"보관함", value:`${storage.length}/30` },
                { icon:"🎒", label:"물약", value:totalPotions },
                { icon:"🌿", label:"재료", value:totalMaterials },
              ].map(s=>(
                <div key={s.label} className="text-center px-3 py-1.5 rounded-xl"
                  style={{ background:"rgba(20,12,4,.6)", border:"1px solid rgba(80,50,10,.2)" }}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
                  <p className="text-sm font-black text-zinc-200">{s.value}</p>
                </div>
              ))}
              {bestFloor > 0 && (
                <div className="text-center px-3 py-1.5 rounded-xl"
                  style={{ background:"rgba(30,15,2,.6)", border:"1px solid rgba(180,100,10,.25)" }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color:"rgba(180,120,30,.6)" }}>최고층</p>
                  <p className="text-sm font-black" style={{ color:"#f59e0b" }}>{bestFloor}F</p>
                </div>
              )}
            </div>

            {/* HP 회복 */}
            <button onClick={handleRestore}
              className="relative rounded-xl px-4 py-2 text-sm font-black transition overflow-hidden"
              style={{
                background: faintedCount>0
                  ? "linear-gradient(135deg,rgba(20,60,20,.8),rgba(10,30,10,.9))"
                  : "rgba(10,20,10,.6)",
                border: faintedCount>0
                  ? "1px solid rgba(34,197,94,.5)"
                  : "1px solid rgba(30,60,20,.3)",
                color: faintedCount>0 ? "#4ade80" : "#3f6030",
                boxShadow: faintedCount>0 && restoreAnim ? "0 0 20px rgba(52,211,153,.5)" : "none",
              }}>
              {restoreAnim && (
                <div className="absolute inset-0 rounded-xl"
                  style={{ background:"rgba(52,211,153,.15)", animation:"bubblePop .6s ease" }}/>
              )}
              <span className="relative">
                {restoreAnim ? "✓ 회복 완료!" : faintedCount>0 ? `⚡ HP 전회복 (${faintedCount}마리 기절)` : "파티 HP 전회복"}
              </span>
            </button>
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="flex">
          {TAB_DATA.map(tab => {
            const isActive = activeTab === tab.id;
            const badge =
              tab.id==="potions" ? totalPotions :
              tab.id==="craft"   ? Object.values(materials).reduce((a,b)=>a+b,0) : 0;
            return (
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all"
                style={{
                  color: isActive ? "#f59e0b" : "rgba(120,80,20,.6)",
                  borderBottom: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                  background: isActive ? "rgba(245,158,11,.06)" : "transparent",
                }}>
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {badge > 0 && (
                  <span className="rounded-full px-1.5 text-[9px] font-black"
                    style={{
                      background: isActive ? "rgba(245,158,11,.25)" : "rgba(80,50,10,.3)",
                      color: isActive ? "#f59e0b" : "rgba(120,80,20,.6)",
                      minWidth:18, textAlign:"center",
                    }}>
                    {badge}
                  </span>
                )}
                {/* active indicator glow */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background:"rgba(245,158,11,.6)", filter:"blur(2px)" }}/>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab==="monsters" && <MonstersTab/>}
        {activeTab==="potions"  && <BagTab/>}
        {activeTab==="craft"    && <CraftTab/>}
      </div>
    </div>
  );
}
