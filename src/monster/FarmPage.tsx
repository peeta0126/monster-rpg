import { useState, useEffect, useRef, Fragment } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlayerStore } from "../shared/playerStore";
import { MATERIALS } from "../shared/items";
import {
  QUALITY_COLOR,
  QUALITY_LABEL,
} from "../shared/craftingUtils";
import type { ArtifactInstance, CraftedPotionStack } from "../shared/crafting";

import { PALETTE, rgba } from "../shared/palette";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { ArtifactCard } from "../shared/ui/ArtifactCard";
import { isIconName, type IconName } from "../shared/ui/icons";
import { useBgm, BGM } from "../shared/audio";
import { SlotGrid, SlotGridRow, EmptySlot } from "../shared/ui/SlotGrid";
import { GameBackground } from "../shared/ui/GameBackground";
import { EmptyState, PixelButton, ConfirmDialog } from "../shared/ui";

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

/** 격자 한 칸의 최소 폭. 개수 상자가 이 한 칸에 들어가므로 두 곳이 같은 값을 봐야 한다 */
const MATERIAL_SLOT = 168;
const POTION_SLOT   = 300;

const TAB_DATA: { id: BagTab; label: string }[] = [
  { id: "all",       label: "전체" },
  { id: "materials", label: "재료" },
  { id: "potions",   label: "물약" },
  { id: "artifacts", label: "아티팩트" },
];

// ─── 개수를 골라 버리기 ───────────────────────────────────────────────────────────
//
// 예전에는 「−1」 과 「전체」 뿐이었고, 누르면 그 자리에서 「확인?」 으로 바뀌어 한 번 더
// 누르면 나갔다. 문제가 둘이었다. 셋을 버리려면 같은 자리를 여섯 번 눌러야 했고, 손이
// 이미 그 자리에 있으니 연타 한 번이 곧 삭제였다 — 확인이 확인 노릇을 못 했다.
//
// 지금은 「삭제」 를 누르면 그 칸 아래에 **한 칸 폭**의 상자가 열린다. 점을 좌우로 끌어
// 개수를 잡고, 한 개씩은 좌우 방향키로 맞춘다. 개수가 곧 확인이라 「삭제」 는 한 번에 나간다.
//
// 상자에 이름을 안 적는다. 바로 위 칸이 무엇인지 말하고 있어서 "약초 버리기" 는 같은 말을
// 두 번 하는 것이고, 그만큼 폭을 먹어 슬라이더가 짧아진다. 취소 버튼도 없다 — 다른 데를
// 누르면 닫히는 것이 이 상자의 취소다.

function DiscardAmountBox({
  max,
  onDiscard,
  onClose,
}: {
  max: number;
  onDiscard: (amount: number) => void;
  onClose: () => void;
}) {
  // 1 에서 시작한다. 열자마자 전부 날아갈 자리에 손잡이가 놓여 있으면 안 된다
  const [amount, setAmount] = useState(1);
  const boxRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);

  // 열리면 손잡이를 잡아 둔다. 그래야 방향키가 바로 듣는다 — 한 번 더 클릭해서
  // 초점을 옮겨야 하면 "미세 조정은 방향키" 라는 약속이 안 지켜진다.
  useEffect(() => { sliderRef.current?.focus(); }, []);

  // 상자 밖을 누르면 닫힌다. 취소 버튼 대신이다.
  //
  // 「삭제」 버튼들은 "밖"으로 안 센다. 그 버튼은 자기가 열고 닫을 것을 알고 있어서,
  // 여기서 먼저 닫아 버리면 같은 버튼을 다시 눌러 닫으려던 것이 도리어 다시 열린다
  // (닫힘이 pointerdown, 토글이 click 이라 순서가 그렇게 된다).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (boxRef.current?.contains(target)) return;
      if (target?.closest?.(`[${TRIGGER_ATTR}]`)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [onClose]);

  return (
    <div
      ref={boxRef}
      data-testid="discard-amount-row"
      className="flex flex-col gap-1.5 rounded-xl px-3 py-2"
      style={{
        background: rgba("shadow900", 0.85),
        border: `1px solid ${rgba("ember700", 0.6)}`,
      }}
      // ESC 도 닫기다. 위로 흘리면 가방 화면이 같이 닫힌다
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onClose();
      }}
    >
      <input
        ref={sliderRef}
        type="range"
        min={1}
        max={Math.max(1, max)}
        step={1}
        value={amount}
        disabled={max <= 1}
        aria-label="버릴 개수"
        onChange={(e) => setAmount(Number(e.target.value))}
        className="pixel-range"
      />

      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-pixel-md font-black" style={{ color: PALETTE.ember500 }}>
          {amount}
          <span className="text-pixel-sm" style={{ color: PALETTE.sand300 }}> / {max}</span>
        </p>
        <PixelButton
          variant="danger"
          className="px-2 py-0.5"
          data-testid="discard-amount-apply"
          onClick={() => onDiscard(amount)}
        >
          삭제
        </PixelButton>
      </div>
    </div>
  );
}

/**
 * 칸마다 붙는 「삭제」. 누르면 아래에 개수 상자가 열린다.
 *
 * 표시를 달아 두는 이유는 위의 "밖을 누르면 닫힌다"가 이 버튼을 밖으로 세지 않게
 * 하기 위해서다. 이름(`삭제`)으로 가리면 상자 안의 확정 버튼까지 같이 잡힌다.
 */
const TRIGGER_ATTR = "data-discard-trigger";

function DiscardTrigger({ onOpen, open }: { onOpen: () => void; open: boolean }) {
  return (
    <PixelButton
      variant={open ? "primary" : "danger"}
      className="px-2 py-0.5"
      data-discard-trigger=""
      data-testid="discard-trigger"
      onClick={onOpen}
    >
      삭제
    </PixelButton>
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
  /** 지금 개수 줄이 열려 있는 재료. 하나만 열린다 — 둘이 열리면 방향키가 어디로 가는지 모른다 */
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
            style={{ color: PALETTE.sand300 }}>MATERIALS</p>
          <p className="text-pixel-sm font-black text-sand-200">보유 재료</p>
        </div>
        <p className="text-title-sm font-black font-mono"
          style={{ color: total > 0 ? PALETTE.ember500 : PALETTE.earth400 }}>
          {total}
        </p>
      </div>

      {/* 안 가진 재료는 칸을 안 만든다. **먼저 걸러 두는** 이유는 순번이 필요해서다 —
          개수 상자가 자기 칸과 같은 열에 서려면 "보이는 칸들 중 몇 번째"를 알아야 하고,
          MATERIALS 의 색인은 빈 것까지 세므로 그 자리가 아니다 */}
      <SlotGrid minItemWidth={MATERIAL_SLOT} minSlots={15}>
        {MATERIALS.filter((mat) => (materials[mat.id] ?? 0) > 0).map((mat, i) => {
            const cnt    = materials[mat.id] ?? 0;
            const open = openId === mat.id;
            return (
              <Fragment key={mat.id}>
                <div
                  className="rounded-xl p-3 flex flex-col items-center gap-1.5"
                  style={{
                    background: "rgba(13, 18, 35, .5)",
                    border: `1px solid ${open ? PALETTE.ember500 : "rgba(122, 132, 85, .489)"}`,
                    animation: `bagIn .35s ease ${i * .06}s both`,
                  }}>
                  <PixelIcon name={mat.icon} size={32}
                    className="pixel-img"
                    title={mat.name}
                    style={{ filter: "drop-shadow(0 0 6px rgba(122, 132, 85, .783))" }} />
                  <p className="text-pixel-sm font-bold text-sand-200 text-center">{mat.name}</p>
                  <p className="text-pixel-md font-black font-mono mt-1" style={{ color: PALETTE.moss500 }}>×{cnt}</p>

                  <div className="mt-0.5">
                    <DiscardTrigger open={open} onOpen={() => setOpenId((cur) => (cur === mat.id ? null : mat.id))} />
                  </div>
                </div>

                {/* 격자 한 줄을 쓰되 상자는 한 칸 폭이다. 누른 칸 바로 아래, 다음 칸 위에 열린다 */}
                {open && (
                  <SlotGridRow minItemWidth={MATERIAL_SLOT} after={i}>
                    <DiscardAmountBox
                      max={cnt}
                      onClose={() => setOpenId(null)}
                      onDiscard={(n) => { discardMaterial(mat.id, n); setOpenId(null); }}
                    />
                  </SlotGridRow>
                )}
              </Fragment>
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
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-3">
        <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
          style={{ color: PALETTE.sand300 }}>POTIONS</p>
        <p className="text-pixel-sm font-black text-sand-200">
          보유 물약{" "}
          <span className="font-mono text-ember-500">
            ×{craftedPotions.reduce((s, p) => s + p.quantity, 0)}
          </span>
        </p>
      </div>

      <SlotGrid minItemWidth={POTION_SLOT} minSlots={4} emptySlot={() => <EmptySlot className="min-h-20" />}>
        {craftedPotions.map((stack, i) => {
          const color = QUALITY_COLOR[stack.quality];
          const open  = openId === stack.stackId;
          const icon: IconName = isIconName(stack.itemId) ? stack.itemId : "potion";
          return (
            <Fragment key={stack.stackId}>
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(145deg, rgba(13, 18, 35, .9), rgba(13, 18, 35, .6))",
                border: `1px solid ${open ? PALETTE.ember500 : `${color}55`}`,
                boxShadow: `0 0 16px ${color}22`,
                animation: `bagIn .35s ease ${i * .07}s both`,
              }}>
              <div className="w-8 h-8 flex-shrink-0 relative">
                <PixelIcon name={icon} size={32} title={stack.name} />
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

              <div className="flex-shrink-0">
                <DiscardTrigger open={open} onOpen={() => setOpenId((cur) => (cur === stack.stackId ? null : stack.stackId))} />
              </div>
            </div>

            {open && (
              <SlotGridRow minItemWidth={POTION_SLOT} after={i}>
                <DiscardAmountBox
                  max={stack.quantity}
                  onClose={() => setOpenId(null)}
                  onDiscard={(n) => { discardPotion(stack.stackId, n); setOpenId(null); }}
                />
              </SlotGridRow>
            )}
            </Fragment>
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
  // 장비는 개수가 없다(하나가 하나다). 슬라이더로 고를 것이 없으니 대신 화면 가운데에
  // 한 번 더 묻는다 — 레벨과 강화가 들어간 물건이라 잘못 버리면 되돌릴 방법이 없다.
  const [pending, setPending] = useState<ArtifactInstance | null>(null);

  return (
    <div>
      <div className="mb-3">
        <p className="text-pixel-sm font-bold uppercase tracking-widest mb-0.5"
          style={{ color: PALETTE.sand300 }}>ARTIFACTS</p>
        <p className="text-pixel-sm font-black text-sand-200">보유 아티팩트 <span className="text-ember-500 font-mono">{craftedArtifacts.length}개</span></p>
      </div>

      {/* 칸을 280 → 340 으로 넓혔다. 다 키운 장비는 능력치 줄이 일곱까지 늘어나는데, 좁은
          칸에서는 한 단으로 쌓여 카드 높이가 두 배 넘게 벌어진다(줄이 둘뿐인 카드 옆에서
          그만큼이 빈다). 넓히면 능력치가 두 단으로 접혀 높이 차가 줄어든다. */}
      <SlotGrid minItemWidth={340} minSlots={3} emptySlot={() => <EmptySlot className="min-h-24" />}>
        {craftedArtifacts.map((item, i) => (
          <ArtifactCard
            key={item.instanceId}
            artifact={item}
            size="full"
            className="rounded-2xl"
            style={{ animation: `bagIn .35s ease ${i * .07}s both` }}
            action={
              <PixelButton variant="danger" className="px-2 py-0.5" onClick={() => setPending(item)}>
                버리기
              </PixelButton>
            }
          />
        ))}
      </SlotGrid>

      {pending && (
        <ConfirmDialog
          message="정말 삭제하시겠습니까?"
          detail={`${pending.name} · ${QUALITY_LABEL[pending.quality]} Lv.${pending.level ?? 1}${(pending.enhancement ?? 0) > 0 ? ` +${pending.enhancement}` : ""}`}
          onCancel={() => setPending(null)}
          onConfirm={() => { discardArtifact(pending.instanceId); setPending(null); }}
        />
      )}

      {craftedArtifacts.length === 0 && (
        <EmptyState title="보유 아티팩트가 없습니다"
          description="제작 공방에서 만들고, 내 몬스터 메뉴에서 장착합니다." />
      )}
    </div>
  );
}

// ─── FarmPage ─────────────────────────────────────────────────────────────────────
export default function FarmPage() {
  // 가방은 마을 안이다. 마을 곡을 그대로 잇는다(같은 키라 안 되감긴다)
  useBgm(BGM.basecamp);

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

        <div className="mx-auto flex w-full max-w-board items-center justify-between px-6 py-3">
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
            {([
              { icon: "herb",     label: "재료",     value: totalMats },
              { icon: "potion",   label: "물약",     value: totalPotions },
              { icon: "artifact", label: "아티팩트", value: totalArtifacts },
            ] as const).map((s) => (
              <div key={s.label} className="flex items-center gap-1.5" title={s.label}>
                <PixelIcon name={s.icon} size={16} />
                <span className="text-pixel-sm font-black text-sand-200">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 탭 바 ── */}
        <div className="mx-auto flex w-full max-w-board px-2">
          {TAB_DATA.map((tab) => {
            const isActive = activeTab === tab.id;
            const b = badge[tab.id];
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-2 px-5 py-3 text-pixel-sm font-bold transition-all"
                style={{
                  color: isActive ? PALETTE.ember500 : PALETTE.sand300,
                  borderBottom: isActive ? `2px solid ${PALETTE.ember500}` : "2px solid transparent",
                  background: isActive ? "rgba(233, 148, 65, .068)" : "transparent",
                }}>
                <span>{tab.label}</span>
                {b > 0 && (
                  <span className="rounded-full px-1.5 text-pixel-sm font-black"
                    style={{
                      background: isActive ? "rgba(233, 148, 65, .283)" : "rgba(132, 75, 63, .45)",
                      color: isActive ? PALETTE.ember500 : PALETTE.sand300,
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
      <div className="relative mx-auto w-full max-w-board flex-1 overflow-y-auto p-panel">
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
