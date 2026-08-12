import type { ElementType } from "../shared/game";

/**
 * 속성 상성표: typeChart[공격속성][방어속성] = 배율
 *
 * 2배  : 효과가 굉장했다!
 * 0.5배: 효과가 별로인 듯하다...
 * (미정의) = 1배 기본
 */
export const typeChart: Record<ElementType, Partial<Record<ElementType, number>>> = {
  fire: {
    grass: 2,     // 불 → 풀: 2배
    ice: 2,       // 불 → 얼음: 2배
    water: 0.5,   // 불 → 물: 0.5배
    fire: 0.5,
  },
  water: {
    fire: 2,       // 물 → 불: 2배
    grass: 0.5,    // 물 → 풀: 0.5배
    water: 0.5,
    electric: 0.5, // 물 → 전기: 0.5배
  },
  electric: {
    water: 2,      // 전기 → 물: 2배
    grass: 0.5,    // 전기 → 풀: 0.5배
    electric: 0.5,
  },
  grass: {
    water: 2,      // 풀 → 물: 2배
    fire: 0.5,     // 풀 → 불: 0.5배
    grass: 0.5,
  },
  ice: {
    grass: 2,      // 얼음 → 풀: 2배
    fire: 0.5,     // 얼음 → 불: 0.5배
    ice: 0.5,
  },
  normal: {},
  poison: {
    grass: 2,    // 독 → 풀: 2배
    poison: 0.5, // 독 → 독: 0.5배
  },
};

/**
 * 화면에 상성표를 그릴 때 쓰는 속성 순서. 위 선언 순서를 그대로 따르므로 속성을 추가하면
 * 표도 저절로 늘어난다 — 순서를 따로 적어 두면 새 속성이 표에서만 빠진다.
 */
export const ELEMENT_ORDER = Object.keys(typeChart) as ElementType[];
