import { useEffect, useState } from "react";
import { gameEvents, GAME_EVENT, type AppErrorPayload } from "./phaser/events";

/**
 * Phaser 씬(requestAnimationFrame 루프)이나 전역 window 핸들러에서 잡힌 예외는
 * React 렌더 트리 바깥에서 발생하므로 ErrorBoundary가 직접 잡지 못한다.
 * setState 업데이터 함수 안에서 다시 던져 React 렌더 단계로 옮기면, 가장 가까운
 * ErrorBoundary가 동일한 폴백 UI로 처리할 수 있다. 이 컴포넌트는 ErrorBoundary
 * 안쪽에 항상 마운트해둔다.
 */
export default function AppErrorBridge() {
  const [, setError] = useState<AppErrorPayload | null>(null);

  useEffect(() => {
    function onAppError(payload: AppErrorPayload) {
      setError(() => {
        throw new Error(`[${payload.source}] ${payload.message}`);
      });
    }
    gameEvents.on(GAME_EVENT.APP_ERROR, onAppError);
    return () => {
      gameEvents.off(GAME_EVENT.APP_ERROR, onAppError);
    };
  }, []);

  return null;
}
