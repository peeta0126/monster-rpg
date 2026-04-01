import Phaser from "phaser";
import BaseCampScene from "./scenes/BaseCampScene";
import BattleScene from "./scenes/BattleScene";
export type { BattleSceneInitData } from "./battleInitStore";
export { setBattleInitData, getBattleInitData } from "./battleInitStore";

export const createBaseCampGame = (parent: string | HTMLElement) => {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: "#1d1d1d",
    pixelArt: true,
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scene: [BaseCampScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
};

/**
 * 전투용 Phaser 게임 인스턴스 생성
 * 반드시 setBattleInitData() 호출 이후에 실행해야 한다
 */
export const createBattleGame = (parent: HTMLElement) => {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 400,
    backgroundColor: "#1a1a2e",
    pixelArt: true,
    scene: [BattleScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });
};