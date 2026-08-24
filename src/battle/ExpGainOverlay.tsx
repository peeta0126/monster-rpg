import { useBattleSettings } from "../shared/battleSettings";
import type { ExpPlaybackView } from "./expPlayback";
import type { StatGains } from "./expTimeline";
import { StatBar } from "../shared/ui";

/**
 * 레벨업 카드.
 *
 * 레벨이 올랐을 때만 뜬다. 원래는 승리할 때마다 화면을 통째로 덮었는데, 잡몹 한
 * 마리에 전면 창이 뜨는 건 성장을 보여주는 게 아니라 진행을 끊는 거였다. 그냥
 * 들어오는 경험치는 하단 상태 줄 바가 차오르는 걸로 충분하고, 여기서만 멈춰 선다.
 *
 * 올라간 스탯이 이 창이 있는 이유다. 그건 상태 줄 한 칸에 못 넣는다.
 */

const GAIN_ROWS: [keyof StatGains, string][] = [
  ["maxHp", "HP"], ["attack", "공격"], ["defense", "방어"], ["speed", "속도"],
];

export function ExpGainOverlay({
  view, onAdvance,
}: {
  view: ExpPlaybackView;
  onAdvance: () => void;
}) {
  const { autoAdvance } = useBattleSettings();
  const card = view.card;
  if (!card) return null;

  return (
    <div
      data-testid="exp-gain"
      className="absolute inset-0 z-[55] flex items-center justify-center bg-shadow-900/75 px-4"
      onClick={onAdvance}
    >
      <div className="w-full max-w-sm border-2 border-moss-500 bg-shadow-900/95 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-pixel-sm font-bold text-cream-100">{view.name}</span>
          <span className="text-pixel-sm text-sand-300">Lv.{card.level}</span>
        </div>

        {/* 바는 가득 찬 채로 선다. 상태 줄의 바와 같은 부품·같은 색이다 */}
        <StatBar value={1000} max={1000} variant="exp" fillMs={0} />

        <p className="mt-2 text-center text-pixel-sm text-moss-500">
          경험치 +{view.gained}
        </p>

        <div data-testid="exp-levelup" className="mt-3 border border-moss-500 bg-moss-500/12 p-3">
          <p className="mb-2 text-center text-pixel-sm font-bold text-moss-500">
            레벨 {card.level} 달성!
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {GAIN_ROWS.map(([key, label]) => (
              <div key={key} className="flex items-baseline justify-between">
                <span className="text-pixel-sm text-sand-300">{label}</span>
                <span className="text-pixel-sm font-bold text-cream-100">+{card.gains[key]}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-center text-pixel-sm text-earth-400">
          {autoAdvance ? "자동 진행 중 · Space 건너뛰기" : "Q / 클릭 진행 · Space 건너뛰기"}
        </p>
      </div>
    </div>
  );
}
