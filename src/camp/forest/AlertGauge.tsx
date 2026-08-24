import { rgba } from "../../shared/palette";
import { ALERT_BANDS, ALERT_MAX, alertBand, bandColor } from "./alert";

/**
 * 소란도 계기판. 탐험 중 화면 우상단에 늘 떠 있다.
 *
 * 숫자만 띄우면 지금 어느 구간인지가 안 읽힌다. 배수랑 위험이 바뀌는 게 구간
 * 단위라서, 구간 경계를 눈금으로 그어 두고 지금 칸을 이름으로 말해 준다.
 * 플레이어가 다이얼을 돌릴 때 보는 유일한 계기판이다.
 */

export function AlertGauge({ value }: { value: number }) {
  const band = alertBand(value);
  const color = bandColor(value);

  return (
    <div
      className="flex items-center gap-2"
      data-testid="forest-alert"
      data-alert={value}
      data-band={band.id}
    >
      <div className="text-right">
        <p className="text-pixel-sm text-sand-300" style={{ textShadow: `0 1px 3px ${rgba("shadow900", 0.9)}` }}>
          소란도
        </p>
      </div>

      <div className="relative h-3 w-40 overflow-hidden rounded-sm border"
        style={{ borderColor: rgba("stone600", 0.9), background: rgba("shadow900", 0.75) }}>
        <div className="h-full transition-all duration-300"
          style={{ width: `${Math.min(100, (value / ALERT_MAX) * 100)}%`, background: color }}/>
        {/* 구간 경계. 다음 칸까지 얼마나 남았는지가 이걸로만 보인다 */}
        {ALERT_BANDS.slice(1).map((b) => (
          <div key={b.id} className="absolute top-0 h-full"
            style={{ left: `${(b.min / ALERT_MAX) * 100}%`, width: 1, background: rgba("shadow900", 0.9) }}/>
        ))}
      </div>

      <span className="w-6 font-mono text-pixel-sm font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

/** 지금 구간이 무엇을 바꾸는지 한 줄로. 하단 바에 깔린다 */
export function AlertBandSummary({ value }: { value: number }) {
  const band = alertBand(value);
  const color = bandColor(value);
  const parts = [
    `재료 +${Math.round((band.materialMul - 1) * 100)}%`,
    `희귀 +${Math.round(band.rareBonus * 100)}%`,
    band.catchPenalty > 0 ? `포획 -${Math.round(band.catchPenalty * 100)}%p` : null,
    band.intruderChance > 0 ? "강적 난입 가능" : null,
  ].filter(Boolean);

  return (
    <p className="text-pixel-sm text-sand-300">
      <span className="font-bold" style={{ color }}>소란도 {value} · {band.label} 구간</span>
      {parts.length > 0 && <span className="ml-2 text-earth-400">{parts.join("  ")}</span>}
    </p>
  );
}
