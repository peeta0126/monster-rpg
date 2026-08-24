/**
 * 10층·20층 보스 배수를 바꿔가며 재도전 횟수를 비교한다.
 *
 * 배경: 층별 기대 피해를 난수 없이 계산하면 "버티는 턴 / 눕히는 턴" 여유가
 *   9층 1.10 · 10층 0.26 · 19층 1.79 · 20층 0.24 · 30층 0.71 · 40층 0.83 · 50층 0.78
 * 이다. 30~50층 보스는 0.7~0.8 로 고르게 서 있는데 10·20층만 0.25 언저리. 세 배 가혹하다.
 * 배수 자체가 30~50층보다 특별히 높지도 않다(20층은 오히려 제일 낮다). 도달 레벨이
 * 보스보다 낮은 채로(-2.6 / -2.1) 붙게 되는 게 겹친 결과다.
 *
 * 목표는 뒤쪽 보스와 같은 체감(재도전 1~2회)으로 맞추는 것이지 쉽게 만드는 게 아니다.
 *
 * ── 결론: 배수를 낮추면 안 된다 ──────────────────────────────────────────────
 * 40판 기준, FLOOR_FIXED 복구와 경험치 보정을 넣기 전과 후 두 번 다 같은 결과가 나왔다.
 *
 *      방식 | 탑전투 | 10층 | 20층 | 40층 | 재도전 합
 *      현행 |   89.3 |  2.4 |  3.0 |  1.0 |       8.3   ← 이게 제일 낫다
 *   레벨만-1 |  101.7 |  1.6 |  2.5 |  4.1 |      10.3
 *  배수만완화 |  102.4 |  0.7 |  2.5 |  4.8 |       9.7
 *      둘 다 |  103.2 |  0.2 |  1.3 |  4.3 |       9.0
 *
 * 10층 재도전은 잘 내려간다(2.4 → 0.2). 그런데 40층이 1.0 → 4.3 으로 튀고 판 전체가
 * 길어진다(89 → 103전투). 초반 보스가 사실상 레벨 관문 노릇을 하고 있어서, 여기서
 * 갈아둔 레벨이 26~49층(고정 구성 없이 랜덤 풀인 구간)을 버티게 해준다. 관문을 치우면
 * 그 빚을 40층에서 갚는데, 40층 벽이 10층 벽보다 훨씬 비싸다.
 *
 * 그러니 10층 패배율 70% 는 남겨둔 값이지 못 고친 값이 아니다. 다시 낮추려거든
 * 26~49층에 먼저 손을 대야 한다.
 *
 * 실행: node scripts/sim/bossSweep.mjs [판수]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const TARGET = "src/shared/floorTable.ts";
const original = readFileSync(TARGET, "utf8");

/** 보스 한 마리의 (레벨, HP배수, 공격배수, 방어배수) 를 통째로 갈아끼운다 */
function patch(src, floor, baseLevel, hp, atk, def) {
  const re = new RegExp(
    `(if \\(floor === ${floor}\\) \\{[\\s\\S]*?scaleToLevel\\(base, )\\d+(\\);[\\s\\S]*?` +
    `maxHp: Math\\.floor\\(scaled\\.maxHp \\* )[\\d.]+(\\),[\\s\\S]*?` +
    `attack: Math\\.floor\\(scaled\\.attack \\* )[\\d.]+(\\),[\\s\\S]*?` +
    `defense: Math\\.floor\\(scaled\\.defense \\* )[\\d.]+(\\),)`,
  );
  if (!re.test(src)) throw new Error(`${floor}층 보스 블록을 못 찾았다.`);
  return src.replace(re, `$1${baseLevel}$2${hp}$3${atk}$4${def}$5`);
}

// [라벨, 10층(lv,hp,atk,def), 20층(lv,hp,atk,def)]
const CANDIDATES = [
  ["현행",       [11, "1.5", "1.3", "1.2"], [20, "1.2", "1.05", "1.15"]],
  ["레벨만 -1",  [10, "1.5", "1.3", "1.2"], [19, "1.2", "1.05", "1.15"]],
  ["배수만 완화", [11, "1.3", "1.1", "1.0"], [20, "1.1", "0.9",  "1.0"]],
  ["둘 다",      [10, "1.3", "1.1", "1.0"], [19, "1.1", "0.9",  "1.0"]],
  ["둘 다 강하게", [10, "1.35", "1.2", "1.1"], [19, "1.15", "1.0", "1.05"]],
];

const BOSSES = [10, 20, 30, 40, 50];
const RUNS = Number(process.argv[2] ?? 40);

console.log(`${RUNS}판 · SIM_SEED=${process.env.SIM_SEED ?? 1000}\n`);
console.log(`방식        | 탑전투 |  총턴 | ${BOSSES.map((f) => `${f}층`.padStart(6)).join(" ")} | 재도전 합`);
console.log(`------------|--------|-------|${BOSSES.map(() => "-------").join("")}|----------`);

try {
  for (const [label, a, b] of CANDIDATES) {
    writeFileSync(TARGET, patch(patch(original, 10, ...a), 20, ...b));
    const out = execSync(`npx tsx scripts/sim/run.ts ${RUNS}`, { encoding: "utf8", maxBuffer: 1 << 24 });

    const pick = (re) => (out.match(re)?.[1] ?? "-").trim();
    const section = out.slice(out.indexOf("── 보스 벽"), out.indexOf("── 남은 재료"));
    const retries = BOSSES.map((f) => {
      const m = section.match(new RegExp(`^\\s*${f} \\|\\s*([\\d.]+) \\|`, "m"));
      return m ? Number(m[1]) : 0;
    });

    console.log(
      `${label.padEnd(11)} | ${pick(/탑 전투 수\s+: (.+)/).padStart(6)} | ` +
      `${pick(/총 전투 턴\s+: (.+)/).padStart(5)} | ` +
      `${retries.map((n) => n.toFixed(1).padStart(6)).join(" ")} | ` +
      `${retries.reduce((a2, b2) => a2 + b2, 0).toFixed(1).padStart(9)}`,
    );
  }
} finally {
  writeFileSync(TARGET, original);
  console.log("\n(원본 복원 완료)");
}
