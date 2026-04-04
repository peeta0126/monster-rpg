import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type OwnedMonster } from "../store/playerStore";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";
import { MATERIALS, POTIONS, getMaterial } from "../data/items";

// ─── 공통 상수 ───────────────────────────────────────────────────────────────────

const TYPE_KO: Record<string, string> = {
  fire: "불꽃", water: "물", grass: "풀",
  electric: "전기", ice: "얼음", normal: "노말",
};
const TYPE_COLOR: Record<string, string> = {
  fire:     "bg-red-900/70 text-red-200 border-red-700",
  water:    "bg-blue-900/70 text-blue-200 border-blue-700",
  grass:    "bg-green-900/70 text-green-200 border-green-700",
  electric: "bg-yellow-900/70 text-yellow-200 border-yellow-700",
  ice:      "bg-cyan-900/70 text-cyan-200 border-cyan-700",
  normal:   "bg-zinc-800/70 text-zinc-200 border-zinc-600",
};

// ─── 몬스터 카드 ──────────────────────────────────────────────────────────────────

function MonsterCard({ monster, selected, onClick, dimmed }: {
  monster: OwnedMonster; selected?: boolean; onClick: () => void; dimmed?: boolean;
}) {
  const hpPct  = Math.round((monster.currentHp / monster.maxHp) * 100);
  const hpColor = hpPct > 50 ? "bg-green-500" : hpPct > 20 ? "bg-yellow-400" : "bg-red-500";
  return (
    <button onClick={onClick}
      className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-all w-full
        ${selected
          ? "border-yellow-400 bg-yellow-950/50 shadow-lg shadow-yellow-900/40"
          : dimmed
            ? "border-zinc-700 bg-zinc-900/40 opacity-50"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800"}`}
    >
      <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.name} className="h-16 w-16 object-contain" />
      <div className="text-center">
        <p className="font-bold text-sm text-zinc-100 leading-tight">{monster.nickname ?? monster.name}</p>
        <p className="text-xs text-zinc-500">Lv.{monster.level}</p>
        <span className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] ${TYPE_COLOR[monster.type] ?? TYPE_COLOR.normal}`}>
          {TYPE_KO[monster.type] ?? monster.type}
        </span>
      </div>
      <div className="w-full">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
          <span>HP</span><span>{monster.currentHp}/{monster.maxHp}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-700">
          <div className={`h-full rounded-full ${hpColor} transition-all`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
    </button>
  );
}

function EmptyPartySlot({ index, selected, onClick }: { index: number; selected?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-xl border p-3 flex flex-col items-center justify-center gap-1 h-36 w-full transition-all
        ${selected
          ? "border-yellow-400 bg-yellow-950/30"
          : "border-zinc-700 bg-zinc-900/40 border-dashed hover:border-zinc-500"}`}>
      <span className="text-2xl text-zinc-600">+</span>
      <span className="text-xs text-zinc-600">슬롯 {index + 1}</span>
    </button>
  );
}

// ─── 제작소 탭 ────────────────────────────────────────────────────────────────────

function CraftTab() {
  const { materials, potions, craftPotion } = usePlayerStore();
  const [craftMsg, setCraftMsg] = useState<{ id: string; ok: boolean } | null>(null);

  const handleCraft = (potionId: string) => {
    const ok = craftPotion(potionId);
    setCraftMsg({ id: potionId, ok });
    setTimeout(() => setCraftMsg(null), 1800);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">

      {/* ── 보유 재료 ── */}
      <section>
        <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
          <span>🌿 보유 재료</span>
          <span className="text-xs text-zinc-600 font-normal">숲 탐험으로 수집할 수 있어요</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MATERIALS.map(mat => {
            const cnt = materials[mat.id] ?? 0;
            return (
              <div key={mat.id}
                className={`rounded-xl border p-3 flex flex-col items-center gap-1 transition
                  ${cnt > 0
                    ? "border-green-800/60 bg-green-950/20"
                    : "border-zinc-800 bg-zinc-900/30 opacity-50"}`}
              >
                <span className="text-2xl">{mat.emoji}</span>
                <p className="text-xs font-semibold text-zinc-200">{mat.name}</p>
                <p className="text-xs text-zinc-600">{mat.description}</p>
                <p className={`text-lg font-bold font-mono mt-1 ${cnt > 0 ? "text-green-400" : "text-zinc-600"}`}>
                  ×{cnt}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 제작 가능한 물약 ── */}
      <section>
        <h3 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
          <span>🧪 물약 제작</span>
          <span className="text-xs text-zinc-600 font-normal">재료를 모아 전투 아이템을 만드세요</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {POTIONS.map(potion => {
            const owned = potions[potion.id] ?? 0;
            // 재료 충족 여부 검사
            const canCraft = Object.entries(potion.recipe).every(
              ([matId, need]) => (materials[matId] ?? 0) >= need
            );
            const isMsgTarget = craftMsg?.id === potion.id;

            const effectLabel = (() => {
              const e = potion.effect;
              if (e.type === "heal")        return `HP ${e.amount} 회복`;
              if (e.type === "full_heal")   return "HP 완전 회복";
              if (e.type === "cure_status") return "모든 상태이상 치료";
              if (e.type === "buff_attack") return `공격력 ×${e.multiplier} / ${e.turns}턴 지속`;
              return "";
            })();

            return (
              <div key={potion.id}
                className={`rounded-xl border p-4 flex flex-col gap-2 transition
                  ${canCraft
                    ? "border-amber-700/60 bg-amber-950/20 shadow-[0_0_12px_rgba(180,120,0,0.08)]"
                    : "border-zinc-800 bg-zinc-900/30"}`}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{potion.emoji}</span>
                    <div>
                      <p className="text-sm font-bold text-zinc-100">{potion.name}</p>
                      <p className="text-xs text-zinc-500">{potion.description}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-zinc-600">보유</p>
                    <p className={`text-base font-bold font-mono ${owned > 0 ? "text-amber-400" : "text-zinc-600"}`}>
                      ×{owned}
                    </p>
                  </div>
                </div>

                {/* 효과 */}
                <div className="rounded-lg bg-zinc-900/60 px-3 py-1.5">
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">효과</p>
                  <p className="text-xs text-zinc-300">{effectLabel}</p>
                </div>

                {/* 재료 */}
                <div>
                  <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-1.5">필요 재료</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(potion.recipe).map(([matId, need]) => {
                      const mat  = getMaterial(matId);
                      const have = materials[matId] ?? 0;
                      const ok   = have >= need;
                      return (
                        <div key={matId}
                          className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]
                            ${ok
                              ? "border-green-800/60 bg-green-950/30 text-green-300"
                              : "border-zinc-700 bg-zinc-900/50 text-zinc-500"}`}
                        >
                          <span>{mat?.emoji ?? "?"}</span>
                          <span>{mat?.name ?? matId}</span>
                          <span className={`font-mono font-bold ${ok ? "text-green-400" : "text-red-500"}`}>
                            {have}/{need}
                          </span>
                          {ok && <span className="text-green-500">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 제작 버튼 */}
                <button
                  onClick={() => canCraft && handleCraft(potion.id)}
                  disabled={!canCraft}
                  className={`w-full rounded-lg border py-2 text-sm font-bold transition active:scale-95
                    ${canCraft
                      ? "border-amber-600 bg-amber-900/50 text-amber-200 hover:bg-amber-800/60"
                      : "border-zinc-800 bg-zinc-900/30 text-zinc-600 cursor-not-allowed"}`}
                >
                  {isMsgTarget
                    ? craftMsg?.ok
                      ? `✓ ${potion.name} 제작 완료!`
                      : "재료가 부족합니다"
                    : canCraft
                      ? `${potion.emoji} 제작하기`
                      : "재료 부족"
                  }
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 빈 상태 안내 */}
      {Object.values(materials).every(v => !v) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 text-center text-zinc-600">
          <p className="text-2xl mb-2">🌲</p>
          <p className="text-sm font-semibold mb-1">아직 재료가 없어요</p>
          <p className="text-xs">숲 탐험을 통해 약초, 열매, 나무뿌리, 빛의 수정을 수집하세요.</p>
        </div>
      )}
    </div>
  );
}

// ─── 물약 인벤토리 탭 ─────────────────────────────────────────────────────────────

function PotionInventoryTab() {
  const { potions } = usePlayerStore();
  const ownedPotions = POTIONS.filter(p => (potions[p.id] ?? 0) > 0);

  const effectLabel = (potion: (typeof POTIONS)[number]) => {
    const e = potion.effect;
    if (e.type === "heal")        return `HP ${e.amount} 회복`;
    if (e.type === "full_heal")   return "HP 완전 회복";
    if (e.type === "cure_status") return "모든 상태이상 치료";
    if (e.type === "buff_attack") return `공격력 ×${e.multiplier} / ${e.turns}턴`;
    return "";
  };

  if (ownedPotions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600 p-6">
        <span className="text-4xl">🎒</span>
        <p className="text-sm font-semibold">보유한 물약이 없습니다</p>
        <p className="text-xs text-center">제작소 탭에서 재료를 모아 물약을 만들어 보세요!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <h3 className="text-sm font-bold text-zinc-200 mb-3">🎒 보유 물약</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ownedPotions.map(p => (
          <div key={p.id}
            className="rounded-xl border border-amber-800/50 bg-amber-950/20 p-3 flex flex-col items-center gap-1.5">
            <span className="text-3xl">{p.emoji}</span>
            <p className="text-sm font-bold text-zinc-100 text-center">{p.name}</p>
            <p className="text-[10px] text-zinc-500 text-center">{effectLabel(p)}</p>
            <div className="mt-1 rounded-full bg-amber-900/50 border border-amber-700/50 px-3 py-0.5">
              <span className="text-amber-300 font-bold font-mono text-sm">×{potions[p.id] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FarmPage ─────────────────────────────────────────────────────────────────────

type FarmTab = "monsters" | "potions" | "craft";

export default function FarmPage() {
  const navigate = useNavigate();
  const { party, storage, bestFloor, moveToStorage, swapWithStorage, moveToParty, swapPartySlots, restorePartyHp } =
    usePlayerStore();

  const [activeTab, setActiveTab]         = useState<FarmTab>("monsters");
  const [selectedParty,   setSelectedParty]   = useState<number | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);

  const handlePartyClick = (idx: number) => {
    if (selectedStorage !== null) {
      if (idx < party.length) swapWithStorage(idx, selectedStorage);
      else moveToParty(selectedStorage, idx);
      setSelectedStorage(null); setSelectedParty(null); return;
    }
    if (selectedParty !== null && selectedParty !== idx) {
      swapPartySlots(selectedParty, idx); setSelectedParty(null); return;
    }
    setSelectedParty(idx === selectedParty ? null : idx);
  };

  const handleStorageClick = (uid: string) => {
    if (selectedParty !== null) {
      if (selectedParty < party.length) swapWithStorage(selectedParty, uid);
      else moveToParty(uid, selectedParty);
      setSelectedParty(null); setSelectedStorage(null); return;
    }
    setSelectedStorage(uid === selectedStorage ? null : uid);
  };

  const handleRemoveFromParty = (idx: number) => {
    if (party.length <= 1) return;
    moveToStorage(idx); setSelectedParty(null);
  };

  const hint =
    selectedParty !== null
      ? "보관함에서 교체할 몬스터를 선택하세요"
      : selectedStorage !== null
        ? "파티 슬롯을 선택해 교체하거나 추가하세요"
        : "파티 슬롯 또는 보관함 몬스터를 클릭해 교체하세요";

  const tabs: { id: FarmTab; label: string }[] = [
    { id: "monsters", label: "내 몬스터" },
    { id: "potions",  label: "🎒 가방" },
    { id: "craft",    label: "⚗️ 제작소" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* 헤더 */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700">
            ← 베이스캠프
          </button>
          <h1 className="text-lg font-bold text-zinc-100">농장</h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <span className="text-xs">최고 {bestFloor}층 도달</span>
          <button onClick={() => restorePartyHp()}
            className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-3 py-1.5 text-emerald-300 hover:bg-emerald-900/60 text-sm">
            파티 HP 전회복
          </button>
        </div>
      </div>

      {/* 탭 바 */}
      <div className="flex border-b border-zinc-800 bg-zinc-900/50">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-semibold transition border-b-2
              ${activeTab === tab.id
                ? "border-amber-500 text-amber-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── 내 몬스터 탭 ── */}
        {activeTab === "monsters" && (
          <>
            {/* 파티 패널 */}
            <div className="w-72 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-bold text-zinc-200">파티 ({party.length}/3)</h2>
                <span className="text-xs text-zinc-500">전투 참가</span>
              </div>
              {[0, 1, 2].map(idx => {
                const m = party[idx];
                if (m) return (
                  <div key={m.uid} className="flex flex-col gap-1">
                    <MonsterCard monster={m} selected={selectedParty === idx}
                      dimmed={selectedStorage !== null && selectedParty === null}
                      onClick={() => handlePartyClick(idx)} />
                    <button onClick={() => handleRemoveFromParty(idx)}
                      disabled={party.length <= 1}
                      className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-right pr-1">
                      보관함으로 ↓
                    </button>
                  </div>
                );
                return (
                  <EmptyPartySlot key={`empty-${idx}`} index={idx} selected={selectedParty === idx}
                    onClick={() => handlePartyClick(idx)} />
                );
              })}
              <p className="mt-2 text-xs text-zinc-600 text-center">{hint}</p>
            </div>

            {/* 보관함 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-zinc-200">보관함 ({storage.length}/30)</h2>
              </div>
              {storage.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-zinc-600 gap-2">
                  <span className="text-3xl">📦</span>
                  <p className="text-sm">보관 중인 몬스터가 없습니다.</p>
                  <p className="text-xs">포획 전투에서 몬스터를 잡으면 여기에 저장됩니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {storage.map(m => (
                    <MonsterCard key={m.uid} monster={m} selected={selectedStorage === m.uid}
                      onClick={() => handleStorageClick(m.uid)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 가방 탭 ── */}
        {activeTab === "potions" && <PotionInventoryTab />}

        {/* ── 제작소 탭 ── */}
        {activeTab === "craft" && <CraftTab />}
      </div>
    </div>
  );
}
