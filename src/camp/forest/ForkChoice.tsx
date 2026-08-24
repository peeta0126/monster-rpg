import { rgba } from "../../shared/palette";
import { TIER_COLOR, scoutStep, type ForestStepKind } from "./steps";
import type { ScoutLevel } from "./alert";

/**
 * 갈림길. 카드 두 장을 나란히 놓는다.
 *
 * 그래프를 그리지 않는 이유는 노드 맵을 걷어낸 이유와 같다 — 여러 걸음 앞을 계획할
 * 게 아니라 지금 두 갈래 중 하나를 고르는 것뿐이다. 지도가 할 일이 없다.
 *
 * 카드는 정찰 등급과 무관하게 **언제나 두 장**이다. 가려지는 건 내용뿐이라,
 * 소란이 높으면 "무엇을 고르는지 모른 채 골라야 하는" 상태가 그대로 그림이 된다.
 */
export function ForkChoice({ kinds, names, depth, scout, onChoose }: {
  kinds: [ForestStepKind, ForestStepKind];
  names: [string, string];
  depth: number;
  scout: ScoutLevel;
  onChoose: (kind: ForestStepKind) => void;
}) {
  return (
    <div className="flex w-full max-w-stage flex-col items-center gap-4"
      style={{ animation: "fadeInScale .35s ease both" }}
      data-testid="forest-fork">
      <p className="text-title-sm font-black text-cream-100"
        style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
        길이 두 갈래로 나뉜다
      </p>

      <div className="grid w-full grid-cols-2 gap-4">
        {kinds.map((kind, i) => {
          const info = scoutStep(kind, depth, scout);
          const tint = TIER_COLOR[info.tier];
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl px-5 py-4 backdrop-blur"
              style={{
                background: rgba("shadow900", 0.82),
                border: `1px solid ${tint}55`,
                boxShadow: `0 8px 32px ${rgba("shadow900", 0.6)}`,
              }}>
              <div className="min-h-16">
                <p className="text-pixel-sm font-black text-cream-100">{names[i]}</p>
                <p className="mt-1.5 text-pixel-sm" style={{ color: tint }}>{info.title}</p>
                {info.detail !== "???" && (
                  <p className="text-pixel-sm text-sand-300">{info.detail}</p>
                )}
                <p className="mt-1 text-pixel-sm text-earth-400">{info.alertText}</p>
              </div>

              <button
                type="button"
                onClick={() => onChoose(kind)}
                data-testid={`forest-fork-${i}`}
                className="w-full rounded-xl py-2.5 text-pixel-sm font-black transition active:scale-95"
                style={{ background: tint, color: rgba("shadow900", 1) }}
              >
                이 길로
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
