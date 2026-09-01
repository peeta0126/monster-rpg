/**
 * 막히는 지점의 원인을 수치로 확인한다.
 * 실행: npx tsx scripts/sim/diagnose.ts
 */
import { installSeededRandom } from "./gameModel";
import { getFloorEnemy, scaleToLevel } from "../../src/shared/floorTable";
import { monsters } from "../../src/monster/monsters";
import { getTypeMultiplier } from "../../src/battle/battleUtils";
import type { ElementType } from "../../src/shared/game";
import { AREA_MATERIAL_POOL, battleDropPool } from "../../src/shared/dropTables";
import { FOREST_AREAS } from "../../src/camp/forest/areas";
import { CRAFTING_RECIPES } from "../../src/workshop/craftingRecipes";
import { MATERIALS } from "../../src/shared/items";

/** 드랍 테이블 밖에서 나오는 재료 (BattlePage / gameModel 의 특수 처리) */
const SPECIAL_DROP: Record<string, string> = { ormr_essence: "50층 오름 확정" };
const SPECIAL_DROP_FLOOR: Record<string, number> = { ormr_essence: 50 };

const restore = installSeededRandom(42);

function bestMove(m: { moves: { power: number; accuracy: number; type: string; name: string }[] }, defType: unknown) {
  return m.moves.reduce((a, b) => {
    const sa = a.power * (a.accuracy / 100) * getTypeMultiplier(a.type as never, defType as never);
    const sb = b.power * (b.accuracy / 100) * getTypeMultiplier(b.type as never, defType as never);
    return sb > sa ? b : a;
  });
}

console.log("═══ 1. 보스층 요구 스펙 ═══\n");
console.log("층 | 보스            | HP    | 공격 | 방어 | 속도");
console.log("---|-----------------|-------|------|------|-----");
for (const f of [10, 20, 30, 40, 50]) {
  const e = getFloorEnemy(f, "none");
  console.log(
    `${String(f).padStart(2)} | ${e.name.padEnd(15)} | ${String(e.maxHp).padStart(5)} | ` +
    `${String(e.attack).padStart(4)} | ${String(e.defense).padStart(4)} | ${String(e.speed).padStart(4)}`,
  );
}

console.log("\n═══ 2. 각 층 보스를 잡으려면 몇 레벨이 필요한가 ═══");
console.log("(장비 없음 · 해당 시점에 실제로 얻을 수 있는 최선의 몬스터 기준)\n");

/** 그 시점에 잡을 수 있는 몬스터 풀 */
const AVAILABLE: Record<number, string[]> = {
  10: ["flameling", "aquabe", "leafy", "nobi", "venomcrow"],                       // 얕은 숲만 해금
  20: ["burno", "bubblet", "mossy", "crystafox", "frostorb", "toxadon"],           // 깊은 숲(11층+)
  30: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],              // 고대 숲(21층+)
  40: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
  50: ["mossevo", "mossyfinal", "aquavern", "crystafox", "frostorb"],
};

for (const floor of [10, 20, 30, 40, 50]) {
  const boss = getFloorEnemy(floor, "none");
  let bestLine = "";
  let bestNeed = Infinity;

  for (const id of AVAILABLE[floor]) {
    const base = monsters.find((m) => m.id === id)!;
    // 이 종족으로 보스를 이기는 최소 레벨을 이분이 아닌 선형 탐색으로 찾는다
    let need = -1;
    for (let lv = 1; lv <= 200; lv++) {
      const me = scaleToLevel(base, lv);
      const mv = bestMove(me, boss.type);
      const myDmg = Math.max(1, Math.floor((me.attack * mv.power / boss.defense) * getTypeMultiplier(mv.type as ElementType, boss.type)) * (mv.accuracy / 100));
      const bossMv = bestMove(boss, me.type);
      const bossDmg = Math.max(1, Math.floor((boss.attack * bossMv.power / me.defense) * getTypeMultiplier(bossMv.type as ElementType, me.type)) * (bossMv.accuracy / 100));
      const turnsToKill = boss.maxHp / myDmg;
      const turnsToDie = me.maxHp / bossDmg;
      // 파티 3마리 = 대략 3배 버팀
      if (turnsToKill <= turnsToDie * 3) { need = lv; break; }
    }
    if (need > 0 && need < bestNeed) {
      bestNeed = need;
      const me = scaleToLevel(base, need);
      const mv = bestMove(me, boss.type);
      bestLine = `${base.name}(${mv.name} 위력${mv.power}) Lv.${need} — 공격 ${me.attack} / HP ${me.maxHp}`;
    }
  }
  console.log(`${String(floor).padStart(2)}층 ${boss.name.padEnd(14)} → 최소 ${bestLine || "어떤 레벨로도 불가"}`);
}

console.log("\n═══ 3. 레벨을 올리는 데 걸리는 전투 수 ═══");
console.log("(직전 층을 반복해서 파밍한다고 가정)\n");
{
  const base = monsters.find((m) => m.id === "venomcrow")!;
  let exp = 0, lv = 1, need = base.expToNextLevel, battles = 0;
  const marks = [5, 10, 15, 20, 25, 30];
  const rows: string[] = [];
  for (const mark of marks) {
    while (lv < mark && battles < 100000) {
      const farmFloor = Math.min(9, Math.max(1, lv));
      const e = getFloorEnemy(farmFloor, "none");
      exp += e.rewardExp;
      battles++;
      while (exp >= need) { exp -= need; lv++; need = Math.floor(need * 1.2); }
    }
    rows.push(`  Lv.${String(mark).padStart(2)}까지 누적 ${battles}전투`);
  }
  console.log(rows.join("\n"));
}

console.log("\n=== 4. 재료 획득처 ===\n".replace(/=/g, "\u2550"));
{
  console.log("  " + "재료".padEnd(16) + "숲".padEnd(24) + "전투");
  for (const item of MATERIALS) {
    const areas = FOREST_AREAS
      .filter((a) => (AREA_MATERIAL_POOL[a.id] ?? []).includes(item.id))
      .map((a) => `${a.name}(${a.unlockFloor}층~)`);
    const floors = [1, 11, 21, 31].filter((f) => battleDropPool(f).includes(item.id));
    const battle = SPECIAL_DROP[item.id] ?? (floors.length ? `${floors[0]}층~` : "-");
    console.log("  " + item.name.padEnd(16) + (areas.join(" ") || "-").padEnd(24) + battle);
  }
  const orphans = MATERIALS.filter((i) =>
    !SPECIAL_DROP[i.id] &&
    !FOREST_AREAS.some((a) => (AREA_MATERIAL_POOL[a.id] ?? []).includes(i.id)) &&
    ![1, 11, 21, 31].some((f) => battleDropPool(f).includes(i.id)));
  console.log(orphans.length
    ? `\n  ★ 어느 드랍 테이블에도 없음: ${orphans.map((i) => i.name).join(", ")}`
    : "\n  모든 재료에 반복 획득처가 있다.");
}

console.log("\n=== 5. 레시피별 최초 제작 가능 시점 ===\n".replace(/=/g, "\u2550"));
{
  /** 그 재료를 반복해서 얻으려면 몇 층을 넘어야 하나 (숲 구역 해금층 / 전투 드랍 하한) */
  const unlockFloor = (id: string): number | null => {
    const cands: number[] = [];
    for (const a of FOREST_AREAS) {
      if ((AREA_MATERIAL_POOL[a.id] ?? []).includes(id)) cands.push(a.unlockFloor);
    }
    for (const f of [1, 11, 21, 31]) if (battleDropPool(f).includes(id)) cands.push(f);
    if (SPECIAL_DROP_FLOOR[id] !== undefined) cands.push(SPECIAL_DROP_FLOOR[id]);
    return cands.length ? Math.min(...cands) : null;
  };
  for (const r of CRAFTING_RECIPES) {
    const gates = r.costs.map((c) => ({ c, f: unlockFloor(c.itemId) }));
    const blocked = gates.filter((g) => g.f === null);
    if (blocked.length) {
      console.log(`  ${r.name.padEnd(14)} ✗ 영구 봉인 — ${blocked.map((g) => g.c.name).join(", ")} 획득처 없음`);
    } else {
      const at = Math.max(...gates.map((g) => g.f!));
      const why = gates.filter((g) => g.f === at).map((g) => g.c.name).join(", ");
      console.log(`  ${r.name.padEnd(14)} ${String(at).padStart(2)}층~  (${why})`);
    }
  }
}

console.log("\n═══ 6. 보스층 앞에서 쓸 게 있는가 ═══\n");
{
  // 예전엔 여기가 손으로 적은 결론이었다("10층이 닫힌 문이 된다"). 얕은 숲 드랍이
  // 구역별로 갈린 뒤로는 사실이 아닌데도 그대로 출력됐다. 이제 표에서 직접 센다.
  const reachable = (id: string) => {
    for (const a of FOREST_AREAS) {
      if (a.unlockFloor >= 10) continue;                       // 10층 전에 못 여는 구역
      if ((AREA_MATERIAL_POOL[a.id] ?? []).includes(id)) return true;
    }
    return battleDropPool(1).includes(id);
  };
  const ready = CRAFTING_RECIPES.filter((r) => r.costs.every((c) => reachable(c.itemId)));
  console.log("  10층 보스 이전에 반복 제작 가능한 것:");
  console.log(ready.length
    ? ready.map((r) => `    ${r.name}`).join("\n")
    : "    없음 — 아무 준비 없이 첫 보스와 붙게 된다");
}


restore();
