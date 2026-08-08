import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * 공방 배경이 정본인지 지킨다.
 *
 * 한 번 엉뚱한 그림으로 바뀐 적이 있다. 최적화 스크립트를 손보면서 "마스터를 복구했다"고
 * Downloads 의 비슷한 그림을 art-src 에 넣고 거기서 WebP 를 다시 구웠는데, 같은 장면을
 * 다르게 그린 별개 이미지였다. 300x224 로 줄여 평균 색차를 재는 방식으로 확인했더니
 * 4.49(다른 후보 34~44)가 나와 "같은 그림 + 손실압축"으로 오판했다 — 축소하면 차이가
 * 뭉개진다.
 *
 * 비주얼 회귀(design/visual.spec.ts)는 이걸 못 잡았다. 카메라가 1.5배라 화면에 방 일부만
 * 나오고, 두 그림이 그 범위에서는 비슷해서 maxDiffPixelRatio 0.02 를 넘지 않았다.
 * 그래서 여기서 원본 해상도의 특정 지점을 직접 찍는다.
 *
 * 해시가 바뀔 일이 생기면(배경을 정말로 교체하면) 이 값을 의도적으로 갱신하면 된다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = path.join(ROOT, "public", "assets", "housing", "housing_bg.png");
const WEBP = path.join(ROOT, "public", "assets", "housing", "housing_bg.webp");

/** 정본 마스터의 SHA256. 2400x1792. */
const MASTER_SHA256 = "ff6d891d8b3566ebba72764b8797c575689b20a86c21f4bc25ce0f3a38401cbf";

/**
 * 원본 해상도 기준 표본점. 그림이 통째로 바뀌면 여기가 먼저 어긋난다.
 * WebP 는 손실 압축이라 정확히 같지는 않다 — 채널당 12 까지 허용한다
 * (엉뚱한 그림일 때 실제로 나온 오차는 60~99 였다).
 */
const PROBES = [
  { x: 1200, y: 1450, rgb: [112, 93, 79], label: "회갈색 돌바닥" },
  { x: 2167, y: 1550, rgb: [75, 52, 46], label: "어두운 흙" },
];
const TOLERANCE = 12;

test("공방 배경 마스터가 정본이다 (SHA256)", () => {
  assert.ok(fs.existsSync(MASTER), `${path.relative(ROOT, MASTER)} 이 없다`);
  const got = crypto.createHash("sha256").update(fs.readFileSync(MASTER)).digest("hex");
  assert.equal(
    got, MASTER_SHA256,
    "공방 배경 마스터가 정본이 아니다. 일부러 교체했다면 이 테스트의 MASTER_SHA256 을 갱신할 것.",
  );
});

test("공방 배경 마스터가 2400x1792 이다", async () => {
  const m = await sharp(fs.readFileSync(MASTER)).metadata();
  assert.equal(`${m.width}x${m.height}`, "2400x1792");
});

test("배포되는 WebP 가 그 마스터에서 나온 것이다 (표본점 색)", async () => {
  const m = await sharp(fs.readFileSync(WEBP)).metadata();
  assert.equal(`${m.width}x${m.height}`, "2400x1792", "WebP 해상도가 마스터와 다르다");

  const { data, info } = await sharp(fs.readFileSync(WEBP))
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  for (const p of PROBES) {
    const i = (p.y * info.width + p.x) * info.channels;
    const got = [data[i], data[i + 1], data[i + 2]];
    const diff = Math.max(...got.map((v, k) => Math.abs(v - p.rgb[k])));
    assert.ok(
      diff <= TOLERANCE,
      `(${p.x}, ${p.y}) ${p.label}: (${got.join(", ")}) — 기대 (${p.rgb.join(", ")}), 오차 ${diff} > ${TOLERANCE}. ` +
      "배경이 다른 그림으로 바뀌었다.",
    );
  }
});
