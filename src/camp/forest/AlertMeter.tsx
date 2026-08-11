import { PALETTE, rgba } from "../../shared/palette";
import { ALERT_BANDS, ALERT_MAX, alertBand } from "./alert";

/**
 * 소란도 게이지. 탐험 중 화면 상단에 늘 떠 있다.
 *
 * 숫자만 띄우면 "지금 어느 구간인가"가 안 읽힌다 — 배수와 위험이 바뀌는 건 구간
 * 단위라서, 구간 경계를 눈금으로 그어 두고 지금 칸을 이름으로 말해 준다.
 * 이게 플레이어가 다이얼을 돌릴 때 보는 유일한 계기판이다.
 */
export function AlertMeter({ value }: { value: number }) {
  const band = alertBand(value);
  const pct = Math.min(100, (value / ALERT_MAX) * 100);

  // 구간이 오를수록 붉어진다. 조용함만 서늘한 쪽(mist)에 둔다.
  const color =
    band.id === "calm"   ? PALETTE.mist300 :
    band.id === "stir"   ? PALETTE.sand200 :
    band.id === "wary"   ? PALETTE.ember500 :
                           PALETTE.ember700;

  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-1.5 backdrop-blur"
      style={{ background: rgba("shadow900", 0.85), border: `1px solid ${rgba("stone600", 0.8)}` }}
      data-testid="forest-alert"
      data-alert={value}
      data-band={band.id}
    >
      <span className="text-pixel-sm text-earth-400">소란</span>

      <div className="relative h-2 w-24 overflow-hidden rounded-full bg-shadow-700">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
        {/* 구간 경계 눈금 — 다음 칸까지 얼마나 남았는지가 이걸로만 보인다 */}
        {ALERT_BANDS.slice(1).map((b) => (
          <div
            key={b.id}
            className="absolute top-0 h-full"
            style={{ left: `${(b.min / ALERT_MAX) * 100}%`, width: 1, background: rgba("shadow900", 0.9) }}
          />
        ))}
      </div>

      <span className="text-pixel-sm font-bold" style={{ color }}>{band.label}</span>
      <span className="font-mono text-pixel-sm text-sand-300">{value}</span>
    </div>
  );
}
