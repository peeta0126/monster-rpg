import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../store/playerStore";
import { MATERIALS } from "../data/items";
import {
  QUALITY_COLOR,
  QUALITY_LABEL,
  ARTIFACT_STAT_LABEL,
} from "../utils/crafting";
import type { ArtifactStatType, ArtifactInstance, CraftedPotionStack } from "../types/crafting";

// ── pixel art assets ──────────────────────────────────────────────────────────
import herbImg    from "../assets/materials/herb.svg";
import berryImg   from "../assets/materials/berry.svg";
import rootImg    from "../assets/materials/root.svg";
import crystalImg from "../assets/materials/crystal.svg";
import potionImg         from "../assets/potions/potion.svg";
import superPotionImg    from "../assets/potions/super_potion.svg";
import maxPotionImg      from "../assets/potions/max_potion.svg";
import antidoteImg       from "../assets/potions/antidote.svg";
import attackBuffImg     from "../assets/potions/attack_buff.svg";
import strongAttackImg   from "../assets/potions/strong_attack_buff.svg";
import tabBagImg         from "../assets/icons/tab_bag.svg";

const MATERIAL_IMG: Record<string, string> = {
  herb: herbImg, berry: berryImg, root: rootImg, crystal: crystalImg,
};

const POTION_IMG: Record<string, string> = {
  potion: potionImg, super_potion: superPotionImg, max_potion: maxPotionImg,
  antidote: antidoteImg, attack_buff: attackBuffImg, strong_attack_buff: strongAttackImg,
};

const ARTIFACT_EMOJI: Record<string, string> = {
  power_necklace: "📿",
  guard_bracelet: "🛡️",
  spirit_amulet:  "🔮",
};

// ─── CSS 애니메이션 ──────────────────────────────────────────────────────────────
const BAG_STYLES = `
@keyframes bagIn {
  from { transform: translateY(12px) scale(.97); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes countPop {
  0%  { transform: scale(.5); opacity: 0; }
  65% { transform: scale(1.2); }
  100%{ transform: scale(1);  opacity: 1; }
}
`;

type BagTab = "all" | "materials" | "potions" | "artifacts";

const TAB_DATA: { id: BagTab; label: string }[] = [
  { id: "all",       label: "전체" },
  { id: "materials", label: "재료" },
  { id: "potions",   label: "물약" },
  { id: "artifacts", label: "아티팩트" },
];

// ─── 버리기 확인 버튼 (두 번 클릭 패턴) ────────────────────────────────────────────
function DiscardBtn({
  label = "버리기",
  onConfirm,
  small = false,
}: {
  label?: string;
  onConfirm: () => void;
  small?: boolean;
}) {
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (!pending) {
      setPending(true);
      setTimeout(() => setPending(false), 2500);
    } else {
      setPending(false);
      onConfirm();
    }
  };

  const base = small
    ? "rounded px-1.5 py-0.5 text-[9px] font-black transition"
    : "rounded-lg px-2 py-1 text-[10px] font-black transition";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={base}
      style={
        pending
          ? { background: "rgba(239,68,68,.25)", border: "1px solid rgba(239,68,68,.6)", color: "#f87171" }
          : { background: "rgba(60,20,5,.5)",   border: "1px solid rgba(120,50,20,.4)", color: "rgba(180,80,30,.8)" }
      }
    >
      {pending ? "확인?" : label}
    </button>
  );
}

// ─── 재료 섹션 ───────────────────────────────────────────────────────────────────
function MaterialsSection({
  materials,
  discardMaterial,
}: {
  materials: Record<string, number>;
  discardMaterial: (id: string, amount: number) => void;
}) {
  const total = Object.values(materials).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "rgba(180,120,30,.6)" }}>MATERIALS</p>
          <p className="text-sm font-black text-zinc-200">보유 재료</p>
        </div>
        <p className="text-lg font-black font-mono"
          style={{ color: total > 0 ? "#f59e0b" : "rgba(120,80,20,.4)" }}>
          {total}
        </p>
      </div>

      {total === 0 ? (
        <p className="text-xs text-zinc-700 py-4 text-center">
          숲 탐험에서 재료를 획득할 수 있습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MATERIALS.map((mat, i) => {
            const cnt    = materials[mat.id] ?? 0;
            const hasImg = mat.id in MATERIAL_IMG;
            if (cnt === 0) return null;
            return (
              <div key={mat.id}
                className="rounded-xl p-3 flex flex-col items-center gap-1.5"
                style={{
                  background: "rgba(20,40,10,.5)",
                  border: "1px solid rgba(34,197,94,.25)",
                  animation: `bagIn .35s ease ${i * .06}s both`,
                }}>
                {hasImg ? (
                  <img src={MATERIAL_IMG[mat.id]} alt={mat.name}
                    className="w-10 h-10 pixel-img"
                    style={{ imageRendering: "pixelated", filter: "drop-shadow(0 0 6px rgba(34,197,94,.4))" }} />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-2xl">{mat.emoji}</div>
                )}
                <p className="text-[10px] font-bold text-zinc-300 text-center">{mat.name}</p>
                <p className="text-xl font-black font-mono mt-1" style={{ color: "#4ade80" }}>×{cnt}</p>

                {/* 버리기 버튼 */}
                <div className="flex gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => discardMaterial(mat.id, 1)}
                    className="rounded px-1.5 py-0.5 text-[9px] font-black transition"
                    style={{ background: "rgba(60,20,5,.5)", border: "1px solid rgba(120,50,20,.4)", color: "rgba(180,80,30,.8)" }}
                  >
                    −1
                  </button>
                  {cnt > 1 && (
                    <DiscardBtn
                      label="전체"
                      small
                      onConfirm={() => discardMaterial(mat.id, cnt)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── 물약 섹션 ───────────────────────────────────────────────────────────────────
function PotionsSection({
  craftedPotions,
  discardPotion,
}: {
  craftedPotions: CraftedPotionStack[];
  discardPotion: (stackId: string, amount: number) => void;
}) {
  if (craftedPotions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <img src={tabBagImg} alt="" className="w-12 h-12 pixel-img opacity-15"
          style={{ imageRendering: "pixelated" }} />
        <p className="text-sm font-bold text-zinc-500">보유 물약이 없습니다</p>
        <p className="text-xs text-zinc-700">제작 공방의 연금술 제작대에서 물약을 만들어 보세요.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
          style={{ color: "rgba(180,120,30,.6)" }}>POTIONS</p>
        <p className="text-sm font-black text-zinc-200">
          보유 물약{" "}
          <span className="text-amber-400 font-mono">
            ×{craftedPotions.reduce((s, p) => s + p.quantity, 0)}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {craftedPotions.map((stack, i) => {
          const color = QUALITY_COLOR[stack.quality];
          return (
            <div key={stack.stackId}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(145deg, rgba(20,10,3,.9), rgba(40,20,5,.6))",
                border: `1px solid ${color}55`,
                boxShadow: `0 0 16px ${color}22`,
                animation: `bagIn .35s ease ${i * .07}s both`,
              }}>
              {/* 이미지 or 이모지 */}
              <div className="w-10 h-10 flex-shrink-0 relative">
                {POTION_IMG[stack.itemId] ? (
                  <img src={POTION_IMG[stack.itemId]} alt={stack.name}
                    className="w-10 h-10 pixel-img" style={{ imageRendering: "pixelated" }} />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-2xl">🧪</div>
                )}
                <div className="absolute -top-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ background: color, fontSize: 9, fontWeight: 900, color: "#000", animation: "countPop .4s ease both" }}>
                  {stack.quantity}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-100 truncate">{stack.name}</p>
                <p className="text-[10px] font-bold mt-0.5" style={{ color }}>
                  {QUALITY_LABEL[stack.quality]}
                </p>
              </div>

              {/* 버리기 */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => discardPotion(stack.stackId, 1)}
                  className="rounded px-1.5 py-0.5 text-[9px] font-black transition"
                  style={{ background: "rgba(60,20,5,.5)", border: "1px solid rgba(120,50,20,.4)", color: "rgba(180,80,30,.8)" }}
                >
                  −1
                </button>
                {stack.quantity > 1 && (
                  <DiscardBtn
                    label="전체"
                    small
                    onConfirm={() => discardPotion(stack.stackId, stack.quantity)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 아티팩트 섹션 ────────────────────────────────────────────────────────────────
function ArtifactsSection({
  craftedArtifacts,
  discardArtifact,
}: {
  craftedArtifacts: ArtifactInstance[];
  discardArtifact: (instanceId: string) => void;
}) {
  if (craftedArtifacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="text-4xl opacity-20">🔮</div>
        <p className="text-sm font-bold text-zinc-500">보유 아티팩트가 없습니다</p>
        <p className="text-xs text-zinc-700">제작 공방의 아티팩트 제작대에서 만들어 보세요.</p>
        <p className="text-xs text-zinc-700">제작 후 내 몬스터 메뉴에서 장착할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
          style={{ color: "rgba(180,120,30,.6)" }}>ARTIFACTS</p>
        <p className="text-sm font-black text-zinc-200">보유 아티팩트 <span className="text-amber-400 font-mono">{craftedArtifacts.length}개</span></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {craftedArtifacts.map((item, i) => {
          const color = QUALITY_COLOR[item.quality];
          return (
            <div key={item.instanceId}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(20,10,3,.9), rgba(40,20,5,.7))",
                border: `1px solid ${color}55`,
                boxShadow: `0 0 16px ${color}22`,
                animation: `bagIn .35s ease ${i * .07}s both`,
              }}>
              <div className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(0,0,0,.35)", border: `1px solid ${color}44` }}>
                  {ARTIFACT_EMOJI[item.itemId] ?? "✨"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-zinc-100">{item.name}</p>
                  <p className="text-[10px] font-bold mt-0.5" style={{ color }}>
                    {QUALITY_LABEL[item.quality]}
                  </p>
                </div>
                {/* 버리기 */}
                <DiscardBtn onConfirm={() => discardArtifact(item.instanceId)} />
              </div>

              {/* 능력치 */}
              {item.statBonuses.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg p-3 space-y-1"
                    style={{ background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.05)" }}>
                    {item.statBonuses.map((b) => (
                      <p key={b.stat} className="text-xs font-bold flex justify-between"
                        style={{ color: "#c4a46b" }}>
                        <span style={{ color: "rgba(180,120,30,.7)" }}>
                          {ARTIFACT_STAT_LABEL[b.stat as ArtifactStatType] ?? b.stat}
                        </span>
                        <span style={{ color: "#f5e6c8" }}>
                          +{b.value}{b.stat === "critRate" ? "%" : ""}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── FarmPage ─────────────────────────────────────────────────────────────────────
export default function FarmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from     = (location.state as { from?: string } | null)?.from;
  const backPath  = from === "housing" ? "/housing" : "/";
  const backLabel = from === "housing" ? "← 공방" : "← 베이스캠프";

  const {
    materials, craftedArtifacts, craftedPotions,
    discardMaterial, discardPotion, discardArtifact,
  } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<BagTab>("all");

  const totalMats      = Object.values(materials).reduce((a, b) => a + b, 0);
  const totalPotions   = craftedPotions.reduce((s, p) => s + p.quantity, 0);
  const totalArtifacts = craftedArtifacts.length;

  const badge: Record<BagTab, number> = {
    all:       totalMats + totalPotions + totalArtifacts,
    materials: totalMats,
    potions:   totalPotions,
    artifacts: totalArtifacts,
  };

  return (
    <div className="h-screen flex flex-col text-zinc-100 overflow-hidden"
      style={{ background: "linear-gradient(160deg,#0d0906 0%,#0b0705 50%,#0d0906 100%)" }}>
      <style>{BAG_STYLES}</style>

      {/* ── 헤더 ── */}
      <header style={{
        background: "rgba(10,6,2,.92)",
        borderBottom: "1px solid rgba(140,90,20,.18)",
        boxShadow: "0 1px 0 rgba(245,158,11,.06)",
      }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,transparent,rgba(217,119,6,.5),transparent)" }} />

        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(backPath)}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold transition"
              style={{ background: "rgba(20,12,4,.8)", border: "1px solid rgba(140,90,20,.3)", color: "rgba(200,150,50,.8)" }}>
              {backLabel}
            </button>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: "rgba(180,120,30,.5)" }}>BAG</p>
              <p className="text-base font-black text-zinc-100">가방</p>
            </div>
          </div>

          {/* 요약 */}
          <div className="hidden sm:flex items-center gap-3">
            {[
              { icon: "🌿", label: "재료",     value: totalMats },
              { icon: "🧪", label: "물약",     value: totalPotions },
              { icon: "🔮", label: "아티팩트", value: totalArtifacts },
            ].map((s) => (
              <div key={s.label} className="text-center px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(20,12,4,.6)", border: "1px solid rgba(80,50,10,.2)" }}>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</p>
                <p className="text-sm font-black text-zinc-200">{s.icon} {s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="flex">
          {TAB_DATA.map((tab) => {
            const isActive = activeTab === tab.id;
            const b = badge[tab.id];
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all"
                style={{
                  color: isActive ? "#f59e0b" : "rgba(120,80,20,.6)",
                  borderBottom: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                  background: isActive ? "rgba(245,158,11,.06)" : "transparent",
                }}>
                <span>{tab.label}</span>
                {b > 0 && (
                  <span className="rounded-full px-1.5 text-[9px] font-black"
                    style={{
                      background: isActive ? "rgba(245,158,11,.25)" : "rgba(80,50,10,.3)",
                      color: isActive ? "#f59e0b" : "rgba(120,80,20,.6)",
                      minWidth: 18, textAlign: "center",
                    }}>
                    {b}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: "rgba(245,158,11,.6)", filter: "blur(2px)" }} />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {(activeTab === "all" || activeTab === "materials") && (
          <div style={{ animation: "bagIn .3s ease both" }}>
            <MaterialsSection materials={materials} discardMaterial={discardMaterial} />
          </div>
        )}

        {activeTab === "all" && (totalPotions > 0 || totalArtifacts > 0) && (
          <div className="mt-8" style={{ animation: "bagIn .35s ease .05s both" }}>
            <PotionsSection craftedPotions={craftedPotions} discardPotion={discardPotion} />
          </div>
        )}

        {activeTab === "all" && totalArtifacts > 0 && (
          <div className="mt-8" style={{ animation: "bagIn .4s ease .1s both" }}>
            <ArtifactsSection craftedArtifacts={craftedArtifacts} discardArtifact={discardArtifact} />
          </div>
        )}

        {activeTab === "all" && totalMats === 0 && totalPotions === 0 && totalArtifacts === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-5xl opacity-20">🎒</div>
            <p className="font-bold text-zinc-500">가방이 비어 있습니다</p>
            <p className="text-xs text-zinc-700">
              숲 탐험에서 재료를 얻고,<br />
              제작 공방에서 아이템을 만들어 보세요.
            </p>
          </div>
        )}

        {activeTab === "potions" && (
          <div style={{ animation: "bagIn .3s ease both" }}>
            <PotionsSection craftedPotions={craftedPotions} discardPotion={discardPotion} />
          </div>
        )}

        {activeTab === "artifacts" && (
          <div style={{ animation: "bagIn .3s ease both" }}>
            <ArtifactsSection craftedArtifacts={craftedArtifacts} discardArtifact={discardArtifact} />
          </div>
        )}
      </div>
    </div>
  );
}
