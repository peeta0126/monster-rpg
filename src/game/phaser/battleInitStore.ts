/**
 * BattleScene과 phaserConfig 간의 순환 참조를 방지하기 위한
 * 전투 씬 초기화 데이터 전용 저장소
 *
 * 사용 흐름:
 *  1. BattlePage → setBattleInitData() 호출 (Vite 처리 이미지 URL 등록)
 *  2. createBattleGame() 호출 → Phaser 게임 생성
 *  3. BattleScene.preload() → getBattleInitData() 로 URL 읽어 Phaser 로더에 등록
 */

/** BattleScene preload() 가 사용할 이미지 URL 묶음 */
export interface BattleSceneInitData {
  playerImageUrl: string;
  enemyImageUrl: string;
  bgImageUrl: string;
}

let _data: BattleSceneInitData | null = null;

/** BattlePage에서 createBattleGame() 호출 전에 먼저 세팅 */
export function setBattleInitData(data: BattleSceneInitData): void {
  _data = data;
}

/** BattleScene.preload() 내부에서 호출 */
export function getBattleInitData(): BattleSceneInitData | null {
  return _data;
}
