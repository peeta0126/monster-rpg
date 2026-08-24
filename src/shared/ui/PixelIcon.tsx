import { useState } from "react";
import { itemIconUrl } from "../assetPaths";
import { ICONS, type IconName } from "./icons";
import { RASTER_ICON_IDS } from "./rasterIcons";

/**
 * 원본이 32px 논리 격자라 표시 크기도 정수배·정수분의 1 만 쓴다.
 * 24 나 48 은 그 격자의 1.5 배·0.75 배라 crispEdges 로 그린 칸 폭이 들쭉날쭉해진다.
 * 16 은 12px 글자 옆, 32 는 카드·메뉴, 64 는 빈 화면의 큰 표식.
 */
export type IconSize = 16 | 32 | 64;

/**
 * 아이콘 하나. 그림 파일이 있으면 그걸, 없으면 SVG 를 그린다.
 *
 * 두 갈래여도 칸 크기는 같다. width/height 를 size 로 못 박아 둔다. 한 줄에 그림이랑
 * SVG 가 섞여도 줄이 흔들리면 안 되니까(가방엔 물약 그림과 상태이상 SVG 가 같이 선다).
 *
 * 굽지 않고 클론했거나 파일 하나가 빠지면 onError 로 SVG 로 내려앉는다.
 * RASTER_ICON_IDS 에는 그림이 있어야 하는 이름만 있어서, 상태이상·메뉴 아이콘이
 * 없는 파일을 먼저 찔러 404 를 깔지는 않는다.
 */
export function PixelIcon({
  name, size = 32, className = "", title, style,
}: {
  name: IconName;
  size?: IconSize;
  className?: string;
  /** 그림만으로 뜻이 안 통하는 자리에만 쓴다. 보통은 옆에 글자가 있어서 비워 둔다 */
  title?: string;
  style?: React.CSSProperties;
}) {
  // 실패한 이름을 들고 있는다. 불리언으로 두면 아이콘이 갈릴 때 폴백이 따라붙는다.
  const [failed, setFailed] = useState<string | null>(null);
  const raster = RASTER_ICON_IDS.has(name) && failed !== name;

  return (
    <img
      src={raster ? itemIconUrl(name) : ICONS[name]}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      style={{ imageRendering: "pixelated", ...style }}
      draggable={false}
      onError={raster ? () => setFailed(name) : undefined}
    />
  );
}
