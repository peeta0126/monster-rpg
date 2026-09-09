import { Children, type ReactNode } from "react";

interface SlotGridProps {
  /** 칸 하나의 최소 너비(px). 열 수는 여기에 맞춰 알아서 정해진다.
   *  열 수를 고정하면 태블릿 폭에서 칸이 뭉개진다 */
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
/** 칸 폭이 열 수를 정한다. 열 수를 박으면 태블릿 폭에서 칸이 뭉개진다 */
function slotGridColumns(minItemWidth: number): string {
  return `repeat(auto-fill, minmax(min(100%, ${minItemWidth}px), 1fr))`;
}

/**
 * 격자 한 줄을 통째로 쓰면서, 안의 내용은 **정확히 한 칸 폭**으로 `after` 번째 칸 아래에 놓는다.
 *
 * 칸 아래에 딸려 나오는 것(가방의 개수 슬라이더)에 쓴다. 순진하게 하면 둘 다 틀린다 —
 * `gridColumn: 1 / -1` 에 내용을 그냥 넣으면 칸 다섯 개만큼 길어지고, 한 칸짜리 항목으로
 * 넣으면 자동 배치가 **자기 칸의 오른쪽**에 붙인다(아래가 아니다).
 *
 * 그래서 같은 열 규칙을 가진 격자를 한 겹 더 깔고, 앞에 높이 0 인 자리를 `after` 개
 * 넣는다. 열 수가 같으니 상자가 그 칸과 같은 열에 떨어지고, 폭도 저절로 한 칸이 된다 —
 * 열 수도 폭도 px 로 다시 적을 필요가 없다(`auto-fill` 이라 어차피 알 수 없다).
 * 줄 간격을 0 으로 두는 것이 조건이다. 안 그러면 접힌 빈 줄마다 간격이 쌓인다.
 *
 * 열이 맞아야 하는 이유는 상자에 이름이 없어서다. 어느 칸의 개수인지는 **위에 무엇이
 * 있는가**로만 읽힌다.
 */
export function SlotGridRow({
  minItemWidth,
  after = 0,
  children,
}: {
  minItemWidth: number;
  /** 이 상자가 딸린 칸의 순번(보이는 칸들 중에서). 그 칸과 같은 열에 놓인다 */
  after?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className="grid gap-x-2"
      style={{ gridColumn: "1 / -1", gridTemplateColumns: slotGridColumns(minItemWidth), rowGap: 0 }}
    >
      {Array.from({ length: after }, (_, i) => <div key={`skip-${i}`} style={{ height: 0 }} />)}
      {children}
    </div>
  );
}

export function SlotGrid({ minItemWidth, minSlots = 0, emptySlot, className = "", children }: SlotGridProps) {
  const filled = Children.toArray(children);
  const empties = Math.max(0, minSlots - filled.length);

  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: slotGridColumns(minItemWidth) }}
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
 * 기본 빈 칸. 채워진 슬롯과 높이가 같아야 그리드가 안 흔들린다.
 * 높이는 호출부가 정한다. 카드 모양이 화면마다 달라서 여기서 고정하면 안 맞는다.
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
