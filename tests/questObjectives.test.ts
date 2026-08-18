import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateObjective, objectiveCost,
  type QuestObjective, type QuestSnapshot,
} from "../src/camp/questObjectives.ts";

const EMPTY: QuestSnapshot = {
  materials: {}, potions: {}, bestFloor: 0,
  dexCaught: [], equippedArtifacts: {}, craftedArtifacts: [],
};

const snap = (over: Partial<QuestSnapshot>): QuestSnapshot => ({ ...EMPTY, ...over });

test("재료 목표 — 수량으로 판정하고 진행도를 낸다", () => {
  const o: QuestObjective = { kind: "material", itemId: "crystal", amount: 4 };
  assert.equal(evaluateObjective(o, snap({ materials: { crystal: 3 } })).done, false);
  assert.equal(evaluateObjective(o, snap({ materials: { crystal: 4 } })).done, true);
  assert.equal(evaluateObjective(o, snap({ materials: { crystal: 9 } })).done, true);

  const p = evaluateObjective(o, snap({ materials: { crystal: 9 } }));
  assert.equal(p.have, 4, "넘게 들고 있어도 진행도는 목표까지만 찬다");
  assert.equal(p.need, 4);
  assert.ok(p.label.includes("빛의 수정"), "재료 이름이 화면에 나와야 한다");
});

test("층 목표 — 최고 도달 층으로 본다", () => {
  const o: QuestObjective = { kind: "floor", floor: 10 };
  assert.equal(evaluateObjective(o, snap({ bestFloor: 9 })).done, false);
  assert.equal(evaluateObjective(o, snap({ bestFloor: 10 })).done, true);
  // 한 번 오른 층은 도로 내려가지 않는다. 그래서 완료 뒤에도 계속 참이다
  assert.equal(evaluateObjective(o, snap({ bestFloor: 50 })).done, true);
});

test("포획 목표 — 도감에 그 속성 종이 있으면 된다", () => {
  const o: QuestObjective = { kind: "catchType", elementType: "poison" };
  assert.equal(evaluateObjective(o, snap({ dexCaught: ["flameling", "leafy"] })).done, false);
  assert.equal(evaluateObjective(o, snap({ dexCaught: ["venomcrow"] })).done, true);
  assert.equal(evaluateObjective(o, snap({ dexCaught: ["toxadon"] })).done, true, "같은 속성 다른 종도 된다");
  // 지금 데리고 있지 않아도 된다 — 도감은 지워지지 않으니 뺏을 것도 없다
  assert.ok(evaluateObjective(o, snap({ dexCaught: ["toxadon"] })).label.includes("독"));
});

test("포획 목표는 조사를 괄호로 쓰지 않는다", () => {
  for (const t of ["poison", "fire", "water", "ice"] as const) {
    const label = evaluateObjective({ kind: "catchType", elementType: t }, EMPTY).label;
    assert.ok(!label.includes("("), `조사가 괄호로 나온다 — ${label}`);
  }
});

test("장착 목표 — 하나라도 끼고 있으면 된다", () => {
  const o: QuestObjective = { kind: "equipped" };
  assert.equal(evaluateObjective(o, EMPTY).done, false);
  assert.equal(evaluateObjective(o, snap({ equippedArtifacts: { a: [] } })).done, false,
    "칸만 있고 비어 있으면 안 된다");
  assert.equal(evaluateObjective(o, snap({ equippedArtifacts: { a: [{ level: 1 }] } })).done, true);
});

test("장비 레벨 목표 — 가방에 있든 끼고 있든 올린 건 올린 거다", () => {
  const o: QuestObjective = { kind: "artifactLevel", level: 20 };
  assert.equal(evaluateObjective(o, snap({ craftedArtifacts: [{ level: 19 }] })).done, false);
  assert.equal(evaluateObjective(o, snap({ craftedArtifacts: [{ level: 20 }] })).done, true);
  assert.equal(evaluateObjective(o, snap({ equippedArtifacts: { a: [{ level: 25 }] } })).done, true);
  // 여러 개 중 제일 높은 것으로 본다 — "하나라도" 올리라는 목표다
  assert.equal(
    evaluateObjective(o, snap({ craftedArtifacts: [{ level: 3 }, { level: 22 }] })).done, true);
  // 레벨이 안 적힌 옛 장비는 1로 본다
  assert.equal(evaluateObjective(o, snap({ craftedArtifacts: [{}] })).done, false);
});

test("완성품 목표 — 가지고 있으면 된다", () => {
  const o: QuestObjective = { kind: "potion", potionId: "mothers_cure_potion", name: "어머니의 치료약" };
  assert.equal(evaluateObjective(o, EMPTY).done, false);
  assert.equal(evaluateObjective(o, snap({ potions: { mothers_cure_potion: 0 } })).done, false);
  assert.equal(evaluateObjective(o, snap({ potions: { mothers_cure_potion: 1 } })).done, true);
});

test("가져가는 건 재료 목표뿐이다", () => {
  assert.deepEqual(
    objectiveCost({ kind: "material", itemId: "herb", amount: 3 }),
    { itemId: "herb", amount: 3 });

  // 층을 도로 내리거나 잡은 몬스터를 도감에서 지울 수는 없다
  assert.equal(objectiveCost({ kind: "floor", floor: 10 }), null);
  assert.equal(objectiveCost({ kind: "catchType", elementType: "poison" }), null);
  assert.equal(objectiveCost({ kind: "equipped" }), null);
  assert.equal(objectiveCost({ kind: "artifactLevel", level: 20 }), null);
  assert.equal(objectiveCost({ kind: "potion", potionId: "x", name: "x" }), null);
});

test("모든 목표가 화면에 적을 한 줄을 낸다", () => {
  const all: QuestObjective[] = [
    { kind: "material", itemId: "herb", amount: 3 },
    { kind: "floor", floor: 10 },
    { kind: "catchType", elementType: "poison" },
    { kind: "equipped" },
    { kind: "artifactLevel", level: 20 },
    { kind: "potion", potionId: "x", name: "어머니의 치료약" },
  ];
  for (const o of all) {
    const label = evaluateObjective(o, EMPTY).label;
    assert.ok(label && label.length > 0, `${o.kind} 에 목표 문구가 없다`);
  }
});
