import { PALETTE, hpToken, isHpDanger } from "../palette";

type StatBarVariant = "hp" | "mp" | "exp";

/** 채워진 부분의 색. hp만 잔량에 따라 3단계로 바뀐다 (ART_DIRECTION 3-2). */
function fillColor(variant: StatBarVariant, pct: number): string {
  if (variant === "hp")  return PALETTE[hpToken(pct)];
  if (variant === "mp")  return PALETTE.mist300;
  return PALETTE.sand300;
}

/** HP/MP/경험치 게이지. 전투에서 가장 자주 보는 정보라 기본 높이를 넉넉히 잡았다. */
export function StatBar({
  value,
  max,
  variant = "hp",
  height = 12,
  showNumbers = false,
  className = "",
}: {
  value: number;
  max: number;
  variant?: StatBarVariant;
  height?: number;
  showNumbers?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  // 위험 구간에서 느리게 맥박쳐 "위험"을 색이 아닌 움직임으로도 알린다.
  // 경계는 palette 한 곳에서 온다 — 전투 캔버스의 몬스터 경고와 같은 순간에 켜져야 한다.
  const critical = variant === "hp" && isHpDanger(pct);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="flex-1 overflow-hidden rounded-full border border-shadow-900 bg-shadow-700"
        style={{ height }}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${critical ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%`, backgroundColor: fillColor(variant, pct) }}
        />
      </div>
      {showNumbers && (
        <span className="shrink-0 font-mono text-pixel-sm font-bold text-sand-200">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
