import type { ElementType } from "../shared/game";

/**
 * 속성 상성표: typeChart[공격속성][방어속성] = 배율
 *
 * 2배  : 효과가 굉장했다!
 * 0.5배: 효과가 별로인 듯하다...
 * (미정의) = 1배 기본
 *
 * ── 모든 속성에 약점이 하나씩 있어야 한다 ──────────────────────────────────
 * 전수 계산을 해 보면 예전 표에는 구멍이 셋 있었다. electric·normal·poison 은
 * 2배로 맞는 상대가 아예 없고(=영원히 안전하다), grass 는 반대로 약점이 셋인데
 * 2배로 때리는 상대는 water 하나뿐이라 데려갈 이유가 없었다. 시작 몬스터 모시와
 * 40층 보스 모왕이 둘 다 electric 이라, 그 구멍이 곧 게임 전체의 난이도였다.
 *
 * 그래서 칸 셋만 더했다(표를 갈아엎지 않았다):
 *   grass  → electric 2배. 전기의 약점. 덤으로 풀을 쓸 이유가 생긴다.
 *   ice    → poison   2배. 독의 약점. 얼음도 때릴 상대가 둘로 늘어난다.
 *   poison → normal   2배. 노말의 약점. 독한테도 풀 말고 다른 먹이가 생긴다.
 *
 * 결과로 fire → grass → electric → water → fire 가 물고 물리는 순환이 되고,
 * 그 바깥에 ice → poison → normal 이 붙는다. 어느 속성도 혼자 안전하지 않다.
 *
 * normal 은 때리는 쪽 줄이 빈 채로 둔다(상성이 없는 대신 최상급 기술 위력이 제일
 * 높은 게 이 속성의 성격이다). 맞는 쪽에만 약점을 하나 줬다.
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
    electric: 2,   // 풀 → 전기: 2배 (뿌리가 전기를 땅으로 흘린다)
    fire: 0.5,     // 풀 → 불: 0.5배
    grass: 0.5,
  },
  ice: {
    grass: 2,      // 얼음 → 풀: 2배
    poison: 2,     // 얼음 → 독: 2배 (독이 얼어 굳는다)
    fire: 0.5,     // 얼음 → 불: 0.5배
    ice: 0.5,
  },
  normal: {},
  poison: {
    grass: 2,    // 독 → 풀: 2배
    normal: 2,   // 독 → 노말: 2배 (평범한 살일수록 독이 잘 돈다)
    poison: 0.5, // 독 → 독: 0.5배
  },
};

/**
 * 화면에 상성표를 그릴 때 쓰는 속성 순서. 위 선언 순서를 그대로 따르므로 속성을 추가하면
 * 표도 저절로 늘어난다. 순서를 따로 적어 두면 새 속성이 표에서만 빠진다.
 */
export const ELEMENT_ORDER = Object.keys(typeChart) as ElementType[];
