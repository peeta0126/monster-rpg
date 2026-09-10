import { Fragment, useEffect, useMemo, useState } from "react";
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
import { QUALITY_COLOR, QUALITY_LABEL, QUALITY_GLOW, rollArtifactQualityFromArrowResult, maxCraftable } from "../shared/craftingUtils";
import { RockPaperScissorsMiniGame } from "./RockPaperScissorsMiniGame";
import { ArrowKeyCraftingMiniGame, GREAT_MAX_WRONG, GOOD_MAX_WRONG } from "./ArrowKeyCraftingMiniGame";
import type { ArrowMiniGameResult } from "./ArrowKeyCraftingMiniGame";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { PixelButton, ModalShell, SectionHead } from "../shared/ui";
import { ArtifactCard } from "../shared/ui/ArtifactCard";
import { isIconName, type IconName } from "../shared/ui/icons";

/**
 * 난이도 색. 팔레트의 뜻을 그대로 따른다 — moss=순함, ember=보통, ember-700=험함.
 *
 * 예전엔 이 파일이 색 스무 개짜리 자기 팔레트(`C`)를 들고 있었다. 같은 게임의 다른
 * 창들은 Tailwind 토큰만 쓰는데 공방만 인라인 style 로 칠해져서, 모서리·테두리·글자
 * 색이 전부 미묘하게 달랐다. 색은 토큰에서만 오고, 창틀은 `ModalShell` 이 정한다.
 */
const DIFFICULTY_CLASS: Record<string, string> = {
  easy:   "border-moss-500/70 bg-moss-500/12 text-sand-200",
  normal: "border-ember-500/70 bg-ember-500/12 text-ember-500",
  hard:   "border-ember-700/80 bg-ember-700/15 text-ember-500",
};

const STATION_ICON: Record<CraftingStationType, IconName> = {
  artifact: "artifact",
  potion:   "alchemy",
};

// ─── 재료 한 칸 ────────────────────────────────────────────────────────────────

/**
 * 필요한 재료 하나를 적는 상자.
 *
 * 원래 `철 조각 30/2` 였다. 앞이 보유고 뒤가 필요인데 분수처럼 읽혀서 "30개 중
 * 2개"로 오해할 여지가 있었다. 필요한 수는 굵게, 지금 가진 수는 그 아래 작게 적고
 * 그림을 앞에 둔다. 이름을 읽기 전에 뭔지 알 수 있어야 한다.
 */
function CostBox({ cost, have }: { cost: { itemId: string; name: string; amount: number }; have: number }) {
  const ok = have >= cost.amount;
  return (
    <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-pixel-sm
      ${ok ? "border-moss-500/70 bg-moss-500/12" : "border-ember-700/70 bg-ember-700/12"}`}>
      {isIconName(cost.itemId) && <PixelIcon name={cost.itemId} size={16} />}
      <span className="flex flex-col leading-tight">
        <span className="font-bold text-cream-100">{cost.name} {cost.amount}</span>
        <span className={ok ? "text-sand-300" : "text-ember-500"}>보유 {have}</span>
      </span>
    </span>
  );
}

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
  /** 일괄 제작 결과. 미니게임 한 번의 품질을 N개에 그대로 먹인다 */
  const [batchResult,      setBatchResult]      = useState<{ item: CraftedItem; count: number } | null>(null);
  const [quantity,         setQuantity]         = useState(1);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) ?? recipes[0],
    [selectedRecipeId, recipes],
  );

  // 닫힐 때 상태를 되돌리는 효과는 안 둔다. WorkshopPage 가 열려 있을 때만 이 모달을
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
    <ModalShell
      icon={STATION_ICON[stationType]}
      title={STATION_LABEL[stationType]}
      subtitle={stationType === "artifact"
        ? "탐험에서 얻은 재료로 몬스터에게 장착할 아티팩트를 만든다"
        : "약초와 정수로 전투에서 쓸 물약을 만든다"}
      onClose={onClose}
      testId="crafting-modal"
      actions={import.meta.env.DEV
        ? <PixelButton variant="nature" onClick={grantWorkshopTestMaterials}>테스트 재료</PixelButton>
        : undefined}
    >
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_var(--container-aside)]">
          {/* 레시피 목록 */}
          <section className="min-h-0 overflow-y-auto p-panel">
            <SectionHead
              en="Recipes" ko="제작 가능한 레시피"
              right={<span className="text-pixel-sm text-sand-300">
                제작 가능 {affordableCount}/{recipes.length}
              </span>}
            />

            <div className="grid gap-3">
              {recipes.map((recipe) => {
                const affordable = canAfford(recipe, materials);
                const selected   = selectedRecipe?.id === recipe.id;
                const diffClass  = DIFFICULTY_CLASS[recipe.difficulty] ?? DIFFICULTY_CLASS.normal;

                return (
                  <button
                    type="button"
                    key={recipe.id}
                    onClick={() => {
                      setSelectedRecipeId(recipe.id);
                      setActiveRecipe(null);
                      setCraftResult(null);
                    }}
                    /* 선택은 테두리로만 말한다. 예전엔 카드를 earth-500 로 통째로
                       칠했는데, 그 위의 재료 상자·설명이 갈색 위 갈색이 되어 고른
                       카드만 안 읽혔다. 고른 것이 제일 안 보이는 건 앞뒤가 안 맞는다.
                       도감·보관함·모루가 전부 테두리로 표시한다. */
                    className={`rounded-xl border-2 p-panel text-left transition
                      ${selected
                        ? "border-ember-500 bg-ember-500/10"
                        : "border-earth-500/60 bg-shadow-700/70 hover:border-earth-400"}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 만들어질 것의 그림. 예전엔 ◆ / ✚ 라는 도형 문자였다 */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg
                        border border-earth-500/60 bg-shadow-900/60">
                        <PixelIcon
                          name={isIconName(recipe.resultItemId) ? recipe.resultItemId : STATION_ICON[stationType]}
                          size={32}
                        />
                      </div>

                      {/* 내용 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-pixel-sm font-black text-cream-100">{recipe.name}</h4>
                          <span className={`rounded-lg border px-1.5 text-pixel-sm font-bold ${diffClass}`}>
                            {DIFFICULTY_LABEL[recipe.difficulty]}
                          </span>
                          {affordable && (
                            <span className="rounded-lg border border-moss-500/70 bg-moss-500/12
                              px-1.5 text-pixel-sm font-bold text-sand-200">재료 충분</span>
                          )}
                        </div>

                        <p className="mt-1 text-pixel-sm text-sand-300">{recipe.description}</p>

                        {/* 재료 목록 */}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {recipe.costs.map((cost) => (
                            <CostBox key={cost.itemId} cost={cost} have={materials[cost.itemId] ?? 0} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 상세 패널 */}
          <aside className="min-h-0 overflow-y-auto border-shadow-700 p-panel md:border-l">
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
    </ModalShell>
  );
}

// ─── 레시피 상세 패널 ─────────────────────────────────────────────────────────

function BatchResultPanel({
  result, count, onContinue,
}: { result: CraftedItem; count: number; onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">일괄 제작 완료</p>
      <p className="text-title-md font-black text-cream-100">×{count}</p>
      <p className="text-title-sm font-black text-cream-100">{result.name}</p>
      <p className="text-pixel-sm font-bold" style={{ color: QUALITY_COLOR[result.quality] }}>
        {QUALITY_LABEL[result.quality]}
      </p>
      <p className="text-pixel-sm text-sand-300">
        미니게임 한 번의 판정을 {count}개에 그대로 적용했다
      </p>
      <PixelButton variant="primary" className="mt-1 px-6" onClick={onContinue}>계속</PixelButton>
    </div>
  );
}

/**
 * 품질 확률 표. 화면이 그리는 값과 실제 굴림이 갈라지지 않게 한 곳에 적는다.
 * (굴림 자체는 craftingUtils 가 한다 — 여기는 사람이 읽는 표다)
 */
function qualityOdds(station: CraftingStationType): { label: string; tone: string; odds: number[] }[] {
  return station === "artifact"
    ? [
        { label: `0개`,                            tone: "text-sand-200",  odds: [40, 50, 10] },
        { label: `1~${GREAT_MAX_WRONG}개`,          tone: "text-sand-200",  odds: [20, 55, 25] },
        { label: `${GREAT_MAX_WRONG + 1}~${GOOD_MAX_WRONG}개`, tone: "text-sand-300", odds: [5, 40, 55] },
        { label: `${GOOD_MAX_WRONG + 1}개 이상`,     tone: "text-ember-500", odds: [0, 15, 85] },
      ]
    : [
        { label: "승리",   tone: "text-sand-200",  odds: [20, 55, 25] },
        { label: "무승부", tone: "text-sand-300",  odds: [5, 35, 60] },
        { label: "패배",   tone: "text-ember-500", odds: [0, 15, 85] },
      ];
}

/** 1 / 5 / 최대 중에서 고른다. 재료가 모자라면 그만큼만 고를 수 있다. */
function QuantityPicker({
  max, value, onChange,
}: { max: number; value: number; onChange: (n: number) => void }) {
  const options = [1, 5, max].filter((n, i, arr) => n >= 1 && n <= max && arr.indexOf(n) === i);
  if (max <= 1) return null;

  return (
    <div className="mt-4">
      <p className="mb-1.5 text-pixel-sm font-bold uppercase tracking-widest text-sand-300">
        수량 (최대 {max})
      </p>
      <div className="flex gap-1.5">
        {options.map((n) => (
          <PixelButton
            key={n}
            variant={value === n ? "primary" : "ghost"}
            onClick={() => onChange(n)}
            data-testid={`craft-qty-${n === max && n !== 1 && n !== 5 ? "max" : n}`}
            className="flex-1"
          >
            {n === max && n !== 1 && n !== 5 ? `최대 ${n}` : `${n}개`}
          </PixelButton>
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
      <SectionHead en="Selected" ko={recipe.name} />
      <p className="text-pixel-sm text-sand-300">{recipe.description}</p>

      {/* 결과 */}
      <div className="mt-4 rounded-xl border border-earth-500/50 bg-shadow-700/60 p-3">
        <p className="text-pixel-sm text-sand-300">제작 결과</p>
        <p className="mt-1 flex items-center gap-1.5 text-pixel-sm font-black text-cream-100">
          {isIconName(recipe.resultItemId) && <PixelIcon name={recipe.resultItemId} size={16} />}
          {recipe.resultItemName}
        </p>
        <p className="mt-1 text-pixel-sm text-sand-300">
          {recipe.stationType === "artifact"
            ? "방향키 시험 결과로 품질이 정해진다"
            : "가위바위보 결과로 품질이 정해진다"}
        </p>
      </div>

      {/* 품질 확률.
          예전엔 "완벽 (틀린 키 0개) — Elite 40% / Rare 50% / Normal 10%" 같은 줄이
          다섯 개 쌓인 문단이었다. 읽는 사람이 하는 일은 등급끼리 숫자를 비교하는 건데,
          문장으로 늘어놓으면 그 비교를 눈이 못 한다. 열을 맞춘 표로 세운다. */}
      <div className="mt-3 rounded-xl border border-earth-500/50 bg-shadow-900/70 p-3">
        <p className="mb-2 text-pixel-sm font-bold text-sand-200">품질 확률</p>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-1 text-pixel-sm">
          <span className="text-earth-400">{recipe.stationType === "artifact" ? "틀린 키" : "결과"}</span>
          <span className="justify-self-end text-earth-400">정예</span>
          <span className="justify-self-end text-earth-400">희귀</span>
          <span className="justify-self-end text-earth-400">일반</span>
          {qualityOdds(recipe.stationType).map((row) => (
            <Fragment key={row.label}>
              <span className={row.tone}>{row.label}</span>
              {row.odds.map((v, i) => (
                <span key={i} className="justify-self-end font-mono text-sand-200">
                  {v > 0 ? `${v}%` : "—"}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      <QuantityPicker
        max={Math.min(BATCH_LIMIT, maxCraftable(recipe.costs, materials))}
        value={quantity}
        onChange={onQuantityChange}
      />

      <PixelButton
        variant="primary"
        onClick={onStart}
        disabled={!affordable}
        className="mt-5 w-full py-3"
      >
        {affordable ? (quantity > 1 ? `${quantity}개 제작` : "제작 시작") : "재료 부족"}
      </PixelButton>
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
      <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">Crafted</p>

      {/* 아티팩트는 가방·모루·장착 화면과 같은 칸으로 보여준다. 갓 만든 것이라 Lv.1 +0 이지만
          숫자를 뽑는 길이 같아야, 배율을 고치는 날 이 화면만 옛말을 하지 않는다. */}
      {isArtifact ? (
        <ArtifactCard
          size="full"
          glow
          artifact={{
            itemId:      result.recipeId,
            name:        result.name,
            quality:     result.quality,
            statBonuses: result.statBonuses ?? [],
            level:       1,
            enhancement: 0,
          }}
        />
      ) : (
        <div className="flex w-full flex-col items-center gap-3 rounded-xl p-6"
          style={{ background: `${color}0e`, border: `1px solid ${color}55`, boxShadow: `0 0 40px ${glow}` }}
        >
          {isIconName(result.recipeId) && <PixelIcon name={result.recipeId} size={64} />}
          <p className="text-title-sm font-black text-cream-100">{result.name}</p>
          <p className="text-pixel-sm font-black" style={{ color }}>{label}</p>
        </div>
      )}

      <p className="text-pixel-sm text-sand-300">
        {isArtifact ? "아티팩트가 가방에 들어갔다" : "물약이 가방에 들어갔다"}
      </p>

      <PixelButton className="w-full py-2.5" onClick={onContinue}>계속 제작하기</PixelButton>
    </div>
  );
}
