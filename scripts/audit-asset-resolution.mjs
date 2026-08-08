#!/usr/bin/env node
/**
 * public/ 의 이미지가 과거보다 작아진 게 있는지 훑는다.
 *
 * optimize-assets.mjs 의 KEY_ART 단계는 원본 PNG 를 축소본으로 덮어쓴다. 그래서
 * 두 번 돌리면 이미 축소된 PNG 로 WebP 를 다시 구워 해상도가 소리 없이 깎일 수 있었다.
 * 그 사고가 실제로 났는지 확인하려고 만들었고, 앞으로도 같은 종류의 손실을 잡는 데 쓴다.
 *
 * 각 파일을 건드린 모든 커밋을 훑어 최대 해상도를 구하고, 지금 파일과 비교한다.
 * 의도적으로 줄인 폴백(KEY_ART)은 EXPECTED_DOWNSCALE 에 적어 두면 조용히 넘어간다.
 *
 * 실행: node scripts/audit-asset-resolution.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";

/**
 * 의도적으로 줄인 것 — 파일 → 그 이유.
 * 2026-08-08 전수 확인 결과 세 건이 걸렸는데 셋 다 손실이 아니었다.
 *   start-loading.png  2624x1632 → 1312x816  KEY_ART 폴백 (WebP 는 원본 해상도 그대로)
 *   housing_bg.png     1672x941  → 1200x896  아예 다른 그림으로 두 번 교체됐다
 *   Baros.png          408x612   → 64x64     초상화를 Baros_portrait 로 분리하고
 *                                            여긴 64x64 걷기 스프라이트가 됐다
 */
const EXPECTED_DOWNSCALE = {
  "public/assets/player/Baros.png": "초상화는 Baros_portrait 로 분리, 여긴 걷기 스프라이트",
};

const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 1 << 26 });

// 버퍼를 그대로 넘긴다. 임시 파일에 써서 읽으면 sharp 가 경로로 메타데이터를 캐시해
// 두 번째부터 첫 파일 값이 돌아온다 — 처음에 그렇게 짰다가 전부 "이상 없음"이 나왔다.
const metaOf = (buf) => sharp(buf).metadata();

async function main() {
  const files = sh("git ls-files public/")
    .trim().split("\n")
    .filter((f) => /\.(png|webp|jpe?g)$/i.test(f));

  const shrunk = [];
  let checked = 0;

  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const cur = await sharp(f).metadata().catch(() => null);
    if (!cur) continue;
    checked += 1;

    const commits = sh(`git log --format=%h --all -- "${f}"`).trim().split("\n").filter(Boolean);
    let maxW = 0, maxH = 0, at = "";
    for (const c of commits) {
      try {
        const m = await metaOf(execSync(`git show ${c}:${f}`, { maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] }));
        if (m.width > maxW) { maxW = m.width; maxH = m.height; at = c; }
      } catch { /* 그 커밋엔 없던 파일 */ }
    }

    if (cur.width < maxW) {
      shrunk.push({ f, now: `${cur.width}x${cur.height}`, was: `${maxW}x${maxH}`, at });
    }
  }

  console.log(`이미지 ${checked}개 확인\n`);
  const real = shrunk.filter((r) => !EXPECTED_DOWNSCALE[r.f]);
  const expected = shrunk.filter((r) => EXPECTED_DOWNSCALE[r.f]);

  if (expected.length) {
    console.log("의도적으로 줄인 것:");
    for (const r of expected) console.log(`  ${r.f.padEnd(40)} ${r.now.padEnd(12)} (${EXPECTED_DOWNSCALE[r.f]})`);
    console.log();
  }

  if (!real.length) {
    console.log("과거보다 작아진 파일: 없음");
    return;
  }
  console.log("⚠ 과거보다 작아진 파일:");
  console.log("  " + "파일".padEnd(40) + "지금".padEnd(13) + "과거 최대".padEnd(13) + "그 커밋");
  for (const r of real) {
    console.log("  " + r.f.padEnd(40) + r.now.padEnd(13) + r.was.padEnd(13) + r.at);
  }
  process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
