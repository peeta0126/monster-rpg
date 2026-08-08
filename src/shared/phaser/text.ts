import Phaser from "phaser";

/**
 * Phaser 텍스트 공통 설정.
 *
 * Phaser는 캔버스에 글자를 한 번 래스터화해서 텍스처로 캐싱한다. 그래서 두 가지가 필요하다.
 *  - resolution: 기본값 1이라 고DPI 화면에서 글자만 뭉개진다. devicePixelRatio를 넘긴다.
 *  - 웹폰트 로딩 대기: Phaser는 document.fonts를 기다리지 않는다. 씬이 먼저 뜨면
 *    Galmuri가 아직 없어서 fallback으로 그려진 텍스처가 그대로 남는다.
 */
export const PIXEL_FONT = '"Galmuri11", monospace';
export const TITLE_FONT = '"Galmuri14", "Galmuri11", monospace';

export const textResolution = () => Math.max(1, Math.round(window.devicePixelRatio || 1));

/** 씬의 모든 Text를 폰트 로드 후 한 번 다시 그린다. create() 끝에서 호출. */
export function redrawTextOnFontLoad(scene: Phaser.Scene): void {
  let disposed = false;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { disposed = true; });
  scene.events.once(Phaser.Scenes.Events.DESTROY, () => { disposed = true; });

  document.fonts.ready.then(() => {
    if (disposed || !scene.sys?.isActive()) return;
    for (const obj of scene.children.list) {
      if (obj instanceof Phaser.GameObjects.Text) obj.updateText();
    }
  });
}
