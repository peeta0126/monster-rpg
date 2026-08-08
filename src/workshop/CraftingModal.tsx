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
import type { ItemQuality } from "../shared/crafting";
import { QUALITY_COLOR, QUALITY_LABEL, QUALITY_GLOW, ARTIFACT_STAT_LABEL, rollArtifactQualityFromArrowResult, maxCraftable } from "../shared/craftingUtils";
import { RockPaperScissorsMiniGame } from "./RockPaperScissorsMiniGame";
import { ArrowKeyCraftingMiniGame, TOTAL_KEYS, GREAT_MAX_WRONG, GOOD_MAX_WRONG } from "./ArrowKeyCraftingMiniGame";
import type { ArrowMiniGameResult } from "./ArrowKeyCraftingMiniGame";
import { PALETTE } from "../shared/palette";

// ─── 중세 공방 팔레트 ──────────────────────────────────────────────────────────
const C = {
  bg:           PALETTE.shadow900,      // 모달 전체 배경
  panel:        PALETTE.shadow900,      // 레시피 목록 영역
  aside:        PALETTE.shadow900,      // 상세 패널 영역
  card:         PALETTE.stone600,      // 레시피 카드 기본
  cardSelected: PALETTE.earth500,      // 레시피 카드 선택됨
  border:       "rgba(132, 75, 63, 1)",
  borderGold:   "rgba(233, 148, 65, .857)",
  textPrimary:  PALETTE.cream100,
  textMuted:    PALETTE.sand300,
  textFaint:    PALETTE.earth500,
  gold:         PALETTE.ember500,
  goldDim:      PALETTE.earth500,
  btnBg:        "rgba(132, 75, 63, .515)",
  btnBorder:    "rgba(233, 148, 65, .605)",
  btnHover:     "rgba(132, 75, 63, .982)",
  btnDisabledBg:     "rgba(13, 18, 35, .7)",
  btnDisabledBorder: "rgba(132, 75, 63, .141)",
  btnDisabledText:   PALETTE.earth500,
  diffEasy:   PALETTE.moss500,
  diffNormal: PALETTE.ember500,
  diffHard:   PALETTE.ember700,
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

/** 한 번에 만들 수 있는 상한. 너무 크면 한 번의 미니게임 결과가 과하게 증폭된다. */
const BATCH_LIMIT = 10;

// ─── CraftingModal ────────────────────────────────────────────────────────────

interface CraftingModalProps {
  open:         boolean;
  stationType:  CraftingStationType;
  onClose:      () => void;
}

export function CraftingModal({ open, stationType, onClose }: CraftingModalProps) {
  const navigate = useNavigate();
  const { materials, craftWorkshopRecipe, craftWorkshopRecipeByQuality, grantWorkshopTestMaterials } = usePlayerStore();

  // "어머니의 치료약"은 재료(만물의 정수)를 실제로 얻기 전까진 존재 자체를 숨긴다
  const recipes = stationType === "artifact"
    ? ARTIFACT_RECIPES
    : POTION_RECIPES.filter((r) => r.id !== "ws_mothers_cure" || (materials.ormr_essence ?? 0) > 0);

  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? "");
  const [activeRecipe,     setActiveRecipe]     = useState<CraftingRecipe | null>(null);
  const [craftResult,      setCraftResult]      = useState<CraftedItem | null>(null);
  /** 일괄 제작 결과 — 미니게임 한 번의 품질을 N개에 그대로 적용한다 */
  const [batchResult,      setBatchResult]      = useState<{ item: CraftedItem; count: number } | null>(null);
  const [quantity,         setQuantity]         = useState(1);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0],
    [selectedRecipeId, recipes],
  );

  // 닫힐 때 상태를 되돌리는 효과는 두지 않는다 — WorkshopPage가 열려 있을 때만 이 모달을
  // 마운트하므로(open은 항상 true) 닫히면 컴포넌트째 사라지고 상태도 함께 초기화된다.

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
    setBatchResult(null);
    setActiveRecipe(selectedRecipe);
  };

  /**
   * 미니게임 한 번의 품질을 정해진 개수만큼 그대로 적용한다.
   * 개수마다 미니게임을 시키면 한 판에 96번이라 손이 먼저 지친다(Handoff 6장 2번).
   * 재료가 중간에 떨어지면 만들어진 만큼만 반환한다.
   */
  const craftBatch = (recipe: CraftingRecipe, make: () => CraftedItem | null) => {
    const want = recipe.id === "ws_mothers_cure" ? 1 : Math.max(1, quantity);
    let last: CraftedItem | null = null;
    let made = 0;
    for (let i = 0; i < want; i++) {
      const item = make();
      if (!item) break;
      last = item;
      made += 1;
    }
    setActiveRecipe(null);
    if (!last) return null;
    if (made > 1) setBatchResult({ item: last, count: made });
    else setCraftResult(last);
    return last;
  };

  // 물약(RPS) 완료
  const finishMiniGame = (rpsResult: RpsResult) => {
    if (!activeRecipe) return;
    const recipe = activeRecipe;
    // 품질은 첫 판정 한 번으로 정하고 나머지는 같은 품질로 찍어낸다
    let quality: ItemQuality | null = null;
    const item = craftBatch(recipe, () => {
      if (quality === null) {
        const first = craftWorkshopRecipe(recipe, rpsResult);
        quality = first?.quality ?? null;
        return first;
      }
      return craftWorkshopRecipeByQuality(recipe, quality);
    });
    if (item && recipe.id === "ws_mothers_cure") navigate("/ending");
  };

  // 아티팩트(방향키 QTE) 완료
  const finishArrowQte = (result: ArrowMiniGameResult) => {
    if (!activeRecipe) return;
    const recipe = activeRecipe;
    const quality = rollArtifactQualityFromArrowResult(result.rating);
    craftBatch(recipe, () => craftWorkshopRecipeByQuality(recipe, quality));
  };

  const affordableCount = recipes.filter((r) => canAfford(r, materials)).length;

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center px-4"
      style={{ background: "rgba(13, 18, 35, .82)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: C.bg,
          border: `1px solid ${C.borderGold}`,
          boxShadow: `0 0 60px rgba(132, 75, 63, .585), 0 8px 40px rgba(13, 18, 35, .85)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ─────────────────────────────────────────────────────────────── */}
        <header
          className="flex shrink-0 items-center gap-4 px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span className="text-pixel-md">{STATION_ICON[stationType]}</span>
          <div className="flex-1">
            <h2
              className="text-pixel-md font-black tracking-wide"
              style={{ color: C.textPrimary }}
            >
              {STATION_LABEL[stationType]}
            </h2>
            <p className="mt-0.5 text-pixel-sm" style={{ color: C.textFaint }}>
              {stationType === "artifact"
                ? "탐험에서 얻은 재료로 몬스터에게 장착할 수 있는 아티팩트를 제작합니다."
                : "약초와 정수 재료를 사용해 전투에 사용할 수 있는 물약을 제작합니다."}
            </p>
          </div>

          {/* 테스트 재료 지급 — 개발 환경에서만 노출 */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={grantWorkshopTestMaterials}
              className="rounded-lg px-3 py-2 text-pixel-sm font-bold transition hover:brightness-125"
              style={{
                background: "rgba(122, 132, 85, .069)",
                border: "1px solid rgba(122, 132, 85, .455)",
                color: PALETTE.moss500,
              }}
            >
              테스트 재료
            </button>
          )}

          {/* 닫기 */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-pixel-sm font-bold transition hover:brightness-125"
            style={{
              background: "rgba(13, 18, 35, .6)",
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
                  className="text-pixel-sm font-bold uppercase tracking-widest"
                  style={{ color: C.goldDim }}
                >
                  Recipes
                </p>
                <h3 className="text-title-sm font-black" style={{ color: C.textPrimary }}>
                  제작 가능한 레시피
                </h3>
              </div>
              <span className="text-pixel-sm" style={{ color: C.textFaint }}>
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
                      boxShadow: selected ? `0 0 18px rgba(132, 75, 63, .702)` : "none",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      {/* 아이콘 */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-pixel-md"
                        style={{ background: "rgba(132, 75, 63, .282)", border: `1px solid ${C.border}` }}
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
                            className="rounded-full border px-2 py-0.5 text-pixel-sm font-black"
                            style={{
                              borderColor: `${diffColor}66`,
                              color: diffColor,
                              background: `${diffColor}14`,
                            }}
                          >
                            {DIFFICULTY_LABEL[recipe.difficulty]}
                          </span>
                          {affordable && (
                            <span className="text-pixel-sm font-bold" style={{ color: PALETTE.moss500 }}>
                              ✓ 제작 가능
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-pixel-sm" style={{ color: C.textFaint }}>
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
                                className="rounded-full border px-2 py-0.5 text-pixel-sm font-bold"
                                style={{
                                  borderColor: ok
                                    ? "rgba(122, 132, 85, .793)"
                                    : "rgba(233, 148, 65, .254)",
                                  color: ok ? PALETTE.moss500 : PALETTE.ember500,
                                  background: ok
                                    ? "rgba(122, 132, 85, .057)"
                                    : "rgba(168, 61, 31, .065)",
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
            ) : batchResult ? (
              <BatchResultPanel
                result={batchResult.item}
                count={batchResult.count}
                onContinue={() => setBatchResult(null)}
              />
            ) : craftResult ? (
              <CraftResultPanel
                result={craftResult}
                onContinue={() => setCraftResult(null)}
              />
            ) : selectedRecipe ? (
              <RecipeDetailPanel
                recipe={selectedRecipe}
                materials={materials}
                quantity={quantity}
                onQuantityChange={setQuantity}
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

function BatchResultPanel({
  result, count, onContinue,
}: { result: CraftedItem; count: number; onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
        일괄 제작 완료
      </p>
      <p className="text-title-md font-black" style={{ color: C.textPrimary }}>×{count}</p>
      <p className="text-title-sm font-black" style={{ color: C.textPrimary }}>{result.name}</p>
      <p className="text-pixel-sm font-bold" style={{ color: QUALITY_COLOR[result.quality] }}>
        {QUALITY_LABEL[result.quality]}
      </p>
      <p className="text-pixel-sm" style={{ color: C.textFaint }}>
        미니게임 한 번의 판정을 {count}개에 그대로 적용했습니다
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="mt-2 rounded-lg px-6 py-2 text-pixel-sm font-black transition"
        style={{ background: C.btnBg, border: `1px solid ${C.btnBorder}`, color: C.textPrimary }}
      >
        계속
      </button>
    </div>
  );
}

/** 1 / 5 / 최대 중에서 고른다. 재료가 모자라면 그만큼만 고를 수 있다. */
function QuantityPicker({
  max, value, onChange,
}: { max: number; value: number; onChange: (n: number) => void }) {
  const options = [1, 5, max].filter((n, i, arr) => n >= 1 && n <= max && arr.indexOf(n) === i);
  if (max <= 1) return null;

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
        수량 (최대 {max})
      </p>
      <div className="flex gap-1.5">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            data-testid={`craft-qty-${n === max && n !== 1 && n !== 5 ? "max" : n}`}
            className="flex-1 rounded-lg py-2 text-pixel-sm font-black transition"
            style={value === n
              ? { background: C.btnBg, border: `1px solid ${C.btnBorder}`, color: C.textPrimary }
              : { background: C.btnDisabledBg, border: `1px solid ${C.border}`, color: C.textMuted }}
          >
            {n === max && n !== 1 && n !== 5 ? `최대 ${n}` : `${n}개`}
          </button>
        ))}
      </div>
    </div>
  );
}

function RecipeDetailPanel({
  recipe,
  materials,
  quantity,
  onQuantityChange,
  onStart,
}: {
  recipe:    CraftingRecipe;
  materials: Record<string, number>;
  quantity:  number;
  onQuantityChange: (n: number) => void;
  onStart:   () => void;
}) {
  const affordable = canAfford(recipe, materials);

  return (
    <>
      <p
        className="text-pixel-sm font-bold uppercase tracking-widest"
        style={{ color: C.goldDim }}
      >
        Selected
      </p>
      <h3
        className="mt-1 text-title-sm font-black"
        style={{ color: C.textPrimary }}
      >
        {recipe.name}
      </h3>
      <p className="mt-2 text-pixel-sm" style={{ color: C.textFaint }}>
        {recipe.description}
      </p>

      {/* 결과 */}
      <div
        className="mt-4 rounded-lg p-3"
        style={{ background: "rgba(66, 61, 70, .072)", border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold" style={{ color: C.textFaint }}>
          제작 결과
        </p>
        <p className="mt-1 text-pixel-sm font-black" style={{ color: C.gold }}>
          {recipe.resultItemName}
        </p>
        <p className="mt-1 text-pixel-sm" style={{ color: C.textFaint }}>
          {recipe.stationType === "artifact"
            ? "방향키 QTE 시험으로 품질이 결정됩니다."
            : "가위바위보 시험으로 품질이 결정됩니다."}
        </p>
      </div>

      {/* 품질 확률 */}
      <div
        className="mt-3 rounded-lg p-3 text-pixel-sm"
        style={{ background: "rgba(13, 18, 35, .7)", border: `1px solid ${C.border}` }}
      >
        <p className="mb-1.5 font-bold" style={{ color: C.textMuted }}>
          ✦ 품질 확률 ✦
        </p>
        {recipe.stationType === "artifact" ? (
          <div className="space-y-1" style={{ color: C.textFaint }}>
            <p className="mb-1" style={{ color: C.textFaint }}>
              틀려도 시험은 끝까지 진행되며, 전체 {TOTAL_KEYS}키 중 틀린 개수로 등급이 결정됩니다.
            </p>
            <p>
              <span style={{ color: PALETTE.ember500 }}>완벽 (틀린 키 0개)</span>
              {" "}— Elite 40% / Rare 50% / Normal 10%
            </p>
            <p>
              <span style={{ color: PALETTE.moss500 }}>훌륭 (틀린 키 1~{GREAT_MAX_WRONG}개)</span>
              {" "}— Elite 20% / Rare 55% / Normal 25%
            </p>
            <p>
              <span style={{ color: PALETTE.ember500 }}>무난 (틀린 키 {GREAT_MAX_WRONG + 1}~{GOOD_MAX_WRONG}개)</span>
              {" "}— Elite 5% / Rare 40% / Normal 55%
            </p>
            <p>
              <span style={{ color: PALETTE.ember500 }}>아쉬움 (틀린 키 {GOOD_MAX_WRONG + 1}개 이상)</span>
              {" "}— Rare 15% / Normal 85%
            </p>
          </div>
        ) : (
          <div className="space-y-1" style={{ color: C.textFaint }}>
            <p>
              <span style={{ color: PALETTE.moss500 }}>승리</span>
              {" "}— Elite 20% / Rare 55% / Normal 25%
            </p>
            <p>
              <span style={{ color: PALETTE.ember500 }}>무승부</span>
              {" "}— Elite 5% / Rare 35% / Normal 60%
            </p>
            <p>
              <span style={{ color: PALETTE.ember500 }}>패배</span>
              {" "}— Rare 15% / Normal 85%
            </p>
          </div>
        )}
      </div>

      <QuantityPicker
        max={Math.min(BATCH_LIMIT, maxCraftable(recipe.costs, materials))}
        value={quantity}
        onChange={onQuantityChange}
      />

      {/* 제작 시작 버튼 */}
      <button
        type="button"
        onClick={onStart}
        disabled={!affordable}
        className="mt-5 w-full rounded-lg py-3 text-pixel-sm font-black transition"
        style={
          affordable
            ? {
                background: C.btnBg,
                border: `1px solid ${C.btnBorder}`,
                color: C.textPrimary,
                boxShadow: "0 0 16px rgba(132, 75, 63, .468)",
              }
            : {
                background: C.btnDisabledBg,
                border: `1px solid ${C.btnDisabledBorder}`,
                color: C.btnDisabledText,
                cursor: "not-allowed",
              }
        }
      >
        {affordable ? (quantity > 1 ? `⚒  ${quantity}개 제작` : "⚒  제작 시작") : "재료 부족"}
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
        className="text-pixel-sm font-bold uppercase tracking-widest"
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
        <p className="text-pixel-md font-black" style={{ color: C.textPrimary }}>
          {result.name}
        </p>
        <p className="mt-3 text-title-sm font-black" style={{ color }}>
          {label}
        </p>

        {/* 아티팩트 능력치 */}
        {isArtifact && result.statBonuses && result.statBonuses.length > 0 && (
          <div className="mt-4 text-left space-y-1.5 rounded-lg p-3"
            style={{ background: "rgba(13, 18, 35, .35)", border: `1px solid ${C.border}` }}>
            <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2"
              style={{ color: C.textFaint }}>능력치</p>
            {result.statBonuses.map((b) => (
              <p key={b.stat} className="text-pixel-sm font-bold" style={{ color: C.gold }}>
                {ARTIFACT_STAT_LABEL[b.stat as keyof typeof ARTIFACT_STAT_LABEL] ?? b.stat}
                {" "}+{b.value}{b.stat === "critRate" ? "%" : ""}
              </p>
            ))}
          </div>
        )}
      </div>

      <p className="text-pixel-sm" style={{ color: C.textFaint }}>
        {isArtifact
          ? "아티팩트가 가방에 추가되었습니다!"
          : "물약이 가방에 추가되었습니다!"}
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-lg py-2.5 text-pixel-sm font-bold transition hover:brightness-110"
        style={{
          background: "rgba(66, 61, 70, .066)",
          border: `1px solid ${C.border}`,
          color: C.textMuted,
        }}
      >
        계속 제작하기
      </button>
    </div>
  );
}
