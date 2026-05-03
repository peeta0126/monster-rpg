// ─── 벽 장식품 카탈로그 ───────────────────────────────────────────────────────────

export interface WallDecoration {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  /** 배치 가능한 벽면 */
  wall: "left" | "right" | "both";
  /** 제작 레시피 */
  recipe: Record<string, number>;
}

export const WALL_DECORATIONS: WallDecoration[] = [
  {
    id: "picture_frame",
    name: "나무 액자",
    emoji: "🖼️",
    description: "모험의 기억을 담은 나무 액자입니다.",
    rarity: "common",
    wall: "both",
    recipe: { wood_plank: 2 },
  },
  {
    id: "window",
    name: "창문",
    emoji: "🪟",
    description: "바깥 풍경이 보이는 나무 창문입니다.",
    rarity: "common",
    wall: "both",
    recipe: { wood_plank: 3, iron_fragment: 1 },
  },
  {
    id: "wall_lamp",
    name: "벽걸이 램프",
    emoji: "🕯️",
    description: "따뜻한 불빛을 내는 벽걸이 램프입니다.",
    rarity: "rare",
    wall: "both",
    recipe: { iron_fragment: 2, wood_plank: 1 },
  },
  {
    id: "small_shelf",
    name: "작은 선반",
    emoji: "📚",
    description: "책과 소품을 올려놓는 선반입니다.",
    rarity: "common",
    wall: "both",
    recipe: { wood_plank: 3 },
  },
  {
    id: "trophy",
    name: "트로피",
    emoji: "🏆",
    description: "모험으로 얻은 전설의 트로피입니다.",
    rarity: "epic",
    wall: "both",
    recipe: { iron_fragment: 3, crystal: 1 },
  },
  {
    id: "magic_mirror",
    name: "마법 거울",
    emoji: "🪞",
    description: "신비로운 힘을 담은 마법 거울입니다.",
    rarity: "epic",
    wall: "both",
    recipe: { crystal: 3, iron_fragment: 2 },
  },
  {
    id: "monster_poster",
    name: "몬스터 포스터",
    emoji: "🦎",
    description: "강한 몬스터가 그려진 포스터입니다.",
    rarity: "rare",
    wall: "both",
    recipe: { leather: 2, wood_plank: 1 },
  },
  {
    id: "herb_wreath",
    name: "약초 리스",
    emoji: "🌿",
    description: "신선한 약초로 만든 벽걸이 장식입니다.",
    rarity: "common",
    wall: "both",
    recipe: { herb: 3 },
  },
  {
    id: "weapon_rack",
    name: "무기 걸이",
    emoji: "⚔️",
    description: "무기를 걸어두는 장식 선반입니다.",
    rarity: "rare",
    wall: "both",
    recipe: { iron_fragment: 4, wood_plank: 2 },
  },
  {
    id: "crystal_lamp",
    name: "수정 조명",
    emoji: "✨",
    description: "수정이 반짝이는 신비로운 벽걸이 조명입니다.",
    rarity: "legendary",
    wall: "both",
    recipe: { crystal: 4, iron_fragment: 2 },
  },
];

export function getWallDecoration(id: string): WallDecoration | undefined {
  return WALL_DECORATIONS.find((d) => d.id === id);
}
