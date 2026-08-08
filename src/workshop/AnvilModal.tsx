import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../shared/playerStore";
import type { ArtifactInstance } from "../shared/crafting";
import { PALETTE } from "../shared/palette";
import {
  QUALITY_COLOR,
  QUALITY_LABEL,
  QUALITY_MULTIPLIER,
  ARTIFACT_STAT_LABEL,
  MAX_EQUIPMENT_ENHANCEMENT,
  getEnhancementSuccessRate,
  getEquipmentMaxLevel,
  getEquipmentLevelUpCost,
  getDisassembleStones,
  getNextQuality,
  canSynthesizeArtifacts,
  getEffectiveStats,
  ARTIFACT_BONUS_POOL,
} from "../shared/craftingUtils";

// ─── 팔레트 (제작 공방 공통) ──────────────────────────────────────────────────

const C = {
  bg:           PALETTE.shadow900,
  panel:        PALETTE.shadow900,
  aside:        PALETTE.shadow900,
  card:         PALETTE.stone600,
  cardSel:      PALETTE.earth500,
  border:       "rgba(132, 75, 63, 1)",
  borderGold:   "rgba(233, 148, 65, .857)",
  textPrimary:  PALETTE.cream100,
  textMuted:    PALETTE.sand300,
  textFaint:    PALETTE.earth500,
  gold:         PALETTE.ember500,
  goldDim:      PALETTE.earth500,
  btnBg:        "rgba(132, 75, 63, .515)",
  btnBorder:    "rgba(233, 148, 65, .605)",
  disabledBg:   "rgba(13, 18, 35, .7)",
  disabledBorder:"rgba(132, 75, 63, .141)",
  disabledText: PALETTE.earth500,
  green:        PALETTE.moss500,
  red:          PALETTE.ember500,
  yellow:       PALETTE.ember500,
};

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────

type AnvilTab = "levelup" | "enhance" | "disassemble" | "synthesize";

const TABS: { id: AnvilTab; label: string; icon: string }[] = [
  { id: "levelup",     label: "레벨업",  icon: "⬆" },
  { id: "enhance",     label: "강화",    icon: "⚡" },
  { id: "disassemble", label: "분해",    icon: "🔨" },
  { id: "synthesize",  label: "합성",    icon: "✦"  },
];

// ─── 아이템 이모지 ────────────────────────────────────────────────────────────

const ARTIFACT_EMOJI: Record<string, string> = {
  power_necklace: "📿",
  guard_bracelet: "🛡️",
  spirit_amulet:  "🔮",
};

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function artifactLevel(a: ArtifactInstance): number {
  return a.level ?? 1;
}

function artifactEnh(a: ArtifactInstance): number {
  return a.enhancement ?? 0;
}

// 강화석 소비: discardMaterial을 활용 (store에 이미 있음)

// ─── 작은 아티팩트 카드 ────────────────────────────────────────────────────────

function ArtifactCard({
  artifact,
  selected,
  onClick,
  dim = false,
}: {
  artifact: ArtifactInstance;
  selected?: boolean;
  onClick?: () => void;
  dim?: boolean;
}) {
  const color = QUALITY_COLOR[artifact.quality];
  const lv    = artifactLevel(artifact);
  const enh   = artifactEnh(artifact);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full rounded-lg p-3 text-left transition"
      style={{
        background:  selected ? C.cardSel : C.card,
        border:      `1px solid ${selected ? C.borderGold : C.border}`,
        boxShadow:   selected ? `0 0 14px rgba(132, 75, 63, .702)` : "none",
        opacity:     dim ? 0.4 : 1,
        cursor:      onClick ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-title-sm"
          style={{ background: "rgba(132, 75, 63, .282)", border: `1px solid ${color}44` }}
        >
          {ARTIFACT_EMOJI[artifact.itemId] ?? "✨"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-pixel-sm font-black" style={{ color: C.textPrimary }}>
            {artifact.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-pixel-sm font-bold" style={{ color }}>{QUALITY_LABEL[artifact.quality]}</span>
            <span className="text-pixel-sm" style={{ color: C.textFaint }}>Lv.{lv}</span>
            {enh > 0 && (
              <span className="text-pixel-sm font-black" style={{ color: C.gold }}>+{enh}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── 레벨업 패널 ──────────────────────────────────────────────────────────────

function LevelUpPanel({
  artifact,
  stones,
  onLevelUp,
}: {
  artifact: ArtifactInstance;
  stones:   number;
  onLevelUp: () => void;
}) {
  const color   = QUALITY_COLOR[artifact.quality];
  const lv      = artifactLevel(artifact);
  const enh     = artifactEnh(artifact);
  const maxLv   = getEquipmentMaxLevel(artifact.quality);
  const isMax   = lv >= maxLv;
  const cost    = isMax ? 0 : getEquipmentLevelUpCost(artifact.quality, lv);
  const canDo   = !isMax && stones >= cost;

  // 실효 능력치 (현재 레벨·강화 기준)
  const currentStats = getEffectiveStats(artifact.statBonuses, lv, enh);
  const nextStats    = isMax ? currentStats : getEffectiveStats(artifact.statBonuses, lv + 1, enh);

  // 다음 부가 능력치 해제까지 남은 레벨
  const nextUnlockLv   = Math.ceil(lv / 10) * 10 + (lv % 10 === 0 ? 10 : 0);
  const levelsToUnlock = nextUnlockLv - lv;
  const willUnlockNext = !isMax && (lv + 1) % 10 === 0;

  // 이미 해제된 부가 능력치
  const bonusStats = artifact.bonusStats ?? [];
  const pool       = ARTIFACT_BONUS_POOL[artifact.itemId] ?? [];
  // 레벨 10마다 최대 획득 가능한 횟수 (풀 크기와 최대 레벨 중 작은 값)
  const maxUnlocks = Math.min(pool.length, Math.floor(maxLv / 10));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
          ✦ 장비 레벨업 ✦
        </p>
        <p className="mt-1 text-title-sm font-black" style={{ color: C.textPrimary }}>
          {artifact.name}
        </p>
        <span className="text-pixel-sm font-bold" style={{ color }}>{QUALITY_LABEL[artifact.quality]}</span>
      </div>

      {/* 레벨 바 */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div className="flex justify-between items-end mb-1.5">
          <p className="text-pixel-sm font-bold" style={{ color: C.textFaint }}>현재 레벨</p>
          <p className="text-pixel-sm font-black font-mono" style={{ color: isMax ? C.gold : C.textPrimary }}>
            {lv} / {maxLv}
          </p>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(243, 229, 185, .089)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${(lv / maxLv) * 100}%`,
              background: isMax
                ? `linear-gradient(90deg,${C.gold},${PALETTE.ember500})`
                : `linear-gradient(90deg,${color}88,${color})`,
            }}
          />
        </div>
        {isMax
          ? <p className="mt-1.5 text-center text-pixel-sm font-black" style={{ color: C.gold }}>✦ 최대 레벨 달성 ✦</p>
          : willUnlockNext
            ? <p className="mt-1.5 text-center text-pixel-sm font-bold" style={{ color: PALETTE.mist300 }}>✦ 다음 레벨업 시 부가 능력치 해제! ✦</p>
            : <p className="mt-1.5 text-center text-pixel-sm" style={{ color: C.textFaint }}>
                부가 능력치 해제까지 {levelsToUnlock}레벨 남음
              </p>
        }
      </div>

      {/* 능력치 (현재 → 다음 레벨 미리보기) */}
      <div
        className="rounded-lg p-3 space-y-1.5"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold mb-2" style={{ color: C.textFaint }}>
          능력치 <span style={{ color: C.textFaint, fontWeight: 400 }}>(Lv.{lv} +{enh} 기준)</span>
        </p>
        {currentStats.map((s, i) => {
          const diff = nextStats[i].value - s.value;
          return (
            <div key={s.stat} className="flex items-center justify-between text-pixel-sm">
              <span style={{ color: C.textMuted }}>{ARTIFACT_STAT_LABEL[s.stat]}</span>
              <div className="flex items-center gap-1.5 font-mono font-bold">
                <span style={{ color: C.textPrimary }}>{s.value}</span>
                {!isMax && diff > 0 && (
                  <>
                    <span style={{ color: C.textFaint }}>→</span>
                    <span style={{ color: C.green }}>{nextStats[i].value}</span>
                    <span className="text-pixel-sm font-normal" style={{ color: C.green }}>(+{diff})</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 부가 능력치 */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold mb-2" style={{ color: C.textFaint }}>
          부가 능력치{" "}
          <span style={{ color: C.textFaint, fontWeight: 400 }}>({bonusStats.length}/{maxUnlocks})</span>
        </p>
        {bonusStats.length === 0 ? (
          <p className="text-pixel-sm text-center py-1" style={{ color: C.textFaint }}>
            Lv.10 달성 시 첫 번째 부가 능력치 해제
          </p>
        ) : (
          <div className="space-y-1">
            {bonusStats.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-pixel-sm font-bold"
                style={{
                  background: "rgba(92, 147, 150, .133)",
                  border:     "1px solid rgba(92, 147, 150, .4)",
                  color:      PALETTE.mist300,
                }}
              >
                <span>✦</span>
                <span>{b.label}</span>
                <span className="ml-auto text-pixel-sm font-normal" style={{ color: "rgba(92, 147, 150, .8)" }}>
                  Lv.{(i + 1) * 10} 해제
                </span>
              </div>
            ))}
            {/* 미해제 슬롯 표시 */}
            {Array.from({ length: maxUnlocks - bonusStats.length }, (_, i) => {
              const unlockLv = (bonusStats.length + i + 1) * 10;
              return (
                <div
                  key={`locked-${i}`}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-pixel-sm"
                  style={{
                    background: "rgba(243, 229, 185, .038)",
                    border:     "1px solid rgba(243, 229, 185, .089)",
                    color:      C.textFaint,
                  }}
                >
                  <span>?</span>
                  <span>미해제</span>
                  <span className="ml-auto text-pixel-sm" style={{ color: C.textFaint }}>
                    Lv.{unlockLv} 달성 필요
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 강화석 비용 */}
      {!isMax && (
        <div
          className="rounded-lg p-3 space-y-1.5"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >
          <div className="flex justify-between">
            <span className="text-pixel-sm" style={{ color: C.textFaint }}>필요 강화석</span>
            <span className="text-pixel-sm font-black" style={{ color: stones >= cost ? C.green : C.red }}>
              🪨 {cost}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-sm" style={{ color: C.textFaint }}>보유 강화석</span>
            <span className="text-pixel-sm font-black font-mono" style={{ color: C.textPrimary }}>
              {stones}개
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onLevelUp}
        disabled={!canDo}
        className="w-full rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
        style={
          canDo
            ? { background: willUnlockNext ? "rgba(92, 147, 150, .194)" : C.btnBg,
                border:     `1px solid ${willUnlockNext ? "rgba(92, 147, 150, .543)" : C.btnBorder}`,
                color:      C.textPrimary,
                boxShadow:  willUnlockNext ? "0 0 16px rgba(92, 147, 150, .233)" : "0 0 16px rgba(132, 75, 63, .468)" }
            : { background: C.disabledBg, border: `1px solid ${C.disabledBorder}`, color: C.disabledText,
                cursor: "not-allowed" }
        }
      >
        {isMax ? "최대 레벨" : canDo ? (willUnlockNext ? "✨  레벨업 (부가 능력치 해제!)" : "⬆  레벨업") : "강화석 부족"}
      </button>
    </div>
  );
}

// ─── 강화 패널 ────────────────────────────────────────────────────────────────

function EnhancePanel({
  target,
  allArtifacts,
  materialId,
  onSelectMaterial,
  onEnhance,
}: {
  target:           ArtifactInstance;
  allArtifacts:     ArtifactInstance[];
  materialId:       string | null;
  onSelectMaterial: (id: string) => void;
  onEnhance:        () => void;
}) {
  const color   = QUALITY_COLOR[target.quality];
  const enh     = artifactEnh(target);
  const isMax   = enh >= MAX_EQUIPMENT_ENHANCEMENT;

  // 재료 후보: 같은 등급, 다른 instanceId
  const candidates = allArtifacts.filter(
    (a) => a.quality === target.quality && a.instanceId !== target.instanceId,
  );
  const material = allArtifacts.find((a) => a.instanceId === materialId) ?? null;
  const canDo    = !isMax && material !== null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
          ✦ 장비 강화 ✦
        </p>
        <p className="mt-1 text-title-sm font-black" style={{ color: C.textPrimary }}>
          {target.name}
        </p>
        <span className="text-pixel-sm font-bold" style={{ color }}>{QUALITY_LABEL[target.quality]}</span>
      </div>

      {/* 강화 수치 표시 */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold mb-2" style={{ color: C.textFaint }}>강화 수치</p>
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: MAX_EQUIPMENT_ENHANCEMENT }, (_, i) => {
            const filled = i < enh;
            const next   = !isMax && i === enh;
            return (
              <div
                key={i}
                className="flex h-8 w-8 items-center justify-center rounded font-black text-pixel-sm"
                style={{
                  background: filled ? "rgba(233, 148, 65, .252)" : next ? "rgba(233, 148, 65, .101)" : "rgba(243, 229, 185, .064)",
                  border: `1px solid ${filled ? C.borderGold : next ? "rgba(233, 148, 65, .302)" : "rgba(243, 229, 185, .102)"}`,
                  color: filled ? C.gold : next ? C.goldDim : C.textFaint,
                }}
              >
                {filled ? "★" : next ? "◇" : "◆"}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-pixel-sm font-black" style={{ color: isMax ? C.gold : C.textPrimary }}>
          {isMax ? "최대 강화 달성 ✦" : `+${enh} → +${enh + 1}`}
        </p>
      </div>

      {/* 재료 선택 */}
      {!isMax && (
        <div>
          <p className="mb-2 text-pixel-sm font-bold" style={{ color: C.textMuted }}>
            재료 선택 <span style={{ color: C.textFaint }}>— 같은 등급 장비 사용</span>
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-lg p-3 text-center text-pixel-sm" style={{ color: C.textFaint,
              background: C.card, border: `1px solid ${C.border}` }}>
              재료로 쓸 {QUALITY_LABEL[target.quality]} 등급 장비가 없습니다
            </p>
          ) : (
            <div className="max-h-32 overflow-y-auto space-y-1.5">
              {candidates.map((a) => (
                <ArtifactCard
                  key={a.instanceId}
                  artifact={a}
                  selected={a.instanceId === materialId}
                  onClick={() => onSelectMaterial(a.instanceId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {material && !isMax && (
        <div
          className="rounded-lg p-2 text-pixel-sm text-center"
          style={{ background: "rgba(233, 148, 65, .085)", border: "1px solid rgba(233, 148, 65, .254)",
            color: C.red }}
        >
          ⚠ 재료 장비는 강화 후 사라집니다
        </div>
      )}

      <button
        type="button"
        onClick={onEnhance}
        disabled={!canDo}
        className="w-full rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
        style={
          canDo
            ? { background: C.btnBg, border: `1px solid ${C.btnBorder}`, color: C.textPrimary,
                boxShadow: "0 0 16px rgba(132, 75, 63, .468)" }
            : { background: C.disabledBg, border: `1px solid ${C.disabledBorder}`, color: C.disabledText,
                cursor: "not-allowed" }
        }
      >
        {isMax
          ? "최대 강화"
          : canDo ? `⚡  강화하기 (성공률 ${Math.round(getEnhancementSuccessRate(enh) * 100)}%)`
          : "재료를 선택하세요"}
      </button>
      {!isMax && (
        <p className="text-center text-pixel-sm" style={{ color: C.textFaint }}>
          실패해도 강화 수치는 내려가지 않습니다. 재료만 사라집니다.
        </p>
      )}
    </div>
  );
}

// ─── 분해 패널 ────────────────────────────────────────────────────────────────

function DisassemblePanel({
  artifact,
  onDisassemble,
}: {
  artifact:     ArtifactInstance;
  onDisassemble: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const color  = QUALITY_COLOR[artifact.quality];
  const lv     = artifactLevel(artifact);
  const enh    = artifactEnh(artifact);
  const stones = getDisassembleStones(artifact.quality, lv, enh);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
          ✦ 장비 분해 ✦
        </p>
        <p className="mt-1 text-title-sm font-black" style={{ color: C.textPrimary }}>
          {artifact.name}
        </p>
        <span className="text-pixel-sm font-bold" style={{ color }}>{QUALITY_LABEL[artifact.quality]}</span>
        <span className="ml-2 text-pixel-sm" style={{ color: C.textFaint }}>Lv.{lv} +{enh}</span>
      </div>

      {/* 획득 강화석 */}
      <div
        className="rounded-xl p-4 text-center"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold mb-2" style={{ color: C.textFaint }}>분해 시 획득</p>
        <p className="text-title-md font-black" style={{ color: C.gold }}>🪨 ×{stones}</p>
        <p className="mt-1 text-pixel-sm" style={{ color: C.textFaint }}>강화석</p>
        <div className="mt-3 space-y-0.5 text-pixel-sm" style={{ color: C.textFaint }}>
          <p>기본 ({QUALITY_LABEL[artifact.quality]}): +{({ normal: 3, rare: 8, elite: 18 })[artifact.quality]}</p>
          <p>레벨 보너스 (Lv.{lv}): +{Math.floor(lv / 5)}</p>
          <p>강화 보너스 (+{enh}): +{enh * 2}</p>
        </div>
      </div>

      <div
        className="rounded-lg p-2.5 text-pixel-sm text-center"
        style={{ background: "rgba(233, 148, 65, .085)", border: "1px solid rgba(233, 148, 65, .254)",
          color: C.red }}
      >
        ⚠ 분해하면 이 장비는 영구히 사라집니다
      </div>

      {!confirm ? (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="w-full rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
          style={{ background: "rgba(168, 61, 31, .3)", border: "1px solid rgba(168, 61, 31, .801)",
            color: C.red }}
        >
          🔨  분해하기
        </button>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="flex-1 rounded-lg py-3 text-pixel-sm font-bold transition hover:brightness-125"
            style={{ background: C.disabledBg, border: `1px solid ${C.disabledBorder}`,
              color: C.textMuted }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onDisassemble}
            className="flex-1 rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
            style={{ background: "rgba(168, 61, 31, .601)", border: "1px solid rgba(168, 61, 31, 1)",
              color: PALETTE.ember500 }}
          >
            확인 · 분해
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 합성 패널 ────────────────────────────────────────────────────────────────

function SynthesizePanel({
  primary,
  allArtifacts,
  secondaryId,
  onSelectSecondary,
  onSynthesize,
}: {
  primary:           ArtifactInstance;
  allArtifacts:      ArtifactInstance[];
  secondaryId:       string | null;
  onSelectSecondary: (id: string) => void;
  onSynthesize:      () => void;
}) {
  const nextQual  = getNextQuality(primary.quality);
  const nextColor = nextQual ? QUALITY_COLOR[nextQual] : C.textFaint;
  const maxLv     = getEquipmentMaxLevel(primary.quality);
  const pvLv      = artifactLevel(primary);
  const pvEnh     = artifactEnh(primary);

  // 두 번째 장비 후보: 같은 등급, 다른 instanceId
  const candidates = allArtifacts.filter(
    (a) => a.quality === primary.quality && a.instanceId !== primary.instanceId,
  );
  const secondary = allArtifacts.find((a) => a.instanceId === secondaryId) ?? null;
  const svLv      = secondary ? artifactLevel(secondary) : 0;
  const svEnh     = secondary ? artifactEnh(secondary) : 0;

  const canSynth = secondary !== null && canSynthesizeArtifacts(primary, secondary);

  // 조건 체크
  const conds = [
    { label: `등급 일치 (${QUALITY_LABEL[primary.quality]})`, ok: true },
    { label: `Elite 미만 등급`, ok: primary.quality !== "elite" },
    { label: `첫 번째: 최대 레벨 (Lv.${pvLv}/${maxLv})`, ok: pvLv >= maxLv },
    { label: `첫 번째: 최대 강화 (+${pvEnh})`, ok: pvEnh >= MAX_EQUIPMENT_ENHANCEMENT },
    { label: secondary ? `두 번째: 최대 레벨 (Lv.${svLv}/${maxLv})` : "두 번째: 미선택", ok: secondary ? svLv >= maxLv : false },
    { label: secondary ? `두 번째: 최대 강화 (+${svEnh})` : "", ok: secondary ? svEnh >= MAX_EQUIPMENT_ENHANCEMENT : false },
  ].filter((c) => c.label !== "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: C.goldDim }}>
          ✦ 장비 합성 ✦
        </p>
        <p className="mt-0.5 text-pixel-sm" style={{ color: C.textFaint }}>
          최대 레벨+최대 강화 달성 시 등급 상승
        </p>
      </div>

      {/* 조건 체크리스트 */}
      <div
        className="rounded-lg p-3 space-y-1"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <p className="text-pixel-sm font-bold mb-1.5" style={{ color: C.textFaint }}>합성 조건</p>
        {conds.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-pixel-sm">
            <span style={{ color: c.ok ? C.green : C.red }}>{c.ok ? "✓" : "✗"}</span>
            <span style={{ color: c.ok ? C.textMuted : C.textFaint }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* 두 번째 장비 선택 */}
      <div>
        <p className="mb-2 text-pixel-sm font-bold" style={{ color: C.textMuted }}>
          두 번째 장비 선택
          <span className="ml-1.5 font-normal" style={{ color: C.textFaint }}>
            — 같은 등급 ({QUALITY_LABEL[primary.quality]})
          </span>
        </p>
        {candidates.length === 0 ? (
          <p className="rounded-lg p-3 text-center text-pixel-sm" style={{ color: C.textFaint,
            background: C.card, border: `1px solid ${C.border}` }}>
            합성에 쓸 {QUALITY_LABEL[primary.quality]} 등급 장비가 없습니다
          </p>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1.5">
            {candidates.map((a) => {
              const lv = artifactLevel(a); const eh = artifactEnh(a);
              const ok = lv >= maxLv && eh >= MAX_EQUIPMENT_ENHANCEMENT;
              return (
                <ArtifactCard
                  key={a.instanceId}
                  artifact={a}
                  selected={a.instanceId === secondaryId}
                  onClick={() => onSelectSecondary(a.instanceId)}
                  dim={!ok}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* 합성 결과 미리보기 */}
      {nextQual && (
        <div
          className="rounded-lg p-3 text-center"
          style={{ background: `${nextColor}0e`, border: `1px solid ${nextColor}44` }}
        >
          <p className="text-pixel-sm font-bold mb-1" style={{ color: C.textFaint }}>합성 결과</p>
          <p className="text-pixel-sm font-black" style={{ color: C.textPrimary }}>{primary.name}</p>
          <p className="text-pixel-sm font-black mt-0.5" style={{ color: nextColor }}>
            {QUALITY_LABEL[nextQual]} · Lv.1 +0
          </p>
        </div>
      )}

      {canSynth && (
        <div
          className="rounded-lg p-2.5 text-pixel-sm text-center"
          style={{ background: "rgba(233, 148, 65, .085)", border: "1px solid rgba(233, 148, 65, .254)",
            color: C.red }}
        >
          ⚠ 두 장비 모두 사라지고 새 등급 장비가 생성됩니다
        </div>
      )}

      <button
        type="button"
        onClick={onSynthesize}
        disabled={!canSynth}
        className="w-full rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
        style={
          canSynth
            ? { background: `${nextColor}22`, border: `1px solid ${nextColor}77`,
                color: C.textPrimary, boxShadow: `0 0 16px ${nextColor}22` }
            : { background: C.disabledBg, border: `1px solid ${C.disabledBorder}`,
                color: C.disabledText, cursor: "not-allowed" }
        }
      >
        ✦  합성하기
      </button>
    </div>
  );
}

// ─── 토스트 메시지 ────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div
      className="pointer-events-none fixed bottom-8 left-1/2 z-[1000] -translate-x-1/2 rounded-xl px-5 py-2.5 text-pixel-sm font-black shadow-2xl"
      style={{
        background: "rgba(13, 18, 35, .97)",
        border:     "1px solid rgba(233, 148, 65, .706)",
        color:      C.textPrimary,
        boxShadow:  "0 0 24px rgba(132, 75, 63, .819)",
      }}
    >
      {msg}
    </div>
  );
}

// ─── AnvilModal ────────────────────────────────────────────────────────────────

interface AnvilModalProps {
  open:    boolean;
  onClose: () => void;
}

export function AnvilModal({ open, onClose }: AnvilModalProps) {
  const {
    craftedArtifacts,
    materials,
    addMaterial,
    addCraftedArtifact,
    removeCraftedArtifact,
    discardMaterial,
    updateCraftedArtifact,
  } = usePlayerStore();

  const [tab,         setTab]         = useState<AnvilTab>("levelup");
  const [primaryId,   setPrimaryId]   = useState<string | null>(null);
  const [secondaryId, setSecondaryId] = useState<string | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);
  const busyRef = useRef(false);

  // 탭 변경 시 선택 초기화. 효과가 아니라 이벤트에서 처리한다 —
  // 효과로 되돌리면 "이전 탭의 선택이 그려진 렌더" 한 번이 먼저 커밋되고 그 다음에 지워진다.
  const changeTab = (next: AnvilTab) => {
    setTab(next);
    setPrimaryId(null);
    setSecondaryId(null);
  };

  // 가방에서 사라진 아티팩트를 가리키는 id는 따로 지우지 않는다 —
  // 아래 primary/secondary가 항상 craftedArtifacts에서 find로 해석하므로 자연히 null이 되고,
  // 선택 표시(=== primaryId)도 일치하는 항목이 없어 저절로 풀린다.
  // (분해·강화 핸들러는 각자 자기 id를 직접 비운다.)

  // ESC 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (open && e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 토스트 자동 제거
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  if (!open) return null;

  const enhancementStones = materials["enhancement_stone"] ?? 0;
  const primary   = craftedArtifacts.find((a) => a.instanceId === primaryId)   ?? null;
  const secondary = craftedArtifacts.find((a) => a.instanceId === secondaryId) ?? null;

  // ── 레벨업 ─────────────────────────────────────────────────────────────────
  const handleLevelUp = () => {
    if (busyRef.current || !primary) return;
    const lv   = artifactLevel(primary);
    const maxLv = getEquipmentMaxLevel(primary.quality);
    if (lv >= maxLv) return;
    const cost = getEquipmentLevelUpCost(primary.quality, lv);
    if (enhancementStones < cost) return;
    busyRef.current = true;
    const newLv          = lv + 1;
    const unlocksBonus   = newLv % 10 === 0;
    discardMaterial("enhancement_stone", cost);
    updateCraftedArtifact(primary.instanceId, { level: newLv });
    if (unlocksBonus) {
      showToast(`✨ ${primary.name} Lv.${newLv} — 부가 능력치 해제!`);
    } else {
      showToast(`${primary.name} Lv.${newLv} 달성!`);
    }
    busyRef.current = false;
  };

  // ── 강화 ───────────────────────────────────────────────────────────────────
  const handleEnhance = () => {
    if (busyRef.current || !primary || !secondary) return;
    const enh = artifactEnh(primary);
    if (enh >= MAX_EQUIPMENT_ENHANCEMENT) return;
    if (primary.quality !== secondary.quality) return;
    busyRef.current = true;
    // 재료는 성공 여부와 무관하게 소모된다. 실패해도 강화 수치가 내려가지는 않으므로
    // "되돌릴 수 없는 손실"은 없고, 재료 한 개를 잃을 뿐이다.
    removeCraftedArtifact(secondary.instanceId);
    setSecondaryId(null);
    if (Math.random() < getEnhancementSuccessRate(enh)) {
      updateCraftedArtifact(primary.instanceId, { enhancement: enh + 1 });
      showToast(`${primary.name} +${enh + 1} 강화 성공!`);
    } else {
      showToast(`강화 실패… ${primary.name}은(는) +${enh} 그대로다. (재료 소모)`);
    }
    busyRef.current = false;
  };

  // ── 분해 ───────────────────────────────────────────────────────────────────
  const handleDisassemble = () => {
    if (busyRef.current || !primary) return;
    busyRef.current = true;
    const lv     = artifactLevel(primary);
    const enh    = artifactEnh(primary);
    const stones = getDisassembleStones(primary.quality, lv, enh);
    const name   = primary.name;
    removeCraftedArtifact(primary.instanceId);
    addMaterial("enhancement_stone", stones);
    setPrimaryId(null);
    showToast(`${name} 분해 → 강화석 ×${stones}`);
    busyRef.current = false;
  };

  // ── 합성 ───────────────────────────────────────────────────────────────────
  const handleSynthesize = () => {
    if (busyRef.current || !primary || !secondary) return;
    if (!canSynthesizeArtifacts(primary, secondary)) return;
    const nextQual = getNextQuality(primary.quality);
    if (!nextQual) return;
    busyRef.current = true;

    // 스탯 재계산: 기존 등급 배율 → 새 등급 배율
    const fromMult = QUALITY_MULTIPLIER[primary.quality];
    const toMult   = QUALITY_MULTIPLIER[nextQual];
    const newStats = primary.statBonuses.map((b) => ({
      ...b,
      value: Math.round((b.value / fromMult) * toMult),
    }));

    const newInstance: ArtifactInstance = {
      instanceId:  makeId(),
      itemId:      primary.itemId,
      name:        primary.name,
      quality:     nextQual,
      description: primary.description,
      statBonuses: newStats,
      createdAt:   Date.now(),
      level:       1,
      enhancement: 0,
      source:      "synthesis",
    };

    removeCraftedArtifact(primary.instanceId);
    removeCraftedArtifact(secondary.instanceId);
    addCraftedArtifact(newInstance);
    setPrimaryId(null);
    setSecondaryId(null);
    showToast(`${QUALITY_LABEL[nextQual]} ${newInstance.name} 합성 완료!`);
    busyRef.current = false;
  };

  // ── 렌더 ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center px-4"
      style={{ background: "rgba(13, 18, 35, .82)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{
          background:  C.bg,
          border:      `1px solid ${C.borderGold}`,
          boxShadow:   "0 0 60px rgba(132, 75, 63, .585), 0 8px 40px rgba(13, 18, 35, .85)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ────────────────────────────────────────────────────────── */}
        <header
          className="flex shrink-0 items-center gap-4 px-5 py-4"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <span className="text-pixel-md">⚒</span>
          <div className="flex-1">
            <h2 className="text-pixel-md font-black tracking-wide" style={{ color: C.textPrimary }}>
              장비 모루
            </h2>
            <p className="mt-0.5 text-pixel-sm" style={{ color: C.textFaint }}>
              제작한 아티팩트를 레벨업·강화·분해·합성할 수 있습니다.
            </p>
          </div>
          {/* 보유 강화석 */}
          <div
            className="rounded-lg px-3 py-1.5 text-pixel-sm font-bold"
            style={{ background: C.card, border: `1px solid ${C.border}`, color: C.textMuted }}
          >
            🪨 강화석 <span style={{ color: C.gold, fontVariantNumeric: "tabular-nums" }}>{enhancementStones}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-pixel-sm font-bold transition hover:brightness-125"
            style={{ background: "rgba(13, 18, 35, .6)", border: `1px solid ${C.border}`, color: C.textMuted }}
          >
            닫기
          </button>
        </header>

        {/* ── 탭 바 ───────────────────────────────────────────────────────── */}
        <div
          className="flex shrink-0 gap-1 px-5 py-2"
          style={{ borderBottom: `1px solid ${C.border}`, background: C.panel }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTab(t.id)}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-pixel-sm font-bold transition hover:brightness-110"
                style={{
                  background: active ? C.btnBg : "transparent",
                  border:     `1px solid ${active ? C.btnBorder : "transparent"}`,
                  color:      active ? C.textPrimary : C.textFaint,
                  boxShadow:  active ? "0 0 10px rgba(132, 75, 63, .351)" : "none",
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── 본문 ────────────────────────────────────────────────────────── */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_320px]">

          {/* 왼쪽: 장비 목록 */}
          <section
            className="min-h-0 overflow-y-auto p-5"
            style={{ background: C.panel }}
          >
            <p className="mb-3 text-pixel-sm font-bold uppercase tracking-widest"
              style={{ color: C.goldDim }}>
              보유 아티팩트
              <span className="ml-2 font-mono normal-case" style={{ color: C.textFaint }}>
                {craftedArtifacts.length}개
              </span>
            </p>

            {craftedArtifacts.length === 0 ? (
              <p className="py-8 text-center text-pixel-sm" style={{ color: C.textFaint }}>
                아티팩트가 없습니다.<br />
                <span className="text-pixel-sm">제작 공방에서 먼저 제작해 보세요.</span>
              </p>
            ) : (
              <div className="space-y-2">
                {craftedArtifacts.map((a) => (
                  <ArtifactCard
                    key={a.instanceId}
                    artifact={a}
                    selected={a.instanceId === primaryId}
                    onClick={() => {
                      setPrimaryId(a.instanceId === primaryId ? null : a.instanceId);
                      setSecondaryId(null);
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 오른쪽: 액션 패널 */}
          <aside
            className="min-h-0 overflow-y-auto p-5 md:border-l"
            style={{ background: C.aside, borderColor: C.border }}
          >
            {!primary ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                <p className="text-title-md opacity-20">⚒</p>
                <p className="text-pixel-sm font-bold" style={{ color: C.textFaint }}>
                  왼쪽 목록에서 장비를 선택하세요
                </p>
              </div>
            ) : tab === "levelup" ? (
              <LevelUpPanel
                artifact={primary}
                stones={enhancementStones}
                onLevelUp={handleLevelUp}
              />
            ) : tab === "enhance" ? (
              <EnhancePanel
                target={primary}
                allArtifacts={craftedArtifacts}
                materialId={secondaryId}
                onSelectMaterial={setSecondaryId}
                onEnhance={handleEnhance}
              />
            ) : tab === "disassemble" ? (
              <DisassemblePanel
                artifact={primary}
                onDisassemble={handleDisassemble}
              />
            ) : (
              <SynthesizePanel
                primary={primary}
                allArtifacts={craftedArtifacts}
                secondaryId={secondaryId}
                onSelectSecondary={setSecondaryId}
                onSynthesize={handleSynthesize}
              />
            )}
          </aside>
        </div>
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}
