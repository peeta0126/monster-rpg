import type { OwnedMonster } from "../../shared/playerStore";
import type { ForestArea } from "./areas";

/**
 * 숲이 내주는 레벨의 천장.
 *
 * 숲은 지금 데리고 다니는 것보다 센 놈을 안 내준다. 파티에서 제일 높은
 * 레벨이 곧 천장이다(보관함은 안 본다. 데리고 나온 것으로만 상대한다).
 *
 * 종은 안 막는다. 진화체라도 레벨만 천장 아래면 나온다. 막아 두면 "레벨은
 * 되는데 왜 안 나오지"가 되고, 그 규칙은 화면에 적을 수가 없다.
 *
 * 천장이 구역 최저 레벨에도 못 미치면 그 구역에는 내놓을 몬스터가 없다.
 * 그때는 조우 자체가 뜨지 않는다(steps.candidates 의 canCatch).
 */
export function partyCapLevel(party: readonly OwnedMonster[]): number {
  return party.reduce((max, m) => Math.max(max, m.level), 0);
}

/** 이 구역에서 실제로 나올 수 있는 레벨대. 천장이 낮으면 null 이고 아무것도 안 나온다 */
export function encounterLevelRange(area: ForestArea, capLevel: number): [number, number] | null {
  const [min, max] = area.levelRange;
  if (capLevel < min) return null;
  return [min, Math.min(max, capLevel)];
}

export function canCatchIn(area: ForestArea, capLevel: number): boolean {
  return encounterLevelRange(area, capLevel) !== null;
}
