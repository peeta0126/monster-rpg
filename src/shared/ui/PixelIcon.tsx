import { ICONS, type IconName } from "./icons";

/**
 * 원본이 32px 라 표시 크기도 **정수배·정수분의 1** 만 쓴다(CLAUDE.md 픽셀 규칙).
 * 24 나 48 은 1.5 배라 crispEdges 로 그린 칸의 폭이 들쭉날쭉해진다.
 * 16 은 12px 글자 옆, 32 는 카드·메뉴, 64 는 빈 화면의 큰 표식.
 */
export type IconSize = 16 | 32 | 64;

export function PixelIcon({
  name, size = 32, className = "", title, style,
}: {
  name: IconName;
  size?: IconSize;
  className?: string;
  /** 그림만으로 뜻이 안 통하는 자리에만 — 대개는 옆에 글자가 있어 비워 둔다 */
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={ICONS[name]}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ imageRendering: "pixelated", ...style }}
      draggable={false}
    />
  );
}
