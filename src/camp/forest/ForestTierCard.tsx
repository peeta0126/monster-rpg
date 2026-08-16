import { monsters } from "../../monster/monsters";
import { ELEMENT_CHIP_CLASS, ELEMENT_KO, rgba } from "../../shared/palette";
import { unlockLabel, type ForestArea } from "./areas";
import { encounterLevelRange } from "./catchLevel";
import { PixelIcon } from "../../shared/ui/PixelIcon";

type ElementId = keyof typeof ELEMENT_CHIP_CLASS;

const isElement = (t: string): t is ElementId => t in ELEMENT_CHIP_CLASS;

const chipClass = (t: string) =>
  isElement(t) ? ELEMENT_CHIP_CLASS[t] : ELEMENT_CHIP_CLASS.normal;

const chipLabel = (t: string) => (isElement(t) ? ELEMENT_KO[t] : t);

/** 3-3 규칙: 상태 전환은 200ms 안에 끝난다. */
const STATE_MS = 180;

const CARD_STYLES = `
.tier-card { transition: transform ${STATE_MS}ms ease-out, filter ${STATE_MS}ms ease-out,
             opacity ${STATE_MS}ms ease-out, border-color ${STATE_MS}ms ease-out,
             box-shadow ${STATE_MS}ms ease-out; }
@media (prefers-reduced-motion: reduce) { .tier-card { transition: none; } }
`;

/** 고대 숲은 속성을 숨긴다. 칸 수는 그대로 셋 — 비면 카드가 헐거워 보인다. */
const HIDDEN_TYPES = ["?", "?", "?"];

function monsterTypes(area: ForestArea): string[] {
  if (!area.revealTypes) return HIDDEN_TYPES;
  return [...new Set(area.monsterPool.map((id) => monsters.find((m) => m.id === id)?.type ?? "normal"))];
}

/**
 * 구역 카드 한 장. 상태는 셋이다 — 선택됨 / 물러남 / 잠김.
 *
 * 선택된 것과 아닌 것을 최대한 벌린다(Balatro·Darkest Dungeon 의 선택 화면). 크기 75%,
 * 채도 40%, 부가 정보 제거까지 한꺼번에 걸어야 "지금 이걸 고르고 있다"가 한눈에 읽힌다.
 * 흑백으로 바꿔도 크기·테두리 굵기·버튼 유무로 구분이 남는다 — 색만으로 가르지 않는다.
 *
 * 잠긴 구역에 회색 버튼을 두지 않는 이유: 눌리지 않는 버튼은 화면이 고장난 것처럼 읽힌다.
 * 버튼이 있던 자리에 해금 조건을 그대로 넣으면 같은 공간이 답을 준다.
 */
export function ForestTierCard({
  area, selected, locked, lockReason = "floor", bestFloor, capLevel, onSelect, onEnter,
}: {
  area: ForestArea;
  selected: boolean;
  locked: boolean;
  bestFloor: number;
  /** 파티 최고 레벨 — 숲이 내주는 레벨의 천장이다 */
  capLevel: number;
  /** 왜 잠겼는가. 층수가 모자란 것과 파티가 빈 것은 답이 다르다 */
  lockReason?: "floor" | "no-party";
  onSelect: () => void;
  onEnter: () => void;
}) {
  const range = encounterLevelRange(area, capLevel);
  const types = monsterTypes(area);
  const accent = area.accentColor;
  // 잠긴 구역에는 티어 강조색을 쓰지 않는다. 색이 곧 "갈 수 있다"는 신호라,
  // 이름만 회색이고 레벨·부제는 강조색이면 어느 쪽이 맞는 말인지 모르게 된다.
  const nameColor = locked ? "var(--color-sand-300)" : accent;

  return (
    <button
      type="button"
      data-testid={`forest-tier-${area.id}`}
      data-selected={selected ? "1" : "0"}
      data-locked={locked ? "1" : "0"}
      aria-current={selected ? "true" : undefined}
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={locked ? onSelect : onEnter}
      className="tier-card relative w-full overflow-hidden border-2 text-left"
      style={{
        // 선택된 카드만 원래 크기. 나머지는 물러나 보이도록 줄이고 채도를 뺀다.
        transform: selected ? "scale(1)" : "scale(.75)",
        filter: selected ? undefined : "saturate(.6)",
        opacity: selected ? 1 : 0.92,
        borderColor: locked ? rgba("stone600", 0.9) : selected ? accent : rgba("stone600", 0.8),
        borderWidth: selected ? 4 : 2,
        borderRadius: 0,
        boxShadow: selected && !locked ? `5px 5px 0 ${area.glowColor}` : "none",
        // 배경 원화 위에 얹히므로 카드 판을 충분히 덮어야 본문이 4.5:1 을 넘는다.
        // 색은 거의 shadow-900 하나로 간다 — 판에 색을 넣으면 뒤의 원화와 싸운다.
        background: selected
          ? `linear-gradient(160deg, ${rgba("shadow900", 0.92)} 0%, ${rgba("shadow900", 0.86)} 100%)`
          : rgba("shadow900", 0.85),
        cursor: locked ? "default" : "pointer",
      }}
    >
      <style>{CARD_STYLES}</style>

      <div className="relative z-10 flex gap-4 p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* 영문 서브타이틀은 선택된 카드에서만. 항상 띄우면 한글 이름과 자리를 다툰다. */}
          {/* 부제·라벨은 강조색을 쓰지 않는다. moss-500 은 12px 글자로 쓰면 얕은 숲
              카드(가장 밝은 원화 위)에서 4.2:1 까지 떨어진다 — 큰 글자와 테두리·버튼
              채움에만 남기고, 작은 글자는 sand 계열로 뺀다. */}
          {selected && (
            <span className="text-pixel-sm font-bold tracking-widest text-sand-300">
              {area.subtitle}
            </span>
          )}
          <h3 className="text-pixel-md font-black" style={{ color: nameColor }}>
            {locked && <PixelIcon name="lock" size={16} className="mr-1.5 inline-block align-middle" />}
            {area.name}
          </h3>
          {selected && (
            <p className="text-pixel-sm leading-relaxed text-sand-200">{area.description}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {types.map((t, i) => (
              <span key={`${t}-${i}`}
                className={`border px-2 py-0.5 text-pixel-sm font-bold ${chipClass(t)}`}
                style={{ borderRadius: 0, fontFamily: "var(--font-pixel)" }}>
                {chipLabel(t)}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* ★ 등급 대신 레벨 숫자를 크게. 추상 등급보다 구체적인 숫자가 세다. */}
          <p className="text-pixel-sm uppercase tracking-wider text-sand-300">레벨</p>
          <p className="text-pixel-md font-black leading-none" style={{ color: nameColor }}>
            {area.levelRange[0]}–{area.levelRange[1]}
          </p>
          {selected && !locked && (
            <p className="text-pixel-sm text-sand-300">
              {range ? `만나는 레벨 ${range[0]}–${range[1]}` : "지금은 재료만"}
            </p>
          )}
        </div>
      </div>

      {selected && !locked && (
        <div className="relative z-10 border-t px-5 py-2 text-pixel-sm font-bold text-sand-200"
          style={{ borderColor: rgba("stone600", 0.7), background: rgba("shadow900", 0.45) }}>
          {area.recommendedText}
        </div>
      )}

      {/* 액션 자리 — 잠겼으면 죽은 버튼 대신 해금 조건이 이 칸을 차지한다. */}
      {locked ? (
        <div className="relative z-10 border-t px-5 py-3 text-center"
          style={{ borderColor: rgba("stone600", 0.9), background: rgba("shadow900", 0.92) }}>
          {lockReason === "no-party" ? (
            <>
              <p className="text-pixel-sm font-bold text-cream-100">함께 갈 몬스터가 없다</p>
              <p className="text-pixel-sm text-sand-200">마을 안쪽의 이장에게 먼저 들르자</p>
            </>
          ) : (
            <>
              <p className="text-pixel-sm font-bold text-cream-100">{unlockLabel(area)}</p>
              <p className="text-pixel-sm text-sand-200">현재 최고 층: {bestFloor}층</p>
            </>
          )}
        </div>
      ) : selected ? (
        <div className="relative z-10 px-5 pb-5">
          <div className="px-4 py-2 text-center text-pixel-sm font-black"
            style={{
              background: accent,
              color: rgba("shadow900", 1),
              border: `2px solid ${accent}`,
              borderRadius: 0,
              boxShadow: `3px 3px 0 ${rgba("shadow900", 0.6)}`,
              fontFamily: "var(--font-pixel)",
            }}>
            탐험하기 →
          </div>
        </div>
      ) : null}
    </button>
  );
}
