import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ARTIFACT_RECIPES,
  POTION_RECIPES,
  DIFFICULTY_LABEL,
  STATION_LABEL,
} from "./craftingRecipes";
import { usePlayerStore } from "../shared/playerStore";
import type { CraftingRecipe, CraftingStationType, CraftedItem } from "../shared/crafting";
import type { RpsResult } from "../shared/craftingUtils";
import { QUALITY_COLOR, QUALITY_LABEL, QUALITY_GLOW, ARTIFACT_STAT_LABEL, rollArtifactQualityFromArrowResult } from "../shared/craftingUtils";
import { RockPaperScissorsMiniGame } from "./RockPaperScissorsMiniGame";
import { ArrowKeyCraftingMiniGame } from "./ArrowKeyCraftingMiniGame";
import type { ArrowMiniGameResult } from "./ArrowKeyCraftingMiniGame";

// ─── 중세 공방 팔레트 ──────────────────────────────────────────────────────────
const C = {
  bg:           "#160c04",      // 모달 전체 배경
  panel:        "#1e1007",      // 레시피 목록 영역
  aside:        "#130a03",      // 상세 패널 영역
  card:         "#2a1508",      // 레시피 카드 기본
  cardSelected: "#3d2008",      // 레시피 카드 선택됨
  border:       "rgba(180,120,30,0.45)",
  borderGold:   "rgba(212,160,23,0.85)",
  textPrimary:  "#f5e6c8",
  textMuted:    "#c4a46b",
  textFaint:    "#8b6014",
  gold:         "#d4a017",
  goldDim:      "#b47828",
  btnBg:        "rgba(180,120,30,0.22)",
  btnBorder:    "rgba(212,160,23,0.6)",
  btnHover:     "rgba(180,120,30,0.42)",
  btnDisabledBg:     "rgba(30,16,7,0.7)",
  btnDisabledBorder: "rgba(80,50,20,0.4)",
  btnDisabledText:   "#5a3c18",
  diffEasy:   "#4ade80",
  diffNormal: "#f59e0b",
  diffHard:   "#ef4444",
};

const DIFFICULTY_COLOR_MW: Record<string, string> = {
  easy:   C.diffEasy,
  normal: C.diffNormal,
  hard:   C.diffHard,
};

const STATION_ICON: Record<CraftingStationType, string> = {
  artifact: "⚔️",
  potion:   "⚗️",
};

// ─── 유틸 ──────────────────────────────────────────────────────────────────────

function canAfford(recipe: CraftingRecipe, materials: Record<string, number>) {
  return recipe.costs.every((c) => (materials[c.itemId] ?? 0) >= c.amount);
}

// ─── CraftingModal ────────────────────────────────────────────────────────────

interface CraftingModalProps {
  open:         boolean;
  stationType:  CraftingStationType;
  onClose:      () => void;
}

export function CraftingModal({ open, stationType, onClose }: CraftingModalProps) {
  const navigate = useNavigate();
  const { materials, craftWorkshopRecipe, craftWorkshopRecipeByQuality, grantWorkshopTestMaterials } = usePlayerStore();

  const recipes = stationType === "artifact" ? ARTIFACT_RECIPES : POTION_RECIPES;

  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? "");
  const [activeRecipe,     setActiveRecipe]     = useState<CraftingRecipe | null>(null);
  const [craftResult,      setCraftResult]      = useState<CraftedItem | null>(null);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0],
    [selectedRecipeId, recipes],
  );

  useEffect(() => {
    if (!open) {
      setActiveRecipe(null);
      setCraftResult(null);
      setSelectedRecipeId(recipes[0]?.id ?? "");
    }
  }, [open, recipes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const startCrafting = () => {
    if (!selectedRecipe || !canAfford(selectedRecipe, materials)) return;
    setCraftResult(null);
    setActiveRecipe(selectedRecipe);
  };

  // 물약(RPS) 완료
  const finishMiniGame = (rpsResult: RpsResult) => {
    if (!activeRecipe) return;
    const item = craftWorkshopRecipe(activeRecipe, rpsResult);
    if (activeRecipe.id === "ws_mothers_cure") {
      navigate("/ending");
      return;
    }
    setCraftResult(item);
    setActiveRecipe(null);
  };

  // 아티팩트(방향키 QTE) 완료
  const finishArrowQte = (result: ArrowMiniGameResult) => {
    if (!activeRecipe) return;
    const quality = rollArtifactQualityFromArrowResult(result.rating);
    const item = craftWorkshopRecipeByQuality(activeRecipe, quality);
    setCraftResult(item);
    setActiveRecipe(null);
  };

  const affordableCount = recipes.filter((r) => canAfford(r, materials)).length;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center px-4"
      style={{ background: "rgba(6,3,1,0.82)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.borderGold}`,
          boxShadow: `0 0 60px rgba(180,120,30,0.25), 0 8px 40px rgba(0,0,0,0.85)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ─────────────────────────────────────────────────────────────── */}
        <header
          className="flex shrink-0 items-center gap-4 px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span className="text-2xl">{STATION_ICON[stationType]}</span>
          <div className="flex-1">
            <h2
              className="text-xl font-black tracking-wide"
              style={{ color: C.textPrimary }}
            >
              {STATION_LABEL[stationType]}
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: C.textFaint }}>
              {stationType === "artifact"
                ? "탐험에서 얻은 재료로 몬스터에게 장착할 수 있는 아티팩트를 제작합니다."
                : "약초와 정수 재료를 사용해 전투에 사용할 수 있는 물약을 제작합니다."}
            </p>
          </div>

          {/* 테스트 재료 지급 */}
          <button
            type="button"
            onClick={grantWorkshopTestMaterials}
            className="rounded-lg px-3 py-2 text-xs font-bold transition hover:brightness-125"
            style={{
              background: "rgba(20,60,30,0.5)",
              border: "1px solid rgba(34,140,60,0.5)",
              color: "#86efac",
            }}
          >
            테스트 재료
          </button>

          {/* 닫기 */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-bold transition hover:brightness-125"
            style={{
              background: "rgba(60,20,5,0.6)",
              border: `1px solid ${C.border}`,
              color: C.textMuted,
            }}
          >
            닫기
          </button>
        </header>

        {/* ── 본문 ─────────────────────────────────────────────────────────────── */}
        <div
          className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_340px]"
        >
          {/* 레시피 목록 */}
          <section
            className="min-h-0 overflow-y-auto p-5"
            style={{ background: C.panel }}
          >
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: C.goldDim }}
                >
                  Recipes
                </p>
                <h3 className="text-base font-black" style={{ color: C.textPrimary }}>
                  제작 가능한 레시피
                </h3>
              </div>
              <span className="text-xs" style={{ color: C.textFaint }}>
                제작 가능 {affordableCount}/{recipes.length}
              </span>
            </div>

            <div className="grid gap-3">
              {recipes.map((recipe) => {
                const affordable = canAfford(recipe, materials);
                const selected   = selectedRecipe?.id === recipe.id;
                const diffColor  = DIFFICULTY_COLOR_MW[recipe.difficulty] ?? C.gold;

                return (
                  <button
                    type="button"
                    key={recipe.id}
                    onClick={() => {
                      setSelectedRecipeId(recipe.id);
                      setActiveRecipe(null);
                      setCraftResult(null);
                    }}
                    className="rounded-lg p-4 text-left transition hover:brightness-110"
                    style={{
                      background: selected ? C.cardSelected : C.card,
                      border: `1px solid ${selected ? C.borderGold : C.border}`,
                      boxShadow: selected ? `0 0 18px rgba(180,120,30,0.3)` : "none",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* 아이콘 */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                        style={{ background: "rgba(120,70,15,0.35)", border: `1px solid ${C.border}` }}
                      >
                        {stationType === "artifact" ? "◆" : "✚"}
                      </div>

                      {/* 내용 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-black" style={{ color: C.textPrimary }}>
                            {recipe.name}
                          </h4>
                          {/* 난이도 뱃지 */}
                          <span
                            className="rounded-full border px-2 py-0.5 text-[10px] font-black"
                            style={{
                              borderColor: `${diffColor}66`,
                              color: diffColor,
                              background: `${diffColor}14`,
                            }}
                          >
                            {DIFFICULTY_LABEL[recipe.difficulty]}
                          </span>
                          {affordable && (
                            <span className="text-[10px] font-bold" style={{ color: "#4ade80" }}>
                              ✓ 제작 가능
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-sm" style={{ color: C.textFaint }}>
                          {recipe.description}
                        </p>

                        {/* 재료 목록 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recipe.costs.map((cost) => {
                            const have = materials[cost.itemId] ?? 0;
                            const ok   = have >= cost.amount;
                            return (
                              <span
                                key={cost.itemId}
                                className="rounded-full border px-2 py-0.5 text-[11px] font-bold"
                                style={{
                                  borderColor: ok
                                    ? "rgba(74,222,128,0.3)"
                                    : "rgba(248,113,113,0.3)",
                                  color: ok ? "#86efac" : "#fca5a5",
                                  background: ok
                                    ? "rgba(20,83,45,0.2)"
                                    : "rgba(127,29,29,0.15)",
                                }}
                              >
                                {cost.name} {have}/{cost.amount}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 상세 패널 */}
          <aside
            className="min-h-0 overflow-y-auto p-5 md:border-l"
            style={{
              background: C.aside,
              borderColor: C.border,
            }}
          >
            {activeRecipe ? (
              activeRecipe.stationType === "artifact" ? (
                <ArrowKeyCraftingMiniGame
                  recipeName={activeRecipe.name}
                  onComplete={finishArrowQte}
                />
              ) : (
                <RockPaperScissorsMiniGame
                  craftingItemName={activeRecipe.name}
                  onFinish={finishMiniGame}
                />
              )
            ) : craftResult ? (
              <CraftResultPanel
                result={craftResult}
                onContinue={() => setCraftResult(null)}
              />
            ) : selectedRecipe ? (
              <RecipeDetailPanel
                recipe={selectedRecipe}
                materials={materials}
                onStart={startCrafting}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ─── 레시피 상세 패널 ─────────────────────────────────────────────────────────

function RecipeDetailPanel({
  recipe,
  materials,
  onStart,
}: {
  recipe:    CraftingRecipe;
  materials: Record<string, number>;
  onStart:   () => void;
}) {
  const affordable = canAfford(recipe, materials);

  return (
    <>
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: C.goldDim }}
      >
        Selected
      </p>
      <h3
        className="mt-1 text-lg font-black"
        style={{ color: C.textPrimary }}
      >
        {recipe.name}
      </h3>
      <p className="mt-2 text-sm" style={{ color: C.textFaint }}>
        {recipe.description}
      </p>

      {/* 결과 */}
      <div
        className="mt-4 rounded-lg p-3"
        style={{ background: "rgba(42,22,8,0.7)", border: `1px solid ${C.border}` }}
      >
        <p className="text-xs font-bold" style={{ color: C.textFaint }}>
          제작 결과
        </p>
        <p className="mt-1 text-sm font-black" style={{ color: C.gold }}>
          {recipe.resultItemName}
        </p>
        <p className="mt-1 text-xs" style={{ color: C.textFaint }}>
          {recipe.stationType === "artifact"
            ? "방향키 QTE 시험으로 품질이 결정됩니다."
            : "가위바위보 시험으로 품질이 결정됩니다."}
        </p>
      </div>

      {/* 품질 확률 */}
      <div
        className="mt-3 rounded-lg p-3 text-xs"
        style={{ background: "rgba(30,15,5,0.7)", border: `1px solid ${C.border}` }}
      >
        <p className="mb-1.5 font-bold" style={{ color: C.textMuted }}>
          ✦ 품질 확률 ✦
        </p>
        {recipe.stationType === "artifact" ? (
          <div className="space-y-1" style={{ color: C.textFaint }}>
            <p>
              <span style={{ color: "#d4a017" }}>완벽 (5/5)</span>
              {" "}— Elite 40% / Rare 50% / Normal 10%
            </p>
            <p>
              <span style={{ color: "#4ade80" }}>훌륭 (4/5)</span>
              {" "}— Elite 20% / Rare 55% / Normal 25%
            </p>
            <p>
              <span style={{ color: "#facc15" }}>무난 (3/5)</span>
              {" "}— Elite 5% / Rare 40% / Normal 55%
            </p>
            <p>
              <span style={{ color: "#f87171" }}>아쉬움 (0~2/5)</span>
              {" "}— Rare 15% / Normal 85%
            </p>
          </div>
        ) : (
          <div className="space-y-1" style={{ color: C.textFaint }}>
            <p>
              <span style={{ color: "#4ade80" }}>승리</span>
              {" "}— Elite 20% / Rare 55% / Normal 25%
            </p>
            <p>
              <span style={{ color: "#facc15" }}>무승부</span>
              {" "}— Elite 5% / Rare 35% / Normal 60%
            </p>
            <p>
              <span style={{ color: "#f87171" }}>패배</span>
              {" "}— Rare 15% / Normal 85%
            </p>
          </div>
        )}
      </div>

      {/* 제작 시작 버튼 */}
      <button
        type="button"
        onClick={onStart}
        disabled={!affordable}
        className="mt-5 w-full rounded-lg py-3 text-sm font-black transition"
        style={
          affordable
            ? {
                background: C.btnBg,
                border: `1px solid ${C.btnBorder}`,
                color: C.textPrimary,
                boxShadow: "0 0 16px rgba(180,120,30,0.2)",
              }
            : {
                background: C.btnDisabledBg,
                border: `1px solid ${C.btnDisabledBorder}`,
                color: C.btnDisabledText,
                cursor: "not-allowed",
              }
        }
      >
        {affordable ? "⚒  제작 시작" : "재료 부족"}
      </button>
    </>
  );
}

// ─── 제작 결과 패널 ──────────────────────────────────────────────────────────

function CraftResultPanel({
  result,
  onContinue,
}: {
  result:     CraftedItem;
  onContinue: () => void;
}) {
  const color      = QUALITY_COLOR[result.quality];
  const glow       = QUALITY_GLOW[result.quality];
  const label      = QUALITY_LABEL[result.quality];
  const isArtifact = result.stationType === "artifact";

  return (
    <div className="flex flex-col items-center gap-5 py-6 text-center">
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: C.goldDim }}
      >
        ✦ Crafted! ✦
      </p>

      <div
        className="w-full rounded-xl p-6"
        style={{
          background: `${color}0e`,
          border: `1px solid ${color}55`,
          boxShadow: `0 0 40px ${glow}`,
        }}
      >
        <p className="text-2xl font-black" style={{ color: C.textPrimary }}>
          {result.name}
        </p>
        <p className="mt-3 text-lg font-black" style={{ color }}>
          {label}
        </p>

        {/* 아티팩트 능력치 */}
        {isArtifact && result.statBonuses && result.statBonuses.length > 0 && (
          <div className="mt-4 text-left space-y-1.5 rounded-lg p-3"
            style={{ background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2"
              style={{ color: C.textFaint }}>능력치</p>
            {result.statBonuses.map((b) => (
              <p key={b.stat} className="text-sm font-bold" style={{ color: C.gold }}>
                {ARTIFACT_STAT_LABEL[b.stat as keyof typeof ARTIFACT_STAT_LABEL] ?? b.stat}
                {" "}+{b.value}{b.stat === "critRate" ? "%" : ""}
              </p>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs" style={{ color: C.textFaint }}>
        {isArtifact
          ? "아티팩트가 가방에 추가되었습니다!"
          : "물약이 가방에 추가되었습니다!"}
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-lg py-2.5 text-sm font-bold transition hover:brightness-110"
        style={{
          background: "rgba(40,22,8,0.7)",
          border: `1px solid ${C.border}`,
          color: C.textMuted,
        }}
      >
        계속 제작하기
      </button>
    </div>
  );
}
