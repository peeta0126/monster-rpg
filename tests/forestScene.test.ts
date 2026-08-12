import assert from "node:assert/strict";
import test from "node:test";
import { BRANCH_WEIGHTS, generatePaths, makeRng, parseRun, rollBranchCount, startRun } from "../src/camp/forest/runStore.ts";
import { depthMood, getForestSceneLayout } from "../src/camp/forest/sceneLayouts.ts";

test("2·3·4갈래가 설정 가중치로 모두 생성된다", () => {
  const counts = new Set<number>();
  for (let seed = 0; seed < 500; seed++) counts.add(rollBranchCount(makeRng(seed).rng));
  assert.deepEqual([...counts].sort(), [2, 3, 4]);
  assert.deepEqual(BRANCH_WEIGHTS, { 2: 55, 3: 30, 4: 15 });
});

test("같은 시드와 깊이는 같은 갈림길을 복원한다", () => {
  assert.deepEqual(generatePaths(37, 7, 9182), generatePaths(37, 7, 9182));
  assert.deepEqual(startRun("shallow", 0, 9182), startRun("shallow", 0, 9182));
});

test("이전 전투 브리지 저장값은 포획 단계와 조우 정보로 마이그레이션한다", () => {
  const old = startRun("shallow", 0, 9182);
  const path = old.paths.find((item) => item.eventKind === "encounter") ?? old.paths[0];
  const restored = parseRun({
    ...old,
    current: "encounter",
    phase: { type: "battle", encounterId: path.id, monsterId: "mossy" },
    encounter: { id: "mossy", level: 4 },
  });
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.run.phase.type, "capture");
  assert.equal(restored.run.encounter?.monsterId, "mossy");
  assert.equal(restored.run.encounter?.level, 4);
});

test("모든 Scene은 발밑 입구와 투명 hit area 좌표를 가진다", () => {
  for (const area of ["shallow", "deep", "ancient"] as const) {
    for (const ways of [2, 3, 4] as const) {
      const scene = getForestSceneLayout(area, ways);
      assert.equal(scene.paths.length, ways);
      assert.ok(scene.entrance.y < 80, `${area}-${ways}: 캐릭터가 하단 HUD에 너무 가깝다`);
      for (const path of scene.paths) {
        assert.ok(path.waypoints.length >= 3);
        assert.ok(path.hitArea.width >= 20 && path.hitArea.height >= 35);
      }
    }
  }
});

test("숲별 깊이 효과가 서로 다르고 깊어질수록 어두워진다", () => {
  const shallow = depthMood("shallow", 12);
  const deep = depthMood("deep", 12);
  const ancient = depthMood("ancient", 12);
  assert.notEqual(shallow.overlayColor, deep.overlayColor);
  assert.notDeepEqual(deep, ancient);
  for (const area of ["shallow", "deep", "ancient"] as const) {
    assert.ok(depthMood(area, 0).brightness > depthMood(area, 12).brightness);
    assert.ok(depthMood(area, 0).vignette < depthMood(area, 12).vignette);
  }
});
