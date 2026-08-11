import { PALETTE, rgba } from "../../shared/palette";

/**
 * 노드 종류 한 벌.
 *
 * 예전에는 ForestPage.tsx 안에 타입과 표시 정보가 같이 있었고, 시뮬(gameModel.ts)은
 * 자기 사본을 들고 있었다. 소란도가 노드마다 다르게 붙는 이상 이 표는 한 곳에 있어야
 * 한다 — 사본이 남으면 시뮬이 게임이 아니라 사본을 잰다.
 */
export type ForestNodeType =
  | "start" | "battle" | "material" | "event" | "rest" | "elite" | "boss";

/**
 * 노드 7종의 표시 정보. 팔레트에 색상환이 다 없어서 색만으로는 7개를 못 가른다 —
 * 아이콘(형태)이 1차 구분이고 색은 보조다. 글자색은 전부 4.5:1 을 넘기는 토큰만 썼다.
 */
export interface NodeMeta {
  icon: string;
  label: string;
  color: string;
  bg: string;
  /** 정찰이 가장 잘 될 때(소란도 25 이하) 보여 주는 한 줄. 무엇을 얻는지만 적는다 */
  hint: string;
}

export const NODE_META: Record<ForestNodeType, NodeMeta> = {
  start:    { icon: "🌲", label: "입구",   color: PALETTE.sand300,  bg: rgba("moss500",  0.18), hint: "탐험의 시작점" },
  battle:   { icon: "⚔️", label: "조우",   color: PALETTE.ember500, bg: rgba("ember600", 0.18), hint: "야생 몬스터 · 포획 기회" },
  material: { icon: "🌿", label: "흔적",   color: PALETTE.sand200,  bg: rgba("moss500",  0.22), hint: "재료 확정 소량" },
  event:    { icon: "❓", label: "이벤트", color: PALETTE.mist300,  bg: rgba("mist500",  0.18), hint: "별다른 소득 없음" },
  rest:     { icon: "🔥", label: "은신처", color: PALETTE.mist300,  bg: rgba("mist500",  0.14), hint: "숨을 고른다 · 소란을 되산다" },
  elite:    { icon: "💀", label: "이변",   color: PALETTE.sand200,  bg: rgba("earth500", 0.28), hint: "강한 개체 · 희귀 재료" },
  boss:     { icon: "👁", label: "주인",   color: PALETTE.cream100, bg: rgba("ember700", 0.32), hint: "숲의 주인 · 탐험의 끝" },
};

/** 정찰이 흐릿할 때(소란도 51~75) 쓰는 두 갈래. 소란을 크게 올리는 노드가 '위험'이다 */
export function isDangerousNode(type: ForestNodeType): boolean {
  return type === "elite" || type === "boss";
}
