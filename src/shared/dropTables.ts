import { isBossFloor } from "./floorTable";

/**
 * 재료가 어디서 나오는지 — 숲과 전투 두 곳뿐이고, 그 표를 여기 한 벌만 둔다.
 *
 * 예전엔 숲 표가 `camp/ForestPage.tsx` 안에, 전투 표가 `battle/BattlePage.tsx` 와
 * `scripts/sim/gameModel.ts` 에 각각 복사돼 있었다. 그래서 `scripts/sim/diagnose.ts` 의
 * "얻을 수 있는 재료" 절은 아예 손으로 적은 문자열이었고, 숲 표가 구역별로 갈린 뒤에도
 * "slime_extract 는 어느 드랍 테이블에도 없음" 이라고 계속 출력했다. 실제로는 얕은 숲에서
 * 나오는데도. 밸런스를 표에서 읽어 판단하는 이상, 표는 한 곳에 있어야 한다.
 */

/** 숲 구역별 재료 풀. 같은 id 를 여러 번 넣으면 그만큼 자주 나온다. */
export const AREA_MATERIAL_POOL: Record<string, string[]> = {
  shallow: ["herb", "herb", "berry", "root", "wood_plank", "leather", "slime_extract"],
  deep:    ["herb", "berry", "root", "crystal", "wood_plank", "leather",
            "slime_extract", "iron_fragment", "magic_dust"],
  ancient: ["herb", "root", "crystal", "crystal", "iron_fragment",
            "magic_dust", "monster_essence", "monster_essence", "enhancement_stone"],
};

/**
 * 층수별 전투 드랍 풀.
 * monster_essence 와 enhancement_stone 은 원래 어느 전투 드랍에도 없어 상위 아티팩트
 * 제작과 장비 레벨업이 통째로 막혀 있었다 — 상위 층 보상에 포함한다.
 */
export function battleDropPool(floor: number): string[] {
  if (floor >= 31) return ["iron_fragment", "crystal", "monster_essence", "enhancement_stone"];
  if (floor >= 21) return ["iron_fragment", "crystal", "wood_plank", "monster_essence", "enhancement_stone"];
  if (floor >= 11) return ["iron_fragment", "wood_plank", "leather", "enhancement_stone"];
  return ["wood_plank", "leather", "herb"];
}

/** 전투 승리 시 재료 드랍 굴림 */
export function rollBattleDrop(floor: number): { id: string; count: number }[] {
  const drops: { id: string; count: number }[] = [];
  const rollChance = isBossFloor(floor) ? 0.95 : 0.45;
  if (Math.random() > rollChance) return drops;

  const pool = battleDropPool(floor);
  const count = isBossFloor(floor) ? 2 + (Math.random() < 0.5 ? 1 : 0) : 1;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  drops.push({ id: picked, count });

  // 보스 층은 추가 드랍
  if (isBossFloor(floor) && Math.random() < 0.6) {
    const extra = pool.filter((p) => p !== picked)[Math.floor(Math.random() * (pool.length - 1))];
    drops.push({ id: extra, count: 1 });
  }

  return drops;
}
