import type { Objective } from "../nextObjective";

/** 화면 상단의 "지금 할 일" 한 줄. 목표가 없으면(엔딩 후) 아무것도 그리지 않는다. */
export function ObjectiveBanner({ objective }: { objective: Objective | null }) {
  if (!objective) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-earth-500/70 bg-shadow-900/90
        px-4 py-2 backdrop-blur">
        <span className="text-pixel-sm text-ember-500">◆</span>
        <span className="text-pixel-sm font-bold text-sand-200">{objective.text}</span>
        {objective.where && (
          <span className="text-pixel-sm text-earth-400">— {objective.where}</span>
        )}
      </div>
    </div>
  );
}
