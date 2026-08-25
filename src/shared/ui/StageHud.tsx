import type { ReactNode } from "react";
import type { StageRect } from "./stageRect";

/**
 * HUD 를 그림 위에 놓는 틀.
 *
 * 안에 드는 것들은 창이 아니라 이 틀을 기준으로 `absolute` 로 붙는다. 그래서 화면마다
 * 비율이 달라도(공방 2400:1792, 베이스캠프 16:9) 늘 그림 모서리에 앉는다.
 * 틀 자체는 클릭을 안 먹는다 — 캔버스로 그대로 내려보내야 하므로, 누를 것에만
 * `pointer-events-auto` 를 준다.
 *
 * 여기 드는 건 **그림을 가려도 되는 것**뿐이다. 목표 띠·상호작용 안내처럼 장면에
 * 붙어 읽혀야 하는 것들. 메뉴·조작 안내는 `StageRail` 로 옆 여백에 내보낸다.
 * 화면을 덮는 모달도 여기 넣지 않는다 — 그건 그림이 아니라 창을 덮는 게 맞다.
 */
export function StageHud({ rect, children }: { rect: StageRect; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {children}
    </div>
  );
}

/**
 * 그림 옆에 남는 어두운 띠. 메뉴·조작 안내처럼 늘 떠 있는 것들이 여기 산다.
 *
 * 띠 폭은 창 비율이 정하는 값이라 화면마다 다르다(공방 1440 에서 117px,
 * 베이스캠프 1920 에서 192px). 그래서 폭을 박지 않고 띠에 맞춘다 — 다만 너무 좁으면
 * 글자가 낱말마다 끊기므로 아래로는 `RAIL_MIN` 에서 멈춘다. 띠가 그보다 좁은 화면
 * (공방 768 세로 등)에서는 그만큼만 그림 위로 걸치는데, 아무것도 안 보이는 것보다 낫다.
 *
 * 위로는 `--container-rail` 에서 멈춘다. 넓은 화면에서 띠가 아무리 넓어져도 메뉴가
 * 같이 부풀면 다른 화면의 패널과 폭이 어긋난다.
 *
 * 아래 136 은 "WASD / 방향키 이동"(12px 픽셀 폰트로 108px)에 좌우 안쪽 여백을 더한
 * 값이다. 이보다 좁으면 그 한 줄이 낱말마다 끊긴다.
 */
const RAIL_MIN = 136;

export function StageRail({
  stage,
  viewportW,
  side,
  children,
}: {
  stage: StageRect;
  viewportW: number;
  side: "left" | "right";
  children: ReactNode;
}) {
  const margin = side === "left" ? stage.left : viewportW - (stage.left + stage.width);

  return (
    <div
      className="pointer-events-none fixed z-40 flex flex-col gap-gutter"
      style={{
        top:     stage.top,
        height:  stage.height,
        [side]:  "var(--spacing-gutter)",
        width:   `clamp(${RAIL_MIN}px, calc(${Math.round(margin)}px - var(--spacing-gutter) * 2),
                  var(--container-rail))`,
      }}
    >
      {children}
    </div>
  );
}
