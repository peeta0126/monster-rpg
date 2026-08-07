/**
 * 막히는 지점의 원인을 수치로 확인한다.
 * 실행: npx tsx scripts/sim/diagnose.ts
 */
import { installSeededRandom } from "./gameModel";
import { getFloorEnemy, scaleToLevel } from "../../src/shared/floorTable";
import { monsters } from "../../src/monster/monsters";
import { getTypeMultiplier } from "../../src/battle/battleUtils";

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
      const myDmg = Math.max(1, Math.floor((me.attack * mv.power / boss.defense) * getTypeMultiplier(mv.type, boss.type)) * (mv.accuracy / 100));
      const bossMv = bestMove(boss, me.type);
      const bossDmg = Math.max(1, Math.floor((boss.attack * bossMv.power / me.defense) * getTypeMultiplier(bossMv.type, me.type)) * (bossMv.accuracy / 100));
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

console.log("\n═══ 4. 9층 이하에서 얻을 수 있는 재료 ═══\n");
console.log("  숲(얕은 숲)   : herb, berry, root, crystal, wood_plank, leather");
console.log("  전투(1~10층) : wood_plank, leather, herb");
console.log("  → iron_fragment는 11층부터, crystal 전투드랍은 21층부터");
console.log("  → monster_essence / magic_dust / slime_extract 는 어느 드랍 테이블에도 없음\n");

console.log("═══ 5. 제작 가능 여부 ═══\n");
const need: Record<string, string[]> = {
  "힘의 목걸이":   ["iron_fragment×2", "monster_essence×1", "crystal×1"],
  "수호의 팔찌":   ["wood_plank×2", "iron_fragment×1", "magic_dust×1"],
  "정령의 부적":   ["crystal×2", "monster_essence×2", "magic_dust×2"],
  "작은 회복 물약": ["herb×2", "root×1"],
  "집중의 물약":   ["herb×1", "slime_extract×1", "magic_dust×1"],
  "강력 회복 물약": ["herb×3", "root×2", "monster_essence×1"],
};
const sources: Record<string, string> = {
  herb: "숲/전투", berry: "숲", root: "숲", crystal: "숲/전투(21층+)",
  wood_plank: "숲/전투", leather: "숲/전투", iron_fragment: "전투(11층+)",
  monster_essence: "오리온 퀘스트 1회뿐", magic_dust: "바로스 퀘스트 1회뿐",
  slime_extract: "★ 획득처 없음",
};
for (const [name, costs] of Object.entries(need)) {
  const blockers = costs.filter((c) => {
    const id = c.split("×")[0];
    return sources[id] === "★ 획득처 없음" || sources[id].includes("퀘스트");
  });
  console.log(`  ${name.padEnd(12)} ${blockers.length === 0 ? "○ 반복 제작 가능" : "△ " + blockers.map((b) => `${b}(${sources[b.split("×")[0]]})`).join(", ")}`);
}

console.log("\n═══ 6. 순환 잠김 ═══\n");
console.log("  11층 돌파 → iron_fragment / 깊은 숲(더 센 몬스터) 해금");
console.log("  그런데 10층 보스를 넘으려면 그 둘이 필요하다");
console.log("  → 10층이 닫힌 문이 된다\n");

restore();
