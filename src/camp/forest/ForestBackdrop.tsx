import { useState } from "react";
import { rgba } from "../../shared/palette";
import { FOREST_AREAS, type ForestAreaId } from "./areas";

/** 크로스페이드 길이. 250~350ms 사이 — 짧으면 교체처럼 보이고 길면 호버가 굼뜨다. */
const FADE_MS = 300;

const BACKDROP_STYLES = `
.forest-backdrop-layer,
.forest-backdrop-dim { transition: opacity ${FADE_MS}ms ease-in-out; }
@media (prefers-reduced-motion: reduce) {
  .forest-backdrop-layer,
  .forest-backdrop-dim { transition: none; }
}
`;

/**
 * 탐험 중 화면에 까는 스크림의 세기.
 *
 * 원화 3장에는 구역 선택 화면 기준의 스크림이 이미 구워져 있다 — 카드가 놓이는
 * 가운데만 눌러 둔 것이라, 노드 맵처럼 화면 전체에 UI 가 흩어지는 장면에는 안 맞는다.
 * 얕은 숲의 밝은 안개 위에서 이동 버튼과 '숲 떠나기'가 통째로 묻혔다.
 *
 * 그래서 이미지를 고치는 대신 화면 쪽에서 한 겹 덮는다. 구역 선택 화면은 dim 없이
 * 원화 그대로 나간다 — 거기서는 카드가 자기 판을 들고 있다.
 */
const DIM_ALPHA = 0.62;

/**
 * 숲 배경 3종을 겹쳐 두고 티어에 따라 opacity 로 넘긴다.
 *
 * 왜 겹쳐 두나 — src 를 갈아끼우면 새 이미지가 디코딩될 때까지 한 프레임이 비어
 * 깜빡인다. 그리고 세 장을 처음부터 마운트해 두는 것 자체가 프리로드다. 첫 호버에
 * 늦게 뜨는 문제가 사라지고, <link rel="preload"> 를 따로 관리하지 않아도 된다.
 *
 * 겹치는 순서 — 새로 고른 층이 맨 위에서 0→1 로 올라오고, 직전 층은 그 아래에서
 * opacity 1 을 유지한다. 둘을 동시에 교차시키면(하나는 내려가고 하나는 올라가면)
 * 중간 프레임에서 합성 알파가 1 밑으로 떨어져 배경이 한 번 어두워진다. 밑을 채워
 * 두면 그 침몰이 없다.
 */
export function ForestBackdrop({ tier, dim = false }: { tier: ForestAreaId; dim?: boolean }) {
  // 마지막 원소가 현재 층. 새로 고른 층을 꺼내 맨 뒤로 보낸다.
  const [stack, setStack] = useState<ForestAreaId[]>(() => [tier]);

  // 렌더 중에 맞춘다 — effect 로 미루면 한 프레임을 옛 층으로 그리고 나서 넘어간다.
  if (stack[stack.length - 1] !== tier) {
    setStack([...stack.filter((id) => id !== tier), tier]);
  }

  return (
    // isolate — 레이어의 z-index 를 이 안에 가둔다. 없으면 페이지 전체 쌓임 맥락에
    // 섞여 배경이 UI 위로 올라온다(카드가 통째로 사라진다).
    <div className="absolute inset-0 z-0 isolate overflow-hidden bg-shadow-900" aria-hidden>
      <style>{BACKDROP_STYLES}</style>
      {FOREST_AREAS.map((area) => {
        const depth = stack.indexOf(area.id);
        // 맨 위(현재)와 바로 아래(직전)만 보인다. 그보다 깊은 층은 어차피 가려져 있다.
        // 아직 한 번도 안 고른 층은 depth -1 — 프리로드만 되고 화면에는 안 나온다.
        const visible = depth >= 0 && depth >= stack.length - 2;
        return (
          <img
            key={area.id}
            className="forest-backdrop-layer absolute inset-0 h-full w-full object-cover"
            src={area.backgroundImage}
            alt=""
            decoding="async"
            fetchPriority={area.id === tier ? "high" : "low"}
            style={{ zIndex: depth + 1, opacity: visible ? 1 : 0 }}
          />
        );
      })}
      <div
        className="forest-backdrop-dim absolute inset-0"
        style={{
          // 레이어 셋 위. 스택이 자라도 항상 맨 위에 있어야 한다.
          zIndex: FOREST_AREAS.length + 1,
          background: rgba("shadow900", DIM_ALPHA),
          opacity: dim ? 1 : 0,
        }}
      />
    </div>
  );
}
