import { test } from "node:test";
import assert from "node:assert/strict";

import {
  generateDungeon, MIN_CHOICES, RUN_NODES_MIN, RUN_NODES_MAX,
} from "../src/camp/forest/dungeon.ts";

/**
 * 노드 그래프에서 지키는 건 모양이 아니라 **선택이 존재하는가**다.
 *
 * 갈림길이 외길이면 플레이어는 소란도를 조절하는 게 아니라 실려 간다. 그러면
 * 소란도는 다이얼이 아니라 타이머가 된다 — 이 파일이 그걸 막는다.
 */

const TRIALS = 300;

test("탐험 길이가 정해진 범위 안이다", () => {
  for (let i = 0; i < TRIALS; i++) {
    const nodes = generateDungeon();
    const maxDepth = Math.max(...nodes.map((n) => n.depth));
    assert.ok(
      maxDepth >= RUN_NODES_MIN && maxDepth <= RUN_NODES_MAX,
      `밟는 노드가 ${maxDepth}개 — ${RUN_NODES_MIN}~${RUN_NODES_MAX} 를 벗어났다`,
    );
  }
});

test("마지막 한 칸을 빼면 갈림길이 언제나 둘 이상이다", () => {
  for (let i = 0; i < TRIALS; i++) {
    const nodes = generateDungeon();
    const maxDepth = Math.max(...nodes.map((n) => n.depth));
    for (const n of nodes) {
      // 주인은 층에 하나뿐이라 그 앞은 복도다. 거기까지 강요하지는 않는다
      if (n.depth >= maxDepth - 1) continue;
      assert.ok(
        n.nextIds.length >= MIN_CHOICES,
        `${n.id}(depth ${n.depth}) 에서 갈 곳이 ${n.nextIds.length}개뿐이다 — 외길은 선택이 아니다`,
      );
    }
  }
});

test("입구에서 모든 노드에 닿을 수 있다", () => {
  for (let i = 0; i < TRIALS; i++) {
    const nodes = generateDungeon();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const start = nodes.find((n) => n.depth === 0)!;

    const seen = new Set<string>([start.id]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const id of cur.nextIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        queue.push(byId.get(id)!);
      }
    }
    assert.equal(
      seen.size, nodes.length,
      "아무도 안 가리키는 노드가 있다 — 지도에는 보이는데 갈 수 없는 칸이다",
    );
  }
});

test("주인은 마지막 한 개뿐이고 거기서 길이 끝난다", () => {
  for (let i = 0; i < TRIALS; i++) {
    const nodes = generateDungeon();
    const maxDepth = Math.max(...nodes.map((n) => n.depth));
    const bosses = nodes.filter((n) => n.type === "boss");
    assert.equal(bosses.length, 1, "주인이 하나가 아니다");
    assert.equal(bosses[0].depth, maxDepth, "주인이 마지막 층에 없다");
    assert.equal(bosses[0].nextIds.length, 0, "주인 뒤에 노드가 더 있다");
    // 주인 뒤에 노드가 남으면 주인의 소란 증가가 수확에 영향을 주게 되어 설계가 어긋난다
  }
});

test("모든 연결은 바로 다음 층으로만 간다", () => {
  for (let i = 0; i < TRIALS; i++) {
    const nodes = generateDungeon();
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
      for (const id of n.nextIds) {
        const next = byId.get(id);
        assert.ok(next, `${n.id} 가 없는 노드 ${id} 를 가리킨다`);
        assert.equal(next.depth, n.depth + 1, `${n.id} → ${id}: 층을 건너뛰었다`);
      }
    }
  }
});

test("입구만 미리 열려 있다", () => {
  const nodes = generateDungeon();
  for (const n of nodes) {
    assert.equal(n.cleared, n.depth === 0, `${n.id}: cleared 초기값이 틀렸다`);
    assert.equal(n.revealed, n.depth === 0, `${n.id}: revealed 초기값이 틀렸다`);
  }
});
