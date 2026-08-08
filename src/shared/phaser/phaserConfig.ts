import Phaser from "phaser";
import BaseCampScene from "../../camp/BaseCampScene";
import BattleScene from "../../battle/BattleScene";
import { PALETTE } from "../palette";

export const createBaseCampGame = (parent: string | HTMLElement) => {
  return new Phaser.Game({
    // CANVAS 고정: WebGL 컨텍스트 소진 없이 여러 번 생성/파기 가능
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
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
  });
};

export const createBattleGame = (parent: HTMLElement) => {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
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
