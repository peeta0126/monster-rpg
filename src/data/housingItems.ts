export type HousingCategory = 'floor' | 'wall' | 'furniture' | 'decoration';

export interface HousingItemDef {
  id: string;
  name: string;
  emoji: string;
  category: HousingCategory;
  size: { w: number; h: number };  // tile footprint (future multi-tile use)
  blockH: number;                   // visual height in pixels
  price: number;
  description: string;
  top: string;
  left: string;
  right: string;
  stroke: string;
}

export const HOUSING_ITEMS: HousingItemDef[] = [
  // ── 바닥 (Floor tiles — very flat) ──────────────────────────────────────────
  {
    id: 'floor_wood', name: '나무 바닥', emoji: '🟫', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 5, description: '따뜻한 나무 바닥재',
    top: '#c89050', left: '#885020', right: '#a06830', stroke: '#603810',
  },
  {
    id: 'floor_stone', name: '돌 바닥', emoji: '⬜', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 7, description: '견고한 돌 바닥재',
    top: '#b8b8c0', left: '#787880', right: '#989898', stroke: '#585860',
  },
  {
    id: 'floor_carpet', name: '빨간 카펫', emoji: '🟥', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 10, description: '화려한 빨간 카펫',
    top: '#c04040', left: '#7a2020', right: '#9a3030', stroke: '#4a1010',
  },
  {
    id: 'floor_marble', name: '대리석', emoji: '◻', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 18, description: '고급 대리석 바닥',
    top: '#eaeaf2', left: '#b0b0c0', right: '#ccccdc', stroke: '#9090a0',
  },
  {
    id: 'floor_grass', name: '잔디', emoji: '🟩', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 4, description: '자연스러운 잔디',
    top: '#48983a', left: '#286820', right: '#38802a', stroke: '#185010',
  },
  {
    id: 'floor_sand', name: '모래', emoji: '🟨', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 4, description: '부드러운 모래',
    top: '#d4b870', left: '#a08840', right: '#b8a050', stroke: '#806030',
  },
  {
    id: 'floor_tile_blue', name: '파란 타일', emoji: '🔵', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 12, description: '시원한 파란 타일',
    top: '#4070c0', left: '#204080', right: '#3058a0', stroke: '#102060',
  },
  {
    id: 'floor_tile_dark', name: '어두운 타일', emoji: '⬛', category: 'floor',
    size: {w:1,h:1}, blockH: 5, price: 8, description: '단단한 어두운 타일',
    top: '#58586c', left: '#30303c', right: '#404050', stroke: '#181822',
  },

  // ── 벽 (Wall blocks — tall) ──────────────────────────────────────────────────
  {
    id: 'wall_stone', name: '돌 벽', emoji: '🧱', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 12, description: '견고한 돌 벽',
    top: '#a0a0a8', left: '#686870', right: '#848490', stroke: '#484850',
  },
  {
    id: 'wall_wood', name: '나무 벽', emoji: '🪵', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 10, description: '따뜻한 나무 벽',
    top: '#c89050', left: '#885020', right: '#a06830', stroke: '#603810',
  },
  {
    id: 'wall_brick', name: '벽돌 벽', emoji: '🟥', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 14, description: '튼튼한 붉은 벽돌 벽',
    top: '#c05040', left: '#802010', right: '#a03828', stroke: '#601008',
  },
  {
    id: 'wall_glass', name: '유리 벽', emoji: '🪟', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 25, description: '투명한 유리 벽',
    top: 'rgba(160,210,255,0.55)', left: 'rgba(100,170,220,0.45)', right: 'rgba(130,190,240,0.50)', stroke: '#88bce0',
  },
  {
    id: 'wall_dark', name: '어두운 벽', emoji: '⬛', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 16, description: '단단하고 어두운 벽',
    top: '#58586c', left: '#30303c', right: '#404050', stroke: '#181822',
  },
  {
    id: 'wall_crystal', name: '수정 벽', emoji: '💎', category: 'wall',
    size: {w:1,h:1}, blockH: 52, price: 35, description: '빛나는 수정 벽',
    top: 'rgba(200,160,255,0.7)', left: 'rgba(140,80,220,0.6)', right: 'rgba(170,120,240,0.65)', stroke: '#9060c8',
  },

  // ── 가구 (Furniture — medium height) ─────────────────────────────────────────
  {
    id: 'table', name: '나무 탁자', emoji: '🪑', category: 'furniture',
    size: {w:1,h:1}, blockH: 22, price: 35, description: '소박한 나무 탁자',
    top: '#b87848', left: '#784830', right: '#986040', stroke: '#483018',
  },
  {
    id: 'bed', name: '침대', emoji: '🛏', category: 'furniture',
    size: {w:2,h:1}, blockH: 20, price: 60, description: '편안한 침대',
    top: '#8090c0', left: '#506090', right: '#6070a8', stroke: '#303060',
  },
  {
    id: 'bookshelf', name: '책장', emoji: '📚', category: 'furniture',
    size: {w:1,h:1}, blockH: 38, price: 45, description: '지식이 가득한 책장',
    top: '#a07840', left: '#604820', right: '#804830', stroke: '#402010',
  },
  {
    id: 'chest', name: '보물상자', emoji: '📦', category: 'furniture',
    size: {w:1,h:1}, blockH: 16, price: 40, description: '아이템을 보관하는 상자',
    top: '#c08830', left: '#805010', right: '#a07020', stroke: '#503010',
  },
  {
    id: 'cauldron', name: '가마솥', emoji: '🫕', category: 'furniture',
    size: {w:1,h:1}, blockH: 22, price: 55, description: '물약 제조에 쓰는 솥',
    top: '#404048', left: '#202028', right: '#303038', stroke: '#101018',
  },
  {
    id: 'workbench', name: '작업대', emoji: '⚒', category: 'furniture',
    size: {w:2,h:1}, blockH: 18, price: 50, description: '제작에 쓰는 작업대',
    top: '#9a7248', left: '#623820', right: '#825030', stroke: '#422010',
  },
  {
    id: 'throne', name: '왕좌', emoji: '👑', category: 'furniture',
    size: {w:1,h:1}, blockH: 40, price: 120, description: '화려한 황금 왕좌',
    top: '#e0b030', left: '#907010', right: '#b09020', stroke: '#604808',
  },

  // ── 장식 (Decoration — small ornaments) ─────────────────────────────────────
  {
    id: 'plant_pot', name: '화분', emoji: '🪴', category: 'decoration',
    size: {w:1,h:1}, blockH: 16, price: 18, description: '싱그러운 화분',
    top: '#48983a', left: '#604820', right: '#806040', stroke: '#304010',
  },
  {
    id: 'lamp', name: '램프', emoji: '🪔', category: 'decoration',
    size: {w:1,h:1}, blockH: 24, price: 22, description: '은은한 빛의 램프',
    top: '#f0c030', left: '#906010', right: '#b08020', stroke: '#604010',
  },
  {
    id: 'campfire', name: '모닥불', emoji: '🔥', category: 'decoration',
    size: {w:1,h:1}, blockH: 18, price: 28, description: '따뜻한 모닥불',
    top: '#f07020', left: '#902010', right: '#c04810', stroke: '#601008',
  },
  {
    id: 'well', name: '우물', emoji: '🪣', category: 'decoration',
    size: {w:1,h:1}, blockH: 26, price: 50, description: '돌로 만든 우물',
    top: '#909098', left: '#505058', right: '#707078', stroke: '#303038',
  },
  {
    id: 'statue', name: '조각상', emoji: '🗿', category: 'decoration',
    size: {w:1,h:1}, blockH: 32, price: 65, description: '신비로운 조각상',
    top: '#a0a0a0', left: '#606060', right: '#808080', stroke: '#303030',
  },
  {
    id: 'banner', name: '깃발', emoji: '🚩', category: 'decoration',
    size: {w:1,h:1}, blockH: 36, price: 30, description: '화려한 깃발',
    top: '#c04040', left: '#802010', right: '#a03828', stroke: '#601008',
  },
  {
    id: 'mushroom', name: '버섯', emoji: '🍄', category: 'decoration',
    size: {w:1,h:1}, blockH: 12, price: 8, description: '귀여운 버섯',
    top: '#c05050', left: '#802020', right: '#a03838', stroke: '#601010',
  },
  {
    id: 'crystal_shard', name: '수정 조각', emoji: '💠', category: 'decoration',
    size: {w:1,h:1}, blockH: 20, price: 40, description: '빛나는 수정 조각',
    top: 'rgba(180,220,255,0.8)', left: 'rgba(100,160,220,0.7)', right: 'rgba(140,190,240,0.75)', stroke: '#70a8e0',
  },
];

export const HOUSING_ITEM_MAP: Record<string, HousingItemDef> = Object.fromEntries(
  HOUSING_ITEMS.map((i) => [i.id, i]),
);

export function getHousingItemsByCategory(cat: HousingCategory): HousingItemDef[] {
  return HOUSING_ITEMS.filter((i) => i.category === cat);
}

export const CATEGORY_LABELS: Record<HousingCategory, string> = {
  floor:       '바닥',
  wall:        '벽',
  furniture:   '가구',
  decoration:  '장식',
};

export const CATEGORY_EMOJIS: Record<HousingCategory, string> = {
  floor:       '🏠',
  wall:        '🧱',
  furniture:   '🪑',
  decoration:  '🌿',
};
