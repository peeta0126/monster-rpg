import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type OwnedMonster } from "../store/playerStore";
import { MONSTER_IMAGE_MAP } from "../data/monsterImages";

// ─── 상수 ─────────────────────────────────────────────────────────────────────────

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

function MonsterCard({
  monster,
  selected,
  onClick,
  dimmed,
}: {
  monster: OwnedMonster;
  selected?: boolean;
  onClick: () => void;
  dimmed?: boolean;
}) {
  const hpPct = Math.round((monster.currentHp / monster.maxHp) * 100);
  const hpColor =
    hpPct > 50 ? "bg-green-500" : hpPct > 20 ? "bg-yellow-400" : "bg-red-500";

  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 flex flex-col items-center gap-1.5 transition-all w-full
        ${selected
          ? "border-yellow-400 bg-yellow-950/50 shadow-lg shadow-yellow-900/40"
          : dimmed
            ? "border-zinc-700 bg-zinc-900/40 opacity-50"
            : "border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800"
        }`}
    >
      <img
        src={MONSTER_IMAGE_MAP[monster.id]}
        alt={monster.name}
        className="h-16 w-16 object-contain"
      />
      <div className="text-center">
        <p className="font-bold text-sm text-zinc-100 leading-tight">
          {monster.nickname ?? monster.name}
        </p>
        <p className="text-xs text-zinc-500">Lv.{monster.level}</p>
        <span
          className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] ${TYPE_COLOR[monster.type] ?? TYPE_COLOR.normal}`}
        >
          {TYPE_KO[monster.type] ?? monster.type}
        </span>
      </div>
      {/* HP 바 */}
      <div className="w-full">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-0.5">
          <span>HP</span>
          <span>{monster.currentHp}/{monster.maxHp}</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-zinc-700">
          <div
            className={`h-full rounded-full ${hpColor} transition-all`}
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// ─── 빈 파티 슬롯 ────────────────────────────────────────────────────────────────

function EmptyPartySlot({
  index,
  selected,
  onClick,
}: {
  index: number;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-3 flex flex-col items-center justify-center gap-1 h-36 w-full transition-all
        ${selected
          ? "border-yellow-400 bg-yellow-950/30"
          : "border-zinc-700 bg-zinc-900/40 border-dashed hover:border-zinc-500"
        }`}
    >
      <span className="text-2xl text-zinc-600">+</span>
      <span className="text-xs text-zinc-600">슬롯 {index + 1}</span>
    </button>
  );
}

// ─── FarmPage ─────────────────────────────────────────────────────────────────────

export default function FarmPage() {
  const navigate = useNavigate();
  const { party, storage, bestFloor, moveToStorage, swapWithStorage, moveToParty, swapPartySlots, restorePartyHp } =
    usePlayerStore();

  // 선택된 파티 슬롯 인덱스 (0~2)
  const [selectedParty, setSelectedParty] = useState<number | null>(null);
  // 선택된 보관함 uid
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);

  // 파티 슬롯 클릭
  const handlePartyClick = (idx: number) => {
    // 보관함 몬스터가 선택된 상태: 파티 슬롯에 넣기
    if (selectedStorage !== null) {
      if (idx < party.length) {
        // 파티 슬롯에 이미 몬스터가 있으면 교체
        swapWithStorage(idx, selectedStorage);
      } else {
        // 빈 슬롯 — 보관함에서 파티로 이동
        moveToParty(selectedStorage, idx);
      }
      setSelectedStorage(null);
      setSelectedParty(null);
      return;
    }

    // 파티 슬롯 2개 선택 시 스왑
    if (selectedParty !== null && selectedParty !== idx) {
      swapPartySlots(selectedParty, idx);
      setSelectedParty(null);
      return;
    }

    setSelectedParty(idx === selectedParty ? null : idx);
  };

  // 보관함 클릭
  const handleStorageClick = (uid: string) => {
    // 파티 슬롯이 선택된 상태: 교체 또는 보관함→파티
    if (selectedParty !== null) {
      if (selectedParty < party.length) {
        swapWithStorage(selectedParty, uid);
      } else {
        moveToParty(uid, selectedParty);
      }
      setSelectedParty(null);
      setSelectedStorage(null);
      return;
    }

    setSelectedStorage(uid === selectedStorage ? null : uid);
  };

  // 파티→보관함 이동
  const handleRemoveFromParty = (idx: number) => {
    if (party.length <= 1) return; // 마지막 1마리 보호
    moveToStorage(idx);
    setSelectedParty(null);
  };

  const hint =
    selectedParty !== null
      ? "보관함에서 교체할 몬스터를 선택하세요"
      : selectedStorage !== null
        ? "파티 슬롯을 선택해 교체하거나 추가하세요"
        : "파티 슬롯 또는 보관함 몬스터를 클릭해 교체하세요";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* 헤더 */}
      <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/")}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700"
          >
            ← 베이스캠프
          </button>
          <h1 className="text-lg font-bold text-zinc-100">내 몬스터</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>최고 {bestFloor}층 도달</span>
          <button
            onClick={() => { restorePartyHp(); }}
            className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-3 py-1.5 text-emerald-300 hover:bg-emerald-900/60 text-sm"
          >
            파티 HP 전회복
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden">
        {/* ─ 파티 패널 ─ */}
        <div className="w-72 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-zinc-200">파티 ({party.length}/3)</h2>
            <span className="text-xs text-zinc-500">전투에 참가</span>
          </div>

          {/* 파티 슬롯 3개 */}
          {[0, 1, 2].map((idx) => {
            const m = party[idx];
            if (m) {
              return (
                <div key={m.uid} className="flex flex-col gap-1">
                  <MonsterCard
                    monster={m}
                    selected={selectedParty === idx}
                    dimmed={selectedStorage !== null && selectedParty === null && false}
                    onClick={() => handlePartyClick(idx)}
                  />
                  <button
                    onClick={() => handleRemoveFromParty(idx)}
                    disabled={party.length <= 1}
                    className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-right pr-1"
                  >
                    보관함으로 ↓
                  </button>
                </div>
              );
            } else {
              return (
                <EmptyPartySlot
                  key={`empty-${idx}`}
                  index={idx}
                  selected={selectedParty === idx}
                  onClick={() => handlePartyClick(idx)}
                />
              );
            }
          })}

          <p className="mt-2 text-xs text-zinc-600 text-center">{hint}</p>
        </div>

        {/* ─ 보관함 ─ */}
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
              {storage.map((m) => (
                <MonsterCard
                  key={m.uid}
                  monster={m}
                  selected={selectedStorage === m.uid}
                  onClick={() => handleStorageClick(m.uid)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
