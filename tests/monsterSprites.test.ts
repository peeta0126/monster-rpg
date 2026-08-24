import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import sharp from "sharp";
import { MONSTER_IMAGE_MAP } from "../src/monster/monsterImages.ts";

const PUBLIC = path.resolve(import.meta.dirname, "..", "public");

/**
 * 몬스터 일러스트는 어두운 전투 배경 위에 그대로 올라간다. 알파가 없으면 원본의 흰
 * 배경이 그대로 남아 흰 네모가 뜬다. dragon.webp(최종 보스 ormr)가 실제로 그랬다.
 * 눈으로만 잡히는 사고라 한 번은 기계가 보게 한다.
 */
test("몬스터 일러스트는 전부 배경이 뚫려 있다", async () => {
  const broken: string[] = [];

  for (const [id, url] of Object.entries(MONSTER_IMAGE_MAP)) {
    const img = sharp(path.join(PUBLIC, url));
    const meta = await img.metadata();
    if (!meta.hasAlpha) {
      broken.push(`${id} (${url}): 알파 채널 없음`);
      continue;
    }
    // 알파는 있는데 전부 255 인 경우도 같은 증상이다. 채널만 붙여 놓고 안 판 것.
    const alpha = (await img.stats()).channels.at(-1)!;
    if (alpha.min === 255) broken.push(`${id} (${url}): 알파가 전부 불투명`);
  }

  assert.deepEqual(broken, [], `배경이 안 뚫린 일러스트:\n${broken.join("\n")}`);
});
