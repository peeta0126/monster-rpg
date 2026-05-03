// ─── 벽지 카탈로그 ────────────────────────────────────────────────────────────────

export interface Wallpaper {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  /** SVG linearGradient: 백코너(밝음) → 왼쪽코너(어둠) */
  leftColor1: string;
  leftColor2: string;
  /** SVG linearGradient: 백코너(밝음) → 오른쪽코너(어둠) */
  rightColor1: string;
  rightColor2: string;
  /** 벽 상단 몰딩/테두리 색 */
  trimColor: string;
  /** 재료 아이디 → 수량 (제작 레시피 – 빈 객체 = 기본 지급) */
  recipe: Record<string, number>;
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "wood",
    name: "나무 벽지",
    emoji: "🪵",
    description: "자연스러운 나무 질감의 따뜻한 벽지입니다.",
    rarity: "common",
    leftColor1: "#7a5232",
    leftColor2: "#4a2e14",
    rightColor1: "#9b6e44",
    rightColor2: "#6a4020",
    trimColor: "#3a2010",
    recipe: {},
  },
  {
    id: "brick",
    name: "벽돌 벽지",
    emoji: "🧱",
    description: "견고한 붉은 벽돌로 쌓인 든든한 벽입니다.",
    rarity: "common",
    leftColor1: "#8a3020",
    leftColor2: "#5a1808",
    rightColor1: "#aa4a38",
    rightColor2: "#7a2818",
    trimColor: "#5a1808",
    recipe: { wood_plank: 2 },
  },
  {
    id: "cafe",
    name: "카페 벽지",
    emoji: "☕",
    description: "아늑한 카페 분위기의 따뜻한 베이지 벽지입니다.",
    rarity: "rare",
    leftColor1: "#c0a870",
    leftColor2: "#907040",
    rightColor1: "#d4bc88",
    rightColor2: "#a08050",
    trimColor: "#806030",
    recipe: { leather: 1, wood_plank: 2 },
  },
  {
    id: "fantasy",
    name: "어둠 판타지",
    emoji: "🔮",
    description: "신비로운 마법 에너지가 흐르는 어두운 벽입니다.",
    rarity: "epic",
    leftColor1: "#2a1448",
    leftColor2: "#120828",
    rightColor1: "#3c1c60",
    rightColor2: "#1e0c38",
    trimColor: "#7040c0",
    recipe: { crystal: 2, wood_plank: 1 },
  },
  {
    id: "stone",
    name: "돌 벽지",
    emoji: "🪨",
    description: "차갑고 견고한 성벽 느낌의 돌벽입니다.",
    rarity: "rare",
    leftColor1: "#606060",
    leftColor2: "#383838",
    rightColor1: "#787878",
    rightColor2: "#484848",
    trimColor: "#282828",
    recipe: { iron_fragment: 2 },
  },
  {
    id: "crystal",
    name: "수정 벽지",
    emoji: "💎",
    description: "빛을 발하는 신비로운 수정 벽입니다.",
    rarity: "legendary",
    leftColor1: "#2040a0",
    leftColor2: "#102060",
    rightColor1: "#3060c8",
    rightColor2: "#183080",
    trimColor: "#60a0ff",
    recipe: { crystal: 4, iron_fragment: 2 },
  },
];

export function getWallpaper(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
