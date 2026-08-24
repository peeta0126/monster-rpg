import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { itemIconUrl } from "../src/shared/assetPaths.ts";
import { RASTER_ICON_IDS } from "../src/shared/ui/rasterIcons.ts";
import { MATERIALS, POTIONS } from "../src/shared/items.ts";

/**
 * 아이템 아이콘은 세 곳이 맞물려 있다. 구운 파일(public/assets/icons), 그 목록
 * (rasterIcons.ts), 그리고 아이템 표의 icon 이름. 하나만 어긋나면 화면에서는
 * 조용히 옛 SVG 가 나오거나 빈 칸이 뜬다. 눈으로는 "원래 이런 그림이었나" 싶어 넘어간다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "assets", "icons");
const SRC = path.join(ROOT, "art-src", "icons");

const built = fs.readdirSync(OUT).filter((f) => f.endsWith(".webp"))
  .map((f) => f.replace(/\.webp$/, "")).sort();

test("목록과 구운 파일이 한 벌이다", () => {
  // rasterIcons.ts 는 생성물이다. 원본을 더하고 굽는 것을 잊으면 여기서 걸린다.
  assert.deepEqual([...RASTER_ICON_IDS].sort(), built);
});

test("원본이 그대로 남아 있다 — 구운 뒤 지우지 않는다", () => {
  const masters = fs.readdirSync(SRC).map((f) => f.replace(/\.[^.]+$/, "")).sort();
  assert.deepEqual(masters, built, "art-src/icons 와 산출물이 다르다");
});

test("경로 규칙은 이름을 나열하지 않는다", () => {
  for (const id of RASTER_ICON_IDS) assert.equal(itemIconUrl(id), `/assets/icons/${id}.webp`);
});

test("재료·물약 전부 그림이 있다", () => {
  for (const m of MATERIALS) {
    assert.ok(RASTER_ICON_IDS.has(m.icon), `재료 ${m.id}: 그림이 없어 SVG 로 떨어진다`);
  }
  for (const p of POTIONS) {
    assert.ok(RASTER_ICON_IDS.has(p.icon), `물약 ${p.id}: 그림이 없어 SVG 로 떨어진다`);
  }
});

test("구운 아이콘은 전부 64x64 이고 알파가 있다", async () => {
  // 크기가 섞이면 24·32 로 줄일 때 어떤 것만 흐려진다. 눈으로는 "왜 얘만 뭉갰지" 로 보인다.
  const sharp = (await import("sharp")).default;
  for (const id of built) {
    const meta = await sharp(path.join(OUT, `${id}.webp`)).metadata();
    assert.equal(`${meta.width}x${meta.height}`, "64x64", `${id}: 크기가 다르다`);
    assert.ok(meta.hasAlpha, `${id}: 알파가 없다 — 흰 네모로 나간다`);
  }
});

test("네 모서리가 투명하다 — 배경이 남아 있으면 칸마다 네모가 보인다", async () => {
  const sharp = (await import("sharp")).default;
  for (const id of built) {
    const { data, info } = await sharp(path.join(OUT, `${id}.webp`))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const a = (x: number, y: number) => data[(y * info.width + x) * info.channels + 3];
    for (const [x, y] of [[0, 0], [63, 0], [0, 63], [63, 63]]) {
      assert.equal(a(x, y), 0, `${id}: 모서리 (${x},${y}) 가 불투명하다`);
    }
  }
});

test("SVG 폴백이 아직 21종 전부 있다", () => {
  // 그림으로 갈아탔다고 SVG 를 지우면, 굽지 않고 클론한 곳에서 아이콘이 통째로 빈다.
  // icons.ts 는 여기서 import 할 수 없다(*.svg 는 Vite 만 읽는다). 소스와 파일을 본다.
  const table = fs.readFileSync(path.join(ROOT, "src/shared/ui/icons.ts"), "utf8");
  const dirs = ["materials", "potions", "artifacts", "ui"];
  for (const id of RASTER_ICON_IDS) {
    const svg = dirs.map((d) => path.join(ROOT, "src/assets", d, `${id}.svg`)).find(fs.existsSync);
    assert.ok(svg, `${id}: SVG 폴백 파일이 없다`);
    assert.match(table, new RegExp(`\\b${id}\\s*:`), `${id}: 아이콘 표에 없다`);
  }
});
