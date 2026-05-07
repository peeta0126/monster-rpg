export interface BlockDef {
  id: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
  top: string;
  left: string;
  right: string;
  stroke: string;
}

export const BLOCKS: BlockDef[] = [
  {
    id: "stone_brick",
    name: "돌 벽돌",
    emoji: "🧱",
    price: 10,
    description: "견고한 돌 벽돌 블록",
    top: "#a0a0a8",
    left: "#686870",
    right: "#848490",
    stroke: "#484850",
  },
  {
    id: "wood_plank",
    name: "나무 판자",
    emoji: "🪵",
    price: 8,
    description: "따뜻한 나무 판자 블록",
    top: "#c89050",
    left: "#885020",
    right: "#a06830",
    stroke: "#603810",
  },
  {
    id: "glass_block",
    name: "유리 블록",
    emoji: "🪟",
    price: 20,
    description: "투명한 유리 블록",
    top: "rgba(160,210,255,0.55)",
    left: "rgba(100,170,220,0.45)",
    right: "rgba(130,190,240,0.50)",
    stroke: "#88bce0",
  },
  {
    id: "leaf_block",
    name: "나뭇잎 블록",
    emoji: "🍃",
    price: 6,
    description: "초록 나뭇잎 블록",
    top: "#48983a",
    left: "#286820",
    right: "#38802a",
    stroke: "#185010",
  },
  {
    id: "dark_stone",
    name: "어두운 돌",
    emoji: "⬛",
    price: 15,
    description: "단단하고 어두운 돌 블록",
    top: "#58586c",
    left: "#30303c",
    right: "#404050",
    stroke: "#181822",
  },
  {
    id: "brick_red",
    name: "붉은 벽돌",
    emoji: "🟥",
    price: 12,
    description: "붉은색 장식 벽돌",
    top: "#c05040",
    left: "#802010",
    right: "#a03828",
    stroke: "#601008",
  },
];

export const BLOCK_MAP: Record<string, BlockDef> = Object.fromEntries(
  BLOCKS.map((b) => [b.id, b]),
);
