import { useEffect, useState } from "react";
import { gameEvents, GAME_EVENT, type AppErrorPayload } from "./phaser/events";

/**
 * Phaser 씬(rAF 루프)이나 window 핸들러에서 터진 예외는 React 렌더 트리 밖이라
 * ErrorBoundary 가 못 잡는다. setState 업데이터 안에서 다시 던지면 렌더 단계로
 * 넘어가서, 가장 가까운 ErrorBoundary 가 같은 폴백을 띄워 준다.
 * 그래서 이 컴포넌트는 ErrorBoundary 안쪽에 늘 붙여 둔다.
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
