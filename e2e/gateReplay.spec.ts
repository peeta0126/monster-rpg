import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { playFloor } from "./autoBattle";

/**
 * 관문 난이도를 **실제 게임 화면으로** 확인한다.
 *
 * `scripts/sim/gateCheck.ts` 는 헤드리스 전투 모델로 승률을 잰다. 그 모델은
 * `BattlePage` 의 턴 루프를 손으로 옮긴 사본이라, 어딘가 어긋나면 밸런스도 같이
 * 어긋난다(실제로 40층 보스 회복이 시뮬에 없던 적이 있다).
 *
 * 그래서 여기서는 **시뮬이 쓴 것과 똑같은 입력**을 실제 세이브에 심고 진짜 UI 로
 * 싸운다. 파티·레벨·장비 인스턴스·각인·입장 HP·가방까지 판마다 그대로 옮긴다.
 * 두 승률이 크게 갈리면 그 차이가 곧 "모델이 게임과 다른 만큼"이다.
 *
 * 표본은 `npx tsx scripts/sim/dumpGateSnapshots.ts <경로> [판수]` 로 미리 뽑는다.
 * 없으면 이 스펙은 통째로 스킵한다 — CI 에서 시뮬을 돌릴 이유는 없다.
 *
 * 실행: GATE_SAMPLES=...\gate-samples.json npx playwright test e2e/gateReplay.spec.ts
 */

const SAMPLE_PATH = process.env.GATE_SAMPLES ?? "";
const PLAYER_KEY = "monster-rpg-player";
const AUTH_KEY = "monster-rpg-auth";

interface Snapshot {
  party: { id: string; level: number; hpRatio: number }[];
  gear: Record<string, unknown>[][];
  imprint: Record<string, number>;
  potions: Record<string, number>;
  simFirstTry: boolean;
}

const samples: Record<string, Snapshot[]> = SAMPLE_PATH && fs.existsSync(SAMPLE_PATH)
  ? JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"))
  : {};

/** 그 판의 상태를 세이브에 그대로 심는다 */
async function seed(page: Page, floor: number, s: Snapshot) {
  await page.addInitScript(
    (opt: { snap: Snapshot; floor: number; playerKey: string; authKey: string }) => {
      localStorage.setItem(opt.authKey, JSON.stringify({
        state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
      // addInitScript 는 네비게이션마다 돈다. 한 번만 심는다
      if (localStorage.getItem(opt.playerKey)) return;

      const party = opt.snap.party.map((m, i) => ({ id: m.id, level: m.level, uid: `gr-${i}` }));
      const equippedArtifacts: Record<string, unknown[]> = {};
      party.forEach((m, i) => {
        const worn = opt.snap.gear[i] ?? [];
        if (worn.length) {
          equippedArtifacts[m.uid] = worn.map((a, k) => ({ ...a, instanceId: `${m.uid}-${k}` }));
        }
      });
      localStorage.setItem(opt.playerKey, JSON.stringify({
        state: {
          party, storage: [], dexSeen: [], dexCaught: [], materials: {},
          potions: opt.snap.potions,
          bestFloor: opt.floor - 1,
          storyFlags: { met_orion: true, met_baros: true }, questStatus: {},
          craftedItems: [], craftedArtifacts: [], craftedPotions: [],
          equippedArtifacts, imprint: opt.snap.imprint,
        },
        version: 2,
      }));
    },
    { snap: s, floor, playerKey: PLAYER_KEY, authKey: AUTH_KEY },
  );

  // 층은 라우터 state 로만 온다. /battle 을 그냥 열면 언제나 1층이다
  await page.goto("/battle");
  await page.evaluate((f) => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: f } }, "");
  }, floor);
  await page.reload();

  // 입장 HP 는 판마다 다르다. 정규화가 끝난 뒤에 깎아야 최대치로 되돌려지지 않는다
  await page.evaluate(({ key, ratios }) => {
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw.state.party.forEach((m: { currentHp: number; maxHp: number }, i: number) => {
      m.currentHp = Math.max(1, Math.round(m.maxHp * (ratios[i] ?? 1)));
    });
    localStorage.setItem(key, JSON.stringify(raw));
  }, { key: PLAYER_KEY, ratios: s.party.map((m) => m.hpRatio) });
  await page.reload();
}

for (const floor of [15, 20, 40, 50]) {
  const ss = samples[String(floor)] ?? [];

  test(`gate: ${floor}층을 실제 화면에서 ${ss.length}판 싸운다`, async ({ browser }) => {
    test.skip(ss.length === 0, "표본이 없다 — dumpGateSnapshots.ts 를 먼저 돌린다");
    test.setTimeout(30 * 60_000);

    let wins = 0;
    for (const [i, s] of ss.entries()) {
      // 판마다 새 컨텍스트를 쓴다. 한 페이지를 돌려쓰면 addInitScript 가 쌓여서
      // 먼저 심은 세이브가 계속 이기고(가드가 있으니), 열두 판이 전부 같은 판이 된다
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      let won = false;
      try {
        await seed(page, floor, s);
        await playFloor(page, floor);
        won = true;
      } catch {
        // 진 것도 결과다. 여기서 스펙을 죽이면 승률을 못 센다
        won = false;
      }
      await ctx.close();
      if (won) wins++;
      console.log(`  ${floor}층 ${String(i + 1).padStart(2)}판 → ${won ? "승" : "패"} (시뮬: ${s.simFirstTry ? "승" : "패"})`);
    }

    const rate = Math.round((wins / ss.length) * 100);
    const simRate = Math.round(ss.filter((s) => s.simFirstTry).length / ss.length * 100);
    console.log(`■ ${floor}층 실제 UI ${rate}% (${wins}/${ss.length}) · 같은 입력의 시뮬 ${simRate}%`);

    // 벽도 공짜도 아니어야 한다. 표본이 열두 판이라 폭을 넓게 잡는다
    expect(rate, `${floor}층이 실제 화면에서 벽이다`).toBeGreaterThan(0);
    expect(rate, `${floor}층이 실제 화면에서 공짜다`).toBeLessThan(100);
  });
}
