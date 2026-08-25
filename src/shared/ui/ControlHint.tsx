export interface ControlHintItem {
  /** 누르는 것 */
  keys: string;
  /** 그러면 일어나는 일 */
  action: string;
}

/**
 * 조작 안내. 걸어 다니는 화면은 캔버스뿐이라 이게 없으면 이동법조차 알 수 없다.
 *
 * 그림 옆 띠(`StageRail`)에 들어간다. 띠 폭은 창 비율이 정하는 값이라 화면마다
 * 다르고(136~304px) 픽셀 폰트는 12px 정수배에 묶여 못 줄인다. 그래서 한 줄로
 * 늘어놓지 않고 **키와 동작을 위아래로** 쌓는다 — 한 줄로 두면 제일 좁은 띠에서
 * "WASD / 방향키" 와 "이동" 사이가 저 혼자 끊겨 읽는 사람이 두 항목으로 본다.
 *
 * 베이스캠프와 공방이 같은 부품을 쓴다. 상호작용 키만 다르다(E / SPACE).
 */
export function ControlHint({ items }: { items: ControlHintItem[] }) {
  return (
    <div className="grid gap-2 rounded-xl border border-stone-600 bg-shadow-900/80 px-3 py-2 backdrop-blur">
      {items.map((it) => (
        <div key={it.keys}>
          <p className="break-keep text-pixel-sm font-bold text-earth-400">{it.keys}</p>
          <p className="break-keep text-pixel-sm text-sand-300">{it.action}</p>
        </div>
      ))}
    </div>
  );
}
