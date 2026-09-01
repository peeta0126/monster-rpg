import { monsters } from "../../src/monster/monsters";
import { LEARNSET } from "../../src/monster/learnset";
console.log("종      | 기본 기술(잡으면 즉시)                  | 학습표상 그 기술을 배우는 레벨");
for (const m of monsters) {
  const ls = (LEARNSET as Record<string, { level: number; move: { name: string } }[]>)[m.id];
  if (!ls) continue;
  const rows = m.moves.map((mv) => {
    const hit = ls.find((e) => e.move.name === mv.name);
    return `${mv.name}(${mv.power})@${hit ? "Lv" + hit.level : "없음"}`;
  });
  console.log(`${m.name.padEnd(6)} | ${rows.join(" ")}`);
}
