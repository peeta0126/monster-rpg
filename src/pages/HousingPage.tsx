import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHousingGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { usePlayerStore } from "../store/playerStore";
import {
  FURNITURE, MATERIAL_SET_TIERS, MATERIAL_LABEL, RARITY_LABEL, RARITY_COLOR,
  getFurniture, countMaterials,
} from "../data/furniture";
import type { FurnitureMaterial } from "../data/furniture";
import { getMaterial } from "../data/items";

// ─── 탭 타입 ──────────────────────────────────────────────────────────────────

type HousingTab = "room" | "craft" | "bonuses";

// ─── 재질 색상 ─────────────────────────────────────────────────────────────────

const MATERIAL_COLOR: Record<FurnitureMaterial, string> = {
  wood:    "text-amber-400 border-amber-700/50 bg-amber-950/20",
  iron:    "text-zinc-300  border-zinc-600/50  bg-zinc-800/20",
  crystal: "text-purple-400 border-purple-700/50 bg-purple-950/20",
  leather: "text-orange-400 border-orange-700/50 bg-orange-950/20",
};

const MATERIAL_BADGE: Record<FurnitureMaterial, string> = {
  wood:    "bg-amber-900/50 text-amber-300",
  iron:    "bg-zinc-700/50  text-zinc-200",
  crystal: "bg-purple-900/50 text-purple-300",
  leather: "bg-orange-900/50 text-orange-300",
};

// ─── 슬롯 카드 ────────────────────────────────────────────────────────────────

function FurnitureSlotCard({
  index, furnitureId, onRemove,
}: { index: number; furnitureId: string | null; onRemove: (i: number) => void }) {
  const f = furnitureId ? getFurniture(furnitureId) : null;

  return (
    <div className={[
      "rounded-xl border p-3 flex flex-col items-center gap-2 min-h-[100px] transition",
      f ? MATERIAL_COLOR[f.material] : "border-zinc-800/50 bg-zinc-900/20",
    ].join(" ")}>
      <div className="flex items-center justify-between w-full">
        <span className="text-[9px] text-zinc-600 font-mono">슬롯 {index + 1}</span>
        {f && (
          <button
            onClick={() => onRemove(index)}
            className="text-[9px] text-red-500 hover:text-red-300 transition"
          >
            제거
          </button>
        )}
      </div>
      {f ? (
        <>
          <span className="text-2xl">{f.emoji}</span>
          <p className="text-[10px] text-center text-zinc-200 leading-tight font-semibold">{f.name}</p>
          <div className="flex gap-1 flex-wrap justify-center">
            <span className={`text-[8px] rounded px-1.5 py-0.5 font-semibold ${MATERIAL_BADGE[f.material]}`}>
              {MATERIAL_LABEL[f.material]}
            </span>
            <span
              className="text-[8px] rounded px-1.5 py-0.5 font-semibold"
              style={{ color: RARITY_COLOR[f.rarity], background: "rgba(0,0,0,0.4)" }}
            >
              {RARITY_LABEL[f.rarity]}
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-1">
          <span className="text-zinc-700 text-xl">＋</span>
          <p className="text-[9px] text-zinc-700">비어있음</p>
        </div>
      )}
    </div>
  );
}

// ─── 방 배치 탭 ────────────────────────────────────────────────────────────────

function RoomTab() {
  const { placedFurniture, furnitureInventory, placeFurniture, removeFurniture } = usePlayerStore();
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null);

  const inventory = FURNITURE.filter((f) => (furnitureInventory[f.id] ?? 0) > 0);
  const counts    = countMaterials(placedFurniture);

  const handleSlotClick = (slotIndex: number) => {
    if (selectedFurnitureId) {
      placeFurniture(slotIndex, selectedFurnitureId);
      gameEvents.emit(GAME_EVENT.HOUSING_FURNITURE_UPDATE);
      setSelectedFurnitureId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 재질 현황 */}
      <div className="flex gap-2">
        {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => (
          <div key={mat} className={`flex-1 rounded-lg border p-2 text-center ${MATERIAL_COLOR[mat]}`}>
            <p className="text-[9px] opacity-70">{MATERIAL_LABEL[mat]}</p>
            <p className="text-sm font-bold">{counts[mat]}</p>
          </div>
        ))}
      </div>

      {/* 슬롯 그리드 */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">배치 슬롯 (6칸)</p>
        <div className="grid grid-cols-3 gap-2">
          {placedFurniture.map((id, i) => (
            <div
              key={i}
              onClick={() => handleSlotClick(i)}
              className={[
                "cursor-pointer transition",
                selectedFurnitureId ? "ring-2 ring-amber-500/60 rounded-xl" : "",
              ].join(" ")}
            >
              <FurnitureSlotCard
                index={i}
                furnitureId={id}
                onRemove={(idx) => {
                  removeFurniture(idx);
                  gameEvents.emit(GAME_EVENT.HOUSING_FURNITURE_UPDATE);
                }}
              />
            </div>
          ))}
        </div>
        {selectedFurnitureId && (
          <p className="text-[10px] text-amber-400 text-center mt-2 animate-pulse">
            배치할 슬롯을 클릭하세요
          </p>
        )}
      </div>

      {/* 보유 가구 선택 */}
      {inventory.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            보유 가구 — 가구 선택 후 슬롯 클릭
          </p>
          <div className="flex flex-col gap-1.5">
            {inventory.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFurnitureId(selectedFurnitureId === f.id ? null : f.id)}
                className={[
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                  selectedFurnitureId === f.id
                    ? "border-amber-500 bg-amber-950/40 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                    : `${MATERIAL_COLOR[f.material]} hover:opacity-80`,
                ].join(" ")}
              >
                <span className="text-xl">{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-zinc-200 truncate">{f.name}</p>
                    <span className={`text-[8px] rounded px-1 py-0.5 shrink-0 ${MATERIAL_BADGE[f.material]}`}>
                      {MATERIAL_LABEL[f.material]}
                    </span>
                    <span
                      className="text-[8px] rounded px-1 py-0.5 shrink-0"
                      style={{ color: RARITY_COLOR[f.rarity], background: "rgba(0,0,0,0.4)" }}
                    >
                      {RARITY_LABEL[f.rarity]}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-500 truncate">{f.description}</p>
                </div>
                <span className="text-xs font-mono text-amber-400 font-bold shrink-0">
                  ×{furnitureInventory[f.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {inventory.length === 0 && placedFurniture.every((s) => !s) && (
        <div className="text-center py-6 text-zinc-600 text-xs">
          <p className="text-2xl mb-2">🪑</p>
          <p>보유한 가구가 없습니다.</p>
          <p className="mt-1 text-zinc-700">제작 탭에서 가구를 만들어보세요.</p>
        </div>
      )}
    </div>
  );
}

// ─── 가구 제작 탭 ──────────────────────────────────────────────────────────────

function CraftTab() {
  const { materials, furnitureInventory, craftFurniture } = usePlayerStore();
  const [lastCrafted, setLastCrafted] = useState<string | null>(null);

  const handleCraft = (id: string) => {
    const ok = craftFurniture(id);
    if (ok) {
      setLastCrafted(id);
      setTimeout(() => setLastCrafted(null), 1500);
    }
  };

  // 재질별로 그룹화
  const grouped = (["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => ({
    mat,
    items: FURNITURE.filter((f) => f.material === mat),
  }));

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ mat, items }) => (
        <div key={mat}>
          <div className={`flex items-center gap-2 mb-2`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${MATERIAL_BADGE[mat]}`}>
              {MATERIAL_LABEL[mat]}
            </span>
            <span className="text-[9px] text-zinc-500">{items.length}종</span>
          </div>
          <div className="flex flex-col gap-2">
            {items.map((f) => {
              const canCraft   = Object.entries(f.recipe).every(([matId, need]) => (materials[matId] ?? 0) >= need);
              const owned      = furnitureInventory[f.id] ?? 0;
              const justCrafted = lastCrafted === f.id;

              return (
                <div
                  key={f.id}
                  className={[
                    "rounded-xl border p-3 transition",
                    justCrafted
                      ? "border-emerald-600 bg-emerald-950/30"
                      : MATERIAL_COLOR[f.material],
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{f.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-zinc-200 truncate">{f.name}</p>
                        <span
                          className="text-[8px] rounded px-1.5 py-0.5 shrink-0"
                          style={{ color: RARITY_COLOR[f.rarity], background: "rgba(0,0,0,0.4)" }}
                        >
                          {RARITY_LABEL[f.rarity]}
                        </span>
                        {owned > 0 && (
                          <span className="text-[9px] text-amber-400 font-mono shrink-0">보유 ×{owned}</span>
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-500 truncate">{f.description}</p>
                    </div>
                  </div>

                  {/* 재료 목록 */}
                  <div className="mt-2 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(f.recipe).map(([matId, need]) => {
                        const have = materials[matId] ?? 0;
                        const mat  = getMaterial(matId);
                        const ok   = have >= need;
                        return (
                          <span
                            key={matId}
                            className={[
                              "text-[9px] rounded-full border px-2 py-0.5 font-mono",
                              ok ? "border-zinc-700 text-zinc-300" : "border-red-900/60 text-red-400",
                            ].join(" ")}
                          >
                            {mat?.emoji ?? "?"} {mat?.name ?? matId} {have}/{need}
                          </span>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handleCraft(f.id)}
                      disabled={!canCraft}
                      className={[
                        "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition active:scale-95",
                        justCrafted
                          ? "border-emerald-500 bg-emerald-800/60 text-emerald-200"
                          : canCraft
                            ? "border-amber-600 bg-amber-900/50 text-amber-300 hover:bg-amber-800/60"
                            : "border-zinc-800 bg-zinc-900/20 text-zinc-700 cursor-not-allowed opacity-50",
                      ].join(" ")}
                    >
                      {justCrafted ? "완성! ✓" : "제작"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 효과 탭 ──────────────────────────────────────────────────────────────────

function BonusesTab() {
  const { getHousingBonuses, placedFurniture } = usePlayerStore();
  const bonuses = getHousingBonuses();
  const counts  = countMaterials(placedFurniture);

  return (
    <div className="flex flex-col gap-4">
      {/* 활성 보너스 요약 */}
      {bonuses.activeSets.length > 0 && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">현재 활성 보너스</p>
          <div className="flex flex-col gap-1">
            {bonuses.grassTypePower > 0   && <p className="text-xs text-green-400">🌿 풀타입 기술 위력 +{bonuses.grassTypePower}%</p>}
            {bonuses.hpPercent > 0        && <p className="text-xs text-emerald-400">❤️ 최대 HP +{bonuses.hpPercent}%</p>}
            {bonuses.attackPercent > 0    && <p className="text-xs text-red-400">⚔️ 공격력 +{bonuses.attackPercent}%</p>}
            {bonuses.defensePercent > 0   && <p className="text-xs text-blue-400">🛡️ 방어력 +{bonuses.defensePercent}%</p>}
            {bonuses.towerDropBonus > 0   && <p className="text-xs text-cyan-400">🗼 탑 드랍 +{bonuses.towerDropBonus}%</p>}
            {bonuses.catchRateBonus > 0   && <p className="text-xs text-yellow-400">🎯 포획률 +{bonuses.catchRateBonus}%</p>}
            {bonuses.potionBonusPercent > 0 && <p className="text-xs text-pink-400">🧪 물약 회복 +{bonuses.potionBonusPercent}%</p>}
            {bonuses.expBonusPercent > 0  && <p className="text-xs text-purple-400">✨ 경험치 +{bonuses.expBonusPercent}%</p>}
          </div>
        </div>
      )}

      {/* 재질별 세트 진행도 */}
      {(["wood", "iron", "crystal", "leather"] as FurnitureMaterial[]).map((mat) => {
        const tiers    = MATERIAL_SET_TIERS[mat];
        const current  = counts[mat];
        const maxCount = tiers[tiers.length - 1].count;

        return (
          <div key={mat} className={`rounded-xl border p-3 ${MATERIAL_COLOR[mat]}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${MATERIAL_BADGE[mat]}`}>
                {MATERIAL_LABEL[mat]}
              </span>
              <span className="text-xs font-mono text-zinc-400">{current} / {maxCount} 종 배치</span>
            </div>

            {/* 진행 바 */}
            <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-3">
              <div
                className="h-1.5 rounded-full bg-current transition-all duration-300"
                style={{ width: `${Math.min(100, (current / maxCount) * 100)}%` }}
              />
            </div>

            {/* 단계 목록 */}
            <div className="flex flex-col gap-1.5">
              {tiers.map((tier) => {
                const active = current >= tier.count;
                return (
                  <div
                    key={tier.count}
                    className={[
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                      active
                        ? "bg-current/10 border border-current/30"
                        : "opacity-40",
                    ].join(" ")}
                  >
                    <span>{active ? "✅" : `${tier.count}종`}</span>
                    <span className="font-semibold">{tier.name}</span>
                    <span className="text-zinc-400 text-[9px] ml-auto">{tier.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {bonuses.activeSets.length === 0 && (
        <p className="text-xs text-zinc-600 text-center py-4">
          같은 재질 가구를 여러 종 배치하면 세트 보너스가 발동됩니다.
        </p>
      )}
    </div>
  );
}

// ─── HousingPage ──────────────────────────────────────────────────────────────

export default function HousingPage() {
  const navigate    = useNavigate();
  const gameRef     = useRef<HTMLDivElement | null>(null);
  const [panelOpen, setPanelOpen]   = useState(false);
  const [activeTab, setActiveTab]   = useState<HousingTab>("room");

  const bonuses = usePlayerStore((s) => s.getHousingBonuses());

  useEffect(() => {
    if (!gameRef.current) return;
    const game = createHousingGame(gameRef.current);

    const handleEnterFarm   = () => navigate("/farm");
    const handleExitHousing = () => navigate("/");

    gameEvents.on(GAME_EVENT.ENTER_FARM,    handleEnterFarm);
    gameEvents.on(GAME_EVENT.EXIT_HOUSING,  handleExitHousing);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_FARM,    handleEnterFarm);
      gameEvents.off(GAME_EVENT.EXIT_HOUSING,  handleExitHousing);
      game.destroy(true);
    };
  }, [navigate]);

  // H 키로 패널 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "h" || e.key === "H") setPanelOpen((p) => !p);
      if (e.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // position:relative + 명시적 크기 → Phaser가 부모 크기를 올바르게 인식
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", background: "#111" }}>

      {/* Phaser 캔버스 */}
      <div
        ref={gameRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* UI 버튼들 (우하단) */}
      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          onClick={() => navigate("/")}
          className="rounded-xl border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 backdrop-blur transition"
        >
          ← 바깥으로
        </button>
        <button
          onClick={() => navigate("/farm")}
          className="rounded-xl border border-green-800/60 bg-zinc-900/90 px-3 py-2 text-sm text-green-400 hover:text-green-200 hover:bg-zinc-800 backdrop-blur transition"
        >
          🌾 농장
        </button>
        <button
          onClick={() => setPanelOpen((p) => !p)}
          className={[
            "rounded-xl border px-3 py-2 text-sm font-semibold backdrop-blur transition",
            panelOpen
              ? "border-amber-500 bg-amber-950/80 text-amber-300"
              : "border-amber-800/60 bg-zinc-900/90 text-amber-400 hover:bg-zinc-800",
          ].join(" ")}
        >
          🏠 인테리어 (H)
          {bonuses.activeSets.length > 0 && !panelOpen && (
            <span className="ml-1 text-emerald-400">●</span>
          )}
        </button>
      </div>

      {/* 인테리어 패널 (오버레이 사이드바) */}
      {panelOpen && (
        <div
          className="fixed right-0 top-0 h-full z-50"
          style={{ width: "380px" }}
        >
          <div
            className="w-full h-full flex flex-col bg-zinc-950/98 border-l border-zinc-800"
            style={{ backdropFilter: "blur(16px)" }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-base font-bold text-zinc-100">🏠 인테리어</h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {bonuses.activeSets.length > 0
                    ? `세트 활성: ${bonuses.activeSets.join(", ")}`
                    : "가구를 같은 재질로 모아 세트 보너스를 획득"}
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-zinc-600 hover:text-zinc-300 text-lg transition"
              >
                ✕
              </button>
            </div>

            {/* 탭 */}
            <div className="flex border-b border-zinc-800 shrink-0">
              {(["room", "craft", "bonuses"] as HousingTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "flex-1 py-2.5 text-xs font-semibold transition",
                    activeTab === tab
                      ? "border-b-2 border-amber-500 text-amber-300"
                      : "text-zinc-500 hover:text-zinc-300",
                  ].join(" ")}
                >
                  {tab === "room" ? "배치" : tab === "craft" ? "제작" : "효과"}
                </button>
              ))}
            </div>

            {/* 탭 내용 */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activeTab === "room"    && <RoomTab />}
              {activeTab === "craft"   && <CraftTab />}
              {activeTab === "bonuses" && <BonusesTab />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
