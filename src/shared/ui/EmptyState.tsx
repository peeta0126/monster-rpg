import type { ReactNode } from "react";

/**
 * "아직 아무것도 없다"를 알리는 안내. 화면 세로 중앙이 아니라 콘텐츠 상단에 붙여
 * 쓴다 — 가운데 띄우면 아래로 빈 공간이 길게 남아 화면이 고장 난 것처럼 보인다.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 py-6 text-center ${className}`}>
      {icon && <div className="text-pixel-md opacity-40">{icon}</div>}
      <p className="text-pixel-sm font-bold text-sand-200">{title}</p>
      {description && <div className="text-pixel-sm text-earth-400">{description}</div>}
      {action}
    </div>
  );
}
