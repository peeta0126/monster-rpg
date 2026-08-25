import Phaser from "phaser";
import BaseCampScene from "../../camp/BaseCampScene";
import BattleScene from "../../battle/BattleScene";
import { PALETTE } from "../palette";

/**
 * dev 빌드에서만 게임 인스턴스를 window 에 걸어 둔다.
 *
 * Phaser 캔버스는 접근성 트리에 안 잡혀서 Playwright 가 플레이어 좌표를 읽을 방법이
 * 없다. 씬에 테스트 전용 코드를 심는 대신 여기서 손잡이 하나만 내준다.
 * `vite build` 에서는 통째로 사라진다.
 */
/**
 * 캔버스 기준 크기. FIT 이라 창에 맞춰 통째로 늘어나고, 창 비율이 16:9 가 아니면
 * 남는 쪽에 배경색 띠가 생긴다. HUD 를 그림 안에 앉히려면 이 값이 필요하다(stageRect).
 */
export const GAME_VIEW = { width: 960, height: 540 } as const;

function exposeForTests(game: Phaser.Game): Phaser.Game {
  if (import.meta.env.DEV) {
    (window as unknown as { __phaserGame?: Phaser.Game }).__phaserGame = game;
  }
  return game;
}

export const createBaseCampGame = (parent: string | HTMLElement) => {
  return exposeForTests(new Phaser.Game({
    // CANVAS 고정: WebGL 컨텍스트 소진 없이 여러 번 생성/파기 가능
    type: Phaser.CANVAS,
    parent,
    width: GAME_VIEW.width,
    height: GAME_VIEW.height,
    backgroundColor: PALETTE.shadow900,
    pixelArt: true,
    // pixelArt만으론 스프라이트가 서브픽셀 좌표에 놓여 이동 중 미세하게 떤다
    antialias: false,
    roundPixels: true,
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [BaseCampScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  }));
};

export const createBattleGame = (parent: HTMLElement) => {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: GAME_VIEW.width,
    height: GAME_VIEW.height,
    backgroundColor: PALETTE.shadow900,
    pixelArt: true,
    // pixelArt만으론 스프라이트가 서브픽셀 좌표에 놓여 이동 중 미세하게 떤다
    antialias: false,
    roundPixels: true,
    scene: [BattleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
};
