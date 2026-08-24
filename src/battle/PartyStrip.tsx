import { StatBar } from "../shared/ui";
import { MONSTER_IMAGE_MAP } from "../monster/monsterImages";
import { statusLabel, STATUS_META } from "./statusInfo";
import { PixelIcon } from "../shared/ui/PixelIcon";
import type { StatusEffect } from "../shared/game";

/**
 * 파티 세 칸.
 *
 * 원래는 마우스로만 누를 수 있었다. 키보드로 전투를 시작해도 교체 한 번에 손이
 * 마우스로 갔다는 얘기고, 조작 계통이 둘로 갈라져 있었다는 뜻이다. 지금은 커맨드에서
 * ← 를 누르면 이 구역으로 넘어오고, 여기서 ↑↓ 랑 Enter 로 교체까지 끝난다.
 *
 * 교체는 한 턴을 쓴다. 커맨드 한 칸을 차지하는 대신 이 구역이 곧 명령이라,
 * 대상 고르기가 그대로 실행이고 한 단계가 준다.
 */

export interface PartyMemberView {
  uid: string;
  id: string;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  status: StatusEffect;
  statusTurns: number;
  isActive: boolean;
  /** 기절해 있는가 */
  fainted: boolean;
}

export interface PartyStripProps {
  members: PartyMemberView[];
  /** 이 구역에 포커스가 있는가 */
  focused: boolean;
  cursor: number;
  /** 기절해서 반드시 골라야 하는 상황 */
  mustPick: boolean;
  disabled: boolean;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
}

export function PartyStrip({
  members, focused, cursor, mustPick, disabled, onHover, onSelect,
}: PartyStripProps) {
  return (
    <div
      data-testid="party-strip"
      className={`flex w-rail shrink-0 flex-col gap-1.5 border-r p-2 transition-colors ${
        focused ? "border-mist-500/70 bg-mist-500/5" : "border-shadow-700"}`}
    >
      <p className="text-pixel-sm font-semibold uppercase tracking-wider text-earth-400">
        파티 {mustPick && <span className="text-mist-300">— 선택</span>}
      </p>

      {members.map((m, i) => {
        const selectable = !m.fainted && !m.isActive && !disabled;
        const onCursor = focused && i === cursor;
        return (
          <button
            key={m.uid}
            type="button"
            data-testid={`party-${i}`}
            data-active={m.isActive ? "1" : undefined}
            disabled={!selectable}
            onMouseEnter={() => onHover(i)}
            onClick={() => selectable && onSelect(i)}
            className={[
              "relative flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-left transition-all",
              m.isActive && "border-ember-500/70 bg-ember-700/10",
              m.fainted && "cursor-not-allowed border-shadow-700 bg-shadow-800/10 opacity-40",
              !m.isActive && !m.fainted && "border-stone-600 bg-shadow-800/40",
              mustPick && selectable && "border-mist-500 bg-mist-500/10",
              // 커서는 색 말고 밝기와 테두리로 준다. 색약에서도 보이게 (ART_DIRECTION 3-2)
              onCursor && "brightness-125 outline outline-2 outline-mist-300",
            ].filter(Boolean).join(" ")}
          >
            <div className="relative shrink-0">
              <img
                src={MONSTER_IMAGE_MAP[m.id]}
                alt={m.name}
                className="h-9 w-9 object-contain"
                style={m.fainted ? { filter: "grayscale(100%) brightness(0.4)" } : undefined}
              />
              {m.isActive && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-ember-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-pixel-sm font-semibold leading-tight text-sand-200">
                {onCursor && <span className="mr-1 text-mist-300">▶</span>}{m.name}
              </p>
              <p className="text-pixel-sm leading-tight text-earth-400">Lv.{m.level}</p>
              {/* 8px — 같은 화면의 경험치 바보다 얇아지면 생존보다 성장이 커 보인다 */}
              <StatBar value={m.currentHp} max={m.maxHp} height={8} className="mt-0.5" />
              <p className="font-mono text-pixel-sm text-earth-400">{m.currentHp}/{m.maxHp}</p>
              {m.status && (
                <p className="flex items-center gap-1 text-pixel-sm text-ember-500">
                  <PixelIcon name={STATUS_META[m.status].icon} size={16} />
                  {statusLabel(m.status)} {m.statusTurns > 0 ? `${m.statusTurns}턴` : ""}
                </p>
              )}
            </div>

            <span className="shrink-0 text-pixel-sm">
              {m.isActive ? <span className="font-bold text-ember-500">출전</span>
                : m.fainted ? <span className="text-earth-400">기절</span>
                : <span className="text-sand-300">교체</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
