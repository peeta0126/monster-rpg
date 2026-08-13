/**
 * 이번 전투 정비(상성 구멍·치명타·속도·적 AI·상태이상 지속)가 각각 밸런스를 얼마나
 * 움직였는지 하나씩 꺼 보며 잰다.
 *
 * 원본을 임시로 고쳐 시뮬을 돌리고 되돌리는 방식이라, 중간에 죽어도 finally 에서 복원된다.
 *
 * 실행: node scripts/sim/battleSweep.mjs [판수]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const UTILS = "src/battle/battleUtils.ts";
const CHART = "src/battle/typeChart.ts";
const originals = { [UTILS]: readFileSync(UTILS, "utf8"), [CHART]: readFileSync(CHART, "utf8") };

const replace = (src, from, to) => {
  if (!src.includes(from)) throw new Error(`못 찾음: ${from.slice(0, 40)}`);
  return src.replaceAll(from, to);
};

/** 각 변형은 {파일: 고친 내용} 을 돌려준다 */
const VARIANTS = [
  ["전부 적용", () => ({})],
  ["속도 빼고", () => ({
    [UTILS]: replace(originals[UTILS],
      "  const diff = mySpeed - oppSpeed;\r\n  const need = Math.max(1, oppSpeed);\r\n  if (diff <= 0)",
      "  const diff = 0; void mySpeed;\r\n  const need = Math.max(1, oppSpeed);\r\n  if (diff <= 0)"),
  })],
  ["AI 빼고", () => ({
    [UTILS]: replace(
      replace(originals[UTILS],
        "  return move.power * getTypeMultiplier(move.type, defender.type) * (move.accuracy / 100);",
        "  return getTypeMultiplier(move.type, defender.type);"),
      "  return Math.min(0.9, 0.45 + Math.max(0, floor - 1) * 0.009);",
      "  return 1; void floor;"),
  })],
  ["치명타 빼고", () => ({
    [UTILS]: replace(originals[UTILS], "export const BASE_CRIT_RATE = 6;", "export const BASE_CRIT_RATE = 0;"),
  })],
  ["상성 빼고", () => ({
    // 새로 더한 칸 셋만 1배로 되돌린다
    [CHART]: replace(
      replace(
        replace(originals[CHART], "    electric: 2,   // 풀 → 전기", "    electric: 1,   // 풀 → 전기"),
        "    poison: 2,     // 얼음 → 독", "    poison: 1,     // 얼음 → 독"),
      "    normal: 2,   // 독 → 노말", "    normal: 1,   // 독 → 노말"),
  })],
  ["상태이상 지속 빼고", () => ({
    [UTILS]: replace(
      replace(replace(originals[UTILS], "  burn: 4,", "  burn: 999,"), "  poison: 5,", "  poison: 999,"),
      "  paralysis: 4,", "  paralysis: 999,"),
  })],
];

const BOSSES = [10, 20, 30, 40, 50];
const RUNS = Number(process.argv[2] ?? 20);

console.log(`${RUNS}판 · SIM_SEED=${process.env.SIM_SEED ?? 1000}\n`);
console.log(`방식              | 클리어 | 탑전투 | ${BOSSES.map((f) => `${f}층`.padStart(6)).join(" ")} | 재도전 합`);
console.log(`------------------|--------|--------|${BOSSES.map(() => "-------").join("")}|----------`);

try {
  for (const [label, build] of VARIANTS) {
    const patched = build();
    for (const [file, content] of Object.entries(originals)) {
      writeFileSync(file, patched[file] ?? content);
    }
    const out = execSync(`npx tsx scripts/sim/run.ts ${RUNS}`, { encoding: "utf8", maxBuffer: 1 << 24 });

    const pick = (re) => (out.match(re)?.[1] ?? "-").trim();
    const section = out.slice(out.indexOf("── 보스 벽"), out.indexOf("── 남은 재료"));
    const retries = BOSSES.map((f) => {
      const m = section.match(new RegExp(`^\\s*${f} \\|\\s*([\\d.]+) \\|`, "m"));
      return m ? Number(m[1]) : 0;
    });

    console.log(
      `${label.padEnd(17)} | ${pick(/클리어율\s+: (.+)/).padStart(6)} | ` +
      `${pick(/탑 전투 수\s+: (.+)/).padStart(6)} | ` +
      `${retries.map((n) => n.toFixed(1).padStart(6)).join(" ")} | ` +
      `${retries.reduce((a, b) => a + b, 0).toFixed(1).padStart(9)}`,
    );
  }
} finally {
  for (const [file, content] of Object.entries(originals)) writeFileSync(file, content);
  console.log("\n(원본 복원 완료)");
}
