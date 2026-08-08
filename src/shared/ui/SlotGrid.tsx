import { Children, type ReactNode } from "react";

interface SlotGridProps {
  /** 칸 하나의 최소 너비(px). 열 수는 여기에 맞춰 자동으로 정해진다 —
   *  열 수를 고정하면 태블릿 폭에서 칸이 뭉개진다. */
  minItemWidth: number;
  /** 내용이 적어도 최소 이만큼의 칸은 보여준다 */
  minSlots?: number;
  /** 빈 칸에 넣을 것 (기본: 점선 사각형) */
  emptySlot?: (index: number) => ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * 인벤토리·파티처럼 "칸"이 있는 목록. 내용이 0개여도 빈 칸이 보여야 인벤토리로 읽힌다.
 * 아무것도 안 그리면 화면이 고장 난 것처럼 보인다.
 */
export function SlotGrid({ minItemWidth, minSlots = 0, emptySlot, className = "", children }: SlotGridProps) {
  const filled = Children.toArray(children);
  const empties = Math.max(0, minSlots - filled.length);

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minItemWidth}px), 1fr))` }}
    >
      {filled}
      {Array.from({ length: empties }, (_, i) =>
        emptySlot
          ? <div key={`empty-${i}`}>{emptySlot(filled.length + i)}</div>
          : <EmptySlot key={`empty-${i}`} />,
      )}
    </div>
  );
}

/**
 * 기본 빈 칸. 채워진 슬롯과 높이가 같아야 그리드가 흔들린다.
 * 높이는 호출부가 정한다 — 카드 모양이 화면마다 달라서 여기서 고정하면 맞지 않는다.
 */
export function EmptySlot({ children, className = "min-h-28" }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border border-dashed
        border-earth-500/60 bg-shadow-900/50 ${className}`}
    >
      {children}
    </div>
  );
}
