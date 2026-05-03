// ─── 바닥 타일 카탈로그 ───────────────────────────────────────────────────────────

export interface FloorTileStyle {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  /** 기본 타일 배경색 (CSS rgba) */
  normalBg: string;
  normalOutline: string;
  /** 호버/선택 시 배경색 */
  hoverBg: string;
  hoverOutline: string;
  /** 제작 레시피 (빈 = 기본 지급) */
  recipe: Record<string, number>;
}

export const FLOOR_TILES: FloorTileStyle[] = [
  {
    id: "wood",
    name: "나무 바닥",
    emoji: "🪵",
    description: "따뜻한 나무 재질의 기본 바닥입니다.",
    rarity: "common",
    normalBg: "rgba(180,140,90,0.45)",
    normalOutline: "rgba(120,80,40,0.35)",
    hoverBg: "rgba(220,190,130,0.65)",
    hoverOutline: "rgba(200,160,80,0.8)",
    recipe: {},
  },
  {
    id: "stone",
    name: "돌 바닥",
    emoji: "🪨",
    description: "단단한 돌 타일 바닥입니다.",
    rarity: "common",
    normalBg: "rgba(115,115,125,0.5)",
    normalOutline: "rgba(75,75,85,0.5)",
    hoverBg: "rgba(155,155,168,0.65)",
    hoverOutline: "rgba(115,115,138,0.8)",
    recipe: { iron_fragment: 1 },
  },
  {
    id: "cafe",
    name: "카페 타일",
    emoji: "☕",
    description: "고급스러운 카페 스타일 타일입니다.",
    rarity: "rare",
    normalBg: "rgba(218,198,162,0.5)",
    normalOutline: "rgba(178,152,108,0.5)",
    hoverBg: "rgba(238,218,178,0.7)",
    hoverOutline: "rgba(198,168,112,0.9)",
    recipe: { leather: 1, wood_plank: 2 },
  },
  {
    id: "rug",
    name: "러그 바닥",
    emoji: "🟥",
    description: "부드럽고 따뜻한 러그 느낌의 바닥입니다.",
    rarity: "rare",
    normalBg: "rgba(155,55,50,0.42)",
    normalOutline: "rgba(115,38,33,0.42)",
    hoverBg: "rgba(195,75,68,0.62)",
    hoverOutline: "rgba(158,48,43,0.82)",
    recipe: { leather: 2, wood_plank: 1 },
  },
  {
    id: "crystal",
    name: "수정 바닥",
    emoji: "💎",
    description: "빛을 반사하는 신비로운 수정 바닥입니다.",
    rarity: "epic",
    normalBg: "rgba(90,140,215,0.38)",
    normalOutline: "rgba(65,112,192,0.42)",
    hoverBg: "rgba(130,182,248,0.55)",
    hoverOutline: "rgba(105,152,228,0.82)",
    recipe: { crystal: 2, iron_fragment: 1 },
  },
  {
    id: "dark",
    name: "어둠 바닥",
    emoji: "🌑",
    description: "어두운 판타지 분위기의 검은 대리석 바닥입니다.",
    rarity: "legendary",
    normalBg: "rgba(28,18,38,0.72)",
    normalOutline: "rgba(75,45,98,0.52)",
    hoverBg: "rgba(55,35,75,0.78)",
    hoverOutline: "rgba(115,75,145,0.82)",
    recipe: { crystal: 3, iron_fragment: 2 },
  },
];

export function getFloorTile(id: string): FloorTileStyle {
  return FLOOR_TILES.find((t) => t.id === id) ?? FLOOR_TILES[0];
}
