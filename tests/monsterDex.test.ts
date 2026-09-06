import { test } from "node:test";
import assert from "node:assert/strict";
import { monsters, NOT_IN_DEX } from "../src/monster/monsters";
import { MONSTER_IMAGE_MAP, MONSTER_ART_FACING } from "../src/monster/monsterImages";
import { MONSTER_DEX_DESC } from "../src/monster/monsterDex";
import { LEARNSET } from "../src/monster/learnset";

/**
 * 몬스터를 하나 더할 때 같이 채워야 하는 표가 넷이다(그림·방향·설명·학습표).
 * 넷 다 없어도 화면이 안 죽는다 — 그림은 빈 칸, 설명은 "아직 알려진 정보가 없다",
 * 방향은 left 로 떨어지고, 학습표가 없으면 종족 기본기를 평생 쓴다. 조용히 반쪽만
 * 들어오는 셈이라, 톡사룡·베노까가 설명 없이 몇 달을 서 있었다.
 */

const dexMonsters = monsters.filter((m) => !NOT_IN_DEX.includes(m.id));

test("도감에 오르는 몬스터는 전부 설명이 있다", () => {
  const missing = dexMonsters.filter((m) => !MONSTER_DEX_DESC[m.id]).map((m) => `${m.id}(${m.name})`);
  assert.deepEqual(missing, [], `도감 설명이 없는 몬스터: ${missing.join(", ")}`);
});

test("모든 몬스터는 그림과 원화 방향을 갖는다", () => {
  const noImage = monsters.filter((m) => !MONSTER_IMAGE_MAP[m.id]).map((m) => m.id);
  assert.deepEqual(noImage, [], `그림이 없는 몬스터: ${noImage.join(", ")}`);

  // 빠지면 예외 없이 "left" 로 떨어져, 오른쪽을 보는 원화가 전투에서 상대와 같은 쪽을 본다
  const noFacing = monsters.filter((m) => !MONSTER_ART_FACING[m.id]).map((m) => m.id);
  assert.deepEqual(noFacing, [], `원화 방향이 없는 몬스터: ${noFacing.join(", ")}`);
});

test("잡을 수 있는 몬스터는 전부 학습표가 있다", () => {
  const missing = dexMonsters.filter((m) => !LEARNSET[m.id]?.length).map((m) => `${m.id}(${m.name})`);
  assert.deepEqual(missing, [], `학습표가 없는 몬스터: ${missing.join(", ")}`);
});

/**
 * 진화는 monsters.ts 의 evolvesTo/evolvesFrom 두 줄이 서로를 가리켜야 성립한다.
 * 한쪽만 적으면 성장(growth.applyLevelGrowth)은 진화시키는데 도감의 진화 계통도가
 * 그 몬스터를 못 찾아 사슬이 중간에서 끊긴다.
 */
test("진화 관계는 양쪽에서 맞물린다", () => {
  const byId = new Map(monsters.map((m) => [m.id, m]));

  for (const m of monsters) {
    if (m.evolvesTo) {
      const next = byId.get(m.evolvesTo);
      assert.ok(next, `${m.id}: evolvesTo 가 가리키는 ${m.evolvesTo} 가 없다`);
      assert.equal(next.evolvesFrom, m.id, `${next.id}: evolvesFrom 이 ${m.id} 를 안 가리킨다`);
      assert.equal(next.evolutionChainId, m.evolutionChainId, `${next.id}: 계통 id 가 ${m.id} 와 다르다`);
      assert.equal(next.evolutionStage, (m.evolutionStage ?? 1) + 1, `${next.id}: 단계가 이어지지 않는다`);
      assert.ok(m.evolvesAtLevel !== undefined, `${m.id}: evolvesTo 만 있고 evolvesAtLevel 이 없다`);
    }
    if (m.evolvesFrom) {
      const prev = byId.get(m.evolvesFrom);
      assert.ok(prev, `${m.id}: evolvesFrom 이 가리키는 ${m.evolvesFrom} 가 없다`);
      assert.equal(prev.evolvesTo, m.id, `${prev.id}: evolvesTo 가 ${m.id} 를 안 가리킨다`);
    }
  }
});

/**
 * 진화는 능력치가 오르는 일이라야 한다. 총합이 안 오르면 진화가 손해가 되고,
 * 레벨 증분은 진화 전후가 같으므로(레벨당 HP+10/공격+3/방어+2/속도+2) 종족값
 * 총합만 비교하면 된다.
 */
test("진화하면 종족값 총합이 오른다", () => {
  const byId = new Map(monsters.map((m) => [m.id, m]));
  const total = (id: string) => {
    const m = byId.get(id)!;
    return m.maxHp + m.attack + m.defense + m.speed;
  };

  for (const m of monsters) {
    if (!m.evolvesTo) continue;
    assert.ok(
      total(m.evolvesTo) > total(m.id),
      `${m.id}(${total(m.id)}) → ${m.evolvesTo}(${total(m.evolvesTo)}): 진화했는데 총합이 안 올랐다`,
    );
  }
});
