import type { ReactNode } from "react";
import { PixelIcon } from "./PixelIcon";
import { PixelButton } from "./PixelButton";
import type { IconName } from "./icons";

/**
 * 화면을 덮는 창 한 벌.
 *
 * 도감·퀘스트·확인창이 이미 같은 모양으로 서 있었는데(백드롭 → 둥근 판 → 제목줄에
 * 닫기), 공방 쪽 창들만 자기 색·자기 테두리·자기 모서리를 들고 있었다. 같은 게임
 * 안에서 창이 두 종류로 보이면 그 자체가 고장이다.
 *
 * 규칙은 셋뿐이다.
 *  · 판은 `rounded-2xl` · `border-stone-600` · `bg-shadow-900`
 *  · 제목줄은 아래에 선 하나(`border-shadow-700`), 오른쪽 끝이 닫기
 *  · 밖을 누르면 닫힌다. 안쪽 클릭은 여기서 막는다
 *
 * 너비는 부르는 쪽이 정한다(`width`). 값은 `--container-*` 자 한 벌에서만 고른다 —
 * 화면마다 px 를 새로 적으면 같은 폭에서 창끼리 어긋난다.
 */
export function ModalShell({
  icon,
  title,
  subtitle,
  actions,
  width = "board",
  onClose,
  bodyClassName = "",
  testId,
  children,
}: {
  /** 제목 왼쪽 그림. 없으면 안 그린다 */
  icon?: IconName;
  title: string;
  /** 이 창이 무엇을 하는 곳인지 한 줄 */
  subtitle?: string;
  /** 닫기 왼쪽에 붙는 것 (개발용 버튼 따위) */
  actions?: ReactNode;
  width?: "stage" | "board";
  onClose: () => void;
  /** 본문 칸에 더할 클래스. 격자를 깔거나 스크롤을 줄 때 */
  bodyClassName?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center bg-shadow-900/80 p-gutter backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid={testId}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border
          border-stone-600 bg-shadow-900 shadow-2xl
          ${width === "stage" ? "max-w-stage" : "max-w-board"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-shadow-700 px-panel py-4">
          {icon && <PixelIcon name={icon} size={32} className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-title-sm font-bold text-cream-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-pixel-sm text-sand-300">{subtitle}</p>}
          </div>
          {actions}
          <PixelButton onClick={onClose}>닫기</PixelButton>
        </header>

        {/* 세로 flex 로 둔다. 안에 탭 바처럼 고정 높이가 먼저 서고 그 아래가 남은 높이를
            가져가는 배치가 흔한데, 여기가 그냥 블록이면 아래 격자의 flex-1 이 죽는다.
            그러면 격자가 내용만큼 늘어나 창 밖으로 흘러나가고, 정작 스크롤은 안쪽의
            작은 목록에서만 돈다(모루의 재료 목록이 그랬다). */}
        <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * 창 안의 한 구역. 제목은 작은 대문자 한 줄 + 한글 한 줄로, 「내 몬스터」·가방과 같다.
 * 공방 쪽이 `✦ 장비 강화 ✦` 처럼 장식 문자를 쓰고 있었는데 그건 이 게임 어디에도 없다.
 */
export function SectionHead({ en, ko, right }: { en: string; ko: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <p className="text-pixel-sm font-bold uppercase tracking-widest text-sand-300">{en}</p>
        <p className="text-pixel-sm font-black text-sand-200">{ko}</p>
      </div>
      {right}
    </div>
  );
}
