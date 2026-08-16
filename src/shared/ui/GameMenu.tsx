import { useEffect, useRef, type ReactNode } from "react";
import { PixelIcon } from "./PixelIcon";
import type { IconName } from "./icons";

/**
 * 우상단에 붙어 아래로 펼쳐지는 메뉴.
 *
 * 화면 한가운데 뜨는 모달은 웹보다 앱 쪽 어법이라, 게임이 잠깐 멈춘 것처럼 보인다.
 *
 * 버튼과 목록은 테두리 하나를 같이 쓰는 한 장이다 — 따로 떼어 놓고 밑에 띄우면
 * 버튼에서 내려온 게 아니라 옆에서 튀어나온 창처럼 읽힌다. 그래서 폭도 버튼과
 * 목록이 같고, 열리면 머리(버튼)의 아래 모서리만 각지면서 몸통이 이어진다.
 *
 * 열고 닫는 키(Tab)는 페이지가 쥐고 있고 여기는 open/onClose 만 받는다.
 */

/** 항목 색조. 강조는 아이콘 칩에만 쓰고 글자는 sand 계열로 둔다 (12px 대비). */
export type GameMenuTone = "default" | "accent" | "info" | "gold";

export interface GameMenuItem {
  label: string;
  icon: IconName;
  onClick: () => void;
  tone?: GameMenuTone;
  /** 이 항목 위에 구분선을 긋는다 — 계정/설정처럼 성격이 다른 묶음 앞에 쓴다 */
  separated?: boolean;
  /** 항목 바로 아래로 펼쳐지는 내용 (소리 설정처럼 메뉴 안에서 끝나는 것) */
  panel?: ReactNode;
}

const TONE_CHIP: Record<GameMenuTone, string> = {
  default: "border-stone-600 bg-shadow-800/70",
  accent:  "border-ember-700/60 bg-ember-700/11",
  info:    "border-mist-500/60 bg-mist-500/11",
  gold:    "border-ember-500/70 bg-ember-500/10",
};

export function GameMenu({
  open,
  onOpen,
  onClose,
  items,
  badge,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: GameMenuItem[];
  /** 버튼 옆에 늘 붙는 작은 표식 (예: 탑 클리어) */
  badge?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 바깥을 누르면 닫는다. 투명 오버레이를 깔면 캔버스 클릭까지 먹으므로 문서에서 듣는다.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose]);

  return (
    <div
      ref={rootRef}
      className="fixed right-4 top-4 z-50 w-64 overflow-hidden rounded-xl border border-earth-500
        bg-shadow-900/92 shadow-2xl backdrop-blur"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? onClose() : onOpen())}
        className={`flex w-full items-center gap-2 px-4 py-3 text-pixel-sm font-bold transition
          hover:bg-shadow-700 ${open ? "bg-shadow-800 text-cream-100" : "text-sand-200"}`}
      >
        <span className={open ? "text-ember-500" : "text-earth-400"}>{open ? "▾" : "☰"}</span>
        <span>메뉴</span>
        {badge && (
          <span className="rounded border border-ember-500/70 px-1.5 text-pixel-sm font-bold text-ember-500">
            {badge}
          </span>
        )}
        <span className="ml-auto text-earth-400">{open ? "ESC" : "Tab"}</span>
      </button>

      {open && (
        <div className="menu-unroll">
          <div>
            <div role="menu" className="border-t border-earth-500/60 p-2">
              {items.map((it) => (
                <div key={it.label}>
                  {it.separated && <div className="my-2 h-px bg-stone-600" />}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={it.onClick}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-pixel-sm
                      font-bold text-sand-200 transition hover:bg-shadow-700 hover:text-cream-100
                      active:scale-[.98]"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border
                        ${TONE_CHIP[it.tone ?? "default"]}`}
                    >
                      <PixelIcon name={it.icon} size={32} />
                    </span>
                    {it.label}
                  </button>
                  {it.panel}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
