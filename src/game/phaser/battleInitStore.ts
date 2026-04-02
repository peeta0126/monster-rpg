/**
 * BattleScene과 phaserConfig 간의 순환 참조를 방지하기 위한
 * 전투 씬 초기화 데이터 전용 저장소
 */

export interface BattleSceneInitData {
  playerImageUrl: string;
  enemyImageUrl: string;
  /** 현재 탑 층 (1~) */
  floor: number;
}

let _data: BattleSceneInitData | null = null;

export function setBattleInitData(data: BattleSceneInitData): void {
  _data = data;
}

export function getBattleInitData(): BattleSceneInitData | null {
  return _data;
}
