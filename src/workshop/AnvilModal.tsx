import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../shared/playerStore";
import type { ArtifactInstance, ArtifactStatBonus, ItemQuality } from "../shared/crafting";
import { PALETTE } from "../shared/palette";
import { withJosa } from "../shared/josa";
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
import { PixelIcon } from "../shared/ui/PixelIcon";
import { PixelButton, ModalShell, SectionHead, EmptyState } from "../shared/ui";
import { ArtifactCard } from "../shared/ui/ArtifactCard";
import type { IconName } from "../shared/ui/icons";

// ─── 탭 정의 ──────────────────────────────────────────────────────────────────

type AnvilTab = "levelup" | "enhance" | "disassemble" | "synthesize";

const TABS: { id: AnvilTab; label: string; icon: IconName }[] = [
  { id: "levelup",     label: "레벨업",  icon: "levelup" },
  { id: "enhance",     label: "강화",    icon: "enhance" },
  { id: "disassemble", label: "분해",    icon: "disassemble" },
  { id: "synthesize",  label: "합성",    icon: "synthesize" },
];

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

/**
 * 합성 후의 기본 능력치. 예전 등급 배율을 벗기고 새 등급 배율을 씌운다.
 * 미리보기와 실제 합성이 같은 함수를 봐야 "결과가 이렇다"는 말이 참이 된다.
 */
function synthesizedStats(a: ArtifactInstance, next: ItemQuality): ArtifactStatBonus[] {
  const from = QUALITY_MULTIPLIER[a.quality];
  const to   = QUALITY_MULTIPLIER[next];
  return a.statBonuses.map((b) => ({ ...b, value: Math.round((b.value / from) * to) }));
}

// 강화석 소비: discardMaterial을 활용 (store에 이미 있음)

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
        <SectionHead en="Level up" ko="장비 레벨업" />
        {/* 실제 값에서 그대로 적는다(getLevelMultiplier · ARTIFACT_BONUS_POOL).
            "레벨업 = 부가 능력치, 강화 = 자체 능력치" 로만 알면 반만 맞다 —
            레벨업도 능력치를 올린다. 둘의 차이는 부가 능력치 칸이 열리느냐다. */}
        <p className="mb-2 -mt-2 text-pixel-sm text-sand-300">
          한 레벨마다 능력치 +3% · 10레벨마다 부가 능력치가 하나씩 열린다
        </p>
        {/* 여기만 능력치 없는 카드다. 바로 아래 「능력치」·「부가 능력치」 상자가
            같은 값을 이미 적고 있어서, 카드까지 펼치면 한 화면에 세 번 나온다.
            강화·분해·합성에는 그 상자가 없으니 거기서는 카드가 능력치를 들고 있다. */}
        <ArtifactCard artifact={artifact} />
      </div>

      {/* 레벨 바 */}
      <div
        className="p-3 rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <div className="flex justify-between items-end mb-1.5">
          <p className="text-pixel-sm font-bold text-sand-300">현재 레벨</p>
          <p className={`text-pixel-sm font-black font-mono ${isMax ? "text-ember-500" : "text-cream-100"}`}>
            {lv} / {maxLv}
          </p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-shadow-900">
          <div className="h-full rounded-full"
            style={{ width: `${(lv / maxLv) * 100}%`, background: isMax ? PALETTE.ember500 : color }} />
        </div>
        {isMax
          ? <p className="mt-1.5 text-center text-pixel-sm font-black text-ember-500">최대 레벨 달성</p>
          : willUnlockNext
            ? <p className="mt-1.5 text-center text-pixel-sm font-bold text-mist-300">다음 레벨업에 부가 능력치가 열린다</p>
            : <p className="mt-1.5 text-center text-pixel-sm text-sand-300">
                부가 능력치 해제까지 {levelsToUnlock}레벨 남음
              </p>
        }
      </div>

      {/* 능력치 (현재 → 다음 레벨 미리보기) */}
      <div
        className="p-3 space-y-1.5 rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <p className="text-pixel-sm font-bold mb-2 text-sand-300">
          능력치 <span className="font-normal text-sand-300">(Lv.{lv} +{enh} 기준)</span>
        </p>
        {/* 다른 화면은 전부 "+52" 로 적는다. 여기만 "52" 였는데, 장비가 주는 값이 아니라
            장비의 능력치 그 자체인 것처럼 읽혔다. 단위(%)도 같이 붙인다. */}
        {currentStats.map((s, i) => {
          const diff = nextStats[i].value - s.value;
          const unit = s.stat === "critRate" ? "%" : "";
          return (
            <div key={s.stat} className="flex items-center justify-between text-pixel-sm">
              <span className="text-sand-300">{ARTIFACT_STAT_LABEL[s.stat]}</span>
              <div className="flex items-center gap-1.5 font-mono font-bold">
                <span className="text-cream-100">+{s.value}{unit}</span>
                {!isMax && diff > 0 && (
                  <>
                    <span className="text-sand-300">→</span>
                    <span className="text-sand-200">+{nextStats[i].value}{unit}</span>
                    <span className="text-pixel-sm font-normal text-mist-300">(+{diff})</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 부가 능력치 */}
      <div
        className="p-3 rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <p className="text-pixel-sm font-bold mb-2 text-sand-300">
          부가 능력치{" "}
          <span className="font-normal text-sand-300">({bonusStats.length}/{maxUnlocks})</span>
        </p>
        {bonusStats.length === 0 ? (
          <p className="text-pixel-sm text-center py-1 text-sand-300">
            Lv.10 달성 시 첫 번째 부가 능력치 해제
          </p>
        ) : (
          <div className="space-y-1">
            {bonusStats.map((b, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-lg border border-mist-500/50
                  bg-mist-500/12 px-2 py-1 text-pixel-sm font-bold text-mist-300"
              >
                <PixelIcon name="levelup" size={16} />
                <span>{b.label}</span>
                <span className="ml-auto text-pixel-sm font-normal text-sand-300">
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
                  className="flex items-center gap-1.5 rounded-lg border border-stone-600
                    bg-shadow-900/50 px-2 py-1 text-pixel-sm text-sand-300"
                >
                  <span>?</span>
                  <span>미해제</span>
                  <span className="ml-auto text-pixel-sm text-sand-300">
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
          className="p-3 space-y-1.5 rounded-xl border border-earth-500/50 bg-shadow-700/60"
        >
          <div className="flex justify-between">
            <span className="text-pixel-sm text-sand-300">필요 강화석</span>
            <span className={`text-pixel-sm font-black ${stones >= cost ? "text-sand-200" : "text-ember-500"}`}>
              <PixelIcon name="enhancement_stone" size={16} className="inline-block align-middle" /> {cost}개
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-pixel-sm text-sand-300">보유 강화석</span>
            <span className="text-pixel-sm font-black font-mono text-cream-100">
              {stones}개
            </span>
          </div>
        </div>
      )}

      {/* 부가 능력치가 열리는 레벨업은 mist(정보) 로, 보통 레벨업은 ember(주 행동)로.
          색이 팔레트의 뜻을 그대로 따르므로 여기서 새 색을 만들지 않는다 */}
      <PixelButton
        variant={willUnlockNext ? "info" : "primary"}
        onClick={onLevelUp}
        disabled={!canDo}
        className="w-full py-3"
      >
        {/* 반짝이 이모지 자리였다. 픽셀 폰트에 없어서 그 글자만 다른 서체로 떨어진다.
            이름도 다른 탭에 맞춘다. 강화하기·분해하기·합성하기 옆에서 "레벨업"만 명사였다. */}
        {isMax ? "최대 레벨" : canDo ? (
          <span className="inline-flex items-center justify-center gap-1.5">
            <PixelIcon name="levelup" size={16} />
            {willUnlockNext ? "레벨업하기 (부가 능력치 해제!)" : "레벨업하기"}
          </span>
        ) : "강화석 부족"}
      </PixelButton>
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
        <SectionHead en="Enhance" ko="장비 강화" />
        {/* 레벨업이 부가 능력치 칸을 여는 축이라면, 강화는 장비가 원래 가진 능력치를
            끌어올리는 축이다. 탭 이름만으로는 둘이 안 갈려서 한 줄로 적어 둔다. */}
        <p className="mb-2 -mt-2 text-pixel-sm text-sand-300">
          한 단계마다 능력치 +10% — 같은 등급 장비 하나를 재료로 태운다. 부가 능력치는 안 열린다
        </p>
        {/* 능력치를 같이 그린다. 이름이 같은 장비가 둘일 때, 무엇을 강화하고 무엇을
            재료로 태우는지 이름표만으로는 못 가린다 */}
        <ArtifactCard size="full" artifact={target} />
      </div>

      {/* 강화 수치 표시 */}
      <div
        className="p-3 rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <p className="text-pixel-sm font-bold mb-2 text-sand-300">강화 수치</p>
        <div className="flex justify-center gap-1.5">
          {Array.from({ length: MAX_EQUIPMENT_ENHANCEMENT }, (_, i) => {
            const filled = i < enh;
            const next   = !isMax && i === enh;
            return (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-pixel-sm font-black
                  ${filled ? "border-ember-500 bg-ember-500/25 text-ember-500"
                    : next  ? "border-ember-500/40 bg-ember-500/10 text-sand-300"
                            : "border-stone-600 bg-shadow-900/50 text-earth-400"}`}
              >
                {filled ? "★" : next ? "◇" : "◆"}
              </div>
            );
          })}
        </div>
        <p className={`mt-2 text-center text-pixel-sm font-black ${isMax ? "text-ember-500" : "text-cream-100"}`}>
          {isMax ? "최대 강화 달성" : `+${enh} → +${enh + 1}`}
        </p>
      </div>

      {/* 재료 선택 */}
      {!isMax && (
        <div>
          <p className="mb-2 text-pixel-sm font-bold text-sand-300">
            재료 선택 <span className="text-sand-300">— 같은 등급 장비 사용</span>
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-xl border border-earth-500/50 bg-shadow-700/60 p-3 text-center text-pixel-sm text-sand-300">
              재료로 쓸 {QUALITY_LABEL[target.quality]} 등급 장비가 없습니다
            </p>
          ) : (
            <div data-testid="anvil-material-list" className="space-y-1.5">
              {candidates.map((a) => (
                <ArtifactCard
                  key={a.instanceId}
                  size="full"
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
        <div className="rounded-xl border border-ember-700/60 bg-ember-700/12 p-2.5 text-center text-pixel-sm text-ember-500">재료 장비는 강화 뒤 사라진다</div>
      )}

      <PixelButton variant="primary" onClick={onEnhance} disabled={!canDo} className="w-full py-3">
        {isMax
          ? "최대 강화"
          : canDo ? `강화하기 (성공률 ${Math.round(getEnhancementSuccessRate(enh) * 100)}%)`
          : "재료를 고르세요"}
      </PixelButton>
      {!isMax && (
        <p className="text-center text-pixel-sm text-sand-300">
          실패해도 강화 수치는 안 내려간다. 재료만 사라진다.
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
  const lv     = artifactLevel(artifact);
  const enh    = artifactEnh(artifact);
  const stones = getDisassembleStones(artifact.quality, lv, enh);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead en="Disassemble" ko="장비 분해" />
        <ArtifactCard artifact={artifact} size="full" />
      </div>

      {/* 획득 강화석 */}
      <div
        className="rounded-xl p-4 text-center rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <p className="text-pixel-sm font-bold mb-2 text-sand-300">분해 시 획득</p>
        <p className="flex items-center justify-center gap-1.5 text-title-md font-black text-ember-500">
            <PixelIcon name="enhancement_stone" size={32} />×{stones}
          </p>
        <p className="mt-1 text-pixel-sm text-sand-300">강화석</p>
        <div className="mt-3 space-y-0.5 text-pixel-sm text-sand-300">
          {/* 값을 여기 다시 적으면 규칙을 고친 날 화면만 옛말을 한다. 실제로 3/8/18 로
              굳어 있어서, 아래 항목을 더해도 위에 적힌 합계와 안 맞았다 */}
          <p>기본 ({QUALITY_LABEL[artifact.quality]}): +{getDisassembleStones(artifact.quality, 1, 0) - Math.floor(1 / 5)}</p>
          <p>레벨 보너스 (Lv.{lv}): +{Math.floor(lv / 5)}</p>
          <p>강화 보너스 (+{enh}): +{enh * 2}</p>
        </div>
      </div>

      <div className="rounded-xl border border-ember-700/60 bg-ember-700/12 p-2.5 text-center text-pixel-sm text-ember-500">분해하면 이 장비는 영영 사라진다</div>

      {!confirm ? (
        <PixelButton variant="danger" onClick={() => setConfirm(true)} className="w-full py-3">
          분해하기
        </PixelButton>
      ) : (
        <div className="flex gap-2">
          <PixelButton onClick={() => setConfirm(false)} className="flex-1 py-3">취소</PixelButton>
          <PixelButton variant="danger" onClick={onDisassemble} className="flex-1 py-3">
            확인 · 분해
          </PixelButton>
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
  const maxLv     = getEquipmentMaxLevel(primary.quality);
  const pvLv      = artifactLevel(primary);
  const pvEnh     = artifactEnh(primary);

  // 두 번째 장비 후보: 같은 등급, 다른 instanceId
  const candidates = allArtifacts.filter(
    (a) => a.quality === primary.quality && a.instanceId !== primary.instanceId,
  );
  const secondary = allArtifacts.find((a) => a.instanceId === secondaryId) ?? null;

  const canSynth = secondary !== null && canSynthesizeArtifacts(primary, secondary);

  // 조건 체크
  const conds = [
    { label: `등급 일치 (${QUALITY_LABEL[primary.quality]})`, ok: true },
    { label: `Elite 미만 등급`, ok: primary.quality !== "elite" },
    { label: `첫 번째: 최대 레벨 (Lv.${pvLv}/${maxLv})`, ok: pvLv >= maxLv },
    { label: `첫 번째: 최대 강화 (+${pvEnh})`, ok: pvEnh >= MAX_EQUIPMENT_ENHANCEMENT },
    // 두 번째는 등급만 맞으면 된다(craftingUtils.canSynthesizeArtifacts). 화면이 최대
    // 레벨·최대 강화까지 요구하는 것처럼 적어서, 실제보다 훨씬 비싼 줄 알고 안 쓰게 돼 있었다.
    { label: secondary ? `두 번째: 등급 일치 (${QUALITY_LABEL[secondary.quality]})` : "두 번째: 미선택",
      ok: secondary ? secondary.quality === primary.quality : false },
  ].filter((c) => c.label !== "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHead en="Synthesize" ko="장비 합성" />
        <p className="-mt-2 text-pixel-sm text-sand-300">
          첫 번째가 최대 레벨·최대 강화면, 같은 등급 하나를 재료로 등급이 오른다
        </p>
      </div>

      {/* 무엇을 합성하는지. 아래 「합성 결과」와 나란히 놓여야 "나아지는가"를 잰다 */}
      <div>
        <p className="mb-2 text-pixel-sm font-bold text-sand-300">첫 번째 장비</p>
        <ArtifactCard size="full" artifact={primary} />
      </div>

      {/* 조건 체크리스트 */}
      <div
        className="p-3 space-y-1 rounded-xl border border-earth-500/50 bg-shadow-700/60"
      >
        <p className="text-pixel-sm font-bold mb-1.5 text-sand-300">합성 조건</p>
        {conds.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5 text-pixel-sm">
            <span className={`${c.ok ? "text-sand-200" : "text-ember-500"}`}>{c.ok ? "✓" : "✗"}</span>
            <span className={`${c.ok ? "text-sand-200" : "text-sand-300"}`}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* 두 번째 장비 선택 */}
      <div>
        <p className="mb-2 text-pixel-sm font-bold text-sand-300">
          두 번째 장비 선택
          <span className="ml-1.5 font-normal text-sand-300">
            — 같은 등급 ({QUALITY_LABEL[primary.quality]})
          </span>
        </p>
        {candidates.length === 0 ? (
          <p className="rounded-xl border border-earth-500/50 bg-shadow-700/60 p-3 text-center text-pixel-sm text-sand-300">
            합성에 쓸 {QUALITY_LABEL[primary.quality]} 등급 장비가 없습니다
          </p>
        ) : (
          <div data-testid="anvil-secondary-list" className="space-y-1.5">
            {candidates.map((a) => {
              const lv = artifactLevel(a); const eh = artifactEnh(a);
              const ok = lv >= maxLv && eh >= MAX_EQUIPMENT_ENHANCEMENT;
              return (
                <ArtifactCard
                  key={a.instanceId}
                  size="full"
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

      {/* 합성 결과 미리보기. 합성은 등급만 올리고 레벨·강화를 1/+0 으로 되돌린다.
          능력치까지 보여야 "지금 것보다 나은가"를 눈으로 잴 수 있다. */}
      {nextQual && (
        <div>
          <p className="mb-2 text-pixel-sm font-bold text-sand-300">합성 결과</p>
          <ArtifactCard
            size="full"
            artifact={{
              itemId:      primary.itemId,
              name:        primary.name,
              quality:     nextQual,
              statBonuses: synthesizedStats(primary, nextQual),
              level:       1,
              enhancement: 0,
              source:      "synthesis",
            }}
          />
        </div>
      )}

      {canSynth && (
        <div className="rounded-xl border border-ember-700/60 bg-ember-700/12 p-2.5 text-center text-pixel-sm text-ember-500">두 장비 모두 사라지고 새 등급 장비 하나가 생긴다</div>
      )}

      <PixelButton variant="primary" onClick={onSynthesize} disabled={!canSynth} className="w-full py-3">
        합성하기
      </PixelButton>
    </div>
  );
}

// ─── 토스트 메시지 ────────────────────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div className="pointer-events-none fixed bottom-8 left-1/2 z-[1000] -translate-x-1/2 rounded-xl
      border border-ember-500/70 bg-shadow-900 px-5 py-2.5 text-pixel-sm font-black text-cream-100 shadow-2xl">
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

  // 탭을 바꾸면 선택을 비운다. 효과가 아니라 이벤트에서 처리하는데,
  // 효과로 되돌리면 "이전 탭 선택이 그려진 렌더" 한 번이 먼저 커밋되고 그다음에 지워진다.
  const changeTab = (next: AnvilTab) => {
    setTab(next);
    setPrimaryId(null);
    setSecondaryId(null);
  };

  // 가방에서 사라진 아티팩트를 가리키는 id 는 따로 안 지운다.
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
      showToast(`${primary.name} Lv.${newLv} — 부가 능력치 해제!`);
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
      showToast(`강화 실패… ${withJosa(primary.name, "은는")} +${enh} 그대로다. (재료 소모)`);
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

    const newInstance: ArtifactInstance = {
      instanceId:  makeId(),
      itemId:      primary.itemId,
      name:        primary.name,
      quality:     nextQual,
      description: primary.description,
      statBonuses: synthesizedStats(primary, nextQual),
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
    <ModalShell
      icon="anvil"
      title="장비 모루"
      subtitle="만든 아티팩트를 레벨업·강화·분해·합성한다"
      onClose={onClose}
      testId="anvil-modal"
      actions={
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-earth-500/60
          bg-shadow-700/70 px-3 py-1.5 text-pixel-sm font-bold text-sand-300">
          <PixelIcon name="enhancement_stone" size={16} />
          강화석 <span className="font-mono text-ember-500">{enhancementStones}</span>
        </span>
      }
    >
        {/* ── 탭 바. 가방의 탭과 같은 규칙이다 — 밑줄로 고른 것을 말하고, 판을 칠하지 않는다 ── */}
        <div className="flex shrink-0 gap-1 border-b border-shadow-700 px-panel">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTab(t.id)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-pixel-sm font-bold transition
                  ${active
                    ? "border-ember-500 bg-ember-500/8 text-ember-500"
                    : "border-transparent text-sand-300 hover:text-sand-200"}`}
              >
                <PixelIcon name={t.icon} size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_var(--container-aside)]">

          {/* 왼쪽: 장비 목록 */}
          <section className="min-h-0 overflow-y-auto p-panel">
            <SectionHead
              en="Artifacts" ko="보유 아티팩트"
              right={<span className="font-mono text-pixel-sm text-sand-300">{craftedArtifacts.length}개</span>}
            />

            {craftedArtifacts.length === 0 ? (
              <EmptyState title="아티팩트가 없습니다"
                description="제작 공방의 아티팩트 제작대에서 먼저 만들어 보세요." />
            ) : (
              // 한 줄에 하나씩 세우면 판이 넓어질수록 카드 오른쪽이 통째로 빈다.
              // 칸 폭이 열 수를 정하게 두면 넓은 화면에서 목록이 짧아진다.
              <div className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
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
          <aside className="min-h-0 overflow-y-auto border-shadow-700 p-panel md:border-l">
            {!primary ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                <PixelIcon name="anvil" size={64} className="opacity-40" />
                <p className="text-pixel-sm text-sand-300">왼쪽 목록에서 장비를 고르세요</p>
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

      {toast && <Toast msg={toast} />}
    </ModalShell>
  );
}
