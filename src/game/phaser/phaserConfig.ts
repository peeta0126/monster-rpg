import Phaser from "phaser";
import BaseCampScene from "./scenes/BaseCampScene";
import BattleScene from "./scenes/BattleScene";
import HousingScene from "./scenes/HousingScene";
export type { BattleSceneInitData } from "./battleInitStore";
export { setBattleInitData, getBattleInitData } from "./battleInitStore";

export const createBaseCampGame = (parent: string | HTMLElement) => {
  return new Phaser.Game({
    // CANVAS 고정: WebGL 컨텍스트 소진 없이 여러 번 생성/파기 가능
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#1d1d1d",
    pixelArt: true,
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

export const createHousingGame = (parent: HTMLElement) => {
  return new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#c8a87a",
    pixelArt: true,
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [HousingScene],
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
    backgroundColor: "#0a0a14",
    pixelArt: true,
    scene: [BattleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
};
