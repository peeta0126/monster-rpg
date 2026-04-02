export interface BattleSceneInitData {
  playerImageUrl: string;
  playerName: string;
  playerLevel: number;
  enemyImageUrl: string;
  enemyName: string;
  enemyLevel: number;
  floor: number;
}

let _data: BattleSceneInitData | null = null;

export function setBattleInitData(data: BattleSceneInitData): void {
  _data = data;
}

export function getBattleInitData(): BattleSceneInitData | null {
  return _data;
}
