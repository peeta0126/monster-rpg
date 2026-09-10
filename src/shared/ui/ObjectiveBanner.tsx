import type { Objective } from "../nextObjective";

/**
 * 화면 상단의 "지금 할 일" 한 줄. 목표가 없으면(엔딩 후) 아무것도 그리지 않는다.
 *
 * 자리는 `StageHud` 가 잡는다 — 창 위쪽이 아니라 그림 위쪽에 앉아야 한다.
 * 메뉴·조작 안내와 달리 이건 그림 위에 남는다. 장면을 보면서 읽는 줄이라 옆 띠로
 * 빼면 눈이 두 번 움직인다. 대신 좁은 화면에서 줄이 늘어나게 둔다.
 */
export function ObjectiveBanner({ objective }: { objective: Objective | null }) {
  if (!objective) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-gutter z-40 flex justify-center px-gutter"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-2.5 rounded-xl border
        border-earth-500/70 bg-shadow-900/90 px-4 py-2 backdrop-blur">
        <span className="text-pixel-sm text-ember-500">◆</span>
        <span className="break-keep text-pixel-sm font-bold text-sand-200">{objective.text}</span>
        {objective.where && (
          <span className="break-keep text-pixel-sm text-earth-400">— {objective.where}</span>
        )}
        {/* 걷지 않고 가는 길이 있으면 그쪽을 알려준다. 화면이 가리키는 길이 제일 먼
            길이면 안내가 아니라 함정이다 */}
        {objective.via && (
          <span className="break-keep rounded border border-mist-500/60 px-1.5 text-pixel-sm font-bold text-mist-300">
            {objective.via}
          </span>
        )}
      </div>
    </div>
  );
}
