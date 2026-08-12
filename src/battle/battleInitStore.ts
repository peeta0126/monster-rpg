import type { ElementType } from "../shared/game";

export interface BattleSceneInitData {
  playerImageUrl: string;
  playerName: string;
  playerLevel: number;
  enemyImageUrl: string;
  enemyName: string;
  enemyLevel: number;
  /** null 은 무속성(오름). 상성이 전부 1배라 화면에는 "?" 로 나간다 */
  enemyType: ElementType | null;
  floor: number;
  isBoss: boolean;
  /** 파티 전체 이미지 URL (인덱스 = 파티 슬롯) — 교체 시 스프라이트 전환에 사용 */
  partyImageUrls: string[];
  partyNames: string[];
  partyLevels: number[];
}

let _data: BattleSceneInitData | null = null;

export function setBattleInitData(data: BattleSceneInitData): void {
  _data = data;
}

export function getBattleInitData(): BattleSceneInitData | null {
  return _data;
}
