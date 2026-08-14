import { gainExp, type BattleMonster } from "./battleUtils";

/**
 * 경험치 바가 어떻게 차오르는지의 순서표.
 *
 * 계산은 하지 않는다 — 전투가 쓰는 gainExp 를 **다음 레벨까지 남은 만큼씩 잘라** 부를 뿐이다.
 * 그래서 요구 경험치 곡선(EXP_GROWTH_RATE)이나 레벨당 스탯 증가를 고쳐도 연출이 따라온다.
 * 테스트가 "잘라 넣은 결과 = 한 번에 넣은 결과"를 못 박는다.
 */

export interface StatGains {
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface ExpSegment {
  /** 이 구간을 채우는 동안 화면에 적히는 레벨 */
  level: number;
  /** 바의 시작·끝 비율 (0~1) */
  from: number;
  to: number;
  /** 이 구간을 그리는 동안 바 옆에 적히는 분모. 레벨마다 달라서 구간이 들고 있어야 한다 */
  expToNext: number;
  /** 구간 끝에서 레벨이 올랐다면 그 결과. 여기서 연출이 멈춘다 */
  levelUp: { level: number; gains: StatGains } | null;
}

/** 레벨이 이 이상 오르면 무언가 잘못된 것이다. 무한 루프 방지용 */
const MAX_STEPS = 200;

export function buildExpTimeline(
  monster: BattleMonster,
  gained: number,
): { segments: ExpSegment[]; final: BattleMonster } {
  const segments: ExpSegment[] = [];
  let cur = monster;
  let remaining = Math.max(0, gained);

  for (let step = 0; step < MAX_STEPS && remaining > 0; step++) {
    const need = cur.expToNextLevel - cur.exp;
    // need 가 0 이하면 이미 문턱을 넘긴 상태다. 0 을 넣어 레벨만 올리고 다음 칸으로 간다.
    const take = need > 0 ? Math.min(remaining, need) : 0;

    const before = cur;
    const res = gainExp(cur, take);
    cur = res.updatedMonster;
    remaining -= take;

    segments.push({
      level: before.level,
      expToNext: before.expToNextLevel,
      from: before.expToNextLevel > 0 ? before.exp / before.expToNextLevel : 0,
      to: res.leveledUp
        ? 1
        : cur.expToNextLevel > 0 ? cur.exp / cur.expToNextLevel : 0,
      levelUp: res.leveledUp
        ? {
            level: cur.level,
            gains: {
              maxHp:   cur.maxHp   - before.maxHp,
              attack:  cur.attack  - before.attack,
              defense: cur.defense - before.defense,
              speed:   cur.speed   - before.speed,
            },
          }
        : null,
    });
  }

  return { segments, final: cur };
}
