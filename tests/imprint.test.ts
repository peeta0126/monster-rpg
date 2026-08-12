import test from "node:test";
import assert from "node:assert/strict";
import {
  imprintTier, withImprint, chainKeyOf, tierOf, imprintStatus,
  essenceCostFor, IMPRINT_TIERS, MAX_IMPRINT_TIER,
} from "../src/monster/imprint.ts";
import { monsters } from "../src/monster/monsters.ts";
import { applyLevelGrowth } from "../src/monster/growth.ts";
import { scaleToLevel } from "../src/shared/floorTable.ts";
import { usePlayerStore, normalizeState, type OwnedMonster } from "../src/shared/playerStore.ts";
import { rollNestChoices } from "../src/camp/forest/nest.ts";
import { makeRng } from "../src/camp/forest/runStore.ts";
import { FOREST_AREAS } from "../src/camp/forest/areas.ts";

const mossy    = monsters.find((m) => m.id === "mossy")!;
const aquabe   = monsters.find((m) => m.id === "aquabe")!;
const flameling = monsters.find((m) => m.id === "flameling")!;

const owned = (m: typeof mossy, uid: string, level = m.level): OwnedMonster => {
  const s = scaleToLevel(m, level);
  return { ...s, uid, currentHp: s.maxHp };
};

// ─── 등급 계산 ────────────────────────────────────────────────────────────────

test("먹인 수 → 등급이 비용표 그대로다", () => {
  const expected: [number, number][] = [
    [0, 0], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3],
    [6, 4], [7, 4], [8, 4], [9, 5], [12, 5],
  ];
  for (const [fed, tier] of expected) {
    assert.equal(imprintTier(fed), tier, `${fed}마리 → ${tier}등급`);
  }
});

test("등급 경계는 표의 값과 한 몸이다", () => {
  for (const def of IMPRINT_TIERS) {
    assert.equal(imprintTier(def.fed), def.tier);
    assert.equal(imprintTier(def.fed - 1), def.tier - 1, `${def.fed - 1}마리는 아직 ${def.tier}등급이 아니다`);
  }
});

test("정수는 등급이 오르는 그 한 마리에만 붙는다", () => {
  assert.equal(essenceCostFor(0), 0);   // 0→1마리: 1등급, 정수 없음
  assert.equal(essenceCostFor(5), 3);   // 5→6마리: 4등급
  assert.equal(essenceCostFor(6), 0);   // 6→7마리: 등급이 안 오른다
  assert.equal(essenceCostFor(8), 5);   // 8→9마리: 5등급
  assert.equal(essenceCostFor(9), 0);   // 만렙 뒤엔 없다
});

// ─── withImprint ──────────────────────────────────────────────────────────────

test("withImprint 는 원본을 건드리지 않는다", () => {
  const m = owned(mossy, "a");
  const before = { ...m };
  const out = withImprint(m, { mossy: 9 });

  assert.deepEqual({ ...m }, before, "원본 능력치가 그대로다");
  assert.notEqual(out, m);
  assert.equal(out.maxHp, Math.round(before.maxHp * 1.25));
  assert.equal(out.attack, Math.round(before.attack * 1.25));
  assert.equal(out.defense, Math.round(before.defense * 1.25));
  assert.equal(out.speed, Math.round(before.speed * 1.25));
});

test("두 번 걸어도 배수가 겹치지 않는다", () => {
  const m = owned(mossy, "a");
  const once  = withImprint(m, { mossy: 9 });
  const twice = withImprint(once, { mossy: 9 });
  assert.equal(twice.maxHp, once.maxHp);
  assert.equal(twice.attack, once.attack);
  assert.equal(twice.speed, once.speed);

  // 등급이 바뀌어도 원본 기준으로 다시 계산된다
  const lowered = withImprint(once, { mossy: 1 });
  assert.equal(lowered.attack, Math.round(m.attack * 1.05));
});

test("각인이 없으면 능력치가 그대로다", () => {
  const m = owned(mossy, "a");
  const out = withImprint(m, {});
  assert.equal(out.maxHp, m.maxHp);
  assert.equal(out.attack, m.attack);
});

test("HP 상한이 오른 만큼 현재 HP 도 따라 오른다 (기절은 0 그대로)", () => {
  const full = withImprint(owned(mossy, "a"), { mossy: 9 });
  assert.equal(full.currentHp, full.maxHp, "만피는 만피로 남는다");

  const fainted = withImprint({ ...owned(mossy, "a"), currentHp: 0 }, { mossy: 9 });
  assert.equal(fainted.currentHp, 0);
});

test("전개 연산자로 복사한 사본에는 각인 자국이 따라붙지 않는다", () => {
  // 자국이 사본에 남으면 성장·저장을 거친 뒤의 능력치가 옛 기준으로 되돌아간다
  const m = owned(mossy, "a");
  const copy = { ...withImprint(m, { mossy: 9 }) };
  const again = withImprint(copy, {});
  assert.equal(again.attack, copy.attack, "사본은 그 자체가 원본으로 취급된다");
});

// ─── 계열 단위 ────────────────────────────────────────────────────────────────

test("진화해도 각인 등급이 유지된다", async () => {
  const imprint = { aqua: 4 };            // 3등급
  const before = owned(aquabe, "a", 21);
  assert.equal(tierOf(before, imprint), 3);

  const grown = (await applyLevelGrowth({ ...before, level: 22 }, 21)).monster;
  assert.equal(grown.id, "aquavern", "진화했다");
  assert.equal(chainKeyOf(grown), chainKeyOf(before), "계열키가 같다");
  assert.equal(tierOf(grown, imprint), 3, "등급이 초기화되지 않는다");
});

test("계열이 없는 종은 자기 id 가 계열키다", () => {
  assert.equal(chainKeyOf(flameling), "flameling");
  assert.equal(tierOf(flameling, { flameling: 2 }), 2);
});

test("같은 계열이면 진화 단계가 달라도 같은 등급을 받는다", () => {
  const imprint = { mossy: 6 };           // 4등급
  const evo = monsters.find((m) => m.id === "mossyfinal")!;
  assert.equal(tierOf(mossy, imprint), tierOf(evo, imprint));
});

// ─── 스토어 ───────────────────────────────────────────────────────────────────

function setStorage(party: OwnedMonster[], storage: OwnedMonster[], materials: Record<string, number> = {}) {
  usePlayerStore.setState({ party, storage, materials, imprint: {}, equippedArtifacts: {} });
}

test("마지막 한 마리는 먹일 수 없다", () => {
  setStorage([owned(flameling, "p0")], [owned(mossy, "s0")]);
  assert.equal(usePlayerStore.getState().feedImprint("s0"), "last-one");
  assert.equal(usePlayerStore.getState().storage.length, 1, "보관함에 그대로 남는다");

  // 같은 계열이 하나 더 있으면 먹을 수 있다
  setStorage([owned(flameling, "p0")], [owned(mossy, "s0"), owned(mossy, "s1")]);
  assert.equal(usePlayerStore.getState().feedImprint("s0"), "ok");
  assert.equal(usePlayerStore.getState().imprint.mossy, 1);
  assert.equal(usePlayerStore.getState().storage.length, 1);
});

test("파티에 있는 개체를 세어 마지막 한 마리를 판정한다", () => {
  // 파티에 모시가 한 마리 있으니 보관함의 모시는 먹여도 계열이 사라지지 않는다
  setStorage([owned(mossy, "p0")], [owned(mossy, "s0")]);
  assert.equal(usePlayerStore.getState().feedImprint("s0"), "ok");
});

test("파티 멤버는 먼저 보관함으로 내려야 한다", () => {
  setStorage([owned(mossy, "p0"), owned(mossy, "p1")], []);
  assert.equal(usePlayerStore.getState().feedImprint("p0"), "in-party");
});

test("4등급부터는 몬스터 정수가 함께 든다", () => {
  const many = Array.from({ length: 4 }, (_, i) => owned(mossy, `s${i}`));
  setStorage([owned(flameling, "p0")], many, { monster_essence: 2 });
  usePlayerStore.setState({ imprint: { mossy: 5 } });   // 다음 한 마리가 4등급

  assert.equal(usePlayerStore.getState().feedImprint("s0"), "no-essence");
  assert.equal(usePlayerStore.getState().imprint.mossy, 5, "먹인 수가 늘지 않는다");
  assert.equal(usePlayerStore.getState().storage.length, 4, "몬스터도 그대로다");

  usePlayerStore.setState({ materials: { monster_essence: 3 } });
  assert.equal(usePlayerStore.getState().feedImprint("s0"), "ok");
  assert.equal(usePlayerStore.getState().imprint.mossy, 6);
  assert.equal(usePlayerStore.getState().materials.monster_essence, 0, "정수가 소모된다");
});

test("만렙 계열은 더 먹일 수 없다", () => {
  setStorage([owned(flameling, "p0")], [owned(mossy, "s0"), owned(mossy, "s1")]);
  usePlayerStore.setState({ imprint: { mossy: 9 } });
  assert.equal(usePlayerStore.getState().feedImprint("s0"), "maxed");
});

test("보관함이 꽉 찼을 때의 흡수는 보관함을 거치지 않는다", () => {
  setStorage([owned(flameling, "p0")], []);
  assert.equal(usePlayerStore.getState().absorbCapture(mossy), "ok");
  assert.equal(usePlayerStore.getState().imprint.mossy, 1);
  assert.equal(usePlayerStore.getState().storage.length, 0);
});

test("각인이 없던 옛 세이브도 그대로 열린다", () => {
  const old = normalizeState({ party: [], storage: [], materials: { herb: 3 } });
  assert.deepEqual(old.imprint, {});
  assert.equal(old.materials.herb, 3);

  // 손으로 고친 값은 걸러낸다
  const dirty = normalizeState({ imprint: { mossy: 3, aqua: -1, bad: "9", frac: 2.7 } });
  assert.deepEqual(dirty.imprint, { mossy: 3, frac: 2 });
});

test("imprintStatus 가 다음 등급까지 남은 비용을 알려 준다", () => {
  const s = imprintStatus("mossy", { mossy: 5 });
  assert.equal(s.tier, 3);
  assert.equal(s.needFed, 1);
  assert.equal(s.needEssence, 3);
  assert.equal(s.maxed, false);

  const maxed = imprintStatus("mossy", { mossy: 9 });
  assert.equal(maxed.tier, MAX_IMPRINT_TIER);
  assert.equal(maxed.maxed, true);
});

// ─── 둥지 후보 ────────────────────────────────────────────────────────────────

const shallow = FOREST_AREAS[0];

test("둥지 후보에 같은 종이 두 번 나오지 않는다", () => {
  for (let seed = 0; seed < 200; seed++) {
    const { rng } = makeRng(seed);
    const choices = rollNestChoices(shallow, 3, [], rng);
    const ids = new Set(choices.map((m) => m.id));
    assert.equal(ids.size, choices.length, `seed ${seed}: ${choices.map((m) => m.id).join(",")}`);
  }
});

test("가능하면 보유 계열과 미보유 계열이 섞인다", () => {
  const ownedChains = ["flameling"];       // 얕은 숲 풀에 있는 계열 하나만 보유
  let mixed = 0;
  const rounds = 200;
  for (let seed = 0; seed < rounds; seed++) {
    const { rng } = makeRng(seed);
    const choices = rollNestChoices(shallow, 2, ownedChains, rng);
    const hasOwned = choices.some((m) => ownedChains.includes(chainKeyOf(m)));
    const hasNew   = choices.some((m) => !ownedChains.includes(chainKeyOf(m)));
    if (hasOwned && hasNew) mixed++;
  }
  assert.equal(mixed, rounds, "풀에 둘 다 있으면 매번 섞인다");
});

test("풀이 좁아 대비를 못 만들면 중복 제거만 한다", () => {
  const narrow = { ...shallow, monsterPool: ["flameling", "burno"] };
  const { rng } = makeRng(7);
  const choices = rollNestChoices(narrow, 2, ["flameling", "burno"], rng);
  assert.equal(choices.length, 2);
  assert.equal(new Set(choices.map((m) => m.id)).size, 2);
});

test("같은 시드·같은 스냅샷이면 후보가 똑같이 나온다", () => {
  const key = (ms: { id: string; level: number }[]) => ms.map((m) => `${m.id}:${m.level}`).join("|");
  const first  = rollNestChoices(shallow, 3, ["mossy"], makeRng(42).rng);
  const second = rollNestChoices(shallow, 3, ["mossy"], makeRng(42).rng);
  assert.equal(key(first), key(second));
});

test("후보 레벨은 구역 레벨대 안이다", () => {
  for (let seed = 0; seed < 50; seed++) {
    const { rng } = makeRng(seed);
    for (const m of rollNestChoices(shallow, 3, [], rng)) {
      assert.ok(m.level >= shallow.levelRange[0] && m.level <= shallow.levelRange[1],
        `${m.id} Lv.${m.level}`);
    }
  }
});
