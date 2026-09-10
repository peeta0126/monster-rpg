import type { ReactNode } from "react";

/** "X 제작대 사용하기" 같은 조작 안내 배지. 베이스캠프·공방·숲에서 같은 모양을 쓴다.
 *  상호작용 키는 게임 전체가 X 하나다 — 기본값을 바꾸려면 그 이유부터 적을 것. */
export function InteractionPrompt({
  keyLabel = "X",
  children,
}: {
  keyLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-earth-500/75 bg-shadow-900/94
      px-5 py-2.5 font-pixel text-pixel-sm text-sand-200 shadow-[0_0_28px_rgba(233,148,65,0.25)]">
      <span className="rounded bg-ember-500 px-2 py-0.5 text-pixel-sm font-black tracking-wider text-shadow-900">
        {keyLabel}
      </span>
      <span>{children}</span>
    </div>
  );
}
