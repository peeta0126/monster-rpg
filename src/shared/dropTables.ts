import { corridorMultiplier, isHardFloor } from "./floorTable";

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
  // monster_essence 를 여기 한 자리 넣은 건 의도다. 목걸이·부적이 그걸 요구하는데
  // 고대 숲(21층 해금) 전에는 어디서도 안 나와서, **20층 관문을 장비로 넘는 길 자체가
  // 없었다**. 고대 숲 풀에는 두 자리라 여전히 그쪽이 주력이다.
  // ⚠️ **약초는 구역이 깊어져도 흔해야 한다.** 회복 물약 다섯 종이 전부 약초를 2~3개씩
  // 먹는데, 예전엔 얕은 숲 2/7 → 깊은 숲 1/10 → 고대 숲 1/9 로 오히려 드물어졌다.
  // 그래서 후반에 약초만 0 이 되고(한 판 실측), 40층부터는 가방에 회복 물약이 한 개도
  // 없는 채로 보스를 만났다. 40·50층 첫 도전 승률 13%·8% 는 보스가 세서가 아니라
  // 빈손이라서였다. 세 구역 모두 두 자리씩 준다.
  deep:    ["herb", "herb", "berry", "root", "crystal", "wood_plank", "leather",
            "slime_extract", "iron_fragment", "magic_dust", "monster_essence"],
  ancient: ["herb", "herb", "root", "crystal", "crystal", "iron_fragment",
            "magic_dust", "monster_essence", "monster_essence", "enhancement_stone"],
};

/**
 * 층수별 전투 드랍 풀.
 * monster_essence 와 enhancement_stone 은 원래 어느 전투 드랍에도 없어 상위 아티팩트
 * 제작과 장비 레벨업이 통째로 막혀 있었다 — 상위 층 보상에 포함한다.
 */
export function battleDropPool(floor: number): string[] {
  // ⚠️ **약초를 전 구간에 둔다.** 예전엔 10층까지만 나왔다. 탑은 회복 물약을 쓰는 곳인데
  // 그 재료가 11층에서 끊기니, 위로 올라갈수록 소모는 늘고 보급은 숲 한 곳으로만 좁아졌다.
  // 층이 오를수록 다른 재료가 좋아지므로 약초의 상대 비중은 자연히 줄어든다.
  if (floor >= 31) return ["iron_fragment", "crystal", "monster_essence", "enhancement_stone", "herb"];
  if (floor >= 21) return ["iron_fragment", "crystal", "wood_plank", "monster_essence", "enhancement_stone", "herb"];
  if (floor >= 11) return ["iron_fragment", "wood_plank", "leather", "enhancement_stone", "monster_essence", "herb"];
  return ["wood_plank", "leather", "herb"];
}

/** 전투 승리 시 재료 드랍 굴림 */
export function rollBattleDrop(floor: number): { id: string; count: number }[] {
  const drops: { id: string; count: number }[] = [];
  // 관문(15·25·35·45)도 보스급으로 준다. 그 층을 넘느라 쓴 물약을 돌려받아야
  // 다음 관문까지 갈 수 있다 — 벽 뒤에 보상이 없으면 벽이 아니라 통행세다.
  //
  // ⚠️ **일반 층 드랍은 층과 같이 무거워진다.** 예전엔 1층이든 49층이든 45% 에 1개였다.
  // 26층부터 구간 배수로 층을 길게 만들어 놓고 보급은 그대로 뒀으니, 위로 갈수록 소모가
  // 보급을 앞질렀다 — 40층부터 가방에 회복 물약이 0 개인 채로 보스를 만났다.
  const zone = corridorMultiplier(floor);
  const rollChance = isHardFloor(floor) ? 0.95 : 0.45 + (zone - 1) * 0.8;
  if (Math.random() > rollChance) return drops;

  const pool = battleDropPool(floor);
  const count = isHardFloor(floor)
    ? 2 + (Math.random() < 0.5 ? 1 : 0)
    : (zone >= 1.28 ? 2 : 1);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  drops.push({ id: picked, count });

  // 보스 층은 추가 드랍
  if (isHardFloor(floor) && Math.random() < 0.6) {
    const extra = pool.filter((p) => p !== picked)[Math.floor(Math.random() * (pool.length - 1))];
    drops.push({ id: extra, count: 1 });
  }

  return drops;
}

/**
 * 재료의 상대 가치.
 *
 * 개수만 세면 약초 1개와 강화석 1개가 같은 무게가 된다 — 밸런스를 그렇게 재면
 * 희귀 재료만 주는 사건(이변)이 흔적보다 못한 것으로 계산된다. 실제로 그랬다.
 *
 * 기준은 두 가지다.
 *   1) 희소성 — 어느 구역 풀에 몇 번 들어 있는가 (AREA_MATERIAL_POOL 이 원본)
 *   2) 제작 위치 — 상위 아티팩트·강화가 요구하는 것일수록 위
 *
 * 값을 바꾸면 밸런스 측정(scripts/sim/forestBalance.ts)의 기준이 통째로 움직인다.
 */
export const MATERIAL_VALUE: Record<string, number> = {
  // 흔한 것 — 얕은 숲에서 그냥 나온다
  herb: 1, berry: 1, root: 1, wood_plank: 1, leather: 1, slime_extract: 1,
  // 중급 — 깊은 숲부터. 아티팩트 제작이 요구한다
  iron_fragment: 2, magic_dust: 2,
  // 희귀 — 고대 숲에 몰려 있고 상위 제작의 병목이다
  crystal: 3, monster_essence: 3,
  // 최상 — 장비 강화 전용이라 대체재가 없다
  enhancement_stone: 4,
  // 오름 전용. 숲에서는 안 나온다
  ormr_essence: 8,
};

/** 값이 없는 재료는 흔한 것으로 친다 — 새 재료를 넣고 표를 안 고쳐도 0 으로 세지 않게 */
export function materialValue(id: string): number {
  return MATERIAL_VALUE[id] ?? 1;
}
