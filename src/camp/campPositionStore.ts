/** 베이스캠프에서 마지막으로 서 있던 플레이어 좌표를 보존 */
// 기본 위치: 집 앞 (basecamp-bg.png 기준)
let _x = 794;
let _y = 1230;

export function getCampPosition(): { x: number; y: number } {
  return { x: _x, y: _y };
}

export function setCampPosition(x: number, y: number): void {
  _x = x;
  _y = y;
}
