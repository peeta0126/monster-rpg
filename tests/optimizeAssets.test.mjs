import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * optimize-assets.mjs 가 몇 번을 돌려도 같은 결과를 내는지 확인한다.
 *
 * 예전 스크립트는 원본을 제자리에서 덮어써서, 두 번째 실행이 이미 축소된 파일을 입력으로
 * 삼아 해상도를 또 깎았다. 그게 조용히 진행되는 종류라 눈으로는 못 잡는다. 실행 전후
 * 해시를 비교하는 게 유일하게 확실한 방법이다.
 *
 * 시간이 걸리는 검사라 `--dry` 가 아니라 실제 변환을 돌린다. art-src/ 에 마스터가 없는
 * 환경(새 클론·CI)에서는 변환할 게 없으므로, 그때는 "입력을 건드리지 않는다"만 본다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts", "optimize-assets.mjs");
const PUBLIC = path.join(ROOT, "public");
const ART_SRC = path.join(ROOT, "art-src");

const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

function snapshot(dir) {
  const out = new Map();
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|webp|jpe?g)$/i.test(e.name)) out.set(path.relative(dir, p), sha(p));
    }
  };
  walk(dir);
  return out;
}

const run = () => execFileSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: "utf8" });

function diff(a, b) {
  const changed = [];
  for (const [k, v] of b) if (a.get(k) !== v) changed.push(k);
  for (const k of a.keys()) if (!b.has(k)) changed.push(`${k} (사라짐)`);
  return changed;
}

test("두 번 돌려도 public/ 산출물이 그대로다", () => {
  run();                              // 1회차 — 기준선을 만든다
  const first = snapshot(PUBLIC);
  run();                              // 2회차
  const second = snapshot(PUBLIC);

  assert.deepEqual(diff(first, second), [], "2회차에서 산출물이 바뀌었다");
});

test("원본(art-src/)을 건드리지 않는다", () => {
  const before = snapshot(ART_SRC);
  run();
  const after = snapshot(ART_SRC);
  assert.deepEqual(diff(before, after), [], "art-src/ 의 원본이 바뀌었다");
});

test("출력이 입력을 덮는 레시피가 있으면 아무것도 하지 않고 죽는다", async () => {
  // 규칙을 어기는 레시피를 넣은 사본을 만들어 돌려본다.
  // 규칙 자체가 이 스크립트의 존재 이유라, 검사가 살아 있는지 확인해 둔다.
  const src = fs.readFileSync(SCRIPT, "utf8");
  const broken = src.replace(
    'const RECIPES = [',
    'const RECIPES = [\n  { src: "housing_bg.png", out: "../art-src/housing_bg.png" },',
  );
  assert.notEqual(broken, src, "레시피 배열을 못 찾았다 — 테스트가 낡았다");

  const tmp = path.join(ROOT, "scripts", "__optimize-assets.tmp.mjs");
  fs.writeFileSync(tmp, broken);
  try {
    let failed = false, out = "";
    try { execFileSync(process.execPath, [tmp], { cwd: ROOT, encoding: "utf8" }); }
    catch (e) { failed = true; out = `${e.stdout ?? ""}${e.stderr ?? ""}`; }
    assert.ok(failed, "규칙을 어겼는데 그냥 돌았다");
    assert.match(out, /출력이 입력을 덮어쓴다/);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});
