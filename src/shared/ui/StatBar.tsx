import { PALETTE, hpToken, isHpDanger } from "../palette";

type StatBarVariant = "hp" | "mp" | "exp";

/**
 * 굵기는 종류가 정한다. HP 가 화면에서 제일 큰 게이지여야 하므로 경험치는 한 단계 얇다.
 * 6px 은 배경 테두리에 먹혀 안 보였고, HP 와 같은 12px 은 성장이 생존보다 커 보였다.
 */
const BAR_HEIGHT: Record<StatBarVariant, number> = { hp: 12, mp: 12, exp: 8 };

/** 채워지는 데 걸리는 기본 시간(ms). 경험치 연출은 여기에 자기 값을 넣는다. */
const FILL_MS = 300;

/**
 * 채워진 부분의 색.
 * hp 만 잔량에 따라 3단계로 바뀐다(ART_DIRECTION 3-2). 그래서 경험치는 변하지 않는
 * 단색이어야 한다. 둘 다 변하면 뭐가 줄고 뭐가 느는지 색으로 구분이 안 된다.
 * mist300 은 HP 3단계(moss500·ember500·ember700) 어디와도 안 겹치는 유일한 밝은 색이다.
 */
function fillColor(variant: StatBarVariant, pct: number): string {
  if (variant === "hp")  return PALETTE[hpToken(pct)];
  if (variant === "mp")  return PALETTE.mist500;
  return PALETTE.mist300;
}

/** HP/MP/경험치 게이지. 전투에서 가장 자주 보는 정보라 기본 높이를 넉넉히 잡았다. */
export function StatBar({
  value,
  max,
  variant = "hp",
  height,
  fillMs = FILL_MS,
  showNumbers = false,
  className = "",
}: {
  value: number;
  max: number;
  variant?: StatBarVariant;
  height?: number;
  /** 채워지는 데 걸리는 시간(ms). 0 이면 즉시 */
  fillMs?: number;
  showNumbers?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  // 위험 구간에서 느리게 맥박쳐 "위험"을 색이 아닌 움직임으로도 알린다.
  // 경계는 palette 한 곳에서 온다. 전투 캔버스의 몬스터 경고와 같은 순간에 켜져야 한다.
  const critical = variant === "hp" && isHpDanger(pct);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* 홈. 테두리가 stone600 이라 어떤 판 위에 놓여도 바의 시작과 끝이 보인다.
          예전엔 테두리가 shadow900 이라 같은 색 패널 위에서 사라졌고, 그러면 빈 칸이
          어디까지인지 몰라서 "반 남았다"가 "거의 없다"처럼 보였다. */}
      <div
        className="relative flex-1 overflow-hidden rounded-full border border-stone-600 bg-shadow-900"
        style={{ height: height ?? BAR_HEIGHT[variant] }}
      >
        <div
          className={`relative h-full rounded-full transition-[width] motion-reduce:transition-none ${
            critical ? "animate-pulse" : ""}`}
          style={{
            width: `${pct}%`,
            backgroundColor: fillColor(variant, pct),
            transitionDuration: `${fillMs}ms`,
          }}
        >
          {/* 윗면 광택 한 줄. 채워진 곳만 도드라져서 홈과 구분된다 */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-full bg-cream-100/25" />
          {/* 지금 값이 짚이는 자리. 8px 바에서는 색 경계만으로 눈금을 못 읽는다 */}
          {pct > 0 && (
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px bg-cream-100/70" />
          )}
        </div>
      </div>
      {showNumbers && (
        <span className="shrink-0 font-mono text-pixel-sm font-bold text-sand-200">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
