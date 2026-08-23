import { useState, useEffect, useMemo, type ReactNode } from "react";
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
import { StatBar, PixelButton } from "../shared/ui";
import { PixelIcon } from "../shared/ui/PixelIcon";
import { isIconName, type IconName } from "../shared/ui/icons";

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
@keyframes selectRing {
  0%,100%{ box-shadow: 0 0 0 2px var(--sel-color, var(--color-ember-500)), 0 0 16px var(--sel-glow, rgba(233, 148, 65, .452)); }
  50%    { box-shadow: 0 0 0 2px var(--sel-color, var(--color-ember-500)), 0 0 28px var(--sel-glow, rgba(233, 148, 65, .622)); }
}
@keyframes bubblePop {
  0%  { transform: scale(0); opacity: 1; }
  100%{ transform: scale(3); opacity: 0; }
}
`;

// ─── 공용 조판 ──────────────────────────────────────────────────────────────────
/**
 * 패널 안 구역 이름. 여덟 곳이 같은 조판을 손으로 반복하고 있었는데, 색이
 * earth-500(#844B3F) 이라 shadow-900 위에서 2.7:1 밖에 안 나왔다 — 팔레트 표에서
 * earth-500 은 **테두리 색**이지 글자 색이 아니다(palette.ts 머리말). 한 곳으로
 * 모으고 sand-300(7:1) 으로 올린다.
 */
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-pixel-sm font-bold text-sand-300">{children}</p>;
}

/** 값이 없는 자리. "— 비어있음 —" 이 cream 알파 .08 이라 아예 안 보였다. */
function EmptyValue({ children = "비어 있음" }: { children?: ReactNode }) {
  return <span className="text-pixel-sm text-earth-400">{children}</span>;
}

/** 아티팩트의 아이콘 이름. 표 밖의 id 가 들어와도 총칭 아이콘으로 떨어진다. */
function artifactIcon(itemId: string): IconName {
  return isIconName(itemId) ? itemId : "artifact";
}

/**
 * 카드 위의 장비 표시.
 *
 * 슬롯 이름 칩(목걸이·팔찌·부적) 세 개는 116px 카드에서 줄을 갈아 카드마다 높이가
 * 달라졌고, 그만큼 아래 것들이 어긋났다. 카드에서는 **아이콘 한 줄**로만 눕히고
 * 이름·등급은 상태창의 '장비' 칸이 맡는다.
 */
function EquipStrip({ items, align = "center" }: {
  items: ArtifactInstance[]; align?: "center" | "start";
}) {
  if (items.length === 0) return null;
  return (
    <div className={`flex w-full items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
      {items.map((a) => (
        <PixelIcon key={a.instanceId} name={artifactIcon(a.itemId)} size={16} title={a.name} />
      ))}
    </div>
  );
}

/**
 * 스크롤이 이어진다는 표시.
 *
 * 이 게임은 스크롤바를 전역에서 숨긴다(index.css). 그래서 잘린 자리가 "여기서 끝"으로
 * 읽힌다 — 상태창은 관리 버튼부터 기술까지 한 칸에 담겨 늘 잘린 채로 서 있다.
 * 아래쪽을 패널 색으로 흐리면 "더 있다"가 스크롤바 없이도 읽힌다.
 */
function ScrollFade() {
  return (
    <div aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-6 lg:block"
      style={{ background: `linear-gradient(to top, ${rgba("shadow900", 0.9)}, transparent)` }} />
  );
}

// ─── ReleaseButton ─────────────────────────────────────────────────────────────
/** 두 번 눌러야 나간다. 되돌릴 수 없는 조작이라 첫 클릭은 확인으로만 쓴다. */
function ReleaseButton({ disabled, onRelease }: { disabled: boolean; onRelease: () => void }) {
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (!pending) {
      setPending(true);
      setTimeout(() => setPending(false), 2500);
    } else {
      setPending(false);
      onRelease();
    }
  };

  return (
    <PixelButton
      variant={pending ? "primary" : "danger"}
      disabled={disabled}
      data-testid="action-release"
      onClick={handleClick}
    >
      {pending ? "정말?" : "놓아주기"}
    </PixelButton>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: rgba("shadow900", 0.78) }}
      onClick={onClose}
    >
      <div
        data-testid="equip-modal"
        className="relative flex max-h-[90vh] w-[520px] max-w-full flex-col rounded-2xl"
        style={{
          background: rgba("shadow900", 0.98),
          border: `2px solid ${PALETTE.earth500}`,
          boxShadow: `0 16px 48px ${rgba("shadow900", 0.8)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${rgba("earth500", 0.4)}` }}>
          <div className="min-w-0">
            <p className="text-pixel-sm font-bold text-sand-300">장비 관리</p>
            <p className="truncate text-title-sm font-black text-cream-100">
              {monster.nickname ?? monster.name}
            </p>
          </div>
          <PixelButton variant="ghost" onClick={onClose} className="shrink-0">닫기</PixelButton>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {/* 현재 장착 슬롯 */}
          <div>
            <SectionLabel>장착 중인 장비 — 슬롯을 누르면 가방이 그 슬롯만 보여 준다</SectionLabel>
            <div className="flex flex-col gap-2">
              {ALL_ARTIFACT_SLOTS.map((slot) => {
                const item = equipped.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
                const isActive = selectedSlot === slot;
                return (
                  <div
                    key={slot}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition"
                    style={{
                      background: isActive ? rgba("earth500", 0.28) : rgba("shadow900", 0.35),
                      border: `1px solid ${isActive ? PALETTE.earth500 : rgba("earth500", 0.3)}`,
                    }}
                    onClick={() => setSelectedSlot(isActive ? null : slot)}
                  >
                    <span className="w-16 shrink-0 text-pixel-sm font-bold text-sand-300">
                      {ARTIFACT_SLOT_LABEL[slot]}
                    </span>
                    {item ? (
                      <>
                        <PixelIcon name={artifactIcon(item.itemId)} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-pixel-sm font-black text-cream-100">{item.name}</p>
                          <p className="mt-0.5 text-pixel-sm font-bold" style={{ color: QUALITY_COLOR[item.quality] }}>
                            {QUALITY_LABEL[item.quality]}
                          </p>
                          {item.statBonuses && item.statBonuses.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.statBonuses.map((sb, i) => (
                                <span key={i} className="rounded px-1 py-0.5 text-pixel-sm font-bold"
                                  style={{ background: rgba("earth500", 0.28), color: PALETTE.sand200 }}>
                                  {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <PixelButton
                          variant="danger"
                          className="shrink-0"
                          onClick={(e) => { e.stopPropagation(); onUnequip(item.instanceId); }}
                        >
                          해제
                        </PixelButton>
                      </>
                    ) : (
                      <EmptyValue />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 가방의 아티팩트 */}
          <div>
            <SectionLabel>
              가방의 아티팩트{selectedSlot ? ` — ${ARTIFACT_SLOT_LABEL[selectedSlot]}만` : ""}
            </SectionLabel>
            {visibleArtifacts.length === 0 ? (
              <p className="py-5 text-center text-pixel-sm text-earth-400">
                {selectedSlot
                  ? `장착 가능한 ${withJosa(ARTIFACT_SLOT_LABEL[selectedSlot], "이가")} 없습니다.`
                  : "가방에 아티팩트가 없습니다."}
              </p>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(216px, 1fr))" }}>
                {visibleArtifacts.map((a) => (
                  <button
                    key={a.instanceId}
                    onClick={() => onEquip(a)}
                    className="flex flex-col rounded-xl px-3 py-2 text-left transition hover:brightness-110"
                    style={{
                      background: rgba("shadow900", 0.88),
                      border: `1px solid ${rgba("earth500", 0.5)}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <PixelIcon name={artifactIcon(a.itemId)} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-pixel-sm font-black text-cream-100">{a.name}</p>
                        <p className="mt-0.5 text-pixel-sm font-bold" style={{ color: QUALITY_COLOR[a.quality] }}>
                          {QUALITY_LABEL[a.quality]}
                        </p>
                      </div>
                    </div>
                    <p className="mt-1 text-pixel-sm text-sand-300">
                      {ARTIFACT_SLOT_LABEL[ARTIFACT_SLOT_MAP[a.itemId]] ?? "알 수 없음"}
                    </p>
                    {a.statBonuses && a.statBonuses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {a.statBonuses.map((sb, i) => (
                          <span key={i} className="rounded px-1 py-0.5 text-pixel-sm font-bold"
                            style={{ background: rgba("earth500", 0.28), color: PALETTE.sand200 }}>
                            {ARTIFACT_STAT_LABEL[sb.stat]} +{sb.value}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="mt-2 rounded py-0.5 text-center text-pixel-sm font-black"
                      style={{ background: rgba("earth500", 0.45), color: PALETTE.cream100 }}>
                      장착하기
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <ScrollFade />
        </div>
      </div>
    </div>
  );
}

// ─── MonsterStatusPanel ──────────────────────────────────────────────────────────
/**
 * 고른 몬스터의 정보와 **그 몬스터로 할 수 있는 일 전부**를 담는 상시 패널(모달 아님).
 *
 * 예전에는 장착·각인·놓아주기가 카드마다 따라붙어 있었다. 보관함 카드는 124px 인데
 * 버튼 셋은 150px 이라 카드 밖으로 흘러 옆 카드의 버튼과 겹쳤고, 어느 카드의 버튼인지
 * 알 수 없었다. 조작은 **한 마리에게만** 하는 것이므로 고른 한 마리 옆에 한 벌만 둔다 —
 * 덤으로 늘 비어 있던 이 칸이 제 일을 하게 된다.
 */
function MonsterStatusPanel({
  monster, equipBonus = ZERO_EQUIP_BONUS, equipped = [], imprint = {},
  inParty = false, canAddToParty = false, canRemoveFromParty = false, canRelease = false,
  onTogglePartySlot, onOpenEquip, onOpenImprint, onRelease,
}: {
  monster: OwnedMonster | null;
  equipBonus?: EquipStatBonus;
  equipped?: ArtifactInstance[];
  imprint?: Record<string, number>;
  /** 파티 멤버는 먼저 보관함으로 내려야 먹일 수 있다 — 각인 버튼을 잠그고 이유를 적는다 */
  inParty?: boolean;
  canAddToParty?: boolean;
  canRemoveFromParty?: boolean;
  canRelease?: boolean;
  onTogglePartySlot?: () => void;
  onOpenEquip?: () => void;
  onOpenImprint?: (chainKey: string) => void;
  onRelease?: () => void;
}) {
  const shell = "m-3 flex min-h-40 flex-col overflow-hidden rounded-lg border-2 border-earth-500" +
    " bg-shadow-900/85 lg:mr-0 lg:w-80 lg:flex-shrink-0";
  const header = (
    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${rgba("earth500", 0.32)}` }}>
      <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">STATUS</p>
      <p className="text-pixel-sm font-black text-sand-200">상태창</p>
    </div>
  );

  if (!monster) {
    return (
      <div className={shell}>
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <PixelIcon name="monsters" size={64} className="opacity-40" />
          <p className="text-pixel-sm text-sand-300">
            몬스터를 누르면<br />여기에서 살펴보고 관리합니다
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
  const status    = imprintStatus(chainKeyOf(monster), imprint);
  const nextLearn = getFullLearnset(monster.id).find((e) => e.level > monster.level);
  const evoTo     = monster.evolvesTo ? monsters.find((m) => m.id === monster.evolvesTo) : undefined;
  const fainted   = monster.currentHp === 0;
  const boxStyle  = {
    background: rgba("shadow900", 0.35),
    border: `1px solid ${rgba("earth500", 0.28)}`,
  };

  return (
    <div className={shell}>
      {header}

      <div className="relative flex min-h-0 flex-col lg:flex-1">
      <div className="flex flex-col gap-5 px-4 py-4 lg:flex-1 lg:overflow-y-auto">
        {/* 이름줄 */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl"
            style={{ background: acc.bg, border: `1px solid ${acc.border}` }}>
            <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
              className="h-11 w-11 object-contain"
              style={{ filter: fainted ? "grayscale(.8) brightness(.6)" : "none" }} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-title-sm font-black text-cream-100">{monster.nickname ?? monster.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="text-pixel-sm font-bold text-sand-300">Lv.{monster.level}</span>
              <span className={`rounded-full border px-1.5 text-pixel-sm font-bold ${acc.label}`}>
                {TYPE_KO[monster.type ?? "none"] ?? ""}
              </span>
              {/* 파티인지 보관함인지가 곧 무엇을 할 수 있는지다 — 아래 버튼의 근거를 여기서 밝힌다 */}
              <span className="rounded-full border px-1.5 text-pixel-sm font-bold"
                style={{
                  borderColor: rgba("earth500", 0.8),
                  background: rgba("shadow900", 0.6),
                  color: PALETTE.sand300,
                }}>
                {inParty ? "파티" : "보관함"}
              </span>
            </div>
          </div>
        </div>

        {/* 관리 — 이 화면에서 몬스터에게 할 수 있는 일 전부가 여기 한 벌 있다 */}
        <div>
          <SectionLabel>관리</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <PixelButton
              variant="ghost"
              data-testid="action-party"
              disabled={inParty ? !canRemoveFromParty : !canAddToParty}
              onClick={onTogglePartySlot}>
              {inParty ? "보관함으로" : "파티에 넣기"}
            </PixelButton>
            <PixelButton variant="info" data-testid="action-equip" onClick={onOpenEquip}>
              장착
            </PixelButton>
            <PixelButton
              variant="nature"
              data-testid="action-imprint"
              disabled={inParty}
              onClick={() => onOpenImprint?.(status.key)}>
              각인
            </PixelButton>
            <ReleaseButton disabled={!canRelease} onRelease={() => onRelease?.()} />
          </div>
          {inParty && (
            <p className="mt-2 text-pixel-sm text-earth-400">
              각인은 보관함으로 내린 뒤에 먹일 수 있다.
            </p>
          )}
          {!inParty && !canAddToParty && (
            <p className="mt-2 text-pixel-sm text-earth-400">
              파티가 가득 찼다. 이 몬스터를 고른 채로 파티 슬롯을 누르면 자리를 바꾼다.
            </p>
          )}
        </div>

        {/* 종합 능력치 */}
        <div>
          <SectionLabel>종합 능력치</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {stats.map(([label, base, bonus]) => (
              <div key={label} data-testid={`stat-${label}`}
                className="flex flex-col items-center rounded-lg py-2" style={boxStyle}>
                <span className="text-pixel-sm font-bold text-earth-400">{label}</span>
                <span data-testid={`stat-${label}-value`} className="mt-0.5 text-pixel-sm font-black text-sand-200">
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

        {/* 장비 — 카드에는 아이콘만 서므로 이름·등급은 여기서만 읽힌다 */}
        <div>
          <SectionLabel>장비</SectionLabel>
          <div className="flex flex-col gap-1">
            {ALL_ARTIFACT_SLOTS.map((slot) => {
              const item = equipped.find((a) => ARTIFACT_SLOT_MAP[a.itemId] === slot);
              return (
                <div key={slot} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={boxStyle}>
                  <span className="w-12 shrink-0 text-pixel-sm text-earth-400">
                    {ARTIFACT_SLOT_LABEL[slot]}
                  </span>
                  {item ? (
                    <>
                      <PixelIcon name={artifactIcon(item.itemId)} size={16} />
                      <span className="min-w-0 flex-1 truncate text-pixel-sm font-bold text-sand-200">
                        {item.name}
                      </span>
                      {/* 등급 이름표는 QUALITY_LABEL 한 벌뿐이다. 칸이 좁아 "제작품"만 턴다 */}
                      <span className="shrink-0 text-pixel-sm font-bold"
                        style={{ color: QUALITY_COLOR[item.quality] }}>
                        {QUALITY_LABEL[item.quality].replace(" 제작품", "")}
                      </span>
                    </>
                  ) : (
                    <EmptyValue />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 각인 — 계열 단위라 이 몬스터 한 마리가 아니라 계열 전원에 붙는다 */}
        <div>
          <SectionLabel>각인</SectionLabel>
          <div className="rounded-xl px-3 py-2.5" data-testid="imprint-status" style={boxStyle}>
            <div className="flex items-center justify-between">
              <span className="text-pixel-sm font-black" style={{ color: PALETTE.ember500 }}>
                {imprintStars(status.tier)}
              </span>
              <span className="text-pixel-sm font-bold text-sand-200">
                {status.tier} / {MAX_IMPRINT_TIER}
              </span>
            </div>
            <p className="mt-1.5 text-pixel-sm text-sand-300">
              {status.label} 전원 능력치{" "}
              <span className="font-bold text-sand-200">+{status.tier * 5}%</span>
            </p>
            <p className="mt-1 text-pixel-sm text-earth-400">
              {status.maxed
                ? "더 올릴 등급이 없다."
                : `다음 등급까지 중복 ${status.needFed}마리${status.needEssence > 0 ? ` · 정수 ${status.needEssence}개` : ""}`}
            </p>
          </div>
        </div>

        {/* 성장 — 다음 레벨까지, 다음에 배울 기술, 진화 예정 */}
        <div>
          <SectionLabel>성장</SectionLabel>
          <div className="rounded-xl px-3 py-2.5" style={boxStyle}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-pixel-sm font-bold text-earth-400">다음 레벨까지</span>
              <span className="font-mono text-pixel-sm text-sand-200">
                {monster.exp} / {monster.expToNextLevel}
              </span>
            </div>
            {/* HP 와 같은 부품·같은 규칙으로 그린다. 손으로 만든 6px 막대는 같은 화면의
                HP 바 옆에서 게이지로 안 읽혔고, 색도 HP 위험 단계와 같은 주황이었다. */}
            <StatBar value={monster.exp} max={monster.expToNextLevel} variant="exp" />

            {nextLearn && (
              <p className="mt-2 text-pixel-sm text-sand-300">
                Lv.{nextLearn.level} — <span className="font-bold text-sand-200">{nextLearn.move.name}</span> 습득
              </p>
            )}
            {evoTo && monster.evolvesAtLevel !== undefined && (
              <p className="mt-1 text-pixel-sm text-sand-300">
                Lv.{monster.evolvesAtLevel} — <span className="font-bold text-sand-200">{evoTo.name}</span>{josa(evoTo.name, "로")} 진화
              </p>
            )}
            {!nextLearn && !evoTo && (
              <p className="mt-2 text-pixel-sm text-earth-400">
                더 배울 기술도, 남은 진화도 없습니다.
              </p>
            )}
          </div>
        </div>

        {/* 보유 스킬 */}
        <div>
          <SectionLabel>보유 스킬 ({monster.moves.length})</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {monster.moves.map((mv) => {
              const mvAcc = TYPE_ACCENT[mv.type] ?? TYPE_ACCENT.normal;
              return (
                <div key={mv.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={boxStyle}>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-pixel-sm font-bold ${mvAcc.label}`}>
                    {TYPE_KO[mv.type] ?? mv.type}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-pixel-sm font-black text-cream-100">{mv.name}</p>
                    <p className="mt-0.5 text-pixel-sm text-earth-400">
                      {MOVE_CATEGORY_KO[mv.category] ?? mv.category}
                      {mv.statusEffect && ` · ${STATUS_KO[mv.statusEffect] ?? mv.statusEffect} ${mv.statusChance ?? 0}%`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-pixel-sm text-sand-200">위력 {mv.power === 0 ? "—" : mv.power}</p>
                    <p className="font-mono text-pixel-sm text-earth-400">명중 {mv.accuracy}%</p>
                  </div>
                </div>
              );
            })}
            {monster.moves.length === 0 && <EmptyValue>아직 배운 기술이 없습니다</EmptyValue>}
          </div>
        </div>
      </div>
      <ScrollFade />
      </div>
    </div>
  );
}

// ─── MonsterCard ────────────────────────────────────────────────────────────────
/**
 * 몬스터 카드. **정보만 담는다** — 조작은 상태창의 '관리' 한 벌뿐이다.
 *
 * `layout="row"` 은 파티 칸 전용이다. 세로로 쌓으면 한 장이 200px 을 넘어 세 마리가
 * 1280x900 화면에 안 들어갔다. 가로로 누이되 HP·공방속 줄은 **카드 전체 폭**을 쓴다 —
 * 그림 옆 글자 칸(146px)에 세 칸을 넣으면 한 칸이 46px 이라 "공 169" 부터 이미 넘친다.
 */
function MonsterCard({
  monster, size = "md", layout = "stack", selected, targetable, onClick, showStats = false,
  equipped = [], equipBonus = ZERO_EQUIP_BONUS, testId, className = "",
}: {
  monster: OwnedMonster; size?: "sm" | "md" | "lg";
  layout?: "stack" | "row";
  selected?: boolean;
  /** 교체가 걸려 있어 지금 누르면 자리가 바뀌는 카드 */
  targetable?: boolean;
  onClick: () => void; showStats?: boolean;
  equipped?: ArtifactInstance[]; equipBonus?: EquipStatBonus; testId?: string;
  /** 보관함 격자만 h-full 을 준다 — 파티 칸에서 늘리면 카드 밑에 빈 자리가 길게 남는다 */
  className?: string;
}) {
  const isFainted = monster.currentHp === 0;
  const acc       = TYPE_ACCENT[monster.type ?? "none"] ?? TYPE_ACCENT.normal;
  const imgSize   = size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-11 h-11";
  const row       = layout === "row";

  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={`relative flex w-full flex-col gap-1.5 overflow-hidden rounded-xl text-left transition-all ${className}`}
      style={{
        padding: size === "lg" ? "14px 10px" : "10px 8px",
        background: selected
          ? `linear-gradient(145deg, ${acc.bg}, ${rgba("shadow900", 0.9)})`
          : rgba("shadow900", 0.85),
        // 교체가 걸린 쪽은 **점선 강조**로 알린다. 예전에는 반대쪽을 45% 로 어둡게 눌렀는데,
        // 정작 눌러야 하는 게 그 어두워진 쪽이라 안내가 거꾸로였고 글자도 안 읽혔다.
        border: selected ? `1px solid ${acc.border}`
          : targetable ? `1px dashed ${PALETTE.ember500}`
            : `1px solid ${rgba("earth500", 0.45)}`,
        boxShadow: selected
          ? `0 0 20px ${acc.glow}, inset 0 0 12px ${rgba("shadow900", 0.4)}`
          : targetable ? `inset 0 0 12px ${rgba("ember500", 0.12)}`
            : `inset 0 0 8px ${rgba("shadow900", 0.3)}`,
        animation: selected ? "selectRing 2.2s ease-in-out infinite" : "none",
      } as React.CSSProperties}
    >
      {/* 이름줄: 가로 카드는 그림 옆에, 세로 카드는 그림 아래에 선다 */}
      <div className={`flex w-full min-w-0 gap-2.5 ${row ? "items-center" : "flex-col items-center"}`}>
        <div className="relative shrink-0">
          {selected && (
            <div className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${acc.glow}, transparent 65%)`,
                animation: "glowBreathe 2s ease-in-out infinite",
              }} />
          )}
          <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.nickname ?? monster.name}
            className={`${imgSize} relative object-contain`}
            style={{
              filter: isFainted ? "grayscale(.8) brightness(.6)"
                : selected ? `drop-shadow(0 0 8px ${acc.glow})` : "none",
            }} />
        </div>

        <div className={`min-w-0 ${row ? "flex-1" : "w-full text-center"}`}>
          <p className={`truncate font-black leading-tight text-cream-100 ${size === "sm" ? "text-pixel-sm" : "text-title-sm"}`}>
            {monster.nickname ?? monster.name}
          </p>
          <div className={`mt-0.5 flex flex-wrap items-center gap-1 ${row ? "" : "justify-center"}`}>
            <span className="text-pixel-sm font-bold text-sand-300">Lv.{monster.level}</span>
            <span className={`rounded-full border px-1 text-pixel-sm font-bold ${acc.label}`}
              style={{ paddingTop: 0, paddingBottom: 0 }}>
              {TYPE_KO[monster.type ?? "none"] ?? ""}
            </span>
            {/* 기절은 카드 전체를 덮는 오버레이였다 — 그 밑의 HP 숫자가 안 읽혔다.
                칩으로 내려 세우고, 흑백이 된 그림과 빈 HP 바가 같은 말을 거든다. */}
            {isFainted && (
              <span className="rounded-full border px-1 text-pixel-sm font-bold"
                style={{
                  borderColor: PALETTE.ember700,
                  background: rgba("ember700", 0.3),
                  color: PALETTE.ember500,
                }}>
                기절
              </span>
            )}
          </div>
        </div>
      </div>

      {/* HP 바는 카드에서 두 번째로 큰 요소여야 한다 (ART_DIRECTION 3-2) */}
      <div className="w-full">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-pixel-sm font-bold text-earth-400">HP</span>
          <span className="text-pixel-sm font-bold text-sand-200">{monster.currentHp}/{monster.maxHp}</span>
        </div>
        <StatBar value={monster.currentHp} max={monster.maxHp} height={10} />
      </div>

      {showStats && (
        // 카드는 **합계 하나만** 적는다. 예전엔 한 칸에 합계와 "+n" 을 같이 찍어 46px
        // 칸에서 옆 칸으로 흘렀다("공 169 +119 +속 124 +6"). 장비가 올려 준 값이라는
        // 사실은 색(moss)으로 알리고, 얼마인지는 상태창의 종합 능력치가 적는다.
        <div className="grid w-full grid-cols-3 gap-1">
          {([
            ["공", monster.attack, equipBonus.attack],
            ["방", monster.defense, equipBonus.defense],
            ["속", monster.speed, equipBonus.speed],
          ] as [string, number, number][]).map(([l, base, bonus]) => (
            <div key={l} className="flex items-center justify-center gap-1 rounded py-0.5"
              style={{ background: rgba("shadow900", 0.3) }}>
              <span className="text-pixel-sm text-earth-400">{l}</span>
              <span className={`text-pixel-sm font-bold ${bonus > 0 ? "text-moss-500" : "text-sand-200"}`}>
                {base + bonus}
              </span>
            </div>
          ))}
        </div>
      )}

      <EquipStrip items={equipped} align={row ? "start" : "center"} />
    </button>
  );
}

function EmptyPartySlot({ index, selected, targetable, onClick }: {
  index: number; selected?: boolean; targetable?: boolean; onClick: () => void;
}) {
  const lit = selected || targetable;
  return (
    <button onClick={onClick}
      className={`flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-dashed transition-all
        ${lit ? "border-2 border-ember-500 bg-ember-500/10" : "border border-earth-500/70 bg-shadow-700/40"}`}>
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-dashed
        ${lit ? "border-ember-500 bg-ember-500/15" : "border-earth-500/70"}`}>
        <span className={`text-pixel-md ${lit ? "text-ember-500" : "text-sand-300"}`}>+</span>
      </div>
      <span className={`text-pixel-sm font-semibold ${lit ? "text-ember-500" : "text-sand-300"}`}>
        슬롯 {index + 1}
      </span>
    </button>
  );
}

/**
 * 속성 필터·정렬 칩. 안 고른 쪽 글자가 cream 알파 .12~.14 라 사실상 안 보였다 —
 * 속성 필터가 몇 개 서 있는지조차 못 읽는 상태였다. 안 고른 쪽도 sand-300 으로 세운다.
 */
function FilterChip({ active, accent, onClick, children }: {
  active: boolean; accent?: { border: string; bg: string }; onClick: () => void; children: ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="rounded-full px-2.5 py-0.5 text-pixel-sm font-bold transition"
      style={{
        background: active ? (accent ? accent.bg : rgba("ember500", 0.17)) : rgba("shadow900", 0.6),
        border: `1px solid ${active ? (accent?.border ?? PALETTE.ember500) : rgba("earth500", 0.6)}`,
        color: active ? (accent?.border ?? PALETTE.ember500) : PALETTE.sand300,
      }}>
      {children}
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

  // 상태창에 세울 몬스터. 아무것도 안 골랐으면 **파티 첫 마리**가 선다 — 이 칸이 비면
  // 화면 가운데 320px 이 통째로 놀고, 이제 조작이 전부 여기 있어서 "무엇부터 눌러야
  // 하는지"까지 같이 사라진다.
  const [detailUid, setDetailUid] = useState<string | null>(null);
  const shownUid = detailUid ?? party[0]?.uid ?? null;
  const detailMonster = shownUid
    ? ([...party, ...storage].find((m) => m.uid === shownUid) ?? null)
    : null;
  const detailPartyIndex = detailMonster ? party.findIndex((m) => m.uid === detailMonster.uid) : -1;
  const detailInParty    = detailPartyIndex >= 0;

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
      setSelStorage(null); setSelParty(null); setDetailUid(selStorage); return;
    }
    if (selParty !== null && selParty !== idx) {
      swapPartySlots(selParty, idx); setSelParty(null); return;
    }
    if (selParty === idx) {
      setSelParty(null);
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
      setSelParty(null); setSelStorage(null); setDetailUid(uid); return;
    }
    if (selStorage === uid) {
      setSelStorage(null);
      return;
    }
    setSelStorage(uid);
    setDetailUid(uid);
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

  /** 상태창의 '파티에 넣기 / 보관함으로'. 슬롯 번호는 화면이 아니라 여기서 정한다. */
  const handleTogglePartySlot = () => {
    if (!detailMonster) return;
    if (detailInParty) {
      if (party.length <= 1) return;
      moveToStorage(detailPartyIndex);
    } else {
      if (party.length >= 3) return;
      moveToParty(detailMonster.uid);
    }
    setSelParty(null); setSelStorage(null);
  };

  // 헬퍼: 장착 목록 (카드의 아이콘 줄과 상태창의 장비 칸이 같은 값을 본다)
  const getEquipped = (uid: string): ArtifactInstance[] => equippedArtifacts[uid] ?? [];

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
    ? { icon: "storage", text: "보관함의 몬스터를 눌러 교체" }
    : selStorage !== null
      ? { icon: "party", text: "파티 슬롯을 눌러 교체하거나 추가" }
      : { icon: null, text: "몬스터를 누르면 가운데 상태창에서 관리한다" };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden text-cream-100">
      <GameBackground />
      <style>{MON_STYLES}</style>

      {/* ── 헤더 ── */}
      <header className="relative" style={{
        background: rgba("shadow900", 0.92),
        borderBottom: `1px solid ${rgba("earth500", 0.4)}`,
        boxShadow: `0 1px 0 ${rgba("ember500", 0.07)}`,
        flexShrink: 0,
      }}>
        <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${rgba("ember500", 0.36)},transparent)` }} />
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-4">
            <PixelButton variant="ghost" onClick={() => navigate("/")} className="whitespace-nowrap">
              ← 베이스캠프
            </PixelButton>
            <p className="text-title-sm font-black text-cream-100">내 몬스터</p>

            <div className="flex items-baseline gap-1.5 rounded-xl border border-earth-500/50 bg-shadow-900/70 px-3 py-1">
              <span className="text-pixel-sm text-sand-300">도감</span>
              <span className="text-title-sm font-black text-ember-500">{caughtCount}</span>
              <span className="text-pixel-sm text-sand-300">/ {catchableTotal}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 sm:flex">
              {[
                { label: "파티",   value: `${party.length}/3` },
                { label: "보관함", value: `${storage.length}/30` },
                ...(bestFloor > 0 ? [{ label: "최고층", value: `${bestFloor}F` }] : []),
              ].map((s) => (
                <div key={s.label} className="flex items-baseline gap-1.5">
                  <span className="text-pixel-sm text-sand-300">{s.label}</span>
                  <span className="text-pixel-sm font-black text-sand-200">{s.value}</span>
                </div>
              ))}
            </div>

            {/* 기절이 있으면 강조되고, 없어도 **읽히는** 버튼이어야 한다 —
                예전엔 평상시 글자색이 stone-600 이라 1.6:1 이었다. */}
            <PixelButton
              variant={faintedCount > 0 ? "nature" : "ghost"}
              onClick={handleRestore}
              className="relative overflow-hidden whitespace-nowrap">
              {restoreAnim && (
                <span className="absolute inset-0 rounded-lg"
                  style={{ background: rgba("moss500", 0.36), animation: "bubblePop .6s ease" }} />
              )}
              <span className="relative">
                {restoreAnim ? "회복 완료!" : faintedCount > 0 ? `HP 전회복 (${faintedCount}마리 기절)` : "파티 HP 전회복"}
              </span>
            </PixelButton>
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
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `1px solid ${rgba("earth500", 0.32)}` }}>
            <div>
              <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">PARTY</p>
              <p className="text-pixel-sm font-black text-sand-200">
                전투 파티 <span className="font-normal text-sand-300">({party.length}/3)</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 px-3 py-3 lg:flex-1 lg:overflow-y-auto">
            {[0, 1, 2].map((idx) => {
              const m = party[idx];
              return m ? (
                <MonsterCard key={m.uid} monster={m} size="md" layout="row"
                  testId={`party-card-${m.uid}`}
                  selected={selParty === idx || shownUid === m.uid}
                  targetable={selStorage !== null}
                  showStats
                  equipped={getEquipped(m.uid)}
                  equipBonus={getEquipBonus(m.uid)}
                  onClick={() => handlePartyClick(idx)} />
              ) : (
                <EmptyPartySlot key={`empty-${idx}`} index={idx}
                  selected={selParty === idx}
                  targetable={selStorage !== null}
                  onClick={() => handlePartyClick(idx)} />
              );
            })}
          </div>

          <div className="px-4 py-3" style={{ borderTop: `1px solid ${rgba("earth500", 0.32)}` }}>
            <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-center text-pixel-sm text-sand-300">
              {hint.icon && <PixelIcon name={hint.icon} size={16} />}
              <span>{hint.text}</span>
            </p>
          </div>
        </div>

        {/* 상태창 */}
        <MonsterStatusPanel
          monster={detailMonster}
          equipBonus={detailMonster ? getEquipBonus(detailMonster.uid) : undefined}
          equipped={detailMonster ? getEquipped(detailMonster.uid) : []}
          imprint={imprint}
          inParty={detailInParty}
          canAddToParty={!detailInParty && party.length < 3}
          canRemoveFromParty={detailInParty && party.length > 1}
          canRelease={!!detailMonster && (!detailInParty || party.length > 1)}
          onTogglePartySlot={handleTogglePartySlot}
          onOpenEquip={() => detailMonster && setEquipModalUid(detailMonster.uid)}
          onOpenImprint={setImprintKey}
          onRelease={() => detailMonster && handleRelease(detailMonster.uid)}
        />

        {/* 보관함 */}
        <div className="relative m-3 flex min-h-64 flex-1 flex-col overflow-hidden rounded-lg
          border-2 border-earth-500 bg-shadow-900/85">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3"
            style={{ borderBottom: `1px solid ${rgba("earth500", 0.32)}`, background: rgba("shadow900", 0.35) }}>
            <div className="mr-2">
              <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">STORAGE</p>
              <p className="text-pixel-sm font-black text-sand-200">
                보관함 <span className="font-normal text-sand-300">({storage.length}/30)</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-1">
              {["all", ...storageTypes].map((t) => (
                <FilterChip key={t} active={typeFilter === t}
                  accent={t === "all" ? undefined : TYPE_ACCENT[t]}
                  onClick={() => setTypeFilter(t)}>
                  {t === "all" ? "전체" : TYPE_KO[t] ?? t}
                </FilterChip>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-pixel-sm text-sand-300">정렬</span>
              {([["level", "레벨"], ["hp", "HP"], ["type", "속성"]] as [SortKey, string][]).map(([k, l]) => (
                <FilterChip key={k} active={sortBy === k} onClick={() => setSortBy(k)}>{l}</FilterChip>
              ))}
            </div>
          </div>

          <div className="p-3 lg:flex-1 lg:overflow-y-auto">
            {storage.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                <PixelIcon name="storage" size={64} className="opacity-40" />
                <div>
                  <p className="mb-1 font-bold text-sand-200">보관함이 비어 있습니다</p>
                  <p className="text-pixel-sm text-sand-300">
                    숲 탐험에서 몬스터를 포획하면<br />이곳에 자동으로 저장됩니다.
                  </p>
                </div>
              </div>
            ) : filteredStorage.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-center">
                <p className="text-pixel-sm text-sand-300">{TYPE_KO[typeFilter]} 속성 몬스터가 없습니다.</p>
              </div>
            ) : (
              <div className="grid gap-2 [grid-auto-rows:1fr]" style={{
                // 버튼을 걷어내기 전에는 셋(장착·각인·놓아주기)이 한 줄에 서야 해서 124px 이
                // 하한이었는데, 실제로는 150px 이 필요해 카드 밖으로 넘쳤다. 이제 카드에는
                // 글자와 게이지만 있으므로 "Lv.30 [전기]" 한 줄이 하한이다.
                gridTemplateColumns: "repeat(auto-fill, minmax(116px, 1fr))",
              }}>
                {filteredStorage.map((m, i) => (
                  // 등장 애니메이션은 겉의 칸이 맡는다 — 카드 자신의 animation 자리는
                  // 선택 링이 쓰고 있어서 둘을 같은 요소에 걸 수 없다.
                  <div key={m.uid} style={{ animation: `monIn .3s ease ${(i * 0.04).toFixed(2)}s both` }}>
                    <MonsterCard monster={m} size="sm" className="h-full"
                      testId={`storage-card-${m.uid}`}
                      selected={selStorage === m.uid || shownUid === m.uid}
                      targetable={selParty !== null}
                      equipped={getEquipped(m.uid)}
                      onClick={() => handleStorageClick(m.uid)} />
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
