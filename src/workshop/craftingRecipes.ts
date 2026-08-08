import type { ArtifactStatBonus, CraftingDifficulty, CraftingRecipe, CraftingStationType } from "../shared/crafting";
import { PALETTE } from "../shared/palette";

export const DIFFICULTY_LABEL: Record<CraftingDifficulty, string> = {
  easy:   "쉬움",
  normal: "보통",
  hard:   "어려움",
};

export const DIFFICULTY_COLOR: Record<CraftingDifficulty, string> = {
  easy:   PALETTE.moss500,
  normal: PALETTE.ember500,
  hard:   PALETTE.ember700,
};

export const STATION_LABEL: Record<CraftingStationType, string> = {
  artifact: "아티팩트 제작대",
  potion:   "연금술 제작대",
};

// ─── 아티팩트 레시피 ──────────────────────────────────────────────────────────
// 재료 ID는 src/shared/items.ts 의 MATERIALS 기준

export const ARTIFACT_RECIPES: CraftingRecipe[] = [
  {
    id:             "power_necklace",
    name:           "힘의 목걸이",
    description:    "장착한 몬스터의 공격력을 높여주는 기본 아티팩트입니다.",
    difficulty:     "easy",
    stationType:    "artifact",
    costs: [
      { itemId: "iron_fragment",   name: "철 조각",     amount: 2 },
      { itemId: "monster_essence", name: "몬스터 정수", amount: 1 },
      { itemId: "crystal",         name: "빛의 수정",   amount: 1 },
    ],
    resultItemId:   "power_necklace",
    resultItemName: "힘의 목걸이",
    baseStats: [{ stat: "attack" as ArtifactStatBonus["stat"], value: 8 }, { stat: "critRate" as ArtifactStatBonus["stat"], value: 2 }],
  },
  {
    id:             "guard_bracelet",
    name:           "수호의 팔찌",
    description:    "장착한 몬스터의 방어력을 보조하는 아티팩트입니다.",
    difficulty:     "normal",
    stationType:    "artifact",
    costs: [
      { itemId: "wood_plank",    name: "나무판자",  amount: 2 },
      { itemId: "iron_fragment", name: "철 조각",   amount: 1 },
      { itemId: "magic_dust",    name: "마법 가루", amount: 1 },
    ],
    resultItemId:   "guard_bracelet",
    resultItemName: "수호의 팔찌",
    baseStats: [{ stat: "defense" as ArtifactStatBonus["stat"], value: 7 }, { stat: "hp" as ArtifactStatBonus["stat"], value: 20 }],
  },
  {
    id:             "spirit_amulet",
    name:           "정령의 부적",
    description:    "희귀한 기운이 담긴 강화형 아티팩트입니다.",
    difficulty:     "hard",
    stationType:    "artifact",
    costs: [
      { itemId: "crystal",         name: "빛의 수정",   amount: 2 },
      { itemId: "monster_essence", name: "몬스터 정수", amount: 2 },
      { itemId: "magic_dust",      name: "마법 가루",   amount: 2 },
    ],
    resultItemId:   "spirit_amulet",
    resultItemName: "정령의 부적",
    baseStats: [{ stat: "elementPower" as ArtifactStatBonus["stat"], value: 6 }, { stat: "speed" as ArtifactStatBonus["stat"], value: 3 }],
  },
];

// ─── 물약 레시피 ──────────────────────────────────────────────────────────────
// resultItemId는 src/shared/items.ts 의 POTIONS ID와 일치 → craftWorkshopRecipe에서 potions 레코드에 추가

export const POTION_RECIPES: CraftingRecipe[] = [
  {
    id:             "ws_small_potion",
    name:           "작은 회복 물약",
    description:    "전투 중 체력을 조금 회복합니다.",
    difficulty:     "easy",
    stationType:    "potion",
    costs: [
      { itemId: "herb", name: "약초",    amount: 2 },
      { itemId: "root", name: "나무뿌리", amount: 1 },
    ],
    resultItemId:   "potion",           // items.ts POTIONS[0].id
    resultItemName: "물약",
  },
  {
    id:             "ws_focus_potion",
    name:           "집중의 물약",
    description:    "일정 시간 동안 공격력을 높여주는 물약입니다.",
    difficulty:     "normal",
    stationType:    "potion",
    costs: [
      { itemId: "herb",          name: "약초",        amount: 1 },
      { itemId: "slime_extract", name: "슬라임 추출물", amount: 1 },
      { itemId: "magic_dust",    name: "마법 가루",   amount: 1 },
    ],
    resultItemId:   "attack_buff",      // items.ts POTIONS[4].id
    resultItemName: "전투 물약",
  },
  {
    id:             "ws_large_potion",
    name:           "강력 회복 물약",
    description:    "더 높은 회복 효과를 가진 물약입니다.",
    difficulty:     "hard",
    stationType:    "potion",
    costs: [
      { itemId: "herb",            name: "약초",       amount: 3 },
      { itemId: "root",            name: "나무뿌리",   amount: 2 },
      { itemId: "monster_essence", name: "몬스터 정수", amount: 1 },
    ],
    resultItemId:   "super_potion",     // items.ts POTIONS[1].id
    resultItemName: "슈퍼 물약",
  },
  {
    // items.ts의 POTIONS에는 맥스 물약·해독제가 있는데 공방 레시피가 없어 획득할 방법이
    // 아예 없었다(store의 craftPotion은 어떤 화면에서도 호출되지 않는다).
    id:             "ws_max_potion",
    name:           "맥스 물약",
    description:    "HP를 완전히 회복시키는 상급 물약입니다.",
    difficulty:     "hard",
    stationType:    "potion",
    costs: [
      { itemId: "herb",            name: "약초",        amount: 3 },
      { itemId: "crystal",         name: "빛의 수정",    amount: 1 },
      { itemId: "monster_essence", name: "몬스터 정수",  amount: 1 },
    ],
    resultItemId:   "max_potion",
    resultItemName: "맥스 물약",
  },
  {
    id:             "ws_antidote",
    name:           "해독제",
    description:    "독·화상·마비·빙결 상태를 치료합니다.",
    difficulty:     "easy",
    stationType:    "potion",
    costs: [
      { itemId: "berry", name: "열매", amount: 2 },
    ],
    resultItemId:   "antidote",
    resultItemName: "해독제",
  },
  {
    id:             "ws_strong_focus_potion",
    name:           "강한 집중의 물약",
    description:    "더 오래, 더 크게 공격력을 끌어올립니다.",
    difficulty:     "hard",
    stationType:    "potion",
    costs: [
      { itemId: "herb",       name: "약초",      amount: 2 },
      { itemId: "crystal",    name: "빛의 수정",  amount: 1 },
      { itemId: "magic_dust", name: "마법 가루",  amount: 1 },
    ],
    resultItemId:   "strong_attack_buff",
    resultItemName: "강력 전투 물약",
  },
  {
    id:             "ws_mothers_cure",
    name:           "어머니의 치료약",
    description:    "만물의 정수로 만든, 모든 원소의 파장을 씻어내는 치료약입니다.",
    difficulty:     "hard",
    stationType:    "potion",
    costs: [
      { itemId: "ormr_essence", name: "만물의 정수", amount: 1 },
    ],
    resultItemId:   "mothers_cure_potion",  // items.ts POTIONS엔 없음 — 전투에서 쓰이지 않는 엔딩 전용 아이템
    resultItemName: "어머니의 치료약",
  },
];

export const CRAFTING_RECIPES: CraftingRecipe[] = [...ARTIFACT_RECIPES, ...POTION_RECIPES];

export function getCraftingRecipe(id: string) {
  return CRAFTING_RECIPES.find((r) => r.id === id);
}
