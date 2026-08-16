import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayerStore, type OwnedMonster } from "../shared/playerStore";
import { MONSTER_IMAGE_MAP } from "./monsterImages";
import { getFullLearnset } from "./learnset";
import { monsters } from "./monsters";
import {
  withImprint, imprintStatus, imprintStars, chainKeyOf, MAX_IMPRINT_TIER,
} from "./imprint";
import { ImprintModal } from "./ImprintModal";
import type { ArtifactInstance } from "../shared/crafting";
import {
  ARTIFACT_SLOT_MAP, ARTIFACT_SLOT_LABEL, ALL_ARTIFACT_SLOTS,
  QUALITY_COLOR, QUALITY_LABEL, ARTIFACT_STAT_LABEL, sumEquippedStatBonuses,
} from "../shared/craftingUtils";
import { PALETTE, rgba, ELEMENT_COLOR, ELEMENT_CHIP_CLASS } from "../shared/palette";
import { GameBackground } from "../shared/ui/GameBackground";
import { josa, withJosa } from "../shared/josa";
import { StatBar } from "../shared/ui";
import { PixelIcon } from "../shared/ui/PixelIcon";
import type { IconName } from "../shared/ui/icons";

/** 파티 카드/상태창에 반영할 장비 능력치 (HP는 배틀 실수치와 어긋나지 않도록 제외) */
export interface EquipStatBonus { attack: number; defense: number; speed: number }
const ZERO_EQUIP_BONUS: EquipStatBonus = { attack: 0, defense: 0, speed: 0 };

// ─── 속성 상수 ────────────────────────────────────────────────────────────────────
const TYPE_KO: Record<string, string> = {
  fire:"불꽃", water:"물", grass:"풀", electric:"전기", ice:"얼음", normal:"노말",
  poison:"독",
  none:"무속성",
};

// 속성 색은 shared/palette.ts 의 ELEMENT_COLOR 가 단일 출처다 (숲·전투와 동일).
// 무속성(none)만 이 화면에서 쓰는 값이라 여기서 노말과 같게 둔다.
const TYPE_ACCENT: Record<string, { glow: string; border: string; bg: string; label: string }> =
  Object.fromEntries(
    (Object.keys({ ...ELEMENT_COLOR, none: "normal" }) as string[]).map((type) => {
      const token = ELEMENT_COLOR[type as keyof typeof ELEMENT_COLOR] ?? ELEMENT_COLOR.normal;
      const chip  = ELEMENT_CHIP_CLASS[type as keyof typeof ELEMENT_CHIP_CLASS] ?? ELEMENT_CHIP_CLASS.normal;
      return [type, {
        glow:   rgba(token, 0.45),
        border: PALETTE[token],
        bg:     rgba(token, 0.12),
        label:  chip,
      }];
    }),
  );

const MOVE_CATEGORY_KO: Record<string, string> = {
  physical: "물리", special: "특수", status: "상태",
};

const STATUS_KO: Record<string, string> = {
  burn: "화상", paralysis: "마비", freeze: "빙결", poison: "독",
};

const MON_STYLES = `
@keyframes monIn {
  from { transform: translateY(12px) scale(.97); opacity: 0; }
  to   { transform: translateY(0) scale(1); opacity: 1; }
}
@keyframes glowBreathe {
  0%,100%{ opacity: .55; }
  50%    { opacity: .9; }
}
@keyframes hpLoad { from { width: 0; } }
@keyframes selectRing {
  0%,100%{ box-shadow: 0 0 0 2px var(--sel-color, var(--color-ember-500)), 0 0 16px var(--sel-glow, rgba(233, 148, 65, .452)); }
  50%    { box-shadow: 0 0 0 2px var(--sel-color, var(--color-ember-500)), 0 0 28px var(--sel-glow, rgba(233, 148, 65, .622)); }
}
@keyframes bubblePop {
  0%  { transform: scale(0); opacity: 1; }
  100%{ transform: scale(3); opacity: 0; }
}
`;

// ─── ReleaseBtn ────────────────────────────────────────────────────────────────
function ReleaseBtn({ disabled, onRelease }: { disabled: boolean; onRelease: () => void }) {
  const [pending, setPending] = useState(false);

  if (disabled) {
    return (
      <button disabled className="text-pixel-sm font-bold px-2 py-0.5 rounded whitespace-nowrap"
        style={{ background: "rgba(13, 18, 35, .2)", border: "1px solid rgba(132, 75, 63, .35)", color: "rgba(172, 123, 98, .4)" }}>
        놓아주기
      </button>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pending) {
      setPending(true);
      setTimeout(() => setPending(false), 2500);
    } else {
      setPending(false);
      onRelease();
    }
  };

  return (
    <button onClick={handleClick}
      className="text-pixel-sm font-bold px-2 py-0.5 rounded transition whitespace-nowrap"
      style={{
        background: pending ? "rgba(168, 61, 31, .317)" : "rgba(13, 18, 35, .25)",
        border: pending ? "1px solid rgba(168, 61, 31, .897)" : "1px solid rgba(132, 75, 63, .239)",
        color: pending ? PALETTE.ember500 : PALETTE.earth400,
      }}>
      {pending ? "확인?" : "놓아주기"}
    </button>
  );
}

// ─── EquipModal ────────────────────────────────────────────────────────────────
function EquipModal({
  monster,
  equipped,
  available,
  onEquip,
  onUnequip,
  onClose,
}: {
  monster: OwnedMonster;
  equipped: ArtifactInstance[];
  available: ArtifactInstance[];
  onEquip: (artifact: ArtifactInstance) => void;
  onUnequip: (instanceId: string) => void;
  onClose: () => void;
}) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const visibleArtifacts = selectedSlot
    ? available.filter((a) => ARTIFACT_SLOT_MAP[a.itemId] === selectedSlot)
    : available;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(13, 18, 35, .78)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl w-[500px] max-h-[90vh] overflow-y-auto"
        style={{
          background: "rgba(13, 18, 35, .98)",
          border: "1px solid rgba(132, 75, 63, .936)",
          boxShadow: "0 0 48px rgba(13, 18, 35, .8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(13, 18, 35, .98)", borderBottom: "1px solid rgba(132, 75, 63, .255)" }}>
          <div>
            <p className="text-pixel-sm font-bold uppercase tracking-widest" style={{ color: PALETTE.sand300 }}>장비 관리</p>
            <p className="text-title-sm font-black text-cream-100">{monster.nickname ?? monster.name}</p>
          </div>
          <button onClick={onClose}
            className="text-title-sm font-black transition hover:brightness-125 rounded-lg px-2 py-1"
            style={{ color: PALETTE.sand300, background: "rgba(13, 18, 35, .8)" }}>
            ✕
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-5">
          {/* 현재 장착 슬롯 */}
          <div>
            <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
              장착 중인 장비 (슬롯 클릭 → 가방 필터)
            </p>
            <div className="flex flex-col gap-2">
              {ALL_ARTIFACT_SLOTS.map((slot) => {
                const item = equipped.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
                const isActive = selectedSlot === slot;
                return (
                  <div
                    key={slot}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 cursor-pointer transition"
                    style={{
                      background: isActive ? "rgba(132, 75, 63, .281)" : "rgba(13, 18, 35, .35)",
                      border: `1px solid ${isActive ? "rgba(132, 75, 63, 1)" : "rgba(132, 75, 63, .105)"}`,
                    }}
                    onClick={() => setSelectedSlot(isActive ? null : slot)}
                  >
                    <span className="w-16 text-pixel-sm font-bold shrink-0" style={{ color: PALETTE.sand300 }}>
                      {ARTIFACT_SLOT_LABEL[slot]}
                    </span>
                    {item ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-pixel-sm font-black truncate" style={{ color: PALETTE.cream100 }}>{item.name}</p>
                          <p className="text-pixel-sm font-bold mt-0.5" style={{ color: QUALITY_COLOR[item.quality] }}>
                            {QUALITY_LABEL[item.quality]}
                          </p>
                          {item.statBonuses && item.statBonuses.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-1">
                              {item.statBonuses.map((sb, i) => (
                                <span key={i} className="text-pixel-sm px-1 py-0.5 rounded"
                                  style={{ background: "rgba(132, 75, 63, .154)", color: PALETTE.ember500 }}>
                                  {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onUnequip(item.instanceId); }}
                          className="text-pixel-sm font-bold px-2 py-0.5 rounded shrink-0 transition hover:brightness-125"
                          style={{
                            background: "rgba(168, 61, 31, .236)",
                            border: "1px solid rgba(168, 61, 31, .547)",
                            color: PALETTE.ember500,
                          }}
                        >
                          해제
                        </button>
                      </>
                    ) : (
                      <p className="text-pixel-sm" style={{ color: "rgba(205, 178, 126, .08)" }}>— 비어있음 —</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 가방의 아티팩트 */}
          <div>
            <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
              가방의 아티팩트{selectedSlot ? ` — ${ARTIFACT_SLOT_LABEL[selectedSlot]} 필터` : ""}
            </p>
            {visibleArtifacts.length === 0 ? (
              <p className="text-center py-5 text-pixel-sm" style={{ color: "rgba(205, 178, 126, .1)" }}>
                {selectedSlot
                  ? `장착 가능한 ${withJosa(ARTIFACT_SLOT_LABEL[selectedSlot], "이가")} 없습니다.`
                  : "가방에 아티팩트가 없습니다."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {visibleArtifacts.map((a) => (
                  <button
                    key={a.instanceId}
                    onClick={() => onEquip(a)}
                    className="rounded-xl px-3 py-2 text-left transition hover:brightness-110 w-full"
                    style={{
                      background: "rgba(13, 18, 35, .88)",
                      border: `1px solid ${QUALITY_COLOR[a.quality]}44`,
                    }}
                  >
                    <p className="text-pixel-sm font-black leading-tight" style={{ color: PALETTE.cream100 }}>{a.name}</p>
                    <p className="text-pixel-sm font-bold mt-0.5" style={{ color: QUALITY_COLOR[a.quality] }}>
                      {QUALITY_LABEL[a.quality]}
                    </p>
                    <p className="text-pixel-sm mt-0.5" style={{ color: "rgba(132, 75, 63, .891)" }}>
                      {ARTIFACT_SLOT_LABEL[ARTIFACT_SLOT_MAP[a.itemId]] ?? "알 수 없음"}
                    </p>
                    {a.statBonuses && a.statBonuses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-0.5">
                        {a.statBonuses.map((sb, i) => (
                          <span key={i} className="text-pixel-sm px-1 py-0.5 rounded"
                            style={{ background: "rgba(132, 75, 63, .154)", color: PALETTE.ember500 }}>
                            {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 text-center text-pixel-sm font-black rounded py-0.5"
                      style={{ background: "rgba(132, 75, 63, .351)", color: PALETTE.sand300 }}>
                      장착하기
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MonsterStatusPanel ──────────────────────────────────────────────────────────
// 파티/보관함에서 클릭한 몬스터의 정보를 보여주는 상시 패널(모달 아님).
function MonsterStatusPanel({ monster, equipBonus = ZERO_EQUIP_BONUS, imprint = {}, inParty = false, onOpenImprint }: {
  monster: OwnedMonster | null; equipBonus?: EquipStatBonus;
  imprint?: Record<string, number>;
  /** 파티 멤버는 먼저 보관함으로 내려야 먹일 수 있다 — 버튼 대신 안내를 띄운다 */
  inParty?: boolean;
  onOpenImprint?: (chainKey: string) => void;
}) {
  if (!monster) {
    return (
      <div className="m-3 flex min-h-40 flex-col overflow-hidden rounded-lg border-2 border-earth-500
        bg-shadow-900/85 lg:mr-0 lg:w-72 lg:flex-shrink-0">
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(132, 75, 63, .32)" }}>
          <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">STATUS</p>
          <p className="text-pixel-sm font-black text-sand-200">상태창</p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center">
          <p className="text-pixel-sm" style={{ color: "rgba(205, 178, 126, .1)" }}>
            몬스터를 클릭하면<br />상세 정보가 표시됩니다
          </p>
        </div>
      </div>
    );
  }

  const acc = TYPE_ACCENT[monster.type ?? "none"] ?? TYPE_ACCENT.normal;
  const stats: [string, number, number][] = [
    ["HP", monster.maxHp, 0],
    ["공격", monster.attack, equipBonus.attack],
    ["방어", monster.defense, equipBonus.defense],
    ["속도", monster.speed, equipBonus.speed],
  ];

  return (
    <div className="m-3 flex min-h-40 flex-col overflow-hidden rounded-lg border-2 border-earth-500
      bg-shadow-900/85 lg:mr-0 lg:w-72 lg:flex-shrink-0">
      <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(132, 75, 63, .32)" }}>
        <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">STATUS</p>
        <p className="text-pixel-sm font-black text-sand-200">상태창</p>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4 lg:flex-1 lg:overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="relative h-14 w-14 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: acc.bg, border: `1px solid ${acc.border}` }}>
            <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
              className="w-11 h-11 object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-title-sm font-black text-cream-100 truncate">{monster.nickname ?? monster.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-pixel-sm font-bold text-sand-300">Lv.{monster.level}</span>
              <span className={`rounded-full border px-1.5 text-pixel-sm font-bold ${acc.label}`}>
                {TYPE_KO[monster.type ?? "none"] ?? ""}
              </span>
            </div>
          </div>
        </div>

        {/* 종합 능력치 */}
        <div>
          <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
            종합 능력치
          </p>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([label, base, bonus]) => (
              <div key={label} data-testid={`stat-${label}`}
                className="flex flex-col items-center rounded-lg py-2"
                style={{ background: "rgba(13, 18, 35, .35)", border: "1px solid rgba(132, 75, 63, .105)" }}>
                <span className="text-pixel-sm font-bold" style={{ color: "rgba(132, 75, 63, 1)" }}>{label}</span>
                <span data-testid={`stat-${label}-value`} className="text-pixel-sm font-black text-sand-200 mt-0.5">
                  {label === "HP" ? `${monster.currentHp}/${monster.maxHp}` : base + bonus}
                </span>
                {bonus > 0 && (
                  <span data-testid={`stat-${label}-bonus`} className="text-pixel-sm font-bold text-moss-500">
                    +{bonus}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 각인 — 계열 단위라 이 몬스터 한 마리가 아니라 계열 전원에 붙는다 */}
        {(() => {
          const status = imprintStatus(chainKeyOf(monster), imprint);
          return (
            <div>
              <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
                각인
              </p>
              <div className="rounded-xl px-3 py-2.5"
                data-testid="imprint-status"
                style={{ background: "rgba(13, 18, 35, .35)", border: "1px solid rgba(132, 75, 63, .105)" }}>
                <div className="flex items-center justify-between">
                  <span className="text-pixel-sm font-black" style={{ color: PALETTE.ember500 }}>
                    {imprintStars(status.tier)}
                  </span>
                  <span className="text-pixel-sm font-bold text-sand-200">
                    {status.tier} / {MAX_IMPRINT_TIER}
                  </span>
                </div>
                <p className="mt-1.5 text-pixel-sm" style={{ color: "rgba(205, 178, 126, .698)" }}>
                  {status.label} 전원 능력치{" "}
                  <span className="font-bold text-sand-200">+{status.tier * 5}%</span>
                </p>
                <p className="mt-1 text-pixel-sm" style={{ color: "rgba(132, 75, 63, .891)" }}>
                  {status.maxed
                    ? "더 올릴 등급이 없다."
                    : `다음 등급까지 중복 ${status.needFed}마리${status.needEssence > 0 ? ` · 정수 ${status.needEssence}개` : ""}`}
                </p>
                {onOpenImprint && (
                  inParty ? (
                    <p className="mt-2 text-pixel-sm" style={{ color: "rgba(132, 75, 63, .891)" }}>
                      먹이려면 보관함으로 내려야 한다.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenImprint(status.key)}
                      data-testid="imprint-open-status"
                      className="mt-2 w-full rounded-lg py-1.5 text-pixel-sm font-black transition hover:brightness-125"
                      style={{
                        background: rgba("moss500", 0.25),
                        border: `1px solid ${rgba("moss500", 0.7)}`,
                        color: PALETTE.sand200,
                      }}>
                      각인하기
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })()}

        {/* 성장 — 다음 레벨까지, 다음에 배울 기술, 진화 예정 */}
        {(() => {
          const nextLearn = getFullLearnset(monster.id).find((e) => e.level > monster.level);
          const evoTo = monster.evolvesTo
            ? monsters.find((m) => m.id === monster.evolvesTo) : undefined;
          return (
            <div>
              <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
                성장
              </p>
              <div className="rounded-xl px-3 py-2.5"
                style={{ background: "rgba(13, 18, 35, .35)", border: "1px solid rgba(132, 75, 63, .105)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-pixel-sm font-bold" style={{ color: "rgba(132, 75, 63, 1)" }}>다음 레벨까지</span>
                  <span className="text-pixel-sm font-mono text-sand-200">
                    {monster.exp} / {monster.expToNextLevel}
                  </span>
                </div>
                {/* HP 와 같은 부품·같은 규칙으로 그린다. 손으로 만든 6px 막대는 같은 화면의
                    HP 바 옆에서 게이지로 안 읽혔고, 색도 HP 위험 단계와 같은 주황이었다. */}
                <StatBar value={monster.exp} max={monster.expToNextLevel} variant="exp" />

                {nextLearn && (
                  <p className="mt-2 text-pixel-sm" style={{ color: "rgba(205, 178, 126, .698)" }}>
                    Lv.{nextLearn.level} — <span className="font-bold text-sand-200">{nextLearn.move.name}</span> 습득
                  </p>
                )}
                {evoTo && monster.evolvesAtLevel !== undefined && (
                  <p className="mt-1 text-pixel-sm" style={{ color: "rgba(205, 178, 126, .698)" }}>
                    Lv.{monster.evolvesAtLevel} — <span className="font-bold text-sand-200">{evoTo.name}</span>{josa(evoTo.name, "로")} 진화
                  </p>
                )}
                {!nextLearn && !evoTo && (
                  <p className="mt-2 text-pixel-sm" style={{ color: "rgba(132, 75, 63, .891)" }}>
                    더 배울 기술도, 남은 진화도 없습니다.
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        {/* 보유 스킬 */}
        <div>
          <p className="text-pixel-sm font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(132, 75, 63, 1)" }}>
            보유 스킬 ({monster.moves.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {monster.moves.map((mv) => {
              const mvAcc = TYPE_ACCENT[mv.type] ?? TYPE_ACCENT.normal;
              return (
                <div key={mv.id} className="flex items-center gap-2 rounded-xl px-3 py-2"
                  style={{ background: "rgba(13, 18, 35, .35)", border: "1px solid rgba(132, 75, 63, .105)" }}>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-pixel-sm font-bold ${mvAcc.label}`}>
                    {TYPE_KO[mv.type] ?? mv.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-pixel-sm font-black truncate" style={{ color: PALETTE.cream100 }}>{mv.name}</p>
                    <p className="text-pixel-sm mt-0.5" style={{ color: "rgba(132, 75, 63, .891)" }}>
                      {MOVE_CATEGORY_KO[mv.category] ?? mv.category}
                      {mv.statusEffect && ` · ${STATUS_KO[mv.statusEffect] ?? mv.statusEffect} ${mv.statusChance ?? 0}%`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-pixel-sm font-mono text-sand-200">위력 {mv.power === 0 ? "—" : mv.power}</p>
                    <p className="text-pixel-sm font-mono" style={{ color: "rgba(132, 75, 63, .764)" }}>명중 {mv.accuracy}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MonsterCard ────────────────────────────────────────────────────────────────
/**
 * 몬스터 카드.
 *
 * `layout="row"` 은 파티 칸 전용이다. 세로로 쌓으면 한 장이 200px 을 넘어 세 마리가
 * 1280x900 화면에 안 들어갔다 — 셋째 칸의 공/방/속이 잘린 채로 보였다. 가로로 누이면
 * 100px 남짓이라 세 장이 스크롤 없이 들어간다.
 */
function MonsterCard({
  monster, size = "md", layout = "stack", selected, dimmed, onClick, showStats = false,
  equippedSlots = [], equipBonus = ZERO_EQUIP_BONUS,
}: {
  monster: OwnedMonster; size?: "sm" | "md" | "lg";
  layout?: "stack" | "row";
  selected?: boolean; dimmed?: boolean; onClick: () => void; showStats?: boolean;
  equippedSlots?: string[]; equipBonus?: EquipStatBonus;
}) {
  const hpPct     = monster.maxHp === 0 ? 0 : Math.round((monster.currentHp / monster.maxHp) * 100);
  const isFainted = hpPct === 0;
  const acc       = TYPE_ACCENT[monster.type ?? "none"] ?? TYPE_ACCENT.normal;
  const imgSize   = size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-11 h-11";
  const row       = layout === "row";

  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl transition-all w-full overflow-hidden ${
        row ? "flex items-center gap-2.5 text-left" : "flex flex-col items-center gap-1.5"}`}
      style={{
        padding: size === "lg" ? "14px 10px" : "10px 8px",
        background: selected
          ? `linear-gradient(145deg, ${acc.bg}, rgba(13, 18, 35, .9))`
          : dimmed ? "rgba(13, 18, 35, .5)" : "rgba(13, 18, 35, .85)",
        border: selected ? `1.5px solid ${acc.border}` : `1px solid rgba(132, 75, 63, .255)`,
        boxShadow: selected ? `0 0 20px ${acc.glow}, inset 0 0 12px rgba(13, 18, 35, .4)` : "inset 0 0 8px rgba(13, 18, 35, .3)",
        opacity: dimmed ? .45 : 1,
        animation: selected ? "selectRing 2.2s ease-in-out infinite" : "none",
      } as React.CSSProperties}
    >
      {isFainted && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(13, 18, 35, .55)", backdropFilter: "blur(1px)" }}>
          <span className="text-pixel-sm font-black text-ember-500 tracking-widest rotate-[-15deg] opacity-90">기절</span>
        </div>
      )}

      <div className="relative flex-shrink-0">
        {selected && (
          <div className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${acc.glow}, transparent 65%)`, animation: "glowBreathe 2s ease-in-out infinite" }} />
        )}
        <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
          className={`${imgSize} object-contain relative`}
          style={{
            filter: isFainted ? "grayscale(.8) brightness(.6)" : selected ? `drop-shadow(0 0 8px ${acc.glow})` : "none",
          }} />
      </div>

      <div className={row ? "flex min-w-0 flex-1 flex-col gap-1" : "contents"}>
        <div className={row ? "w-full min-w-0" : "text-center w-full px-0.5"}>
          <p className={`truncate font-black leading-tight text-cream-100 ${size === "sm" ? "text-pixel-sm" : "text-title-sm"}`}>
            {monster.nickname ?? monster.name}
          </p>
          <div className={`flex items-center gap-1 mt-0.5 ${row ? "" : "justify-center"}`}>
            <span className="text-pixel-sm font-bold text-sand-300">Lv.{monster.level}</span>
            <span className={`rounded-full border px-1 text-pixel-sm font-bold ${acc.label}`} style={{ paddingTop: 0, paddingBottom: 0 }}>
              {TYPE_KO[monster.type ?? "none"] ?? ""}
            </span>
          </div>
        </div>

        {/* HP 바는 카드에서 두 번째로 큰 요소여야 한다 (ART_DIRECTION 3-2) */}
        <div className={row ? "w-full" : "w-full px-0.5"}>
          <div className="mb-0.5 flex items-center justify-between">
            <span className="text-pixel-sm font-bold text-earth-400">HP</span>
            <span className="text-pixel-sm font-bold text-sand-200">{monster.currentHp}/{monster.maxHp}</span>
          </div>
          <StatBar value={monster.currentHp} max={monster.maxHp} height={10} />
        </div>

        {showStats && (
          <div className={`w-full grid grid-cols-3 gap-0.5 ${row ? "" : "px-0.5 mt-0.5"}`}>
            {([
              ["공", monster.attack, equipBonus.attack],
              ["방", monster.defense, equipBonus.defense],
              ["속", monster.speed, equipBonus.speed],
            ] as [string, number, number][]).map(([l, base, bonus]) => (
              <div key={l} className={`flex items-center justify-center gap-1 rounded py-0.5 ${row ? "" : "flex-col"}`}
                style={{ background: "rgba(13, 18, 35, .3)" }}>
                <span className="text-pixel-sm text-earth-400">{l}</span>
                <span className="text-pixel-sm font-bold text-sand-200">{base + bonus}</span>
                {bonus > 0 && <span className="text-pixel-sm font-bold text-moss-500 leading-none">+{bonus}</span>}
              </div>
            ))}
          </div>
        )}

        {equippedSlots.length > 0 && (
          <div className={`w-full flex items-center gap-0.5 flex-wrap ${row ? "" : "justify-center mt-0.5"}`}>
            {equippedSlots.map((slot) => (
              <span key={slot} className="text-pixel-sm px-1 rounded font-bold"
                style={{ background: "rgba(132, 75, 63, .468)", color: PALETTE.sand300, border: "1px solid rgba(132, 75, 63, .702)" }}>
                {ARTIFACT_SLOT_LABEL[slot]}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function EmptyPartySlot({ index, selected, onClick }: { index: number; selected?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-dashed transition-all
        ${selected ? "border-2 border-ember-500 bg-ember-500/10" : "border border-earth-500/70 bg-shadow-700/40"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-dashed
        ${selected ? "border-ember-500 bg-ember-500/15" : "border-earth-500/70"}`}>
        <span className={`text-pixel-md ${selected ? "text-ember-500" : "text-earth-400"}`}>+</span>
      </div>
      <span className={`text-pixel-sm font-semibold ${selected ? "text-ember-500" : "text-earth-400"}`}>슬롯 {index + 1}</span>
    </button>
  );
}

// ─── MonstersPage ──────────────────────────────────────────────────────────────────
type SortKey = "level" | "hp" | "type";

export default function MonstersPage() {
  const navigate = useNavigate();
  const {
    party: rawParty, storage: rawStorage, bestFloor, dexCaught, imprint,
    moveToStorage, swapWithStorage, moveToParty, swapPartySlots, restorePartyHp,
    equippedArtifacts, craftedArtifacts, equipArtifact, unequipArtifact, releaseMonster,
  } = usePlayerStore();

  // 각인은 저장된 능력치에 손대지 않는다 — 화면에 보이는 값만 파생시킨다.
  // 순서는 그대로라 파티 인덱스·uid 로 도는 조작은 전부 원본과 맞물린다.
  const party   = useMemo(() => rawParty.map((m) => withImprint(m, imprint)), [rawParty, imprint]);
  const storage = useMemo(() => rawStorage.map((m) => withImprint(m, imprint)), [rawStorage, imprint]);

  // 오름(최종 보스)은 포획 대상이 아니라 도감 분모에서 뺀다
  const catchableTotal = monsters.filter((m) => m.id !== "ormr").length;
  const caughtCount    = dexCaught.filter((id) => id !== "ormr").length;

  const [selParty,   setSelParty]   = useState<number | null>(null);
  const [selStorage, setSelStorage] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy,     setSortBy]     = useState<SortKey>("level");
  const [restoreAnim, setRestoreAnim] = useState(false);

  // 각인 모달 — 계열 단위라 uid 가 아니라 계열키를 들고 연다
  const [imprintKey, setImprintKey] = useState<string | null>(null);

  // 장비 모달
  const [equipModalUid, setEquipModalUid] = useState<string | null>(null);
  const equipModalMonster = equipModalUid
    ? ([...party, ...storage].find((m) => m.uid === equipModalUid) ?? null)
    : null;

  // 상세 정보 모달
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const detailMonster = detailUid
    ? ([...party, ...storage].find((m) => m.uid === detailUid) ?? null)
    : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (imprintKey) { setImprintKey(null); return; }
      if (equipModalUid) { setEquipModalUid(null); return; }
      navigate("/", { state: { openMenu: true } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [equipModalUid, imprintKey, navigate]);

  // 몬스터 클릭 시: 다른 몬스터가 이미 선택된 상태라면 파티 교체를 수행하고,
  // 아무것도 선택되지 않은 상태라면 선택 표시와 함께 상세 정보를 띄운다.
  const handlePartyClick = (idx: number) => {
    if (selStorage !== null) {
      if (idx < party.length) swapWithStorage(idx, selStorage);
      else moveToParty(selStorage, idx);
      setSelStorage(null); setSelParty(null); setDetailUid(null); return;
    }
    if (selParty !== null && selParty !== idx) {
      swapPartySlots(selParty, idx); setSelParty(null); setDetailUid(null); return;
    }
    if (selParty === idx) {
      setSelParty(null); setDetailUid(null);
      return;
    }
    setSelParty(idx);
    const m = party[idx];
    if (m) setDetailUid(m.uid);
  };

  const handleStorageClick = (uid: string) => {
    if (selParty !== null) {
      if (selParty < party.length) swapWithStorage(selParty, uid);
      else moveToParty(uid, selParty);
      setSelParty(null); setSelStorage(null); setDetailUid(null); return;
    }
    if (selStorage === uid) {
      setSelStorage(null); setDetailUid(null);
      return;
    }
    setSelStorage(uid);
    setDetailUid(uid);
  };

  const handleRemove = (idx: number) => {
    if (party.length <= 1) return;
    moveToStorage(idx); setSelParty(null); setDetailUid(null);
  };

  const handleRestore = () => {
    restorePartyHp();
    setRestoreAnim(true);
    setTimeout(() => setRestoreAnim(false), 800);
  };

  // 장비 모달 핸들러
  const handleEquip = (artifact: ArtifactInstance) => {
    if (!equipModalUid) return;
    equipArtifact(equipModalUid, artifact);
  };

  const handleUnequip = (instanceId: string) => {
    if (!equipModalUid) return;
    unequipArtifact(equipModalUid, instanceId);
  };

  // 놓아주기 핸들러
  const handleRelease = (uid: string) => {
    releaseMonster(uid);
    setSelParty(null);
    setSelStorage(null);
    if (detailUid === uid) setDetailUid(null);
    if (equipModalUid === uid) setEquipModalUid(null);
  };

  // 헬퍼: 장착 슬롯 이름 목록
  const getEquippedSlots = (uid: string): string[] =>
    (equippedArtifacts[uid] ?? []).map((a) => ARTIFACT_SLOT_MAP[a.itemId]).filter(Boolean);

  // 헬퍼: 장착 장비의 공격/방어/속도 합산 보너스 (HP는 배틀 실수치와 어긋나지 않도록 제외)
  const getEquipBonus = (uid: string): EquipStatBonus => {
    const totals = sumEquippedStatBonuses(equippedArtifacts[uid] ?? []);
    return { attack: totals.attack, defense: totals.defense, speed: totals.speed };
  };

  const storageTypes = [...new Set(storage.map((m) => m.type))]
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const filteredStorage = [...storage]
    .filter((m) => typeFilter === "all" || m.type === typeFilter)
    .sort((a, b) => {
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "hp")    return (b.currentHp / b.maxHp) - (a.currentHp / a.maxHp);
      return (a.type ?? "").localeCompare(b.type ?? "");
    });

  // 속성 필터를 바꿔서 상태창에 표시 중이던 몬스터가 목록에서 사라지면 선택/상태창도 함께 초기화
  useEffect(() => {
    if (selStorage && !filteredStorage.some((m) => m.uid === selStorage)) {
      setSelStorage(null);
      setDetailUid(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const faintedCount = party.filter((m) => m.currentHp === 0).length;

  const hint: { icon: IconName | null; text: string } = selParty !== null
    ? { icon: "storage", text: "보관함의 몬스터를 선택해 교체" }
    : selStorage !== null
      ? { icon: "party", text: "파티 슬롯을 선택해 교체하거나 추가" }
      : { icon: null, text: "슬롯 또는 보관함 몬스터를 클릭해 선택" };

  return (
    <div className="relative h-screen flex flex-col text-cream-100 overflow-hidden">
      <GameBackground />
      <style>{MON_STYLES}</style>

      {/* ── 헤더 ── */}
      <header className="relative" style={{
        background: "rgba(13, 18, 35, .92)",
        borderBottom: "1px solid rgba(132, 75, 63, .229)",
        boxShadow: "0 1px 0 rgba(233, 148, 65, .068)",
        flexShrink: 0,
      }}>
        <div style={{ height: 2, background: "linear-gradient(90deg,transparent,rgba(233, 148, 65, .357),transparent)" }} />
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")}
              className="rounded-xl px-3 py-1.5 text-pixel-sm font-semibold transition"
              style={{ background: "rgba(13, 18, 35, .8)", border: "1px solid rgba(132, 75, 63, .382)", color: "rgba(205, 178, 126, .59)" }}>
              ← 베이스캠프
            </button>
            <p className="text-title-sm font-black text-cream-100">내 몬스터</p>

            <div className="flex items-baseline gap-1.5 rounded-xl border border-earth-500/50 bg-shadow-900/70 px-3 py-1">
              <span className="text-pixel-sm text-earth-400">도감</span>
              <span className="text-title-sm font-black text-ember-500">{caughtCount}</span>
              <span className="text-pixel-sm text-sand-300">/ {catchableTotal}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              {[
                { label: "파티",   value: `${party.length}/3` },
                { label: "보관함", value: `${storage.length}/30` },
                ...(bestFloor > 0 ? [{ label: "최고층", value: `${bestFloor}F` }] : []),
              ].map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-pixel-sm text-earth-400">{s.label}</span>
                  <span className="text-pixel-sm font-black text-sand-200">{s.value}</span>
                </div>
              ))}
            </div>

            <button onClick={handleRestore}
              className="relative rounded-xl px-4 py-2 text-pixel-sm font-black transition overflow-hidden"
              style={{
                background: faintedCount > 0 ? "linear-gradient(135deg,rgba(13, 18, 35, .8),rgba(13, 18, 35, .9))" : "rgba(13, 18, 35, .6)",
                border: faintedCount > 0 ? "1px solid rgba(122, 132, 85, .979)" : "1px solid rgba(132, 75, 63, .091)",
                color: faintedCount > 0 ? PALETTE.moss500 : PALETTE.stone600,
                boxShadow: faintedCount > 0 && restoreAnim ? "0 0 20px rgba(122, 132, 85, 1)" : "none",
              }}>
              {restoreAnim && (
                <div className="absolute inset-0 rounded-xl"
                  style={{ background: "rgba(122, 132, 85, .356)", animation: "bubblePop .6s ease" }} />
              )}
              <span className="relative">
                {restoreAnim ? "✓ 회복 완료!" : faintedCount > 0 ? `HP 전회복 (${faintedCount}마리 기절)` : "파티 HP 전회복"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 콘텐츠 ──
          relative 필수: GameBackground가 absolute라 static 형제 위에 그려진다 */}
      {/* 1024 미만에서는 세로로 쌓는다. 768에서 열 폭이 200px까지 눌려
          "보관함이 비어 있 습니다" 처럼 단어 중간에서 줄이 끊겼다. */}
      <div className="relative flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* 파티 패널 */}
        <div className="m-3 flex flex-col overflow-hidden rounded-lg border-2 border-earth-500
          bg-shadow-900/85 lg:mr-0 lg:w-64 lg:flex-shrink-0">
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(132, 75, 63, .32)" }}>
            <div>
              <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">PARTY</p>
              <p className="text-pixel-sm font-black text-sand-200">전투 파티 <span className="text-sand-300 font-normal">({party.length}/3)</span></p>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-3 py-3 lg:flex-1 lg:overflow-y-auto">
            {[0, 1, 2].map((idx) => {
              const m = party[idx];
              return m ? (
                <div key={m.uid} className="flex flex-col gap-1">
                  <MonsterCard monster={m} size="md" layout="row"
                    selected={selParty === idx}
                    dimmed={selStorage !== null && selParty === null}
                    showStats
                    equippedSlots={getEquippedSlots(m.uid)}
                    equipBonus={getEquipBonus(m.uid)}
                    onClick={() => handlePartyClick(idx)} />
                  {/* 액션 버튼 행 */}
                  <div className="flex items-center justify-between px-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(idx); }}
                      disabled={party.length <= 1}
                      className="text-pixel-sm font-semibold transition"
                      style={{ color: party.length <= 1 ? "rgba(172, 123, 98, .35)" : PALETTE.earth400 }}
                      onMouseEnter={(e) => { if (party.length > 1) (e.target as HTMLElement).style.color = PALETTE.sand300; }}
                      onMouseLeave={(e) => { if (party.length > 1) (e.target as HTMLElement).style.color = PALETTE.earth400; }}>
                      보관함↓
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEquipModalUid(m.uid); }}
                        className="text-pixel-sm font-bold px-2 py-0.5 rounded transition hover:brightness-125"
                        style={{
                          background: "rgba(24, 59, 79, .531)",
                          border: "1px solid rgba(92, 147, 150, .29)",
                          color: "rgba(174, 226, 213, .57)",
                        }}>
                        장착
                      </button>
                      <ReleaseBtn
                        disabled={party.length <= 1}
                        onRelease={() => handleRelease(m.uid)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyPartySlot key={`empty-${idx}`} index={idx}
                  selected={selParty === idx}
                  onClick={() => handlePartyClick(idx)} />
              );
            })}
          </div>

          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(132, 75, 63, .32)" }}>
            <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-pixel-sm text-center"
              style={{ color: PALETTE.earth400 }}>
              {hint.icon && <PixelIcon name={hint.icon} size={16} />}
              <span>{hint.text}</span>
            </p>
          </div>
        </div>

        {/* 상태창 */}
        <MonsterStatusPanel
          monster={detailMonster}
          equipBonus={detailMonster ? getEquipBonus(detailMonster.uid) : undefined}
          imprint={imprint}
          inParty={detailMonster ? party.some((m) => m.uid === detailMonster.uid) : false}
          onOpenImprint={setImprintKey}
        />

        {/* 보관함 */}
        <div className="m-3 flex min-h-64 flex-1 flex-col overflow-hidden rounded-lg
          border-2 border-earth-500 bg-shadow-900/85">
          <div className="px-4 py-3 flex flex-wrap items-center gap-2"
            style={{ borderBottom: "1px solid rgba(132, 75, 63, .32)", background: "rgba(13, 18, 35, .35)" }}>
            <div className="mr-2">
              <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">STORAGE</p>
              <p className="text-pixel-sm font-black text-sand-200">보관함 <span className="text-sand-300 font-normal">({storage.length}/30)</span></p>
            </div>

            <div className="flex gap-1 flex-wrap">
              {["all", ...storageTypes].map((t) => {
                const acc = t === "all" ? null : TYPE_ACCENT[t];
                return (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className="rounded-full px-2.5 py-0.5 text-pixel-sm font-bold transition"
                    style={{
                      background: typeFilter === t ? (acc ? acc.bg : "rgba(233, 148, 65, .17)") : "rgba(13, 18, 35, .6)",
                      border: typeFilter === t ? `1px solid ${acc?.border ?? PALETTE.ember500}` : "1px solid rgba(132, 75, 63, .255)",
                      color: typeFilter === t ? (acc?.border ?? PALETTE.ember500) : "rgba(205, 178, 126, .14)",
                    }}>
                    {t === "all" ? "전체" : TYPE_KO[t] ?? t}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1 ml-auto">
              {([["level", "레벨"], ["hp", "HP"], ["type", "속성"]] as [SortKey, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setSortBy(k)}
                  className="rounded-lg px-2 py-0.5 text-pixel-sm font-bold transition"
                  style={{
                    background: sortBy === k ? "rgba(233, 148, 65, .136)" : "rgba(13, 18, 35, .6)",
                    border: `1px solid ${sortBy === k ? "rgba(233, 148, 65, .509)" : "rgba(132, 75, 63, .255)"}`,
                    color: sortBy === k ? PALETTE.ember500 : "rgba(205, 178, 126, .12)",
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 lg:flex-1 lg:overflow-y-auto">
            {storage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                <PixelIcon name="storage" size={64} className="opacity-20" />
                <div>
                  <p className="font-bold text-sand-300 mb-1">보관함이 비어 있습니다</p>
                  <p className="text-pixel-sm text-earth-400">숲 탐험에서 몬스터를 포획하면<br />이곳에 자동으로 저장됩니다.</p>
                </div>
              </div>
            ) : filteredStorage.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <p className="text-pixel-sm text-earth-400">{TYPE_KO[typeFilter]} 속성 몬스터가 없습니다.</p>
              </div>
            ) : (
              <div className="grid gap-2" style={{
                // 100px 이던 시절엔 카드 아래 액션이 둘뿐이었다. 각인이 붙어 셋이 되면서
                // 글자가 "각/인" 으로 끊겼다 — 셋이 한 줄에 서는 최소 폭으로 넓힌다
                gridTemplateColumns: "repeat(auto-fill, minmax(124px, 1fr))",
              }}>
                {filteredStorage.map((m, i) => (
                  // 카드와 그 아래 버튼을 한 판에 담는다. 판이 없으면 옆 카드의 버튼과
                  // 한 줄로 이어져 보여 어느 카드 것인지 알 수 없었다
                  <div key={m.uid} className="flex flex-col gap-1 rounded-xl p-1"
                    style={{
                      animation: `monIn .3s ease ${i * .04}s both`,
                      background: rgba("shadow900", 0.5),
                      border: `1px solid ${rgba("stone600", 0.5)}`,
                    }}>
                    <MonsterCard monster={m} size="sm"
                      selected={selStorage === m.uid}
                      equippedSlots={getEquippedSlots(m.uid)}
                      onClick={() => handleStorageClick(m.uid)} />
                    <div className="flex items-center justify-center gap-1 px-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEquipModalUid(m.uid); }}
                        className="text-pixel-sm font-bold px-1.5 py-0.5 rounded transition hover:brightness-125 whitespace-nowrap"
                        style={{
                          background: "rgba(24, 59, 79, .531)",
                          border: "1px solid rgba(92, 147, 150, .29)",
                          color: "rgba(174, 226, 213, .57)",
                        }}>
                        장착
                      </button>
                      {/* 각인은 보관함에서만 — 파티 카드에는 이 버튼이 없다 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setImprintKey(chainKeyOf(m)); }}
                        data-testid={`imprint-open-${m.uid}`}
                        className="text-pixel-sm font-bold px-1.5 py-0.5 rounded transition hover:brightness-125 whitespace-nowrap"
                        style={{
                          background: rgba("moss500", 0.25),
                          border: `1px solid ${rgba("moss500", 0.6)}`,
                          color: PALETTE.sand200,
                        }}>
                        각인
                      </button>
                      <ReleaseBtn
                        disabled={false}
                        onRelease={() => handleRelease(m.uid)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 각인 모달 ── */}
      {imprintKey && <ImprintModal chainKey={imprintKey} onClose={() => setImprintKey(null)} />}

      {/* ── 장비 모달 ── */}
      {equipModalUid && equipModalMonster && (
        <EquipModal
          monster={equipModalMonster}
          equipped={equippedArtifacts[equipModalUid] ?? []}
          available={craftedArtifacts}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onClose={() => setEquipModalUid(null)}
        />
      )}
    </div>
  );
}
