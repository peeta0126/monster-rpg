/**
 * 대기 파티원 경험치 분배 방식을 바꿔가며 보스층 재도전 횟수를 비교한다.
 *
 * 배경: 20판 시뮬레이션에서 보스층 패배율이 10층 77% / 20층 87% / 40층 76% / 50층 69% 였고,
 * 50층 첫 도전 파티가 "플레미 Lv57 · 모치 Lv34 · 모왕 Lv40" 이었다. 선봉 하나로 버티다
 * 쓰러지면 남은 둘이 20레벨 아래라 그대로 끝난다. 분배율 0.5 고정으로는 뒤처진 쪽이
 * 영원히 못 따라잡는다는 가설을 확인하고, 대안들을 같은 시드로 비교한다.
 *
 * 실행: node scripts/sim/benchSweep.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const TARGET = "src/battle/battleUtils.ts";
const original = readFileSync(TARGET, "utf8");
const RE = /(export function benchExpShare\(benchLevel: number, leadLevel: number\): number \{)[\s\S]*?(\n\})/;

if (!RE.test(original)) {
  console.error(`${TARGET} 에서 benchExpShare 본문을 못 찾았다.`);
  process.exit(1);
}

/** 각 후보의 함수 본문. void 로 미사용 인자 경고를 피한다. */
const CANDIDATES = [
  ["고정 0.5",        "  void benchLevel; void leadLevel; return 0.5;"],
  ["고정 0.7",        "  void benchLevel; void leadLevel; return 0.7;"],
  ["0.5 + .05/lv",    "  return Math.min(1, 0.5 + Math.max(0, leadLevel - benchLevel) * 0.05);"],
  ["0.7 + .05/lv",    "  return Math.min(1, 0.7 + Math.max(0, leadLevel - benchLevel) * 0.05);"],
  ["0.7 + .10/lv",    "  return Math.min(1, 0.7 + Math.max(0, leadLevel - benchLevel) * 0.10);"],
];

const BOSSES = [10, 20, 30, 40, 50];
const RUNS = Number(process.argv[2] ?? 30);

console.log(`${RUNS}판 · 같은 시드\n`);
console.log(`방식          | 탑전투 |  총턴 | ${BOSSES.map((f) => `${f}층`.padStart(6)).join(" ")} | 재도전 합 | 레벨 격차`);
console.log(`--------------|--------|-------|${BOSSES.map(() => "-------").join("")}|-----------|----------`);

try {
  for (const [label, body] of CANDIDATES) {
    writeFileSync(TARGET, original.replace(RE, `$1\n${body}$2`));
    const out = execSync(`npx tsx scripts/sim/run.ts ${RUNS}`, { encoding: "utf8", maxBuffer: 1 << 24 });

    const pick = (re) => (out.match(re)?.[1] ?? "-").trim();
    // "── 보스 벽" 절만 잘라서 읽는다. 층별 난이도 표도 같은 " 10 |" 로 시작해서
    // 문서 전체에 정규식을 걸면 그쪽 전투 수를 집어온다.
    const section = out.slice(out.indexOf("── 보스 벽"), out.indexOf("── 남은 재료"));
    const retries = BOSSES.map((f) => {
      const m = section.match(new RegExp(`^\\s*${f} \\|\\s*([\\d.]+) \\|`, "m"));
      return m ? Number(m[1]) : 0;
    });

    // 최종 레벨 "57/34/51" 들을 모아 최고-최저 격차 평균을 낸다 — 이 변경이 노리는 지표다
    const gaps = [...out.matchAll(/\|\s*(\d+(?:\/\d+)+)\s*$/gm)]
      .map((m) => m[1].split("/").map(Number))
      .map((ls) => Math.max(...ls) - Math.min(...ls));
    const gap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN;

    console.log(
      `${label.padEnd(13)} | ${pick(/탑 전투 수\s+: (.+)/).padStart(6)} | ` +
      `${pick(/총 전투 턴\s+: (.+)/).padStart(5)} | ` +
      `${retries.map((n) => n.toFixed(1).padStart(6)).join(" ")} | ` +
      `${retries.reduce((a, b) => a + b, 0).toFixed(1).padStart(9)} | ` +
      `${gap.toFixed(1).padStart(9)}`,
    );
  }
} finally {
  writeFileSync(TARGET, original);
  console.log("\n(원본 복원 완료)");
}
