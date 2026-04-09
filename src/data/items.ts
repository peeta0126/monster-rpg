// ─── 재료 ─────────────────────────────────────────────────────────────────────────

export interface Material {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

export const MATERIALS: Material[] = [
  { id: "herb",          name: "약초",      emoji: "🌿", description: "숲에서 자라는 약초. 회복 물약의 재료." },
  { id: "berry",         name: "열매",      emoji: "🍓", description: "새콤달콤한 열매. 해독에 효과적." },
  { id: "root",          name: "나무뿌리",  emoji: "🪵", description: "단단한 나무뿌리. 여러 물약에 쓰인다." },
  { id: "crystal",       name: "빛의 수정", emoji: "💎", description: "숲 깊숙이서 발견되는 수정." },
  // ── 가구 제작 재료 ─────────────────────────────────────────────────────────────
  { id: "wood_plank",    name: "나무판자",  emoji: "🪓", description: "튼튼한 목재 조각. 가구 제작에 쓰인다." },
  { id: "iron_fragment", name: "철 조각",   emoji: "⚙️", description: "단단한 철 파편. 금속 가구의 재료." },
  { id: "leather",       name: "가죽",      emoji: "🟫", description: "부드러운 가죽. 여러 용도로 활용된다." },
];

// ─── 물약 효과 타입 ────────────────────────────────────────────────────────────────

export type PotionEffect =
  | { type: "heal";         amount: number }
  | { type: "full_heal" }
  | { type: "cure_status" }
  | { type: "buff_attack";  multiplier: number; turns: number };

// ─── 물약 ─────────────────────────────────────────────────────────────────────────

export interface Potion {
  id: string;
  name: string;
  emoji: string;
  description: string;
  effect: PotionEffect;
  recipe: Record<string, number>;  // materialId → 필요 수량
}

export const POTIONS: Potion[] = [
  {
    id:          "potion",
    name:        "물약",
    emoji:       "🧪",
    description: "HP를 50 회복한다.",
    effect:      { type: "heal", amount: 50 },
    recipe:      { herb: 2 },
  },
  {
    id:          "super_potion",
    name:        "슈퍼 물약",
    emoji:       "💊",
    description: "HP를 120 회복한다.",
    effect:      { type: "heal", amount: 120 },
    recipe:      { herb: 3, berry: 1 },
  },
  {
    id:          "max_potion",
    name:        "맥스 물약",
    emoji:       "✨",
    description: "HP를 완전 회복한다.",
    effect:      { type: "full_heal" },
    recipe:      { herb: 2, crystal: 1 },
  },
  {
    id:          "antidote",
    name:        "해독제",
    emoji:       "🩹",
    description: "독·화상·마비·빙결 상태를 치료한다.",
    effect:      { type: "cure_status" },
    recipe:      { berry: 2 },
  },
  {
    id:          "attack_buff",
    name:        "전투 물약",
    emoji:       "⚔️",
    description: "3턴간 공격력이 1.5배 증가한다.",
    effect:      { type: "buff_attack", multiplier: 1.5, turns: 3 },
    recipe:      { herb: 1, crystal: 1 },
  },
  {
    id:          "strong_attack_buff",
    name:        "강화 전투 물약",
    emoji:       "🗡️",
    description: "5턴간 공격력이 2배 증가한다.",
    effect:      { type: "buff_attack", multiplier: 2.0, turns: 5 },
    recipe:      { root: 2, crystal: 2 },
  },
];

export function getMaterial(id: string) {
  return MATERIALS.find((m) => m.id === id);
}

export function getPotion(id: string) {
  return POTIONS.find((p) => p.id === id);
}
