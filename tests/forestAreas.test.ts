import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FOREST_AREAS, highestUnlockedArea, unlockLabel } from "../src/camp/forest/areas.ts";
import { PALETTE } from "../src/shared/palette.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("배경 3종이 서로 다르고 실제로 있다", () => {
  const paths = FOREST_AREAS.map((a) => a.backgroundImage);
  assert.equal(new Set(paths).size, 3, "두 구역이 같은 배경을 쓴다");

  for (const p of paths) {
    assert.match(p, /^\/assets\/forest\/.+\.webp$/, `${p} — WebP 단독 정책을 벗어났다`);
    const abs = path.join(ROOT, "public", p);
    assert.ok(fs.existsSync(abs), `${p} 가 public/ 에 없다`);
  }
});

test("티어마다 다른 축의 강조색을 쓴다", () => {
  // 초록 → 청록 → 금·주황. 빨강 다음에 더 빨강은 없으니 축을 바꾼다.
  const expected = [PALETTE.moss500, PALETTE.mist500, PALETTE.ember500];
  assert.deepEqual(FOREST_AREAS.map((a) => a.accentColor), expected);
});

test("해금 층수는 올라가고, 안내 문구도 그 값을 그대로 말한다", () => {
  const floors = FOREST_AREAS.map((a) => a.unlockFloor);
  assert.deepEqual(floors, [...floors].sort((a, b) => a - b), "표 순서와 해금 순서가 어긋난다");
  assert.equal(floors[0], 0, "첫 구역은 늘 열려 있어야 한다");

  for (const area of FOREST_AREAS) {
    assert.ok(
      unlockLabel(area).includes(`${area.unlockFloor}층`),
      `${area.name}: 안내 문구가 unlockFloor 를 안 쓴다 — 예전에 JSX 에 11/21 이 따로 박혀 있었다`,
    );
  }
});

test("기본 선택은 갈 수 있는 가장 높은 구역", () => {
  const at = (floor: number) => highestUnlockedArea(floor).id;
  assert.equal(at(0), "shallow");
  assert.equal(at(5), "shallow");
  // 깊은 숲이 6층에 열린다. 10층 관문을 장비로 넘으려면 그 재료(철 조각·마법 가루·정수)가
  // 관문 **앞에** 있어야 한다 — 예전엔 11층이라 답이 문 뒤에 있었다
  assert.equal(at(6), "deep");
  assert.equal(at(20), "deep");
  assert.equal(at(21), "ancient");
  assert.equal(at(999), "ancient");
  // 전부 잠긴 상황이 생기더라도 빈손으로 돌아오지 않는다
  assert.equal(at(-1), "shallow");
});

test("고대 숲만 속성을 가린다", () => {
  const hidden = FOREST_AREAS.filter((a) => !a.revealTypes).map((a) => a.id);
  assert.deepEqual(hidden, ["ancient"]);
});

test("레벨 구간이 티어 순서대로 이어진다", () => {
  for (let i = 1; i < FOREST_AREAS.length; i++) {
    const prev = FOREST_AREAS[i - 1].levelRange;
    const cur = FOREST_AREAS[i].levelRange;
    assert.ok(cur[0] >= prev[1], `${FOREST_AREAS[i].name}: 앞 구역보다 낮은 레벨에서 시작한다`);
    assert.ok(cur[1] > cur[0], `${FOREST_AREAS[i].name}: 레벨 구간이 뒤집혀 있다`);
  }
});
