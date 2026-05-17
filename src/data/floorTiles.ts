// ─── 바닥 타일 카탈로그 ───────────────────────────────────────────────────────────

export interface FloorTileStyle {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  normalBg: string;
  normalOutline: string;
  hoverBg: string;
  hoverOutline: string;
  recipe: Record<string, number>;
}

export const FLOOR_TILES: FloorTileStyle[] = [
  {
    id: "wood",
    name: "나무 바닥",
    emoji: "🪵",
    description: "따뜻한 참나무 재질의 기본 바닥입니다.",
    rarity: "common",
    normalBg:      "rgba(148, 92, 40, 0.90)",
    normalOutline: "rgba(64, 30, 8, 0.95)",
    hoverBg:       "rgba(244, 169, 54, 0.68)",
    hoverOutline:  "rgba(180, 108, 16, 0.95)",
    recipe: {},
  },
  {
    id: "stone",
    name: "돌 바닥",
    emoji: "🪨",
    description: "성벽 돌로 깔린 단단한 바닥입니다.",
    rarity: "common",
    normalBg:      "rgba(96, 84, 68, 0.90)",
    normalOutline: "rgba(40, 32, 20, 0.95)",
    hoverBg:       "rgba(156, 140, 108, 0.68)",
    hoverOutline:  "rgba(88, 72, 48, 0.95)",
    recipe: { iron_fragment: 1 },
  },
  {
    id: "cafe",
    name: "카페 타일",
    emoji: "☕",
    description: "고급스러운 카페 스타일 타일입니다.",
    rarity: "rare",
    normalBg:      "rgba(204, 176, 132, 0.88)",
    normalOutline: "rgba(128, 96, 48, 0.92)",
    hoverBg:       "rgba(244, 216, 164, 0.72)",
    hoverOutline:  "rgba(176, 128, 68, 0.95)",
    recipe: { leather: 1, wood_plank: 2 },
  },
  {
    id: "rug",
    name: "러그 바닥",
    emoji: "🟥",
    description: "부드럽고 따뜻한 러그 느낌의 바닥입니다.",
    rarity: "rare",
    normalBg:      "rgba(140, 40, 32, 0.88)",
    normalOutline: "rgba(72, 16, 12, 0.92)",
    hoverBg:       "rgba(196, 72, 60, 0.68)",
    hoverOutline:  "rgba(136, 32, 24, 0.95)",
    recipe: { leather: 2, wood_plank: 1 },
  },
  {
    id: "crystal",
    name: "수정 바닥",
    emoji: "💎",
    description: "빛을 반사하는 신비로운 수정 바닥입니다.",
    rarity: "epic",
    normalBg:      "rgba(64, 116, 208, 0.82)",
    normalOutline: "rgba(32, 64, 160, 0.92)",
    hoverBg:       "rgba(124, 184, 252, 0.68)",
    hoverOutline:  "rgba(80, 136, 220, 0.95)",
    recipe: { crystal: 2, iron_fragment: 1 },
  },
  {
    id: "dark",
    name: "어둠 바닥",
    emoji: "🌑",
    description: "어두운 판타지 분위기의 검은 대리석 바닥입니다.",
    rarity: "legendary",
    normalBg:      "rgba(20, 12, 32, 0.92)",
    normalOutline: "rgba(76, 44, 100, 0.92)",
    hoverBg:       "rgba(56, 32, 84, 0.80)",
    hoverOutline:  "rgba(120, 76, 156, 0.95)",
    recipe: { crystal: 3, iron_fragment: 2 },
  },
];

export function getFloorTile(id: string): FloorTileStyle {
  return FLOOR_TILES.find((t) => t.id === id) ?? FLOOR_TILES[0];
}
