import type { ForestNodeType } from "./nodes";

/**
 * 노드 그래프 생성기.
 *
 * ForestPage.tsx 안에 있던 것을 꺼냈다. 시뮬(scripts/sim)이 자기 사본을 들고 있어서
 * 노드 가중치가 두 벌이었고, 한쪽만 고치면 측정이 게임이 아니라 사본을 쟀다.
 */

export interface ForestNode {
  id: string;
  type: ForestNodeType;
  depth: number;
  /** 이 depth 안에서의 행 번호 (0-based) */
  col: number;
  /** 이 depth 의 총 행 수 */
  totalCols: number;
  nextIds: string[];
  cleared: boolean;
  /** 도착해서 정체가 드러났는가. 정찰이 좋으면 도착 전에도 아이콘은 보인다 */
  revealed: boolean;
}

/**
 * 한 탐험의 노드 수(입구 제외). 컬럼 수 = 이 값 + 1.
 *
 * 5~7 이었다. 그 길이로는 소란도가 한 바퀴를 못 돌았다 — 회피로 굴려도 48, 탐욕으로
 * 굴려도 64 에서 끝나 다이얼의 위아래 끝을 아무도 못 봤다. 8~10 이면 탐욕 경로가
 * 실제로 강제 퇴각선에 닿는다.
 */
export const RUN_NODES_MIN = 8;
export const RUN_NODES_MAX = 10;

/**
 * 갈림길에서 최소한 이만큼은 고를 수 있어야 한다.
 *
 * 예전에는 45% 확률로만 두 번째 길이 생겨서, 절반 넘는 갈림길이 외길이었다. 그러면
 * 플레이어는 소란도를 조절하는 게 아니라 그냥 실려 간다 — 다이얼이 아니라 타이머다.
 *
 * 유일한 예외는 마지막 한 칸이다. 주인은 층에 하나뿐이라 그리로 가는 길은 언제나
 * 외길이 된다. 탐험의 끝으로 좁혀지는 복도는 그대로 둔다.
 */
export const MIN_CHOICES = 2;

function weightedPick<T>(weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) { r -= w; if (r <= 0) return v; }
  return weights[weights.length - 1][0];
}

/** 진행도에 따른 노드 타입 가중치. 뒤로 갈수록 이변이 늘고 은신처도 같이 는다 */
function colWeights(depth: number, maxDepth: number): [ForestNodeType, number][] {
  if (depth === 0)        return [["start", 1]];
  if (depth === maxDepth) return [["boss",  1]];
  const p = depth / maxDepth;
  if (p < 0.35) return [["battle", 4], ["material", 3], ["event", 2], ["rest", 1]];
  if (p < 0.65) return [["battle", 3], ["material", 3], ["event", 2], ["rest", 2]];
  return [["battle", 3], ["material", 2], ["event", 2], ["rest", 2], ["elite", 3]];
}

/** 두 노드가 세로로 얼마나 떨어져 있는가 (행 수가 층마다 달라 정규화해서 잰다) */
function rowDistance(a: ForestNode, b: ForestNode): number {
  const norm = (n: ForestNode) => (n.totalCols === 1 ? 0.5 : n.col / (n.totalCols - 1));
  return Math.abs(norm(a) - norm(b));
}

export function generateDungeon(): ForestNode[] {
  const totalCols = RUN_NODES_MIN + 1
    + Math.floor(Math.random() * (RUN_NODES_MAX - RUN_NODES_MIN + 1));
  const maxDepth = totalCols - 1;

  // 입구와 주인은 하나씩, 중간은 2~4행
  const depthCols = Array.from({ length: totalCols }, (_, d) =>
    (d === 0 || d === maxDepth) ? 1 : 2 + Math.floor(Math.random() * 3),
  );

  const nodes: ForestNode[] = [];
  const depthNodes: ForestNode[][] = [];
  let idCounter = 0;

  for (let depth = 0; depth <= maxDepth; depth++) {
    const cols = depthCols[depth];
    const layer: ForestNode[] = [];
    for (let col = 0; col < cols; col++) {
      layer.push({
        id:        `n${idCounter++}`,
        type:      weightedPick(colWeights(depth, maxDepth)),
        depth,
        col,
        totalCols: cols,
        nextIds:   [],
        cleared:   depth === 0,
        revealed:  depth === 0,
      });
    }
    depthNodes.push(layer);
    nodes.push(...layer);
  }

  for (let d = 0; d < maxDepth; d++) {
    const curr = depthNodes[d];
    const next = depthNodes[d + 1];
    // 다음 층이 한 칸뿐이면 아무리 보장해도 외길이다 (주인 앞 복도)
    const want = Math.min(MIN_CHOICES, next.length);

    for (const cn of curr) {
      // 가까운 행부터 잇는다. 선이 층을 가로질러 엉키면 어디로 가는지 안 읽힌다
      const byDistance = [...next].sort((a, b) => rowDistance(cn, a) - rowDistance(cn, b));
      for (const nn of byDistance) {
        if (cn.nextIds.length >= want) break;
        if (!cn.nextIds.includes(nn.id)) cn.nextIds.push(nn.id);
      }
      // 가끔 한 갈래 더 — 갈림길 폭이 매번 똑같으면 지도가 격자처럼 보인다
      if (next.length > cn.nextIds.length && Math.random() < 0.35) {
        const rest = byDistance.filter((n) => !cn.nextIds.includes(n.id));
        cn.nextIds.push(rest[Math.floor(Math.random() * rest.length)].id);
      }
    }

    // 아무도 안 가리키는 노드가 남으면 그 칸은 존재하지 않는 것과 같다
    const reached = new Set(curr.flatMap((n) => n.nextIds));
    for (const nn of next) {
      if (reached.has(nn.id)) continue;
      const src = curr[Math.floor(Math.random() * curr.length)];
      if (!src.nextIds.includes(nn.id)) src.nextIds.push(nn.id);
    }
  }

  return nodes;
}
