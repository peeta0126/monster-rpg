/**
 * 층이 오를수록 적이 주는 경험치가 붙는 속도를 바꿔가며 비교한다.
 *
 * 배경: FLOOR_FIXED 11~25층이 죽어 있던 걸 살리고 나니(그 층 적이 자기 최약체 기술만
 * 반복하고 있었다) 20층 도달 레벨이 -2.1 에서 +0.6 으로 붙었다. 대신 11~25층이 전부
 * 진짜 전투가 되면서 판이 98.7전투 → 124.9전투로 늘었고, 30층 이후 도달 레벨이 전부
 * 마이너스로 돌아섰다. 예전엔 공짜 층에서 레벨을 벌어 뒤쪽 보스를 웃돌았던 것이다.
 *
 * scaleToLevel 의 rewardExp 계수(1 + n × 0.22)를 올려 그만큼을 정직하게 메운다.
 *
 * 실행: node scripts/sim/expSweep.mjs [판수]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const TARGET = "src/shared/floorTable.ts";
const original = readFileSync(TARGET, "utf8");
const RE = /(rewardExp: Math\.floor\(base\.rewardExp \* \(1 \+ n \* )[\d.]+(\)\),)/;

if (!RE.test(original)) {
  console.error(`${TARGET} 에서 rewardExp 계수를 못 찾았다.`);
  process.exit(1);
}

const CANDIDATES = ["0.22", "0.30", "0.40", "0.55"];
const BOSSES = [10, 20, 30, 40, 50];
const CHECK = [20, 30, 40, 50];
const RUNS = Number(process.argv[2] ?? 40);

console.log(`${RUNS}판 · SIM_SEED=${process.env.SIM_SEED ?? 1000}\n`);
console.log(`계수  | 탑전투 |  총턴 | ${BOSSES.map((f) => `${f}층`.padStart(6)).join(" ")} | 재도전 합 | ${CHECK.map((f) => `${f}층차`.padStart(7)).join("")}`);
console.log(`------|--------|-------|${BOSSES.map(() => "-------").join("")}|-----------|${CHECK.map(() => "-------").join("")}`);

try {
  for (const c of CANDIDATES) {
    writeFileSync(TARGET, original.replace(RE, `$1${c}$2`));
    const out = execSync(`npx tsx scripts/sim/run.ts ${RUNS}`, { encoding: "utf8", maxBuffer: 1 << 24 });

    const pick = (re) => (out.match(re)?.[1] ?? "-").trim();
    const section = out.slice(out.indexOf("── 보스 벽"), out.indexOf("── 남은 재료"));
    const retries = BOSSES.map((f) => {
      const m = section.match(new RegExp(`^\\s*${f} \\|\\s*([\\d.]+) \\|`, "m"));
      return m ? Number(m[1]) : 0;
    });
    // 도달 레벨표의 "차이" 열 — 보스보다 몇 레벨 위에서 붙느냐
    const lvSec = out.slice(out.indexOf("── 층 도달 시점"), out.indexOf("── 보스 벽"));
    const diffs = CHECK.map((f) => {
      const m = lvSec.match(new RegExp(`^\\s*${f} \\|.*\\|\\s*(-?[\\d.]+)\\s*$`, "m"));
      return m ? Number(m[1]) : NaN;
    });

    console.log(
      `${c.padStart(5)} | ${pick(/탑 전투 수\s+: (.+)/).padStart(6)} | ` +
      `${pick(/총 전투 턴\s+: (.+)/).padStart(5)} | ` +
      `${retries.map((n) => n.toFixed(1).padStart(6)).join(" ")} | ` +
      `${retries.reduce((a, b) => a + b, 0).toFixed(1).padStart(9)} | ` +
      `${diffs.map((n) => n.toFixed(1).padStart(7)).join("")}`,
    );
  }
} finally {
  writeFileSync(TARGET, original);
  console.log("\n(원본 복원 완료)");
}
