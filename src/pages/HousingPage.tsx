import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHousingGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";
import { usePlayerStore } from "../store/playerStore";
import { FURNITURE, FURNITURE_COMBINATIONS, getFurniture } from "../data/furniture";
import { getMaterial } from "../data/items";

// ─── 탭 타입 ──────────────────────────────────────────────────────────────────

type HousingTab = "room" | "craft" | "bonuses";

// ─── 보너스 설명 헬퍼 ──────────────────────────────────────────────────────────

function BonusLabel({ label, value, unit = "" }: { label: string; value: number; unit?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-emerald-400">+{value}{unit}</span>
    </div>
  );
}

// ─── 슬롯 카드 ────────────────────────────────────────────────────────────────

function FurnitureSlotCard({
  index, furnitureId, onRemove,
}: { index: number; furnitureId: string | null; onRemove: (i: number) => void }) {
  const f = furnitureId ? getFurniture(furnitureId) : null;

  return (
    <div className={[
      "rounded-xl border p-3 flex flex-col items-center gap-2 min-h-[96px] transition",
      f ? "border-amber-700/60 bg-amber-950/20" : "border-zinc-800/50 bg-zinc-900/20",
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
          <p className="text-[10px] text-center text-zinc-200 leading-tight">{f.name}</p>
          <div className="w-full text-center">
            {f.bonus.hp        && <p className="text-[9px] text-emerald-400">HP +{f.bonus.hp}</p>}
            {f.bonus.attack    && <p className="text-[9px] text-red-400">공격 +{f.bonus.attack}</p>}
            {f.bonus.defense   && <p className="text-[9px] text-blue-400">방어 +{f.bonus.defense}</p>}
            {f.bonus.speed     && <p className="text-[9px] text-yellow-400">속도 +{f.bonus.speed}</p>}
            {f.bonus.expBonus  && <p className="text-[9px] text-purple-400">경험치 +{f.bonus.expBonus}%</p>}
            {f.bonus.potionBonus && <p className="text-[9px] text-cyan-400">물약 +{f.bonus.potionBonus}%</p>}
            {f.bonus.statusResist && <p className="text-[9px] text-orange-400">저항 +{f.bonus.statusResist}%</p>}
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
  const [targetSlot, setTargetSlot] = useState<number | null>(null);

  const inventory = FURNITURE.filter((f) => (furnitureInventory[f.id] ?? 0) > 0);

  const handleSlotClick = (slotIndex: number) => {
    if (selectedFurnitureId) {
      placeFurniture(slotIndex, selectedFurnitureId);
      gameEvents.emit(GAME_EVENT.HOUSING_FURNITURE_UPDATE);
      setSelectedFurnitureId(null);
      setTargetSlot(null);
    } else {
      setTargetSlot(slotIndex === targetSlot ? null : slotIndex);
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
                selectedFurnitureId ? "ring-2 ring-amber-500/50 rounded-xl" : "",
                targetSlot === i ? "ring-2 ring-blue-500/70 rounded-xl" : "",
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
      </div>

      {/* 보유 가구 선택 */}
      {inventory.length > 0 && (
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
            보유 가구 {selectedFurnitureId ? "— 배치할 슬롯을 선택하세요" : "— 가구를 선택 후 슬롯 클릭"}
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
                    : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600",
                ].join(" ")}
              >
                <span className="text-xl">{f.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-zinc-200 truncate">{f.name}</p>
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

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">가구 제작 (10종)</p>
      {FURNITURE.map((f) => {
        const canCraft = Object.entries(f.recipe).every(([matId, need]) => (materials[matId] ?? 0) >= need);
        const owned    = furnitureInventory[f.id] ?? 0;
        const justCrafted = lastCrafted === f.id;

        return (
          <div
            key={f.id}
            className={[
              "rounded-xl border p-3 transition",
              justCrafted ? "border-emerald-600 bg-emerald-950/30" : "border-zinc-800/60 bg-zinc-900/30",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">{f.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-zinc-200 truncate">{f.name}</p>
                  {owned > 0 && (
                    <span className="text-[9px] text-amber-400 font-mono shrink-0">보유 ×{owned}</span>
                  )}
                </div>
                <p className="text-[9px] text-zinc-500 truncate">{f.description}</p>
                {/* 보너스 미리보기 */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {f.bonus.hp          && <span className="text-[9px] text-emerald-400">HP +{f.bonus.hp}</span>}
                  {f.bonus.attack      && <span className="text-[9px] text-red-400">공격 +{f.bonus.attack}</span>}
                  {f.bonus.defense     && <span className="text-[9px] text-blue-400">방어 +{f.bonus.defense}</span>}
                  {f.bonus.speed       && <span className="text-[9px] text-yellow-400">속도 +{f.bonus.speed}</span>}
                  {f.bonus.expBonus    && <span className="text-[9px] text-purple-400">경험치 +{f.bonus.expBonus}%</span>}
                  {f.bonus.potionBonus && <span className="text-[9px] text-cyan-400">물약 +{f.bonus.potionBonus}%</span>}
                  {f.bonus.statusResist && <span className="text-[9px] text-orange-400">저항 +{f.bonus.statusResist}%</span>}
                </div>
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
  );
}

// ─── 효과 탭 ──────────────────────────────────────────────────────────────────

function BonusesTab() {
  const { getHousingBonuses, placedFurniture } = usePlayerStore();
  const bonuses = getHousingBonuses();
  const hasAny  = bonuses.hp || bonuses.attack || bonuses.defense || bonuses.speed ||
                  bonuses.expBonus || bonuses.potionBonus || bonuses.statusResist;

  return (
    <div className="flex flex-col gap-4">
      {/* 총 보너스 */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3">현재 하우징 보너스</p>
        {hasAny ? (
          <div className="flex flex-col gap-0.5">
            <BonusLabel label="최대 체력 (전 파티)" value={bonuses.hp} />
            <BonusLabel label="공격력"               value={bonuses.attack} />
            <BonusLabel label="방어력"               value={bonuses.defense} />
            <BonusLabel label="속도"                 value={bonuses.speed} />
            <BonusLabel label="경험치 획득"           value={bonuses.expBonus} unit="%" />
            <BonusLabel label="물약 회복량"            value={bonuses.potionBonus} unit="%" />
            <BonusLabel label="상태이상 저항"          value={bonuses.statusResist} unit="%" />
          </div>
        ) : (
          <p className="text-xs text-zinc-600 text-center py-2">가구를 배치하면 보너스가 생깁니다.</p>
        )}
      </div>

      {/* 조합 세트 */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">조합 세트</p>
        <div className="flex flex-col gap-2">
          {FURNITURE_COMBINATIONS.map((combo) => {
            const placed    = new Set(placedFurniture.filter(Boolean) as string[]);
            const isActive  = combo.requiredFurniture.every((id) => placed.has(id));
            const progress  = combo.requiredFurniture.filter((id) => placed.has(id)).length;

            return (
              <div
                key={combo.id}
                className={[
                  "rounded-xl border p-3 transition",
                  isActive
                    ? "border-amber-600/70 bg-amber-950/25"
                    : "border-zinc-800/50 bg-zinc-900/20",
                ].join(" ")}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-xs font-bold ${isActive ? "text-amber-300" : "text-zinc-400"}`}>
                    {isActive ? "✨ " : ""}
                    {combo.name}
                  </p>
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {progress}/{combo.requiredFurniture.length}
                  </span>
                </div>
                <p className="text-[9px] text-zinc-500 mb-2">{combo.description}</p>

                {/* 필요 가구 목록 */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {combo.requiredFurniture.map((fid) => {
                    const f   = getFurniture(fid);
                    const has = placed.has(fid);
                    return (
                      <span
                        key={fid}
                        className={[
                          "text-[9px] rounded border px-1.5 py-0.5",
                          has ? "border-emerald-700/60 text-emerald-400 bg-emerald-950/20" : "border-zinc-800 text-zinc-600",
                        ].join(" ")}
                      >
                        {f?.emoji} {f?.name}
                        {has && " ✓"}
                      </span>
                    );
                  })}
                </div>

                {/* 세트 보너스 */}
                {isActive && (
                  <div className="flex flex-wrap gap-2 mt-1 pt-2 border-t border-amber-800/30">
                    <span className="text-[9px] text-amber-500 font-semibold">세트 보너스:</span>
                    {combo.bonus.hp          && <span className="text-[9px] text-emerald-400">HP +{combo.bonus.hp}</span>}
                    {combo.bonus.attack      && <span className="text-[9px] text-red-400">공격 +{combo.bonus.attack}</span>}
                    {combo.bonus.defense     && <span className="text-[9px] text-blue-400">방어 +{combo.bonus.defense}</span>}
                    {combo.bonus.speed       && <span className="text-[9px] text-yellow-400">속도 +{combo.bonus.speed}</span>}
                    {combo.bonus.expBonus    && <span className="text-[9px] text-purple-400">경험치 +{combo.bonus.expBonus}%</span>}
                    {combo.bonus.potionBonus && <span className="text-[9px] text-cyan-400">물약 +{combo.bonus.potionBonus}%</span>}
                    {combo.bonus.statusResist && <span className="text-[9px] text-orange-400">저항 +{combo.bonus.statusResist}%</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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

    const handleEnterFarm = () => navigate("/farm");
    const handleExitHousing = () => navigate("/");

    gameEvents.on(GAME_EVENT.ENTER_FARM, handleEnterFarm);
    gameEvents.on(GAME_EVENT.EXIT_HOUSING, handleExitHousing);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_FARM, handleEnterFarm);
      gameEvents.off(GAME_EVENT.EXIT_HOUSING, handleExitHousing);
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

  const hasBonuses = bonuses.hp || bonuses.attack || bonuses.defense || bonuses.speed ||
                     bonuses.expBonus || bonuses.potionBonus || bonuses.statusResist;

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#111", display: "flex" }}>

      {/* Phaser 캔버스 */}
      <div
        ref={gameRef}
        style={{ flex: 1, minWidth: 0 }}
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
          {hasBonuses && !panelOpen && <span className="ml-1 text-emerald-400">●</span>}
        </button>
      </div>

      {/* 인테리어 패널 (오버레이 사이드바) */}
      {panelOpen && (
        <div
          className="fixed right-0 top-0 h-full z-50 flex"
          style={{ width: "380px" }}
        >
          {/* 패널 닫기 (오버레이 클릭) */}
          <div className="flex-1" onClick={() => setPanelOpen(false)} />

          <div
            className="w-full h-full flex flex-col bg-zinc-950/98 border-l border-zinc-800"
            style={{ backdropFilter: "blur(16px)" }}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <div>
                <h2 className="text-base font-bold text-zinc-100">🏠 인테리어</h2>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  {hasBonuses
                    ? `${bonuses.activeCombinations.length > 0 ? `세트 활성: ${bonuses.activeCombinations.join(", ")}` : "개별 보너스 적용 중"}`
                    : "가구를 배치해 보너스를 얻으세요"}
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
