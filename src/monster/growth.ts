import type { Monster, Move } from "../shared/game";
import { monsters } from "./monsters";
import { getLearnableAtLevel } from "./learnset";

/**
 * 레벨업에 딸려오는 성장 처리 — 기술 습득과 진화.
 *
 * `learnset.ts`의 레벨업 기술표와 `monsters.ts`의 `evolvesTo`/`evolvesAtLevel`은
 * 원래 도감 표시에만 쓰이고 실제 성장에는 연결돼 있지 않았다. 그 결과 성장축이 "레벨"
 * 하나뿐이라, 화력이 종족 기본기(예: 플레미는 평생 위력 45짜리 불씨)에 묶여
 * 상위 층으로 갈수록 레벨 노가다 외에 방법이 없었다. 이 모듈이 그 두 데이터를 실제로 적용한다.
 *
 * 전투 중 레벨업 직후에 호출한다(`gainExp` 다음).
 */

/** 파티 몬스터가 동시에 보유할 수 있는 기술 수 */
export const MAX_MOVES = 4;

export interface GrowthResult<T extends Monster> {
  monster: T;
  /** 이번 성장에서 새로 배운 기술 */
  learned: Move[];
  /** 기술 칸이 꽉 차서 밀려난 기술 */
  forgotten: Move[];
  /** 진화했다면 진화 전 이름 */
  evolvedFrom: string | null;
}

/** 기술의 실전 가치 — 칸이 찼을 때 무엇을 밀어낼지 고르는 기준 */
function moveValue(m: Move): number {
  // 상태이상기(위력 0)는 위력만 보면 항상 밀려나므로 최소한의 가치를 인정해준다
  if (m.power === 0) return 35;
  return m.power * (m.accuracy / 100);
}

/**
 * 기술 칸이 다 찼을 때 "무엇을 잊을지" 정하는 함수.
 * 잊을 기술의 인덱스를 돌려주고, `null`이면 새 기술을 배우지 않는다.
 * 플레이어에게 물어보기 위해 Promise를 돌려줘도 된다.
 */
export type ForgetResolver = (
  current: Move[],
  incoming: Move,
) => number | null | Promise<number | null>;

/** 기본 정책 — 가장 값이 낮은 기술을 밀어낸다. 새 기술이 더 나쁘면 배우지 않는다. */
export const autoForget: ForgetResolver = (current, incoming) => {
  let worstIdx = 0;
  for (let i = 1; i < current.length; i++) {
    if (moveValue(current[i]) < moveValue(current[worstIdx])) worstIdx = i;
  }
  return moveValue(incoming) <= moveValue(current[worstIdx]) ? null : worstIdx;
};

async function learnMoves(current: Move[], incoming: Move[], resolve: ForgetResolver) {
  const moves = [...current];
  const learned: Move[] = [];
  const forgotten: Move[] = [];

  for (const mv of incoming) {
    if (moves.some((m) => m.id === mv.id)) continue;
    if (moves.length < MAX_MOVES) {
      moves.push(mv);
      learned.push(mv);
      continue;
    }
    const idx = await resolve([...moves], mv);
    if (idx === null || idx < 0 || idx >= moves.length) continue;
    forgotten.push(moves[idx]);
    learned.push(mv);
    moves[idx] = mv;
  }

  return { moves, learned, forgotten };
}

/**
 * `prevLevel` → `monster.level` 사이에 일어나야 할 성장을 전부 적용한다.
 * 여러 레벨이 한 번에 오른 경우(경험치 대량 획득)도 각 레벨을 순서대로 훑는다.
 *
 * 진화 시 능력치는 진화 후 종족의 기본값 위에 레벨 증분을 다시 쌓아 계산한다
 * (`playerStore.normalizeOwnedMonster`와 같은 규칙 — 레벨당 HP+10/공격+3/방어+2/속도+2).
 * 현재 HP는 진화로 늘어난 만큼 함께 늘려 손해가 없게 한다.
 */
export async function applyLevelGrowth<T extends Monster & { currentHp: number }>(
  monster: T,
  prevLevel: number,
  /** 기술 칸이 찼을 때 무엇을 잊을지 — 기본값은 자동 판단, 전투 화면은 플레이어에게 묻는다 */
  resolveForget: ForgetResolver = autoForget,
): Promise<GrowthResult<T>> {
  let result: T = { ...monster };
  const learned: Move[] = [];
  const forgotten: Move[] = [];
  let evolvedFrom: string | null = null;

  for (let lv = prevLevel + 1; lv <= monster.level; lv++) {
    // ── 기술 습득 ──
    const incoming = getLearnableAtLevel(result.id, lv);
    if (incoming.length > 0) {
      const r = await learnMoves(result.moves, incoming, resolveForget);
      result = { ...result, moves: r.moves };
      learned.push(...r.learned);
      forgotten.push(...r.forgotten);
    }

    // ── 진화 ──
    const evolvesAt = result.evolvesAtLevel;
    const evolvesTo = result.evolvesTo;
    if (evolvesTo && evolvesAt !== undefined && lv >= evolvesAt) {
      const next = monsters.find((m) => m.id === evolvesTo);
      if (next) {
        const beforeName = result.name;
        const n = Math.max(0, lv - 1);
        const newMaxHp = next.maxHp + n * 10;
        const hpGain = newMaxHp - result.maxHp;
        result = {
          ...result,
          id: next.id,
          name: next.name,
          type: next.type,
          maxHp: newMaxHp,
          attack: next.attack + n * 3,
          defense: next.defense + n * 2,
          speed: next.speed + n * 2,
          rewardExp: next.rewardExp,
          evolutionStage: next.evolutionStage,
          evolutionChainId: next.evolutionChainId,
          evolvesTo: next.evolvesTo,
          evolvesFrom: next.evolvesFrom,
          evolvesAtLevel: next.evolvesAtLevel,
          currentHp: Math.max(1, result.currentHp + Math.max(0, hpGain)),
        };
        // 진화체가 그 레벨까지 배웠어야 할 기술을 이어서 습득
        const catchUp: Move[] = [];
        for (let l2 = 1; l2 <= lv; l2++) catchUp.push(...getLearnableAtLevel(next.id, l2));
        const r = await learnMoves(result.moves, catchUp, resolveForget);
        result = { ...result, moves: r.moves };
        learned.push(...r.learned);
        forgotten.push(...r.forgotten);
        evolvedFrom = beforeName;
      }
    }
  }

  return { monster: result, learned, forgotten, evolvedFrom };
}
