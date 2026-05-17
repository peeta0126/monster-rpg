// ─── 벽지 카탈로그 ────────────────────────────────────────────────────────────────

export interface Wallpaper {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  leftColor1: string;
  leftColor2: string;
  rightColor1: string;
  rightColor2: string;
  trimColor: string;
  recipe: Record<string, number>;
}

export const WALLPAPERS: Wallpaper[] = [
  {
    id: "wood",
    name: "나무 벽지",
    emoji: "🪵",
    description: "자연스러운 참나무 패널의 따뜻한 벽입니다.",
    rarity: "common",
    leftColor1: "#6A3C18",   // 중세 목재 패널 — 왼벽 상단
    leftColor2: "#3C1E08",   // 왼벽 하단
    rightColor1: "#8A5228",  // 오른벽 상단 (밝은 면)
    rightColor2: "#502A0C",  // 오른벽 하단
    trimColor: "#2C1406",    // 걸레받이/몰딩
    recipe: {},
  },
  {
    id: "brick",
    name: "벽돌 벽지",
    emoji: "🧱",
    description: "견고한 붉은 벽돌로 쌓인 든든한 성벽입니다.",
    rarity: "common",
    leftColor1: "#8C2E1A",   // 풍화된 붉은 벽돌
    leftColor2: "#561408",   // 그늘진 벽돌
    rightColor1: "#B24838",  // 밝은 면 벽돌
    rightColor2: "#742416",  // 어두운 면
    trimColor: "#4A1008",    // 시멘트/걸레받이
    recipe: { wood_plank: 2 },
  },
  {
    id: "cafe",
    name: "카페 벽지",
    emoji: "☕",
    description: "아늑한 카페 분위기의 따뜻한 베이지 벽지입니다.",
    rarity: "rare",
    leftColor1: "#B89858",
    leftColor2: "#886830",
    rightColor1: "#CEAE70",
    rightColor2: "#9A7840",
    trimColor: "#705020",
    recipe: { leather: 1, wood_plank: 2 },
  },
  {
    id: "fantasy",
    name: "어둠 판타지",
    emoji: "🔮",
    description: "신비로운 마법 에너지가 흐르는 어두운 벽입니다.",
    rarity: "epic",
    leftColor1: "#261040",
    leftColor2: "#100620",
    rightColor1: "#361858",
    rightColor2: "#180A30",
    trimColor: "#6030A8",
    recipe: { crystal: 2, wood_plank: 1 },
  },
  {
    id: "stone",
    name: "돌 벽지",
    emoji: "🪨",
    description: "차갑고 견고한 성벽 느낌의 화강암 벽입니다.",
    rarity: "rare",
    leftColor1: "#5A5248",   // 화강암 회갈색
    leftColor2: "#302820",   // 어두운 돌
    rightColor1: "#706458",  // 밝은 화강암
    rightColor2: "#403428",  // 어두운 면
    trimColor: "#201810",    // 석재 바닥
    recipe: { iron_fragment: 2 },
  },
  {
    id: "crystal",
    name: "수정 벽지",
    emoji: "💎",
    description: "빛을 발하는 신비로운 수정 벽입니다.",
    rarity: "legendary",
    leftColor1: "#183898",
    leftColor2: "#0C1C58",
    rightColor1: "#2858C8",
    rightColor2: "#142878",
    trimColor: "#5898FF",
    recipe: { crystal: 4, iron_fragment: 2 },
  },
];

export function getWallpaper(id: string): Wallpaper {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}
