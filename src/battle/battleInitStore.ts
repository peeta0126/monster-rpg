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
  /** 화면 우상단에 적는 층 표시. 층 표시는 이 한 곳뿐이다(예전엔 세 군데였다) */
  floorLabel: string;
  isBoss: boolean;
  /** 파티 전체 이미지 URL (인덱스 = 파티 슬롯). 교체할 때 스프라이트 전환에 쓴다 */
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
