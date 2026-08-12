import assert from "node:assert/strict";
import test from "node:test";
import { BRANCH_WEIGHTS, choosePath, generatePaths, makeRng, parseRun, rollBranchCount, startRun } from "../src/camp/forest/runStore.ts";
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

test("모든 숲에서 여러 사건이 나오고 각 경로 선택은 표시된 사건을 실행한다", () => {
  for (const area of ["shallow", "deep", "ancient"] as const) {
    const kinds = new Set<string>();
    const counts = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      const run = startRun(area, 0, seed);
      counts.add(run.paths.length);
      run.paths.forEach((path) => kinds.add(path.eventKind));
      assert.equal(new Set(run.paths.map((path) => path.eventKind)).size, run.paths.length);
      for (const path of run.paths) assert.equal(choosePath(run, path.id).current, path.eventKind);
    }
    assert.deepEqual([...counts].sort(), [2, 3, 4]);
    assert.ok(kinds.size > 3, `${area}에서 사건 종류가 고정되지 않아야 한다`);
    assert.equal(kinds.has("warden"), false, "조건 전에는 숲의 주인이 나오지 않는다");
  }
});

test("다음 깊이는 새 입력으로 사건 조합을 다시 추첨한다", () => {
  let changed = false;
  for (let seed = 0; seed < 100 && !changed; seed++) {
    const first = generatePaths(20, 0, seed).map((path) => path.eventKind);
    const next = generatePaths(20, 1, seed + 1).map((path) => path.eventKind);
    changed = JSON.stringify(first) !== JSON.stringify(next);
  }
  assert.equal(changed, true);
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
