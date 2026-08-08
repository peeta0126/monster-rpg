import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { gameEvents, GAME_EVENT } from './shared/phaser/events'

import App from './App.tsx'
import { installAudioUnlock } from './shared/audio'

// Phaser 씬 진입점에서 못 잡은 예외나, 그 밖의 처리되지 않은 예외/프로미스 거부에
// 대한 안전망. 개별 진입점을 방어했더라도 놓친 게 있을 수 있으므로 마지막 보루로 둔다.
window.addEventListener("error", (e) => {
  console.error("[window.onerror]", e.error ?? e.message);
  gameEvents.emit(GAME_EVENT.APP_ERROR, {
    source: "window",
    message: e.error instanceof Error ? e.error.message : String(e.message),
  });
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("[unhandledrejection]", e.reason);
  gameEvents.emit(GAME_EVENT.APP_ERROR, {
    source: "promise",
    message: e.reason instanceof Error ? e.reason.message : String(e.reason),
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// 브라우저 자동재생 정책: 첫 상호작용 전에는 소리가 안 난다
installAudioUnlock();
