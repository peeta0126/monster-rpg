import type { ElementType } from "../shared/game";
import { ELEMENT_ORDER } from "./typeChart";
import { getTypeMultiplier } from "./battleUtils";
import { elementChip } from "../shared/palette";

/**
 * 속성 상성표.
 *
 * 값은 typeChart 를 그대로 읽는다 — 정확히는 전투가 쓰는 getTypeMultiplier 를 칸마다
 * 부른다. 표를 손으로 옮겨 적으면 상성을 고친 날 화면만 옛말을 한다.
 * 순서도 typeChart 의 선언 순서(ELEMENT_ORDER)를 따르므로 속성을 추가하면 저절로 늘어난다.
 *
 * 전투를 멈추지 않는다. 패널 위에 떠서 캔버스를 가릴 뿐이고, 열어 둔 채로 기술을 골라도 된다.
 */

/** 1배는 점으로 둔다. 49칸을 전부 숫자로 채우면 정작 약점이 안 보인다. */
function cellText(mult: number): string {
  return mult === 1 ? "·" : `×${mult}`;
}

function cellClass(mult: number): string {
  if (mult > 1) return "bg-moss-500/25 text-cream-100 font-bold";
  if (mult < 1) return "bg-ember-700/25 text-ember-500 font-bold";
  return "text-earth-400";
}

export function TypeChartPanel({
  enemyType, onClose,
}: {
  /** 지금 상대의 속성. null(오름)이면 강조할 줄이 없다 */
  enemyType: ElementType | null;
  onClose: () => void;
}) {
  return (
    <div
      data-testid="type-chart"
      className="w-max border-2 border-earth-500 bg-shadow-900/95 p-2 shadow-2xl"
    >
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <p className="text-pixel-sm font-bold text-sand-300">
          속성 상성 <span className="font-normal text-earth-400">세로 공격 · 가로 방어</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          data-testid="type-chart-close"
          className="border border-earth-500/70 px-1.5 text-pixel-sm text-sand-300 transition hover:text-cream-100"
        >
          T 닫기
        </button>
      </div>

      <table className="border-collapse">
        <thead>
          <tr>
            <th className="w-11" />
            {ELEMENT_ORDER.map((def) => {
              const on = def === enemyType;
              return (
                <th
                  key={def}
                  data-head={on ? "enemy" : undefined}
                  className={`w-11 px-1 py-0.5 text-pixel-sm font-semibold ${
                    on ? "bg-mist-500/30 text-cream-100" : "text-sand-300"}`}
                >
                  {elementChip(def).label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ELEMENT_ORDER.map((atk) => {
            const rowOn = atk === enemyType;
            return (
              <tr key={atk}>
                <th
                  className={`px-1 py-0.5 text-left text-pixel-sm font-semibold ${
                    rowOn ? "bg-mist-500/30 text-cream-100" : "text-sand-300"}`}
                >
                  {elementChip(atk).label}
                </th>
                {ELEMENT_ORDER.map((def) => {
                  const mult = getTypeMultiplier(atk, def);
                  const colOn = def === enemyType;
                  return (
                    <td
                      key={def}
                      data-cell={`${atk}-${def}`}
                      className={`border border-shadow-700 px-1 py-0.5 text-center text-pixel-sm
                        ${cellClass(mult)} ${rowOn || colOn ? "outline outline-1 outline-mist-500/70" : ""}`}
                    >
                      {cellText(mult)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-1.5 text-pixel-sm text-earth-400">
        {enemyType
          ? <>지금 상대는 <span className="text-cream-100">{elementChip(enemyType).label}</span> — 파란 줄이 상대의 공격·방어다.</>
          : <>지금 상대는 무속성이라 약점도 저항도 없다. 어떤 속성으로 때려도 1배다.</>}
      </p>
    </div>
  );
}
