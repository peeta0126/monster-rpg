import type Phaser from "phaser";
import { gameEvents, GAME_EVENT } from "./events";

/**
 * Phaser 씬 진입점(create/update/이벤트 핸들러)에서 잡힌 예외를 콘솔에 남기고
 * React 쪽(AppErrorBridge)에 알린다. requestAnimationFrame 루프 안에서 예외가
 * 그대로 던져지면 Phaser가 다음 프레임을 더 이상 스케줄하지 않아 화면이 그대로
 * 멈추므로, 씬을 일시정지해 반쯤 깨진 화면이 계속 남지 않게 한다.
 */
export function reportSceneError(scene: Phaser.Scene, error: unknown) {
  console.error(`[${scene.scene.key}] 씬 오류`, error);
  scene.scene.pause();
  gameEvents.emit(GAME_EVENT.APP_ERROR, {
    source: scene.scene.key,
    message: error instanceof Error ? error.message : String(error),
  });
}

/** 씬의 이벤트 핸들러(키보드/포인터/gameEvents)를 감싸 예외를 reportSceneError로 보낸다. */
export function safeHandler<T extends (...args: never[]) => void>(scene: Phaser.Scene, fn: T): T {
  return ((...args: Parameters<T>) => {
    try {
      fn(...args);
    } catch (error) {
      reportSceneError(scene, error);
    }
  }) as T;
}
