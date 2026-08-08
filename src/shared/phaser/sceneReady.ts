import Phaser from "phaser";

/**
 * 디자인 캡처(design/capture.spec.ts)용 준비 신호.
 *
 * Phaser 캔버스는 DOM 접근성 트리에 아무것도 노출하지 않아서, 스크린샷 도구가
 * "씬이 다 그려졌는지"를 알 방법이 없다. 그래서 씬이 create를 끝낸 시점에
 * window.__PHASER_READY__ 를 true 로 세우고, shutdown/destroy 시 false 로 되돌린다
 * (씬 재시작 시 이전 실행의 true 가 남아 있으면 안 되므로).
 *
 * 프로덕션 동작에는 영향이 없다 — 읽는 쪽은 테스트뿐이다.
 */
declare global {
  interface Window {
    __PHASER_READY__?: boolean;
    /** 마지막으로 준비된 씬 키. 씬을 구분해 기다려야 할 때 쓴다. */
    __PHASER_READY_SCENE__?: string | null;
  }
}

/** 씬 create() 의 마지막 줄에서 호출한다. shutdown/destroy 시 자동으로 해제된다. */
export function markSceneReady(scene: Phaser.Scene): void {
  const clear = () => {
    window.__PHASER_READY__ = false;
    window.__PHASER_READY_SCENE__ = null;
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, clear);
  scene.events.once(Phaser.Scenes.Events.DESTROY, clear);

  window.__PHASER_READY__ = true;
  window.__PHASER_READY_SCENE__ = scene.scene.key;
}
