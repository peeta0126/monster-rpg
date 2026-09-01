import type { IconName } from "./ui/icons";

// ─── 재료 ─────────────────────────────────────────────────────────────────────────

export interface Material {
  id: string;
  name: string;
  /** shared/ui/PixelIcon 의 아이콘 이름. 표를 두 벌로 안 만들려고 id 와 같게 둔다 */
  icon: IconName;
  description: string;
}

export const MATERIALS: Material[] = [
  { id: "herb",          name: "약초",      icon: "herb", description: "숲에서 자라는 약초. 회복 물약의 재료." },
  { id: "berry",         name: "열매",      icon: "berry", description: "새콤달콤한 열매. 해독에 효과적." },
  { id: "root",          name: "나무뿌리",  icon: "root", description: "단단한 나무뿌리. 여러 물약에 쓰인다." },
  { id: "crystal",       name: "빛의 수정", icon: "crystal", description: "숲 깊숙이서 발견되는 수정." },
  // ── 제작 공방 재료 ─────────────────────────────────────────────────────────────
  { id: "wood_plank",       name: "나무판자",      icon: "wood_plank", description: "튼튼한 목재 조각. 아티팩트 제작에 쓰인다." },
  { id: "iron_fragment",    name: "철 조각",       icon: "iron_fragment", description: "단단한 철 파편. 금속 아티팩트의 재료." },
  { id: "leather",          name: "가죽",          icon: "leather", description: "부드러운 가죽. 여러 용도로 활용된다." },
  { id: "monster_essence",  name: "몬스터 정수",   icon: "monster_essence", description: "몬스터를 쓰러뜨리면 얻을 수 있는 신비로운 정수." },
  { id: "slime_extract",    name: "슬라임 추출물", icon: "slime_extract", description: "슬라임류 몬스터에서 얻는 점성 물질. 물약 제조에 쓰인다." },
  { id: "magic_dust",       name: "마법 가루",     icon: "magic_dust", description: "마력이 응축된 희귀한 가루. 고급 제조에 사용된다." },
  // ── 장비 성장 재료 ────────────────────────────────────────────────────────────
  { id: "enhancement_stone", name: "강화석", icon: "enhancement_stone", description: "장비의 레벨을 올리는 데 사용되는 재료. 장비 분해 시 획득한다." },
  // ── 최종 보스 재료 ────────────────────────────────────────────────────────────
  { id: "ormr_essence", name: "만물의 정수", icon: "ormr_essence", description: "오름을 쓰러뜨리면 얻는 신비로운 정수. 모든 원소의 기운이 담겨 있다." },
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
  /** shared/ui/PixelIcon 의 아이콘 이름. id 와 같게 둔다 */
  icon: IconName;
  description: string;
  effect: PotionEffect;
  recipe: Record<string, number>;  // materialId → 필요 수량
}

export const POTIONS: Potion[] = [
  {
    id:          "potion",
    name:        "물약",
    icon:        "potion",
    description: "HP를 50 회복한다.",
    effect:      { type: "heal", amount: 50 },
    recipe:      { herb: 2 },
  },
  {
    id:          "super_potion",
    name:        "슈퍼 물약",
    icon:        "super_potion",
    description: "HP를 120 회복한다.",
    effect:      { type: "heal", amount: 120 },
    recipe:      { herb: 3, berry: 1 },
  },
  {
    id:          "max_potion",
    name:        "맥스 물약",
    icon:        "max_potion",
    description: "HP를 완전 회복한다.",
    effect:      { type: "full_heal" },
    recipe:      { herb: 2, crystal: 1 },
  },
  {
    id:          "antidote",
    name:        "해독제",
    icon:        "antidote",
    description: "독·화상·마비·빙결 상태를 치료한다.",
    effect:      { type: "cure_status" },
    recipe:      { berry: 2 },
  },
  {
    id:          "attack_buff",
    name:        "전투 물약",
    icon:        "attack_buff",
    description: "3턴간 공격력이 1.5배 증가한다.",
    effect:      { type: "buff_attack", multiplier: 1.5, turns: 3 },
    recipe:      { herb: 1, crystal: 1 },
  },
  {
    id:          "strong_attack_buff",
    name:        "강화 전투 물약",
    icon:        "strong_attack_buff",
    description: "5턴간 공격력이 2배 증가한다.",
    effect:      { type: "buff_attack", multiplier: 2.0, turns: 5 },
    recipe:      { root: 2, crystal: 2 },
  },
];

export function getMaterial(id: string) {
  return MATERIALS.find((m) => m.id === id);
}

