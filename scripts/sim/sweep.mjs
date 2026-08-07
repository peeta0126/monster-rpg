/**
 * 밸런스 값을 후보별로 갈아끼우며 10판 시뮬레이션을 돌려 비교한다.
 * 원본 파일은 매번 복원하므로, 중간에 끊겨도 sweep 대상 파일은 원래대로 남는다.
 *
 * 실행: node scripts/sim/sweep.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const TARGET = "src/battle/battleUtils.ts";
const original = readFileSync(TARGET, "utf8");

const CANDIDATES = ["1.20", "1.12", "1.08", "1.06", "1.05", "1.04"];

console.log("EXP_GROWTH_RATE | 클리어율 | 평균 막힌층 | 평균 탑전투 | 평균 턴");
console.log("----------------|----------|-------------|-------------|--------");

try {
  for (const rate of CANDIDATES) {
    const patched = original.replace(
      /export const EXP_GROWTH_RATE = [\d.]+;/,
      `export const EXP_GROWTH_RATE = ${rate};`,
    );
    writeFileSync(TARGET, patched);
    const out = execSync("npx tsx scripts/sim/run.ts 10", { encoding: "utf8", maxBuffer: 1 << 24 });
    const pick = (re) => (out.match(re)?.[1] ?? "-").trim();
    console.log(
      `${rate.padStart(15)} | ${pick(/클리어율\s+: (.+)/).padStart(8)} | ` +
      `${(pick(/막힌 층\s+: 평균 ([\d.]+)층/) || "-").padStart(11)} | ` +
      `${pick(/탑 전투 수\s+: (.+)/).padStart(11)} | ${pick(/총 전투 턴\s+: (.+)/).padStart(7)}`,
    );
  }
} finally {
  writeFileSync(TARGET, original);
  console.log("\n(원본 복원 완료)");
}
