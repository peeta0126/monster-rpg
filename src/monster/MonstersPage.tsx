import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type OwnedMonster } from "../shared/playerStore";
import { MONSTER_IMAGE_MAP, monsterImgStyle } from "./monsterImages";
import { getFullLearnset } from "./learnset";
import { monsters } from "./monsters";
import type { ArtifactInstance } from "../shared/crafting";
import {
  ARTIFACT_SLOT_MAP, ARTIFACT_SLOT_LABEL, ALL_ARTIFACT_SLOTS,
  QUALITY_COLOR, QUALITY_LABEL, ARTIFACT_STAT_LABEL, sumEquippedStatBonuses,
} from "../shared/craftingUtils";

/** 파티 카드/상태창에 반영할 장비 능력치 (HP는 배틀 실수치와 어긋나지 않도록 제외) */
export interface EquipStatBonus { attack: number; defense: number; speed: number }
const ZERO_EQUIP_BONUS: EquipStatBonus = { attack: 0, defense: 0, speed: 0 };

// ─── 속성 상수 ────────────────────────────────────────────────────────────────────
const TYPE_KO: Record<string, string> = {
  fire:"불꽃", water:"물", grass:"풀", electric:"전기", ice:"얼음", normal:"노말",
  poison:"독",
  none:"무속성",
};

const TYPE_ACCENT: Record<string, { glow: string; border: string; bg: string; label: string }> = {
  fire:     { glow:"rgba(239,68,68,.45)",   border:"#ef4444", bg:"rgba(239,68,68,.1)",   label:"bg-red-900/80 text-red-200 border-red-700" },
  water:    { glow:"rgba(59,130,246,.45)",  border:"#3b82f6", bg:"rgba(59,130,246,.1)",  label:"bg-blue-900/80 text-blue-200 border-blue-700" },
  grass:    { glow:"rgba(34,197,94,.45)",   border:"#22c55e", bg:"rgba(34,197,94,.1)",   label:"bg-green-900/80 text-green-200 border-green-700" },
  electric: { glow:"rgba(234,179,8,.5)",    border:"#eab308", bg:"rgba(234,179,8,.1)",   label:"bg-yellow-900/80 text-yellow-200 border-yellow-700" },
  ice:      { glow:"rgba(103,232,249,.45)", border:"#67e8f9", bg:"rgba(103,232,249,.1)", label:"bg-cyan-900/80 text-cyan-200 border-cyan-700" },
  normal:   { glow:"rgba(161,161,170,.35)", border:"#a1a1aa", bg:"rgba(161,161,170,.08)",label:"bg-zinc-800/80 text-zinc-200 border-zinc-600" },
  poison:   { glow:"rgba(168,85,247,.45)",  border:"#a855f7", bg:"rgba(168,85,247,.1)",  label:"bg-purple-900/80 text-purple-200 border-purple-700" },
  none:     { glow:"rgba(217,70,239,.4)",   border:"#d946ef", bg:"rgba(217,70,239,.1)",  label:"bg-fuchsia-900/80 text-fuchsia-200 border-fuchsia-700" },
};

const MOVE_CATEGORY_KO: Record<string, string> = {
  physical: "물리", special: "특수", status: "상태",
};

const STATUS_KO: Record<string, string> = {
  burn: "화상", paralysis: "마비", freeze: "빙결", poison: "독",
};

function hpGradient(pct: number): string {
  if (pct > 65) return "linear-gradient(90deg, #15803d, #22c55e)";
  if (pct > 35) return "linear-gradient(90deg, #a16207, #eab308)";
  if (pct > 15) return "linear-gradient(90deg, #c2410c, #f97316)";
  return "linear-gradient(90deg, #991b1b, #ef4444)";
}

const MON_STYLES = `
@keyframes monIn {
  from { transform: translateY(12px) scale(.97); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes glowBreathe {
  0%,100%{ opacity: .55; }
  50%    { opacity: .9; }
}
@keyframes hpLoad { from { width: 0; } }
@keyframes selectRing {
  0%,100%{ box-shadow: 0 0 0 2px var(--sel-color,#f59e0b), 0 0 16px var(--sel-glow,rgba(245,158,11,.4)); }
  50%    { box-shadow: 0 0 0 2px var(--sel-color,#f59e0b), 0 0 28px var(--sel-glow,rgba(245,158,11,.55)); }
}
@keyframes bubblePop {
  0%  { transform: scale(0); opacity: 1; }
  100%{ transform: scale(3); opacity: 0; }
}
`;

// ─── ReleaseBtn ────────────────────────────────────────────────────────────────
function ReleaseBtn({ disabled, onRelease }: { disabled: boolean; onRelease: () => void }) {
  const [pending, setPending] = useState(false);

  if (disabled) {
    return (
      <button disabled className="text-[10px] font-bold px-2 py-0.5 rounded"
        style={{ background: "rgba(40,20,20,.2)", border: "1px solid rgba(80,30,30,.2)", color: "rgba(120,60,60,.3)" }}>
        놓아주기
      </button>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pending) {
      setPending(true);
      setTimeout(() => setPending(false), 2500);
    } else {
      setPending(false);
      onRelease();
    }
  };

  return (
    <button onClick={handleClick}
      className="text-[10px] font-bold px-2 py-0.5 rounded transition"
      style={{
        background: pending ? "rgba(180,30,30,.35)" : "rgba(80,20,20,.25)",
        border: pending ? "1px solid rgba(220,60,60,.55)" : "1px solid rgba(140,40,40,.35)",
        color: pending ? "#fca5a5" : "rgba(200,90,90,.65)",
      }}>
      {pending ? "확인?" : "놓아주기"}
    </button>
  );
}

// ─── EquipModal ────────────────────────────────────────────────────────────────
function EquipModal({
  monster,
  equipped,
  available,
  onEquip,
  onUnequip,
  onClose,
}: {
  monster: OwnedMonster;
  equipped: ArtifactInstance[];
  available: ArtifactInstance[];
  onEquip: (artifact: ArtifactInstance) => void;
  onUnequip: (instanceId: string) => void;
  onClose: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const visibleArtifacts = selectedSlot
    ? available.filter((a) => ARTIFACT_SLOT_MAP[a.itemId] === selectedSlot)
    : available;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,.78)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl w-[500px] max-h-[90vh] overflow-y-auto"
        style={{
          background: "rgba(12,7,2,.98)",
          border: "1px solid rgba(180,120,30,.4)",
          boxShadow: "0 0 48px rgba(0,0,0,.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(12,7,2,.98)", borderBottom: "1px solid rgba(140,90,20,.2)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#b47828" }}>장비 관리</p>
            <p className="text-base font-black text-zinc-100">{monster.nickname ?? monster.name}</p>
          </div>
          <button onClick={onClose}
            className="text-base font-black transition hover:brightness-125 rounded-lg px-2 py-1"
            style={{ color: "#8b6014", background: "rgba(40,20,4,.6)" }}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* 현재 장착 슬롯 */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(180,120,30,.65)" }}>
              장착 중인 장비 (슬롯 클릭 → 가방 필터)
            </p>
            <div className="flex flex-col gap-2">
              {ALL_ARTIFACT_SLOTS.map((slot) => {
                const item = equipped.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
                const isActive = selectedSlot === slot;
                return (
                  <div
                    key={slot}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition"
                    style={{
                      background: isActive ? "rgba(180,120,30,.12)" : "rgba(0,0,0,.35)",
                      border: `1px solid ${isActive ? "rgba(180,120,30,.5)" : "rgba(80,50,10,.3)"}`,
                    }}
                    onClick={() => setSelectedSlot(isActive ? null : slot)}
                  >
                    <span className="w-16 text-[11px] font-bold shrink-0" style={{ color: "#a07818" }}>
                      {ARTIFACT_SLOT_LABEL[slot]}
                    </span>
                    {item ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black truncate" style={{ color: "#f5e6c8" }}>{item.name}</p>
                          <p className="text-[9px] font-bold mt-0.5" style={{ color: QUALITY_COLOR[item.quality] }}>
                            {QUALITY_LABEL[item.quality]}
                          </p>
                          {item.statBonuses && item.statBonuses.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-1">
                              {item.statBonuses.map((sb, i) => (
                                <span key={i} className="text-[8px] px-1 py-0.5 rounded"
                                  style={{ background: "rgba(60,40,10,.8)", color: "#d4a030" }}>
                                  {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onUnequip(item.instanceId); }}
                          className="text-[9px] font-bold px-2 py-0.5 rounded shrink-0 transition hover:brightness-125"
                          style={{
                            background: "rgba(120,30,30,.6)",
                            border: "1px solid rgba(200,60,60,.4)",
                            color: "#fca5a5",
                          }}
                        >
                          해제
                        </button>
                      </>
                    ) : (
                      <p className="text-[10px]" style={{ color: "rgba(120,80,20,.4)" }}>— 비어있음 —</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 가방의 아티팩트 */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(180,120,30,.65)" }}>
              가방의 아티팩트{selectedSlot ? ` — ${ARTIFACT_SLOT_LABEL[selectedSlot]} 필터` : ""}
            </p>
            {visibleArtifacts.length === 0 ? (
              <p className="text-center py-5 text-xs" style={{ color: "rgba(120,80,20,.5)" }}>
                {selectedSlot
                  ? `장착 가능한 ${ARTIFACT_SLOT_LABEL[selectedSlot]}이 없습니다.`
                  : "가방에 아티팩트가 없습니다."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleArtifacts.map((a) => (
                  <button
                    key={a.instanceId}
                    onClick={() => onEquip(a)}
                    className="rounded-xl px-3 py-2 text-left transition hover:brightness-110 w-full"
                    style={{
                      background: "rgba(28,14,4,.88)",
                      border: `1px solid ${QUALITY_COLOR[a.quality]}44`,
                    }}
                  >
                    <p className="text-[11px] font-black leading-tight" style={{ color: "#f5e6c8" }}>{a.name}</p>
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: QUALITY_COLOR[a.quality] }}>
                      {QUALITY_LABEL[a.quality]}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(140,90,20,.7)" }}>
                      {ARTIFACT_SLOT_LABEL[ARTIFACT_SLOT_MAP[a.itemId]] ?? "알 수 없음"}
                    </p>
                    {a.statBonuses && a.statBonuses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {a.statBonuses.map((sb, i) => (
                          <span key={i} className="text-[8px] px-1 py-0.5 rounded"
                            style={{ background: "rgba(60,40,10,.8)", color: "#d4a030" }}>
                            {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 text-center text-[9px] font-black rounded py-0.5"
                      style={{ background: "rgba(180,120,30,.15)", color: "#b47828" }}>
                      장착하기
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MonsterStatusPanel ──────────────────────────────────────────────────────────
// 파티/보관함에서 클릭한 몬스터의 정보를 보여주는 상시 패널(모달 아님).
function MonsterStatusPanel({ monster, equipBonus = ZERO_EQUIP_BONUS }: {
  monster: OwnedMonster | null; equipBonus?: EquipStatBonus;
}) {
  if (!monster) {
    return (
      <div className="w-72 flex-shrink-0 flex flex-col"
        style={{ background: "rgba(10,6,2,.5)", borderRight: "1px solid rgba(140,90,20,.15)" }}>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(140,90,20,.1)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(180,120,30,.6)" }}>STATUS</p>
          <p className="text-sm font-black text-zinc-200">상태창</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-xs" style={{ color: "rgba(120,80,20,.5)" }}>
            몬스터를 클릭하면<br />상세 정보가 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  const acc = TYPE_ACCENT[monster.type ?? "none"] ?? TYPE_ACCENT.normal;
  const stats: [string, number, number][] = [
    ["HP", monster.maxHp, 0],
    ["공격", monster.attack, equipBonus.attack],
    ["방어", monster.defense, equipBonus.defense],
    ["속도", monster.speed, equipBonus.speed],
  ];

  return (
    <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
      style={{ background: "rgba(10,6,2,.5)", borderRight: "1px solid rgba(140,90,20,.15)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(140,90,20,.1)" }}>
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(180,120,30,.6)" }}>STATUS</p>
        <p className="text-sm font-black text-zinc-200">상태창</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: acc.bg, border: `1px solid ${acc.border}` }}>
            <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
              className="w-11 h-11 object-contain pixel-img" style={monsterImgStyle(monster.id)} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-black text-zinc-100 truncate">{monster.nickname ?? monster.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-bold text-zinc-500">Lv.{monster.level}</span>
              <span className={`rounded-full border px-1.5 text-[9px] font-bold ${acc.label}`}>
                {TYPE_KO[monster.type ?? "none"] ?? ""}
              </span>
            </div>
          </div>
        </div>

        {/* 종합 능력치 */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(180,120,30,.65)" }}>
            종합 능력치
          </p>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([label, base, bonus]) => (
              <div key={label} className="flex flex-col items-center rounded-lg py-2"
                style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(80,50,10,.3)" }}>
                <span className="text-[9px] font-bold" style={{ color: "rgba(180,120,30,.6)" }}>{label}</span>
                <span className="text-sm font-black text-zinc-200 mt-0.5">
                  {label === "HP" ? `${monster.currentHp}/${monster.maxHp}` : base + bonus}
                </span>
                {bonus > 0 && <span className="text-[9px] font-bold text-emerald-400">+{bonus}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 성장 — 다음 레벨까지, 다음에 배울 기술, 진화 예정 */}
        {(() => {
          const expPct = monster.expToNextLevel > 0
            ? Math.min(100, (monster.exp / monster.expToNextLevel) * 100) : 0;
          const nextLearn = getFullLearnset(monster.id).find((e) => e.level > monster.level);
          const evoTo = monster.evolvesTo
            ? monsters.find((m) => m.id === monster.evolvesTo) : undefined;
          return (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(180,120,30,.65)" }}>
                성장
              </p>
              <div className="rounded-xl px-3 py-2.5"
                style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(80,50,10,.3)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold" style={{ color: "rgba(180,120,30,.6)" }}>다음 레벨까지</span>
                  <span className="text-[10px] font-mono text-zinc-300">
                    {monster.exp} / {monster.expToNextLevel}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${expPct}%`, background: "#d4a017" }} />
                </div>

                {nextLearn && (
                  <p className="mt-2 text-[10px]" style={{ color: "rgba(200,160,90,.85)" }}>
                    Lv.{nextLearn.level} — <span className="font-bold text-zinc-200">{nextLearn.move.name}</span> 습득
                  </p>
                )}
                {evoTo && monster.evolvesAtLevel !== undefined && (
                  <p className="mt-1 text-[10px]" style={{ color: "rgba(200,160,90,.85)" }}>
                    Lv.{monster.evolvesAtLevel} — <span className="font-bold text-zinc-200">{evoTo.name}</span>(으)로 진화
                  </p>
                )}
                {!nextLearn && !evoTo && (
                  <p className="mt-2 text-[10px]" style={{ color: "rgba(140,90,20,.7)" }}>
                    더 배울 기술도, 남은 진화도 없습니다.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* 보유 스킬 */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(180,120,30,.65)" }}>
            보유 스킬 ({monster.moves.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {monster.moves.map((mv) => {
              const mvAcc = TYPE_ACCENT[mv.type] ?? TYPE_ACCENT.normal;
              return (
                <div key={mv.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(80,50,10,.3)" }}>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${mvAcc.label}`}>
                    {TYPE_KO[mv.type] ?? mv.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black truncate" style={{ color: "#f5e6c8" }}>{mv.name}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(140,90,20,.7)" }}>
                      {MOVE_CATEGORY_KO[mv.category] ?? mv.category}
                      {mv.statusEffect && ` · ${STATUS_KO[mv.statusEffect] ?? mv.statusEffect} ${mv.statusChance ?? 0}%`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-mono text-zinc-300">위력 {mv.power === 0 ? "—" : mv.power}</p>
                    <p className="text-[9px] font-mono" style={{ color: "rgba(140,90,20,.6)" }}>명중 {mv.accuracy}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MonsterCard ────────────────────────────────────────────────────────────────
function MonsterCard({
  monster, size = "md", selected, dimmed, onClick, showStats = false,
  equippedSlots = [], equipBonus = ZERO_EQUIP_BONUS,
}: {
  monster: OwnedMonster; size?: "sm" | "md" | "lg";
  selected?: boolean; dimmed?: boolean; onClick: () => void; showStats?: boolean;
  equippedSlots?: string[]; equipBonus?: EquipStatBonus;
}) {
  const hpPct     = monster.maxHp === 0 ? 0 : Math.round((monster.currentHp / monster.maxHp) * 100);
  const isFainted = hpPct === 0;
  const acc       = TYPE_ACCENT[monster.type ?? "none"] ?? TYPE_ACCENT.normal;
  const imgSize   = size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-11 h-11";

  return (
    <button
      onClick={onClick}
      className="relative rounded-xl flex flex-col items-center gap-1.5 transition-all w-full overflow-hidden"
      style={{
        padding: size === "lg" ? "14px 10px" : "10px 8px",
        background: selected
          ? `linear-gradient(145deg, ${acc.bg}, rgba(10,6,2,.9))`
          : dimmed ? "rgba(10,7,3,.5)" : "rgba(14,9,3,.85)",
        border: selected ? `1.5px solid ${acc.border}` : `1px solid rgba(140,90,20,.2)`,
        boxShadow: selected ? `0 0 20px ${acc.glow}, inset 0 0 12px rgba(0,0,0,.4)` : "inset 0 0 8px rgba(0,0,0,.3)",
        opacity: dimmed ? .45 : 1,
        animation: selected ? "selectRing 2.2s ease-in-out infinite" : "none",
      } as React.CSSProperties}
    >
      {isFainted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(0,0,0,.55)", backdropFilter: "blur(1px)" }}>
          <span className="text-xs font-black text-red-400 tracking-widest rotate-[-15deg] opacity-90">기절</span>
        </div>
      )}

      <div className="relative flex-shrink-0">
        {selected && (
          <div className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${acc.glow}, transparent 65%)`, animation: "glowBreathe 2s ease-in-out infinite" }} />
        )}
        <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
          className={`${imgSize} object-contain relative pixel-img`}
          style={{
            ...monsterImgStyle(monster.id),
            filter: isFainted ? "grayscale(.8) brightness(.6)" : selected ? `drop-shadow(0 0 8px ${acc.glow})` : "none",
          }} />
      </div>

      <div className="text-center w-full px-0.5">
        <p className="font-bold text-zinc-100 truncate leading-tight" style={{ fontSize: size === "sm" ? 10 : 11 }}>
          {monster.nickname ?? monster.name}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          <span className="text-[9px] font-bold text-zinc-500">Lv.{monster.level}</span>
          <span className={`rounded-full border px-1 text-[8px] font-bold ${acc.label}`} style={{ paddingTop: 0, paddingBottom: 0 }}>
            {TYPE_KO[monster.type ?? "none"] ?? ""}
          </span>
        </div>
      </div>

      <div className="w-full px-0.5">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-[8px] text-zinc-600 font-bold">HP</span>
          <span className="text-[8px] text-zinc-500">{monster.currentHp}/{monster.maxHp}</span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: "rgba(0,0,0,.5)" }}>
          <div className="h-full rounded-full transition-all"
            style={{ width: `${hpPct}%`, background: hpGradient(hpPct), animation: "hpLoad .6s ease both" }} />
        </div>
      </div>

      {showStats && (
        <div className="w-full px-0.5 grid grid-cols-3 gap-0.5 mt-0.5">
          {([
            ["공", monster.attack, equipBonus.attack],
            ["방", monster.defense, equipBonus.defense],
            ["속", monster.speed, equipBonus.speed],
          ] as [string, number, number][]).map(([l, base, bonus]) => (
            <div key={l} className="flex flex-col items-center rounded py-0.5" style={{ background: "rgba(0,0,0,.3)" }}>
              <span className="text-[8px] text-zinc-600">{l}</span>
              <span className="text-[10px] font-bold text-zinc-300">{base + bonus}</span>
              {bonus > 0 && <span className="text-[7px] font-bold text-emerald-400 leading-none">+{bonus}</span>}
            </div>
          ))}
        </div>
      )}

      {equippedSlots.length > 0 && (
        <div className="w-full flex items-center gap-0.5 justify-center flex-wrap mt-0.5">
          {equippedSlots.map((slot) => (
            <span key={slot} className="text-[7px] px-1 rounded font-bold"
              style={{ background: "rgba(180,120,30,.2)", color: "#b47828", border: "1px solid rgba(180,120,30,.3)" }}>
              {ARTIFACT_SLOT_LABEL[slot]}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function EmptyPartySlot({ index, selected, onClick }: { index: number; selected?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-xl w-full h-32 flex flex-col items-center justify-center gap-2 transition-all"
      style={{
        background: selected ? "rgba(245,158,11,.08)" : "rgba(10,7,3,.5)",
        border: selected ? "1.5px solid #f59e0b" : "1px dashed rgba(140,90,20,.25)",
        boxShadow: selected ? "0 0 16px rgba(245,158,11,.25)" : "none",
      }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: selected ? "rgba(245,158,11,.15)" : "rgba(80,50,10,.15)", border: "1px dashed rgba(140,90,20,.3)" }}>
        <span className="text-xl" style={{ color: selected ? "#f59e0b" : "rgba(120,80,20,.5)" }}>+</span>
      </div>
      <span className="text-[10px] font-semibold" style={{ color: selected ? "#f59e0b" : "rgba(120,80,20,.5)" }}>슬롯 {index + 1}</span>
    </button>
  );
}

// ─── MonstersPage ──────────────────────────────────────────────────────────────────
type SortKey = "level" | "hp" | "type";

export default function MonstersPage() {
  const navigate = useNavigate();
  const {
    party, storage, bestFloor,
    moveToStorage, swapWithStorage, moveToParty, swapPartySlots, restorePartyHp,
    equippedArtifacts, craftedArtifacts, equipArtifact, unequipArtifact, releaseMonster,
  } = usePlayerStore();

  const [selParty,   setSelParty]   = useState<number | null>(null);
  const [selStorage, setSelStorage] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy,     setSortBy]     = useState<SortKey>("level");
  const [restoreAnim, setRestoreAnim] = useState(false);

  // 장비 모달
  const [equipModalUid, setEquipModalUid] = useState<string | null>(null);
  const equipModalMonster = equipModalUid
    ? ([...party, ...storage].find((m) => m.uid === equipModalUid) ?? null)
    : null;

  // 상세 정보 모달
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const detailMonster = detailUid
    ? ([...party, ...storage].find((m) => m.uid === detailUid) ?? null)
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (equipModalUid) { setEquipModalUid(null); return; }
      navigate("/", { state: { openMenu: true } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [equipModalUid, navigate]);

  // 몬스터 클릭 시: 다른 몬스터가 이미 선택된 상태라면 파티 교체를 수행하고,
  // 아무것도 선택되지 않은 상태라면 선택 표시와 함께 상세 정보를 띄운다.
  const handlePartyClick = (idx: number) => {
    if (selStorage !== null) {
      if (idx < party.length) swapWithStorage(idx, selStorage);
      else moveToParty(selStorage, idx);
      setSelStorage(null); setSelParty(null); setDetailUid(null); return;
    }
    if (selParty !== null && selParty !== idx) {
      swapPartySlots(selParty, idx); setSelParty(null); setDetailUid(null); return;
    }
    if (selParty === idx) {
      setSelParty(null); setDetailUid(null);
      return;
    }
    setSelParty(idx);
    const m = party[idx];
    if (m) setDetailUid(m.uid);
  };

  const handleStorageClick = (uid: string) => {
    if (selParty !== null) {
      if (selParty < party.length) swapWithStorage(selParty, uid);
      else moveToParty(uid, selParty);
      setSelParty(null); setSelStorage(null); setDetailUid(null); return;
    }
    if (selStorage === uid) {
      setSelStorage(null); setDetailUid(null);
      return;
    }
    setSelStorage(uid);
    setDetailUid(uid);
  };

  const handleRemove = (idx: number) => {
    if (party.length <= 1) return;
    moveToStorage(idx); setSelParty(null); setDetailUid(null);
  };

  const handleRestore = () => {
    restorePartyHp();
    setRestoreAnim(true);
    setTimeout(() => setRestoreAnim(false), 800);
  };

  // 장비 모달 핸들러
  const handleEquip = (artifact: ArtifactInstance) => {
    if (!equipModalUid) return;
    equipArtifact(equipModalUid, artifact);
  };

  const handleUnequip = (instanceId: string) => {
    if (!equipModalUid) return;
    unequipArtifact(equipModalUid, instanceId);
  };

  // 놓아주기 핸들러
  const handleRelease = (uid: string) => {
    releaseMonster(uid);
    setSelParty(null);
    setSelStorage(null);
    if (detailUid === uid) setDetailUid(null);
    if (equipModalUid === uid) setEquipModalUid(null);
  };

  // 헬퍼: 장착 슬롯 이름 목록
  const getEquippedSlots = (uid: string): string[] =>
    (equippedArtifacts[uid] ?? []).map((a) => ARTIFACT_SLOT_MAP[a.itemId]).filter(Boolean);

  // 헬퍼: 장착 장비의 공격/방어/속도 합산 보너스 (HP는 배틀 실수치와 어긋나지 않도록 제외)
  const getEquipBonus = (uid: string): EquipStatBonus => {
    const totals = sumEquippedStatBonuses(equippedArtifacts[uid] ?? []);
    return { attack: totals.attack, defense: totals.defense, speed: totals.speed };
  };

  const storageTypes = [...new Set(storage.map((m) => m.type))]
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const filteredStorage = [...storage]
    .filter((m) => typeFilter === "all" || m.type === typeFilter)
    .sort((a, b) => {
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "hp")    return (b.currentHp / b.maxHp) - (a.currentHp / a.maxHp);
      return (a.type ?? "").localeCompare(b.type ?? "");
    });

  // 속성 필터를 바꿔서 상태창에 표시 중이던 몬스터가 목록에서 사라지면 선택/상태창도 함께 초기화
  useEffect(() => {
    if (selStorage && !filteredStorage.some((m) => m.uid === selStorage)) {
      setSelStorage(null);
      setDetailUid(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const faintedCount = party.filter((m) => m.currentHp === 0).length;

  const hint = selParty !== null
    ? "📦 보관함의 몬스터를 선택해 교체"
    : selStorage !== null
      ? "👥 파티 슬롯을 선택해 교체하거나 추가"
      : "슬롯 또는 보관함 몬스터를 클릭해 선택";

  return (
    <div className="h-screen flex flex-col text-zinc-100 overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0d0906 0%,#0b0705 50%,#0d0906 100%)" }}>
      <style>{MON_STYLES}</style>

      {/* ── 헤더 ── */}
      <header style={{
        background: "rgba(10,6,2,.92)",
        borderBottom: "1px solid rgba(140,90,20,.18)",
        boxShadow: "0 1px 0 rgba(245,158,11,.06)",
        flexShrink: 0,
      }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,transparent,rgba(217,119,6,.5),transparent)" }} />
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold transition"
              style={{ background: "rgba(20,12,4,.8)", border: "1px solid rgba(140,90,20,.3)", color: "rgba(200,150,50,.8)" }}>
              ← 베이스캠프
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "rgba(180,120,30,.5)" }}>MONSTERS</p>
              <p className="text-base font-black text-zinc-100">내 몬스터</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              {[
                { label: "파티",   value: `${party.length}/3` },
                { label: "보관함", value: `${storage.length}/30` },
              ].map((s) => (
                <div key={s.label} className="text-center px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(20,12,4,.6)", border: "1px solid rgba(80,50,10,.2)" }}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
                  <p className="text-sm font-black text-zinc-200">{s.value}</p>
                </div>
              ))}
              {bestFloor > 0 && (
                <div className="text-center px-3 py-1.5 rounded-xl"
                  style={{ background: "rgba(30,15,2,.6)", border: "1px solid rgba(180,100,10,.25)" }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(180,120,30,.6)" }}>최고층</p>
                  <p className="text-sm font-black" style={{ color: "#f59e0b" }}>{bestFloor}F</p>
                </div>
              )}
            </div>

            <button onClick={handleRestore}
              className="relative rounded-xl px-4 py-2 text-sm font-black transition overflow-hidden"
              style={{
                background: faintedCount > 0 ? "linear-gradient(135deg,rgba(20,60,20,.8),rgba(10,30,10,.9))" : "rgba(10,20,10,.6)",
                border: faintedCount > 0 ? "1px solid rgba(34,197,94,.5)" : "1px solid rgba(30,60,20,.3)",
                color: faintedCount > 0 ? "#4ade80" : "#3f6030",
                boxShadow: faintedCount > 0 && restoreAnim ? "0 0 20px rgba(52,211,153,.5)" : "none",
              }}>
              {restoreAnim && (
                <div className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(52,211,153,.15)", animation: "bubblePop .6s ease" }} />
              )}
              <span className="relative">
                {restoreAnim ? "✓ 회복 완료!" : faintedCount > 0 ? `⚡ HP 전회복 (${faintedCount}마리 기절)` : "파티 HP 전회복"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 콘텐츠 ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 파티 패널 */}
        <div className="w-56 flex-shrink-0 flex flex-col"
          style={{ background: "rgba(10,6,2,.5)", borderRight: "1px solid rgba(140,90,20,.15)" }}>
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(140,90,20,.1)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(180,120,30,.6)" }}>PARTY</p>
              <p className="text-sm font-black text-zinc-200">전투 파티 <span className="text-zinc-500 font-normal">({party.length}/3)</span></p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
            {[0, 1, 2].map((idx) => {
              const m = party[idx];
              return m ? (
                <div key={m.uid} className="flex flex-col gap-1">
                  <MonsterCard monster={m} size="md"
                    selected={selParty === idx}
                    dimmed={selStorage !== null && selParty === null}
                    showStats
                    equippedSlots={getEquippedSlots(m.uid)}
                    equipBonus={getEquipBonus(m.uid)}
                    onClick={() => handlePartyClick(idx)} />
                  {/* 액션 버튼 행 */}
                  <div className="flex items-center justify-between px-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                      disabled={party.length <= 1}
                      className="text-[10px] font-semibold transition"
                      style={{ color: party.length <= 1 ? "rgba(120,80,20,.2)" : "rgba(120,80,20,.55)" }}
                      onMouseEnter={(e) => { if (party.length > 1) (e.target as HTMLElement).style.color = "#a1a1aa"; }}
                      onMouseLeave={(e) => { if (party.length > 1) (e.target as HTMLElement).style.color = "rgba(120,80,20,.55)"; }}>
                      보관함↓
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEquipModalUid(m.uid); }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded transition hover:brightness-125"
                        style={{
                          background: "rgba(30,60,80,.5)",
                          border: "1px solid rgba(60,130,200,.35)",
                          color: "rgba(130,190,255,.8)",
                        }}>
                        장착
                      </button>
                      <ReleaseBtn
                        disabled={party.length <= 1}
                        onRelease={() => handleRelease(m.uid)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyPartySlot key={`empty-${idx}`} index={idx}
                  selected={selParty === idx}
                  onClick={() => handlePartyClick(idx)} />
              );
            })}
          </div>

          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(140,90,20,.1)" }}>
            <p className="text-[10px] text-center" style={{ color: "rgba(140,90,20,.6)" }}>{hint}</p>
          </div>
        </div>

        {/* 상태창 */}
        <MonsterStatusPanel
          monster={detailMonster}
          equipBonus={detailMonster ? getEquipBonus(detailMonster.uid) : undefined}
        />

        {/* 보관함 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 flex flex-wrap items-center gap-2"
            style={{ borderBottom: "1px solid rgba(140,90,20,.1)", background: "rgba(8,5,2,.3)" }}>
            <div className="mr-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(180,120,30,.6)" }}>STORAGE</p>
              <p className="text-sm font-black text-zinc-200">보관함 <span className="text-zinc-500 font-normal">({storage.length}/30)</span></p>
            </div>

            <div className="flex gap-1 flex-wrap">
              {["all", ...storageTypes].map((t) => {
                const acc = t === "all" ? null : TYPE_ACCENT[t];
                return (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold transition"
                    style={{
                      background: typeFilter === t ? (acc ? acc.bg : "rgba(245,158,11,.15)") : "rgba(20,12,4,.6)",
                      border: typeFilter === t ? `1px solid ${acc?.border ?? "#f59e0b"}` : "1px solid rgba(140,90,20,.2)",
                      color: typeFilter === t ? (acc?.border ?? "#f59e0b") : "rgba(120,80,20,.7)",
                    }}>
                    {t === "all" ? "전체" : TYPE_KO[t] ?? t}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1 ml-auto">
              {([["level", "레벨"], ["hp", "HP"], ["type", "속성"]] as [SortKey, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setSortBy(k)}
                  className="rounded-lg px-2 py-0.5 text-[10px] font-bold transition"
                  style={{
                    background: sortBy === k ? "rgba(245,158,11,.12)" : "rgba(20,12,4,.6)",
                    border: `1px solid ${sortBy === k ? "rgba(245,158,11,.45)" : "rgba(140,90,20,.2)"}`,
                    color: sortBy === k ? "#f59e0b" : "rgba(120,80,20,.6)",
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {storage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <div className="text-5xl opacity-20">📦</div>
                <div>
                  <p className="font-bold text-zinc-500 mb-1">보관함이 비어 있습니다</p>
                  <p className="text-xs text-zinc-700">숲 탐험에서 몬스터를 포획하면<br />이곳에 자동으로 저장됩니다.</p>
                </div>
              </div>
            ) : filteredStorage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <p className="text-sm text-zinc-600">{TYPE_KO[typeFilter]} 속성 몬스터가 없습니다.</p>
              </div>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}>
                {filteredStorage.map((m, i) => (
                  <div key={m.uid} className="flex flex-col gap-1" style={{ animation: `monIn .3s ease ${i * .04}s both` }}>
                    <MonsterCard monster={m} size="sm"
                      selected={selStorage === m.uid}
                      equippedSlots={getEquippedSlots(m.uid)}
                      onClick={() => handleStorageClick(m.uid)} />
                    <div className="flex items-center justify-center gap-1 px-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEquipModalUid(m.uid); }}
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded transition hover:brightness-125"
                        style={{
                          background: "rgba(30,60,80,.5)",
                          border: "1px solid rgba(60,130,200,.35)",
                          color: "rgba(130,190,255,.8)",
                        }}>
                        장착
                      </button>
                      <ReleaseBtn
                        disabled={false}
                        onRelease={() => handleRelease(m.uid)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 장비 모달 ── */}
      {equipModalUid && equipModalMonster && (
        <EquipModal
          monster={equipModalMonster}
          equipped={equippedArtifacts[equipModalUid] ?? []}
          available={craftedArtifacts}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onClose={() => setEquipModalUid(null)}
        />
      )}
    </div>
  );
}
