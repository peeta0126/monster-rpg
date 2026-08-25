/**
 * 화면에 실제로 그려진 그림의 자리.
 *
 * 게임 화면은 비율이 고정이라(캔버스 16:9, 공방 배경 2400:1792) 창 비율이 다르면
 * 둘레에 배경색 띠가 남는다. HUD 를 창 모서리에 붙이면 그 띠 위에 얹혀 그림 밖으로
 * 튀어나온 것처럼 보인다 — 붙일 자리는 창이 아니라 그림이다.
 *
 * 여백·폭 토큰(gutter · rail)은 그대로 쓴다. 여기서 정하는 건 "어디서부터가 화면인가"
 * 하나뿐이고, 그 안에서의 비율은 index.css 의 자가 계속 진다.
 */
export interface StageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const centered = (viewW: number, viewH: number, width: number, height: number): StageRect => ({
  left: (viewW - width) / 2,
  top:  (viewH - height) / 2,
  width,
  height,
});

/** 비율 하나가 곧 무대인 화면(공방). 창 안에 넣고 가운데 놓는다 — CSS 의 contain 과 같다. */
export function containRect(viewW: number, viewH: number, ratio: number): StageRect {
  return centered(viewW, viewH, Math.min(viewW, viewH * ratio), Math.min(viewH, viewW / ratio));
}

/**
 * Phaser FIT 캔버스가 실제로 그린 자리(베이스캠프).
 *
 * 띠가 두 겹이다. 캔버스는 base 를 창에 맞춰 통째로 늘려 남는 쪽에 띠를 남기고,
 * 그 안에서 맵이 base 보다 좁으면 카메라가 남는 폭을 배경색으로 또 채운다.
 * 베이스캠프는 맵 폭 1536 에 줌 0.5 라 960 짜리 캔버스에서 좌우 96 씩이 늘 비어 있다.
 */
export function cameraRect(
  viewW: number,
  viewH: number,
  base: { width: number; height: number },
  drawn: { width: number; height: number },
): StageRect {
  const scale = Math.min(viewW / base.width, viewH / base.height);
  return centered(
    viewW,
    viewH,
    Math.min(base.width, drawn.width) * scale,
    Math.min(base.height, drawn.height) * scale,
  );
}
