import { test, expect, type Page } from "@playwright/test";
import { playFloor, winOverlay, loseOverlay } from "./autoBattle";
import { ARTIFACT_RECIPES } from "../src/workshop/craftingRecipes";
import { applyArtifactQualityStats, rollBonusStats } from "../src/shared/craftingUtils";
import { IMPRINT_TIERS } from "../src/monster/imprint";

/**
 * 이 게임의 난이도 설계를 실제 UI 로 증명하는 두 판.
 *
 *   1) 장비 없이 오르면 관문에서 막힌다   ← 막히는 게 성공이다
 *   2) 관문마다 장비를 갖추면 넘어간다     ← 넘는 게 성공이다
 *
 * 둘이 한 쌍이어야 의미가 있다. 하나만 있으면 "어렵다" 나 "쉽다" 밖에 못 말하는데,
 * 우리가 확인하려는 건 무엇이 벽을 넘게 해 주는가 이기 때문이다.
 *
 * ⚠️ 이 자동 플레이어는 사람보다 잘한다. 매 턴 예상 데미지가 가장 큰 기술을 고르고 HP 40%
 *    아래에서 반드시 물약을 마신다. 그런데도 (1)이 막힌다는 게 이 설계의 요지다.
 *
 * 실행: npx playwright test e2e/balanceRun.spec.ts
 */

const PARTY_LEVEL = 5;
const PARTY_SPECIES = ["mossy", "aquabe", "leafy"];
/** 한 층에서 이만큼 지면 벽으로 본다 */
const MAX_RETRIES = 5;

/** 그 층까지 왔다면 정비했을 법한 장비. gateCheck.ts 의 "정규 장비" 와 같은 계단이다 */
function gearFor(floor: number): { quality: "normal" | "rare" | "elite"; level: number; enhancement: number } {
  if (floor <= 9)  return { quality: "normal", level: 5,  enhancement: 1 };
  if (floor <= 14) return { quality: "normal", level: 10, enhancement: 2 };
  if (floor <= 19) return { quality: "rare",   level: 12, enhancement: 2 };
  if (floor <= 24) return { quality: "rare",   level: 15, enhancement: 3 };
  if (floor <= 29) return { quality: "rare",   level: 20, enhancement: 3 };
  if (floor <= 34) return { quality: "rare",   level: 25, enhancement: 4 };
  if (floor <= 39) return { quality: "rare",   level: 30, enhancement: 5 };
  if (floor <= 44) return { quality: "elite",  level: 20, enhancement: 3 };
  return { quality: "elite", level: 30, enhancement: 4 };
}

/** 각인도 같이 오른다. 숲에서 중복을 먹이는 플레이어를 가정한다 */
function imprintFedFor(floor: number): number {
  const tier = floor <= 14 ? 1 : floor <= 24 ? 2 : floor <= 34 ? 3 : floor <= 44 ? 4 : 5;
  return IMPRINT_TIERS.find((t) => t.tier === tier)?.fed ?? 0;
}

interface SeedOptions {
  geared: boolean;
  floor: number;
}

async function seedSave(page: Page, o: SeedOptions) {
  const gear = gearFor(o.floor);
  const artifacts = o.geared
    ? ARTIFACT_RECIPES.map((r, i) => ({
        instanceId: `g${i}`, itemId: r.resultItemId, name: r.resultItemName,
        quality: gear.quality, description: r.description,
        statBonuses: applyArtifactQualityStats(r.baseStats ?? [], gear.quality),
        createdAt: 0, level: gear.level, enhancement: gear.enhancement,
        source: "crafting" as const,
        bonusStats: rollBonusStats(r.resultItemId, 1, gear.level, []),
      }))
    : [];
  const fed = o.geared ? imprintFedFor(o.floor) : 0;

  await page.addInitScript(
    (opt: { level: number; species: string[]; artifacts: unknown[]; fed: number }) => {
      localStorage.setItem("monster-rpg-auth", JSON.stringify({
        state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 }));
      // ⚠️ addInitScript 는 모든 페이지 로드마다 돈다. 무조건 덮어쓰면 층을 넘길 때마다
      //    세이브가 처음 상태로 돌아가서, 레벨도 장비도 영영 안 오른다(실제로 그 함정을 밟았다).
      if (localStorage.getItem("monster-rpg-player")) return;
      const party = opt.species.map((id, i) => ({ id, level: opt.level, uid: `bal-${i}` }));
      const equippedArtifacts: Record<string, unknown[]> = {};
      if (opt.artifacts.length) {
        for (const m of party) {
          equippedArtifacts[m.uid] = opt.artifacts.map((a, i) => ({
            ...(a as Record<string, unknown>), instanceId: `${m.uid}-${i}`,
          }));
        }
      }
      // 각인은 계열키 → 먹인 수. 시작 파티의 계열에 골고루 넣는다
      const imprint: Record<string, number> = opt.fed > 0
        ? { mossy: opt.fed, aqua: opt.fed, leafy: opt.fed, crystafox: opt.fed, frostorb: opt.fed }
        : {};
      localStorage.setItem("monster-rpg-player", JSON.stringify({
        state: {
          party, storage: [], dexSeen: [], dexCaught: [], materials: {},
          // 정식 플레이라면 물약을 무한정 들고 다니지 않는다. 층당 한두 개 쓸 만큼만.
          potions: { super_potion: 12, potion: 12, max_potion: 6, antidote: 6, strong_attack_buff: 4 },
          bestFloor: 0, storyFlags: {}, questStatus: {},
          craftedItems: [], craftedArtifacts: [], craftedPotions: [],
          equippedArtifacts, imprint,
        },
        version: 1,
      }));
    },
    { level: PARTY_LEVEL, species: PARTY_SPECIES, artifacts, fed },
  );
}

/**
 * 캠프에 내려가 회복하고, 그 층부터 다시 오른다. 장비와 물약도 그 층 기준으로 채운다.
 *
 * 물약을 다시 채우는 게 중요하다. 관문 하나가 물약 5개를 먹는데(15층 실측 4.8개),
 * 안 채우면 "관문이 어려워서" 가 아니라 "가방이 비어서" 막힌다. 실제 플레이에서는
 * 캠프에 내려간 김에 연금술로 만들어 온다(시뮬 기준 한 판에 70개 남짓 만든다).
 */
async function restAndReturn(page: Page, floor: number, geared: boolean) {
  await page.evaluate(({ f, g, gear, fed }) => {
    const raw = JSON.parse(localStorage.getItem("monster-rpg-player") ?? "{}");
    const st = raw?.state;
    if (!st) return;
    for (const m of st.party ?? []) {
      m.currentHp = 9999;                       // 정규화가 최대치로 깎아 준다
      // 숲에서 그 구간 레벨의 몬스터를 잡아 오는 플레이어를 가정한다. 탑만 오르면 레벨이
      // 층을 못 따라가는데(실측: 14층에서 Lv9), 그건 숲을 안 쓴 플레이어의 곡선이다.
      // 이 스펙이 재려는 건 레벨이 아니라 장비라, 레벨은 양쪽 다 층에 맞춰 둔다.
      if (m.level < f) m.level = f;
    }
    st.potions = { super_potion: 8, potion: 8, max_potion: 4, antidote: 4, strong_attack_buff: 3 };
    if (g) {
      for (const m of st.party ?? []) {
        st.equippedArtifacts[m.uid] = (st.equippedArtifacts[m.uid] ?? []).map(
          (a: Record<string, unknown>) => ({ ...a, quality: gear.quality, level: gear.level, enhancement: gear.enhancement }),
        );
      }
      st.imprint = { mossy: fed, aqua: fed, leafy: fed, crystafox: fed, frostorb: fed };
    }
    localStorage.setItem("monster-rpg-player", JSON.stringify(raw));
  }, { f: floor, g: geared, gear: gearFor(floor), fed: imprintFedFor(floor) });

  await page.goto("/battle");
  await page.evaluate((f) => {
    history.replaceState({ ...(history.state ?? {}), usr: { floor: f } }, "");
  }, floor);
  await page.reload();
}

/** 한 판 걷는다. 막히면 그 층을 돌려주고, 끝까지 가면 null */
async function climb(page: Page, geared: boolean, maxFloor: number): Promise<number | null> {
  const retries: Record<number, number> = {};

  for (let floor = 1; floor <= maxFloor; floor++) {
    let tries = 0;
    for (;;) {
      try {
        await playFloor(page, floor);
        break;
      } catch (err) {
        if (!(await loseOverlay(page).first().isVisible().catch(() => false))) throw err;
        tries++;
        retries[floor] = tries;
        if (tries > MAX_RETRIES) {
          console.log(`✖ ${floor}층에서 막혔다 (재도전 ${MAX_RETRIES}회)`);
          return floor;
        }
        await restAndReturn(page, floor, geared);
      }
    }

    await expect(winOverlay(page)).toBeVisible();
    // 레벨을 같이 찍는다. 막혔을 때 "레벨이 안 붙어서"인지 "장비가 모자라서"인지 갈린다
    const levels = await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem("monster-rpg-player") ?? "{}");
      return (raw?.state?.party ?? []).map((m: { level: number }) => m.level).join("/");
    });
    console.log(`✔ ${floor}층 (Lv ${levels})${retries[floor] ? ` · 재도전 ${retries[floor]}회` : ""}`);

    if (floor < maxFloor) {
      await page.locator("button").filter({ hasText: `다음층 (${floor + 1}F)` }).click();
      // 관문 직전(5층마다)에는 캠프에 들른다. 회복·물약·(장비를 쓰는 판이면) 정비까지.
      // 두 판이 여기서만 갈린다: 한쪽은 장비를 갖추고, 한쪽은 맨몸으로 다시 올라간다.
      if ((floor + 1) % 5 === 0) await restAndReturn(page, floor + 1, geared);
    }
  }
  return null;
}

test("장비 없이 오르면 관문에서 막힌다", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  await seedSave(page, { geared: false, floor: 1 });
  await page.goto("/battle");

  const wall = await climb(page, false, 50);
  expect(wall, "장비 없이 50층까지 갔다 — 관문이 관문 노릇을 못 하고 있다").not.toBeNull();
  // 첫 관문(10층)이나 그 언저리에서 막혀야 한다. 30층까지 맨몸으로 가면 너무 무르다
  expect(wall!).toBeLessThanOrEqual(20);
  console.log(`맨몸 등반은 ${wall}층에서 멈췄다`);
});

test("관문마다 장비를 갖추면 넘어간다", async ({ page }) => {
  test.setTimeout(30 * 60_000);
  await seedSave(page, { geared: true, floor: 1 });
  await page.goto("/battle");

  const wall = await climb(page, true, 50);
  expect(wall, `장비를 갖췄는데 ${wall}층에서 막혔다 — 벽이 아니라 절벽이다`).toBeNull();
});
