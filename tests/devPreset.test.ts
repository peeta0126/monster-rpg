import { test } from "node:test";
import assert from "node:assert/strict";
import { usePlayerStore } from "../src/shared/playerStore";
import { monsters, NOT_IN_DEX, DEX_TOTAL, dexCount } from "../src/monster/monsters";
import { MATERIALS } from "../src/shared/items";

/**
 * 개발자 프리셋은 "게임을 다 한 상태"를 한 번에 만드는 자리다. 그런데 채워야 하는 곳이
 * 여러 벌로 나뉘어 있어서 조용히 반쪽만 채워지기 쉽다 — 실제로 오래 그랬다:
 *
 *   · 물약은 전투 재고(`potions`)와 가방 표시 스택(`craftedPotions`)이 딴 필드다.
 *     앞의 것만 채워서, 전투에는 20개가 있는데 가방은 "보유 물약이 없습니다" 였다.
 *   · 아티팩트도 장착(`equippedArtifacts`)과 가방(`craftedArtifacts`)이 딴 곳이다.
 *   · 재료(`materials`)는 아예 안 채웠다.
 *
 * 화면은 이 중 무엇이 비어도 안 죽고 빈 칸만 보여주므로 눈으로는 잘 안 잡힌다.
 */

function loadPreset() {
  usePlayerStore.getState().loadDevPreset();
  return usePlayerStore.getState();
}

test("개발자 프리셋은 도감을 전부 채운다", () => {
  const s = loadPreset();
  assert.equal(dexCount(s.dexCaught), DEX_TOTAL, "도감이 다 안 찼다");
  assert.equal(dexCount(s.dexSeen), DEX_TOTAL, "본 기록이 다 안 찼다");

  const missing = monsters
    .filter((m) => !NOT_IN_DEX.includes(m.id) && !s.dexCaught.includes(m.id))
    .map((m) => m.name);
  assert.deepEqual(missing, [], `도감에서 빠진 종: ${missing.join(", ")}`);

  // 잡을 수 없는 종은 반대로 들어가면 안 된다. 도감 분모에 없는 걸 분자에 넣으면 26/25 가 된다
  for (const id of NOT_IN_DEX) {
    assert.ok(!s.dexCaught.includes(id), `${id} 는 도감에 오르면 안 된다`);
  }
});

test("개발자 프리셋은 모든 종을 손에 쥐여 준다", () => {
  const s = loadPreset();
  const held = [...s.party, ...s.storage].map((m) => m.id);
  const expected = monsters.filter((m) => !NOT_IN_DEX.includes(m.id)).length;
  assert.equal(held.length, expected, "보유 마릿수가 도감 분모와 다르다");
  assert.equal(s.party.length, 3, "파티가 3마리가 아니다");
});

test("개발자 프리셋 파티는 전부 최종 진화체다", () => {
  const s = loadPreset();
  // 50층 오름을 시험하는 게 이 프리셋의 목적이라, 더 진화할 게 남아 있으면 안 된다
  for (const m of s.party) {
    const spec = monsters.find((x) => x.id === m.id)!;
    assert.ok(!spec.evolvesTo, `${m.name} 는 아직 ${spec.evolvesTo} 로 진화가 남았다`);
  }
});

test("가방이 비어 있지 않다 — 재료·물약·장비 세 칸 다", () => {
  const s = loadPreset();

  // 재료: 표를 읽어서 채우므로 종류가 하나도 빠지면 안 된다
  const missingMats = MATERIALS.filter((m) => !(s.materials[m.id] > 0)).map((m) => m.name);
  assert.deepEqual(missingMats, [], `가방에 없는 재료: ${missingMats.join(", ")}`);

  assert.ok(s.craftedPotions.length > 0, "가방 물약 칸이 비어 있다");
  assert.ok(s.craftedArtifacts.length > 0, "가방 장비 칸이 비어 있다");
});

test("가방에 보이는 물약 수와 전투 재고가 같다", () => {
  const s = loadPreset();
  const inBag = s.craftedPotions.reduce((n, p) => n + p.quantity, 0);
  const inBattle = Object.values(s.potions).reduce((n, c) => n + c, 0);
  assert.equal(inBag, inBattle, `가방 ${inBag}개 · 전투 ${inBattle}개 — 한쪽만 채웠다`);

  // 스택 id 는 `${itemId}_${quality}` 규칙이다. 어긋나면 같은 물약이 두 줄로 쌓인다
  for (const p of s.craftedPotions) {
    assert.equal(p.stackId, `${p.itemId}_${p.quality}`, `${p.name} 의 stackId 규칙이 다르다`);
  }
  const ids = s.craftedPotions.map((p) => p.stackId);
  assert.equal(new Set(ids).size, ids.length, "같은 스택이 두 줄이다");
});

test("파티 셋은 장비를 다 끼고 있다", () => {
  const s = loadPreset();
  for (const m of s.party) {
    const worn = s.equippedArtifacts[m.uid] ?? [];
    assert.equal(worn.length, 3, `${m.name} 의 장비 칸이 ${worn.length}개다`);
  }
});
