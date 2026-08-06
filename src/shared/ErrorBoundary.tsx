import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const pixelFont = { fontFamily: "var(--pixel-font, monospace)" };

/**
 * 최상위 폴백 UI. Phaser 씬 예외도 AppErrorBridge를 통해 여기로 들어온다.
 * 발표 중 렌더링 예외로 화면이 통째로 하얘지는 상황을 막기 위한 최후 방어선이므로,
 * "새로고침"/"베이스캠프로" 둘 다 SPA 상태를 신뢰하지 않고 location을 직접 바꿔
 * Phaser 게임 인스턴스 등 깨졌을 수 있는 런타임 상태를 완전히 새로 시작한다.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] 처리되지 않은 예외", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-6 bg-black px-6 text-center"
        style={pixelFont}
      >
        <p className="text-sm text-amber-200 sm:text-base">문제가 발생했습니다</p>
        <p className="max-w-md text-[10px] leading-relaxed text-zinc-500 sm:text-xs">
          예상치 못한 오류로 화면을 계속 표시할 수 없습니다. 아래 버튼으로 복구해주세요.
        </p>

        {import.meta.env.DEV && (
          <pre className="max-h-64 max-w-lg overflow-auto whitespace-pre-wrap rounded-md border border-red-900/60 bg-red-950/30 p-3 text-left text-[9px] leading-snug text-red-300">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border-2 border-amber-400/90 bg-gradient-to-b from-amber-500 to-amber-800 px-4 py-2 text-[10px] font-bold text-amber-50 transition hover:brightness-110 sm:text-xs"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="rounded-md border border-zinc-600 px-4 py-2 text-[10px] text-zinc-400 transition hover:border-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 sm:text-xs"
          >
            베이스캠프로
          </button>
        </div>
      </div>
    );
  }
}
