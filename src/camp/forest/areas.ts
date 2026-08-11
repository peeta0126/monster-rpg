import { PALETTE, rgba } from "../../shared/palette";
import { FOREST_BG_SHALLOW, FOREST_BG_DEEP, FOREST_BG_ANCIENT } from "../../shared/assetPaths";

export type ForestAreaId = "shallow" | "deep" | "ancient";

export interface ForestArea {
  id: ForestAreaId; name: string; subtitle: string; description: string;
  monsterPool: string[]; levelRange: [number, number];
  /** 이 구역이 열리는 탑 최고 층. 예전엔 ForestPage JSX 에 숫자로 박혀 있었고
   *  시뮬레이터는 자기 사본에만 들고 있어서, 한쪽만 고치면 측정이 어긋났다. */
  unlockFloor: number;
  encounterRate: number; materialRate: number; materialBonus: number;
  /**
   * 이 구역에 들어설 때의 소란도.
   *
   * 늘 0 에서 시작하면 초반 노드는 무조건 배수 1.0 을 받는다 — 구간 계수를 아무리
   * 가파르게 해도 런 앞쪽 절반은 다이얼이 없는 거나 마찬가지였다. 깊은 곳일수록
   * 숲이 처음부터 깨어 있다고 두면, 구역 선택 자체가 이미 난이도 축이라 자연스럽다.
   */
  startingAlert: number;
  exploreTime: number;
  particleType: "leaf" | "firefly" | "crystal";
  /** 이 구역의 배경. ForestBackdrop 이 3장을 다 깔아 두고 opacity 로 넘긴다. */
  backgroundImage: string;
  /**
   * 속성 칩에 진짜 속성을 적을지. 고대 숲은 `?` 로 가린다 — 정보를 감추면 위협감이
   * 생기고, 칩 자리가 비어 카드가 헐거워 보이지도 않는다.
   */
  revealTypes: boolean;
  accentColor: string; glowColor: string; borderGlow: string;
  recommendedText: string;
}

/**
 * 숲 구역 표 — 이름·레벨·해금 조건부터 강조색·배경 이미지까지 여기 한 벌만 둔다.
 *
 * 강조색은 티어가 올라갈수록 빨개지는 대신 축을 바꾼다. 초록(moss) → 청록(mist) →
 * 금·주황(ember). 빨강 다음에 더 빨간 색은 없어서, 위험을 색으로 계속 올리려면
 * 어딘가에서 다른 축으로 갈아타야 한다.
 */
export const FOREST_AREAS: ForestArea[] = [
  {
    id: "shallow", name: "얕은 숲", subtitle: "SHALLOW WOODS",
    description: "햇빛이 스며드는 고요한 숲. 초보 탐험가도 부담 없이 도전할 수 있습니다.",
    monsterPool: ["flameling", "aquabe", "leafy", "nobi", "venomcrow", "mossy"],
    levelRange: [1, 8], unlockFloor: 0, encounterRate: 0.55, materialRate: 0.40, materialBonus: 0,
    startingAlert: 0,
    exploreTime: 1200,
    particleType: "leaf",
    backgroundImage: FOREST_BG_SHALLOW,
    revealTypes: true,
    accentColor: PALETTE.moss500, glowColor: rgba("moss500", 0.25),
    borderGlow: rgba("moss500", 0.5),
    recommendedText: "추천: 처음 방문 탐험가",
  },
  {
    id: "deep", name: "깊은 숲", subtitle: "DEEP FOREST",
    description: "빛이 닿지 않는 울창한 구역. 강한 몬스터와 희귀 재료가 기다립니다.",
    monsterPool: ["burno", "bubblet", "mossy", "crystafox", "frostorb", "toxadon"],
    levelRange: [8, 18], unlockFloor: 11, encounterRate: 0.68, materialRate: 0.55, materialBonus: 1,
    startingAlert: 15,
    exploreTime: 1500,
    particleType: "firefly",
    backgroundImage: FOREST_BG_DEEP,
    revealTypes: true,
    accentColor: PALETTE.mist500, glowColor: rgba("mist500", 0.22),
    borderGlow: rgba("mist500", 0.55),
    recommendedText: "추천: Lv.5 이상 파티",
  },
  {
    id: "ancient", name: "고대 숲", subtitle: "ANCIENT DEPTHS",
    description: "마력이 깃든 태고의 숲. 전설적인 몬스터가 출몰하며, 생환을 장담할 수 없습니다.",
    monsterPool: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
    levelRange: [18, 32], unlockFloor: 21, encounterRate: 0.75, materialRate: 0.65, materialBonus: 2,
    startingAlert: 30,
    exploreTime: 1800,
    particleType: "crystal",
    backgroundImage: FOREST_BG_ANCIENT,
    revealTypes: false,
    accentColor: PALETTE.ember500, glowColor: rgba("ember500", 0.25),
    borderGlow: rgba("ember500", 0.6),
    recommendedText: "⚠ 경고: 고레벨 파티 필수",
  },
];

/** 해금 조건 한 줄. 잠긴 카드에서 버튼 자리에 그대로 들어간다. */
export function unlockLabel(area: ForestArea): string {
  return `무한의 탑 ${area.unlockFloor}층 도달 시 해금`;
}

/**
 * 기본으로 골라 둘 구역 — 갈 수 있는 것 중 가장 높은 티어.
 * 전부 잠겨 있으면 얕은 숲(unlockFloor 0 이라 실제로는 늘 열려 있다).
 */
export function highestUnlockedArea(bestFloor: number): ForestArea {
  const open = FOREST_AREAS.filter((a) => bestFloor >= a.unlockFloor);
  return open[open.length - 1] ?? FOREST_AREAS[0];
}
