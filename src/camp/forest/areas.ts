import { PALETTE, rgba } from "../../shared/palette";

export interface ForestArea {
  id: string; name: string; subtitle: string; description: string;
  monsterPool: string[]; levelRange: [number, number];
  encounterRate: number; materialRate: number; materialBonus: number;
  exploreTime: number;
  danger: number;
  particleType: "leaf" | "firefly" | "crystal";
  skyTop: string; skyBottom: string; fogColor: string; groundColor: string;
  accentColor: string; glowColor: string; borderGlow: string;
  recommendedText: string;
}

export const FOREST_AREAS: ForestArea[] = [
  {
    id: "shallow", name: "얕은 숲", subtitle: "SHALLOW WOODS",
    description: "햇빛이 스며드는 고요한 숲. 초보 탐험가도 부담 없이 도전할 수 있습니다.",
    monsterPool: ["flameling", "aquabe", "leafy", "nobi", "venomcrow", "mossy"],
    levelRange: [1, 8], encounterRate: 0.55, materialRate: 0.40, materialBonus: 0,
    exploreTime: 1200, danger: 1,
    particleType: "leaf",
    skyTop: PALETTE.moss700, skyBottom: PALETTE.shadow800,
    fogColor: rgba("moss500", 0.14), groundColor: PALETTE.moss700,
    accentColor: PALETTE.moss500, glowColor: rgba("moss500", 0.25),
    borderGlow: rgba("moss500", 0.5),
    recommendedText: "추천: 처음 방문 탐험가",
  },
  {
    id: "deep", name: "깊은 숲", subtitle: "DEEP FOREST",
    description: "빛이 닿지 않는 울창한 구역. 강한 몬스터와 희귀 재료가 기다립니다.",
    monsterPool: ["burno", "bubblet", "mossy", "crystafox", "frostorb", "toxadon"],
    levelRange: [8, 18], encounterRate: 0.68, materialRate: 0.55, materialBonus: 1,
    exploreTime: 1500, danger: 3,
    particleType: "firefly",
    skyTop: PALETTE.shadow900, skyBottom: PALETTE.shadow800,
    fogColor: rgba("mist500", 0.10), groundColor: PALETTE.shadow700,
    accentColor: PALETTE.mist500, glowColor: rgba("mist500", 0.22),
    borderGlow: rgba("mist500", 0.55),
    recommendedText: "추천: Lv.5 이상 파티",
  },
  {
    id: "ancient", name: "고대 숲", subtitle: "ANCIENT DEPTHS",
    description: "마력이 깃든 태고의 숲. 전설적인 몬스터가 출몰하며, 생환을 장담할 수 없습니다.",
    monsterPool: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
    levelRange: [18, 32], encounterRate: 0.75, materialRate: 0.65, materialBonus: 2,
    exploreTime: 1800, danger: 5,
    particleType: "crystal",
    skyTop: PALETTE.shadow900, skyBottom: PALETTE.stone600,
    fogColor: rgba("ember700", 0.10), groundColor: PALETTE.earth500,
    accentColor: PALETTE.ember500, glowColor: rgba("ember500", 0.25),
    borderGlow: rgba("ember500", 0.6),
    recommendedText: "⚠ 경고: 고레벨 파티 필수",
  },
];
