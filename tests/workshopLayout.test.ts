import { test } from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_POS, PLAYER_BOUNDS, COLLISION_BOXES, CRAFTING_STATIONS, EXIT_ZONE,
  isBlocked, isPlayerBlocked, distanceTo, findInteractable, type Point,
} from "../src/workshop/workshopLayout";

test("스폰 지점이 벽 안이 아니고 이동 범위 안에 있다", () => {
  assert.equal(isPlayerBlocked(INITIAL_POS), false);
  assert.ok(INITIAL_POS.x >= PLAYER_BOUNDS.minX && INITIAL_POS.x <= PLAYER_BOUNDS.maxX);
  assert.ok(INITIAL_POS.y >= PLAYER_BOUNDS.minY && INITIAL_POS.y <= PLAYER_BOUNDS.maxY);
});

test("제작대 판정 원끼리 겹치지 않는다", () => {
  for (let i = 0; i < CRAFTING_STATIONS.length; i++) {
    for (let j = i + 1; j < CRAFTING_STATIONS.length; j++) {
      const a = CRAFTING_STATIONS[i], b = CRAFTING_STATIONS[j];
      assert.ok(
        distanceTo(a, b) > a.radius + b.radius,
        `${a.id} 와 ${b.id} 의 판정 원이 겹친다 (거리 ${distanceTo(a, b).toFixed(1)} <= ${a.radius + b.radius})`,
      );
    }
  }
});

test("출입구가 어떤 제작대 원과도 겹치지 않는다", () => {
  for (const s of CRAFTING_STATIONS) {
    assert.ok(
      distanceTo(EXIT_ZONE, s) > EXIT_ZONE.radius + s.radius,
      `${s.id} 가 출입구와 겹친다`,
    );
  }
});

// 아래쪽 벽이 두 줄로 끊겨 있는 것은 의도다. x 39~60 이 비어 있어야 출입구까지
// 걸어 내려갈 수 있다. 하나로 이으면 문 앞에서 막힌다.
test("아래쪽 벽에 x 39~60 틈이 열려 있다", () => {
  for (let x = 40; x <= 59; x += 0.5) {
    assert.equal(isBlocked({ x, y: 93 }), false, `x=${x} 에서 출입구가 막혀 있다`);
  }
  // 틈 바깥은 벽 위다. 틈이 벽 전체로 번지지 않았는지 확인
  assert.equal(isBlocked({ x: 20, y: 93 }), true);
  assert.equal(isBlocked({ x: 80, y: 93 }), true);
});

test("러그 위는 통과할 수 있다", () => {
  for (let x = 40; x <= 60; x += 2) {
    for (let y = 45; y <= 60; y += 2) {
      assert.equal(isBlocked({ x, y }), false, `러그 위 (${x}, ${y}) 가 막혀 있다`);
    }
  }
});

test("findInteractable: 제작대가 출입구보다 우선한다", () => {
  // 출입구 한가운데는 제작대 사거리 밖이라 exit 이 잡힌다
  assert.equal(findInteractable(EXIT_ZONE)?.kind, "exit");
  for (const s of CRAFTING_STATIONS) {
    const hit = findInteractable(s);
    assert.equal(hit?.kind, "station");
    assert.equal(hit?.def.id, s.id);
  }
  // 아무 데도 안 닿는 방 한가운데
  assert.equal(findInteractable({ x: 50, y: 55 }), null);
});

/**
 * BFS 도달성. 0.5% 격자 · 4방향. 스폰에서 출발해 제작대 3개와 출입구 각각의
 * radius 안에 실제로 걸어 들어갈 수 있는 칸이 있는지 본다.
 * 좌표는 이미 검증된 값이라 통과해야 정상이다. 실패하면 배선이 틀린 것이다.
 */
test("BFS: 스폰에서 제작대 3개와 출입구에 전부 도달할 수 있다", () => {
  const STEP = 0.5;
  const key = (p: Point) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const walkable = (p: Point) =>
    p.x >= PLAYER_BOUNDS.minX && p.x <= PLAYER_BOUNDS.maxX &&
    p.y >= PLAYER_BOUNDS.minY && p.y <= PLAYER_BOUNDS.maxY &&
    !isPlayerBlocked(p);

  const start = { x: INITIAL_POS.x, y: INITIAL_POS.y };
  assert.ok(walkable(start), "스폰 지점부터 걸을 수 없다");

  const seen = new Set([key(start)]);
  const queue: Point[] = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: +(cur.x + dx).toFixed(1), y: +(cur.y + dy).toFixed(1) };
      if (seen.has(key(next)) || !walkable(next)) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }

  const reached = [...seen].map((k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  });

  for (const target of [...CRAFTING_STATIONS, EXIT_ZONE]) {
    assert.ok(
      reached.some((p) => distanceTo(p, target) <= target.radius),
      `${target.id} 의 판정 원 안으로 걸어갈 수 없다`,
    );
  }

  /**
   * 테두리 방식에서는 여기가 진짜 안전망이다.
   *
   * 물체마다 상자를 씌우던 때는 가구 한가운데를 찍어 `isBlocked` 로 물을 수 있었다.
   * 지금 벽은 물체 둘레를 따라 그은 얇은 줄이라, 가구 한가운데는 "상자 밖"이다.
   * 못 올라가는 이유는 둘러싸여 있어서지 그 자리가 막혀서가 아니다. 그러니
   * 걸어서 닿는지로 물어야 한다.
   */
  const stand = (p: Point) => reached.some((r) => Math.abs(r.x - p.x) <= STEP && Math.abs(r.y - p.y) <= STEP);
  const MUST_NOT_REACH: Array<[string, Point]> = [
    ["통 무더기 위",   { x: 12, y: 55 }],
    ["침대 위",        { x: 90, y: 55 }],
    ["연금술대 위",    { x: 77, y: 35 }],
    ["책장 뒤",        { x: 50, y: 29 }],
    ["궤짝 위",        { x: 73, y: 86 }],
    ["아티팩트 제작대 위", { x: 25, y: 85 }],
    ["문 밖 왼쪽",     { x: 20, y: 95 }],
    ["문 밖 오른쪽",   { x: 80, y: 95 }],
  ];
  for (const [label, p] of MUST_NOT_REACH) {
    assert.equal(stand(p), false, `${label}(${p.x}, ${p.y}) 에 올라설 수 있다`);
  }

  const MUST_REACH: Array<[string, Point]> = [
    ["러그 한가운데",  { x: 50, y: 52 }],
    ["모루 위 복도",   { x: 27, y: 28.5 }],
    ["연금술대 동쪽",  { x: 92, y: 40 }],
    ["궤짝 왼쪽",      { x: 64, y: 86 }],
    ["출입구 매트",    { x: 50, y: 95 }],
  ];
  for (const [label, p] of MUST_REACH) {
    assert.equal(stand(p), true, `${label}(${p.x}, ${p.y}) 에 걸어갈 수 없다`);
  }
});

test("충돌 박스 id 가 중복되지 않는다", () => {
  const ids = COLLISION_BOXES.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, `중복: ${ids.filter((v, i) => ids.indexOf(v) !== i).join(", ")}`);
});
