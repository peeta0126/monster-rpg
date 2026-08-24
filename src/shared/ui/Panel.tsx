import type { ReactNode } from "react";

type PanelVariant = "default" | "raised" | "inset";

const VARIANT: Record<PanelVariant, string> = {
  // 기본 패널. 전투·인벤토리·상점이 전부 이 조합을 쓴다 (ART_DIRECTION 3-2)
  default: "border-2 border-earth-500 bg-shadow-700/95",
  // 떠 있는 것. 모달, 팝오버
  raised:  "border-2 border-earth-500 bg-shadow-900/95 shadow-[0_16px_48px_rgba(13,18,35,0.7)]",
  // 파인 것. 슬롯 안쪽, 로그 영역
  inset:   "border border-earth-500/50 bg-shadow-900/70 shadow-[inset_0_2px_6px_rgba(13,18,35,0.6)]",
};

/** 배경과 구분돼야 하는 사각 영역이면 이걸 쓴다. 화면마다 테두리를 새로 정하지 마라 */
export function Panel({
  variant = "default",
  className = "",
  children,
}: {
  variant?: PanelVariant;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`rounded-lg ${VARIANT[variant]} ${className}`}>{children}</div>;
}
