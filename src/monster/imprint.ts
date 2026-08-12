import type { Monster } from "../shared/game";
import { monsters } from "./monsters";

/**
 * 각인 — 같은 몬스터를 모아 그 **계열 전체**를 강하게 만드는 축.
 *
 * 둥지에서 후보 2~3마리가 전부 같은 풀·같은 등급에서 나오던 시절엔 레벨만 다르고,
 * 레벨은 높은 게 무조건 좋으니 고를 게 없었다. "중복이 자원이 된다"는 규칙이 붙으면
 * 그 자리에 저울이 하나 선다 — 각인 재료냐, 새 식구냐.
 *
 * 단위가 **종이 아니라 계열**인 이유: 종 단위로 세면 진화시키는 순간 각인이 0으로
 * 돌아간다. 그러면 "진화시키면 손해"라는, 수집 게임에서 제일 나쁜 상황이 나온다.
 */

/** 등급 하나당 붙는 능력치 배수 (등급 5 = +25%) */
export const IMPRINT_STEP_BONUS = 0.05;

export const MAX_IMPRINT_TIER = 5;

/** 4·5등급이 요구하는 재료 */
export const IMPRINT_ESSENCE_ID = "monster_essence";

export interface ImprintTierDef {
  tier: number;
  /** 이 등급이 되기까지 **누적**으로 먹인 중복 수 */
  fed: number;
  /** 이 등급으로 올라서는 그 한 마리를 먹일 때 함께 드는 몬스터 정수 */
  essence: number;
}

/**
 * 비용표. 등급을 바꾸고 싶으면 여기만 고친다.
 *
 * 정수를 4·5등급에만 물리는 건 의도다. 초반엔 재료 없이 각인을 시작할 수 있어야 하고,
 * 후반 각인은 고대 숲(이변 풀에 몬스터 정수)으로 플레이어를 끌어당겨야 한다.
 */
export const IMPRINT_TIERS: ImprintTierDef[] = [
  { tier: 1, fed: 1, essence: 0 },
  { tier: 2, fed: 2, essence: 0 },
  { tier: 3, fed: 4, essence: 0 },
  { tier: 4, fed: 6, essence: 3 },
  { tier: 5, fed: 9, essence: 5 },
];

/** 각인의 단위. 계열이 없는 종은 자기 id 가 곧 계열이다 */
export function chainKeyOf(m: Pick<Monster, "id" | "evolutionChainId">): string {
  return m.evolutionChainId ?? m.id;
}

/** 그 계열에 속한 종 전부. 진화 단계 순 */
export function chainMembers(key: string): Monster[] {
  const byChain = monsters.filter((m) => chainKeyOf(m) === key);
  return byChain.sort((a, b) => (a.evolutionStage ?? 1) - (b.evolutionStage ?? 1));
}

/** 화면에 적는 계열 이름 — 계열의 기초 단계 이름을 쓴다 */
export function chainLabel(key: string): string {
  const first = chainMembers(key)[0];
  return first ? `${first.name} 계열` : key;
}

/**
 * 먹인 수 → 등급.
 *
 * **등급은 저장하지 않는다.** 저장하는 건 먹인 수뿐이다 — 그건 일어난 사실이고
 * 등급은 계산이라, 위 비용표를 고칠 때마다 세이브를 손볼 필요가 없다.
 */
export function imprintTier(fed: number): number {
  let tier = 0;
  for (const def of IMPRINT_TIERS) {
    if (fed >= def.fed) tier = def.tier;
  }
  return tier;
}

/** 다음 등급의 비용. 이미 만렙이면 null */
export function nextImprintTier(fed: number): ImprintTierDef | null {
  return IMPRINT_TIERS.find((d) => fed < d.fed) ?? null;
}

/**
 * 지금 한 마리를 더 먹이면 함께 드는 정수.
 *
 * 등급이 오르는 그 한 마리에만 붙는다(누적 5→6 은 3개, 6→7·7→8 은 0개).
 * 정수가 없으면 먹이기 자체를 막는다 — 여기서 그냥 먹여 버리면 "먹인 수는 6인데
 * 등급은 3"인 상태가 생겨 등급 = f(먹인 수) 라는 규칙이 깨진다.
 */
export function essenceCostFor(fed: number): number {
  return IMPRINT_TIERS.find((d) => d.fed === fed + 1)?.essence ?? 0;
}

export function imprintMultiplier(tier: number): number {
  return 1 + IMPRINT_STEP_BONUS * tier;
}

/** 이 몬스터가 속한 계열의 지금 등급 */
export function tierOf(m: Pick<Monster, "id" | "evolutionChainId">, imprint: Record<string, number>): number {
  return imprintTier(imprint[chainKeyOf(m)] ?? 0);
}

/**
 * 각인 전의 능력치.
 *
 * 열거 불가능(non-enumerable)하게 붙인다 — 전개 연산자는 열거 가능한 것만 복사하므로
 * `{...m}` 한 번이면 자국이 사라진다. 즉 자국은 withImprint 가 방금 만든 그 객체에만
 * 남고, 저장·성장·진화를 거친 사본에는 절대 따라붙지 않는다. Symbol 이라 JSON 에도
 * 실리지 않는다.
 */
const IMPRINT_BASE = Symbol("imprintBase");

interface BaseStats {
  maxHp: number; attack: number; defense: number; speed: number;
  currentHp?: number;
}

function baseOf<T extends Monster>(m: T): BaseStats {
  const marked = (m as T & { [IMPRINT_BASE]?: BaseStats })[IMPRINT_BASE];
  if (marked) return marked;
  return {
    maxHp: m.maxHp, attack: m.attack, defense: m.defense, speed: m.speed,
    currentHp: (m as T & { currentHp?: number }).currentHp,
  };
}

/**
 * 각인이 반영된 몬스터를 **새로** 만들어 돌려준다.
 *
 * ⚠ 저장된 능력치에는 절대 손대지 않는다. OwnedMonster 는 능력치를 절대값으로 들고
 * 있어서, 거기에 +5% 를 누적하면 저장·로드·진화를 거칠 때마다 배수가 겹친다. 각인은
 * **읽는 쪽에서만** 얹는 파생값이다 — 장비 보너스와 같은 취급이다.
 *
 * 두 번 걸어도 배수가 겹치지 않는다(위 자국을 보고 원본에서 다시 계산한다).
 */
export function withImprint<T extends Monster>(m: T, imprint: Record<string, number>): T {
  const base = baseOf(m);
  const mult = imprintMultiplier(tierOf(m, imprint));

  const next = {
    ...m,
    maxHp:   Math.round(base.maxHp * mult),
    attack:  Math.round(base.attack * mult),
    defense: Math.round(base.defense * mult),
    speed:   Math.round(base.speed * mult),
  } as T & { currentHp?: number };

  // HP 상한이 올라간 만큼 현재 HP 도 같이 올린다. 안 그러면 각인을 올리는 순간
  // 멀쩡하던 몬스터가 다친 것처럼 보인다. 기절(0)은 0 그대로 둔다.
  if (base.currentHp !== undefined) {
    next.currentHp = base.currentHp > 0
      ? Math.max(1, Math.min(next.maxHp, Math.round(base.currentHp * mult)))
      : 0;
  }

  Object.defineProperty(next, IMPRINT_BASE, { value: base, enumerable: false });
  return next;
}

/**
 * 계열별 각인 현황 한 줄. UI 와 배지가 같은 값을 보게 하려고 여기서 만든다.
 */
export interface ImprintStatus {
  key: string;
  label: string;
  fed: number;
  tier: number;
  /** 다음 등급까지 더 먹여야 하는 중복 수. 만렙이면 0 */
  needFed: number;
  /** 다음 등급에 드는 정수. 만렙이면 0 */
  needEssence: number;
  maxed: boolean;
}

export function imprintStatus(key: string, imprint: Record<string, number>): ImprintStatus {
  const fed = imprint[key] ?? 0;
  const tier = imprintTier(fed);
  const next = nextImprintTier(fed);
  return {
    key,
    label: chainLabel(key),
    fed,
    tier,
    needFed: next ? next.fed - fed : 0,
    needEssence: next ? next.essence : 0,
    maxed: next === null,
  };
}

/** ★★☆☆☆ — 등급을 글자 하나로 */
export function imprintStars(tier: number): string {
  return "★".repeat(tier) + "☆".repeat(MAX_IMPRINT_TIER - tier);
}
