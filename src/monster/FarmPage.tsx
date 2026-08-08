import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../shared/playerStore";
import { MATERIALS } from "../shared/items";
import {
  QUALITY_COLOR,
  QUALITY_LABEL,
  ARTIFACT_STAT_LABEL,
} from "../shared/craftingUtils";
import type { ArtifactStatType, ArtifactInstance, CraftedPotionStack } from "../shared/crafting";

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
import { PALETTE } from "../shared/palette";
import { SlotGrid, EmptySlot } from "../shared/ui/SlotGrid";
import { GameBackground } from "../shared/ui/GameBackground";
import { EmptyState } from "../shared/ui";

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
    ? "rounded px-1.5 py-0.5 text-pixel-sm font-black transition"
    : "rounded-lg px-2 py-1 text-pixel-sm font-black transition";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={base}
      style={
        pending
          ? { background: "rgba(168, 61, 31, .5)", border: "1px solid rgba(168, 61, 31, 1)", color: PALETTE.ember500 }
          : { background: "rgba(13, 18, 35, .5)",   border: "1px solid rgba(132, 75, 63, .235)", color: "rgba(194, 88, 40, .663)" }
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
          <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "rgba(132, 75, 63, 1)" }}>MATERIALS</p>
          <p className="text-pixel-sm font-black text-sand-200">보유 재료</p>
        </div>
        <p className="text-title-sm font-black font-mono"
          style={{ color: total > 0 ? PALETTE.ember500 : "rgba(205, 178, 126, .08)" }}>
          {total}
        </p>
      </div>

      <SlotGrid cols={5} rows={3}>
        {MATERIALS.map((mat, i) => {
            const cnt    = materials[mat.id] ?? 0;
            const hasImg = mat.id in MATERIAL_IMG;
            if (cnt === 0) return null;
            return (
              <div key={mat.id}
                className="rounded-xl p-3 flex flex-col items-center gap-1.5"
                style={{
                  background: "rgba(13, 18, 35, .5)",
                  border: "1px solid rgba(122, 132, 85, .489)",
                  animation: `bagIn .35s ease ${i * .06}s both`,
                }}>
                {hasImg ? (
                  <img src={MATERIAL_IMG[mat.id]} alt={mat.name}
                    className="w-10 h-10 pixel-img"
                    style={{ filter: "drop-shadow(0 0 6px rgba(122, 132, 85, .783))" }} />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-pixel-md">{mat.emoji}</div>
                )}
                <p className="text-pixel-sm font-bold text-sand-200 text-center">{mat.name}</p>
                <p className="text-pixel-md font-black font-mono mt-1" style={{ color: PALETTE.moss500 }}>×{cnt}</p>

                {/* 버리기 버튼 */}
                <div className="flex gap-1 mt-0.5">
                  <button
                    type="button"
                    onClick={() => discardMaterial(mat.id, 1)}
                    className="rounded px-1.5 py-0.5 text-pixel-sm font-black transition"
                    style={{ background: "rgba(13, 18, 35, .5)", border: "1px solid rgba(132, 75, 63, .235)", color: "rgba(194, 88, 40, .663)" }}
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
      </SlotGrid>

      {total === 0 && (
        <EmptyState title="보유 재료가 없습니다" description="숲 탐험에서 재료를 획득할 수 있습니다." />
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
  return (
    <div>
      <div className="mb-3">
        <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
          style={{ color: "rgba(132, 75, 63, 1)" }}>POTIONS</p>
        <p className="text-pixel-sm font-black text-sand-200">
          보유 물약{" "}
          <span className="font-mono text-ember-500">
            ×{craftedPotions.reduce((s, p) => s + p.quantity, 0)}
          </span>
        </p>
      </div>

      <SlotGrid cols={2} rows={2} emptySlot={() => <EmptySlot className="min-h-20" />}>
        {craftedPotions.map((stack, i) => {
          const color = QUALITY_COLOR[stack.quality];
          return (
            <div key={stack.stackId}
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(145deg, rgba(13, 18, 35, .9), rgba(13, 18, 35, .6))",
                border: `1px solid ${color}55`,
                boxShadow: `0 0 16px ${color}22`,
                animation: `bagIn .35s ease ${i * .07}s both`,
              }}>
              {/* 이미지 or 이모지 */}
              <div className="w-10 h-10 flex-shrink-0 relative">
                {POTION_IMG[stack.itemId] ? (
                  <img src={POTION_IMG[stack.itemId]} alt={stack.name}
                    className="w-10 h-10 pixel-img" />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-pixel-md">🧪</div>
                )}
                <div className="absolute -top-1 -right-1 rounded-full w-5 h-5 flex items-center justify-center"
                  style={{ background: color, fontSize: 12, fontWeight: 900, color: PALETTE.shadow900, animation: "countPop .4s ease both" }}>
                  {stack.quantity}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-pixel-sm font-black text-cream-100 truncate">{stack.name}</p>
                <p className="text-pixel-sm font-bold mt-0.5" style={{ color }}>
                  {QUALITY_LABEL[stack.quality]}
                </p>
              </div>

              {/* 버리기 */}
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => discardPotion(stack.stackId, 1)}
                  className="rounded px-1.5 py-0.5 text-pixel-sm font-black transition"
                  style={{ background: "rgba(13, 18, 35, .5)", border: "1px solid rgba(132, 75, 63, .235)", color: "rgba(194, 88, 40, .663)" }}
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
      </SlotGrid>

      {craftedPotions.length === 0 && (
        <EmptyState title="보유 물약이 없습니다" description="제작 공방의 연금술 제작대에서 만들어 보세요." />
      )}
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
  return (
    <div>
      <div className="mb-3">
        <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
          style={{ color: "rgba(132, 75, 63, 1)" }}>ARTIFACTS</p>
        <p className="text-pixel-sm font-black text-sand-200">보유 아티팩트 <span className="text-ember-500 font-mono">{craftedArtifacts.length}개</span></p>
      </div>

      <SlotGrid cols={3} rows={1} emptySlot={() => <EmptySlot className="min-h-24" />}>
        {craftedArtifacts.map((item, i) => {
          const color = QUALITY_COLOR[item.quality];
          return (
            <div key={item.instanceId}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, rgba(13, 18, 35, .9), rgba(13, 18, 35, .7))",
                border: `1px solid ${color}55`,
                boxShadow: `0 0 16px ${color}22`,
                animation: `bagIn .35s ease ${i * .07}s both`,
              }}>
              <div className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-pixel-md"
                  style={{ background: "rgba(13, 18, 35, .35)", border: `1px solid ${color}44` }}>
                  {ARTIFACT_EMOJI[item.itemId] ?? "✨"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-pixel-sm font-black text-cream-100">{item.name}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-pixel-sm font-bold" style={{ color }}>
                      {QUALITY_LABEL[item.quality]}
                    </span>
                    {item.level !== undefined && (
                      <span className="text-pixel-sm font-bold text-sand-300">
                        Lv.{item.level}
                      </span>
                    )}
                    {item.enhancement !== undefined && item.enhancement > 0 && (
                      <span className="text-pixel-sm font-black" style={{ color: PALETTE.ember500 }}>
                        +{item.enhancement}
                      </span>
                    )}
                    {item.source === "synthesis" && (
                      <span className="rounded-full px-1.5 py-0.5 text-pixel-sm font-black"
                        style={{ background: "rgba(174, 226, 213, .088)", color: PALETTE.mist300,
                          border: "1px solid rgba(174, 226, 213, .131)" }}>
                        합성
                      </span>
                    )}
                  </div>
                </div>
                {/* 버리기 */}
                <DiscardBtn onConfirm={() => discardArtifact(item.instanceId)} />
              </div>

              {/* 능력치 */}
              {item.statBonuses.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="rounded-lg p-3 space-y-1"
                    style={{ background: "rgba(13, 18, 35, .35)", border: "1px solid rgba(243, 229, 185, .064)" }}>
                    {item.statBonuses.map((b) => (
                      <p key={b.stat} className="text-pixel-sm font-bold flex justify-between"
                        style={{ color: PALETTE.sand300 }}>
                        <span style={{ color: "rgba(132, 75, 63, 1)" }}>
                          {ARTIFACT_STAT_LABEL[b.stat as ArtifactStatType] ?? b.stat}
                        </span>
                        <span style={{ color: PALETTE.cream100 }}>
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
      </SlotGrid>

      {craftedArtifacts.length === 0 && (
        <EmptyState title="보유 아티팩트가 없습니다"
          description="제작 공방에서 만들고, 내 몬스터 메뉴에서 장착합니다." />
      )}
    </div>
  );
}

// ─── FarmPage ─────────────────────────────────────────────────────────────────────
export default function FarmPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from     = (location.state as { from?: string } | null)?.from;
  const backPath  = from === "workshop" ? "/workshop" : "/";
  const backLabel = from === "workshop" ? "← 공방" : "← 베이스캠프";

  const {
    materials, craftedArtifacts, craftedPotions,
    discardMaterial, discardPotion, discardArtifact,
  } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<BagTab>("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      navigate(backPath, backPath === "/" ? { state: { openMenu: true } } : undefined);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backPath, navigate]);

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
    <div className="relative h-screen flex flex-col text-cream-100 overflow-hidden">
      <GameBackground />
      <style>{BAG_STYLES}</style>

      {/* ── 헤더 ── */}
      <header className="relative" style={{
        background: "rgba(13, 18, 35, .92)",
        borderBottom: "1px solid rgba(132, 75, 63, .229)",
        boxShadow: "0 1px 0 rgba(233, 148, 65, .068)",
      }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,transparent,rgba(233, 148, 65, .357),transparent)" }} />

        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(backPath)}
              className="rounded-xl px-3 py-1.5 text-pixel-sm font-semibold transition"
              style={{ background: "rgba(13, 18, 35, .8)", border: "1px solid rgba(132, 75, 63, .382)", color: "rgba(205, 178, 126, .59)" }}>
              {backLabel}
            </button>
            <p className="text-title-sm font-black text-cream-100">가방</p>
          </div>

          {/* 총량 요약. 탭과 크기가 비슷하면 뭐가 조작이고 뭐가 정보인지 안 보여서
              라벨은 작게 죽이고 숫자만 남긴다 */}
          <div className="hidden items-center gap-4 sm:flex">
            {[
              { icon: "🌿", label: "재료",     value: totalMats },
              { icon: "🧪", label: "물약",     value: totalPotions },
              { icon: "🔮", label: "아티팩트", value: totalArtifacts },
            ].map((s) => (
              <div key={s.label} className="flex items-baseline gap-1.5">
                <span className="text-pixel-sm text-earth-400">{s.icon}</span>
                <span className="text-pixel-sm font-black text-sand-200">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="mx-auto flex w-full max-w-5xl px-2">
          {TAB_DATA.map((tab) => {
            const isActive = activeTab === tab.id;
            const b = badge[tab.id];
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-5 py-3 text-pixel-sm font-bold transition-all"
                style={{
                  color: isActive ? PALETTE.ember500 : "rgba(205, 178, 126, .12)",
                  borderBottom: isActive ? `2px solid ${PALETTE.ember500}` : "2px solid transparent",
                  background: isActive ? "rgba(233, 148, 65, .068)" : "transparent",
                }}>
                <span>{tab.label}</span>
                {b > 0 && (
                  <span className="rounded-full px-1.5 text-pixel-sm font-black"
                    style={{
                      background: isActive ? "rgba(233, 148, 65, .283)" : "rgba(132, 75, 63, .105)",
                      color: isActive ? PALETTE.ember500 : "rgba(205, 178, 126, .12)",
                      minWidth: 18, textAlign: "center",
                    }}>
                    {b}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                    style={{ background: "rgba(233, 148, 65, .679)", filter: "blur(2px)" }} />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── 탭 콘텐츠 ── */}
      <div className="relative mx-auto w-full max-w-5xl flex-1 overflow-y-auto p-5">
        {(activeTab === "all" || activeTab === "materials") && (
          <div style={{ animation: "bagIn .3s ease both" }}>
            <MaterialsSection materials={materials} discardMaterial={discardMaterial} />
          </div>
        )}

        {activeTab === "all" && (
          <div className="mt-8" style={{ animation: "bagIn .35s ease .05s both" }}>
            <PotionsSection craftedPotions={craftedPotions} discardPotion={discardPotion} />
          </div>
        )}

        {activeTab === "all" && (
          <div className="mt-8" style={{ animation: "bagIn .4s ease .1s both" }}>
            <ArtifactsSection craftedArtifacts={craftedArtifacts} discardArtifact={discardArtifact} />
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
