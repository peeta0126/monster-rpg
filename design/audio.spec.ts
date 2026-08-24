import { test, expect, type Page } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";
import { playFloor } from "../e2e/autoBattle";

/**
 * BGM 확인. 실제로 화면을 돌아다니며 브라우저가 만든 오디오 요소를 들여다본다.
 *
 *   npx playwright test --config design/playwright.config.ts -g "audio:"
 *
 * 왜 이렇게 보나: `new Audio()` 로 만든 요소는 DOM 에 없어서 셀렉터로 못 잡는다.
 * 그래서 페이지가 뜨기 전에 `window.Audio` 를 한 겹 감싸 만들어지는 족족 모아 둔다.
 * 소스에 시험용 구멍을 내지 않고도 "무엇이, 언제, 얼마의 음량으로 흐르는지"를 그대로
 * 읽을 수 있다.
 *
 * 귀로 듣는 것까지는 못 한다. 대신 사람이 귀로 잡아내는 사고(되감김·정적·이중
 * 전환·음량이 안 먹음)는 전부 여기서 수치로 잡힌다.
 */

const AUTH_KEY = "monster-rpg-auth";
const PLAYER_KEY = "monster-rpg-player";
const AUDIO_KEY = "monster-rpg-audio";
const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

/**
 * 1층을 확실히 이기는 세이브. 시작 파티(Lv.1 플레미 한 마리)로는 1층에서도 질 수 있어서
 * 검사가 전투 결과가 아니라 운에 걸린다. 여기서 보려는 건 곡이지 난이도가 아니다.
 */
const STRONG_SAVE = JSON.stringify({
  state: {
    party: [
      { id: "mossevo", level: 30, uid: "a0" },
      { id: "frostorb", level: 28, uid: "a1" },
    ],
    storage: [], dexSeen: ["mossevo"], dexCaught: ["mossevo"],
    materials: {}, potions: { potion: 5 }, bestFloor: 0,
    storyFlags: { met_orion: true }, questStatus: {}, seenDialogues: ["orion_intro"],
    craftedItems: [], craftedArtifacts: [], craftedPotions: [], equippedArtifacts: {},
    imprint: {},
  },
  version: 2,
});

interface Snap {
  file: string;
  paused: boolean;
  volume: number;
  time: number;
  loop: boolean;
  /** HAVE_CURRENT_DATA(2) 이상이면 지금 이 순간 낼 소리가 버퍼에 있다는 뜻 */
  ready: number;
}

declare global {
  interface Window { __AUDIO__?: HTMLAudioElement[] }
}

/**
 * 페이지 첫 스크립트보다 먼저 Audio 를 감싸고 게스트 세션·세이브를 심는다.
 *
 * ⚠️ 소리 설정(monster-rpg-audio)은 지우지 않는다. 이 스크립트는 새로고침마다
 * 다시 도는데, 여기서 지우면 "설정이 새로고침 뒤에도 남는가"를 검사가 스스로 깨뜨린다.
 * 테스트마다 브라우저 컨텍스트가 새로 뜨므로 처음에는 어차피 비어 있다.
 */
async function seed(page: Page, { authed = true, save = FRESH_SAVE } = {}) {
  await page.addInitScript(() => {
    const created: HTMLAudioElement[] = [];
    window.__AUDIO__ = created;
    const Orig = window.Audio;
    function Wrapped(this: unknown, src?: string) {
      const el = new Orig(src);
      created.push(el);
      return el;
    }
    Wrapped.prototype = Orig.prototype;
    window.Audio = Wrapped as unknown as typeof Audio;
  });
  await page.addInitScript(
    ({ a, p, g, fresh, authed }) => {
      window.localStorage.removeItem(a);
      window.localStorage.removeItem(p);
      if (authed) {
        window.localStorage.setItem(a, g);
        window.localStorage.setItem(p, fresh);
      }
    },
    { a: AUTH_KEY, p: PLAYER_KEY, g: GUEST, fresh: save, authed },
  );
}

const snap = (page: Page): Promise<Snap[]> => page.evaluate(() =>
  (window.__AUDIO__ ?? []).map((a) => ({
    file: a.src.split("/").pop() ?? "",
    paused: a.paused,
    volume: Math.round(a.volume * 1000) / 1000,
    time: a.currentTime,
    loop: a.loop,
    ready: a.readyState,
  })));

/** 지금 실제로 소리를 내고 있는 것들 */
const audible = (s: Snap[]) => s.filter((x) => !x.paused && x.volume > 0);

/** 브라우저가 어느 포맷을 골랐든 이름만 본다 (ogg / m4a) */
const nameOf = (file: string) => file.replace(/\.(ogg|m4a)$/, "");

const trackOf = async (page: Page, name: string) =>
  (await snap(page)).find((x) => nameOf(x.file) === name);

/**
 * 자동재생 잠금을 푸는 첫 상호작용. 사람이 하는 것과 같은 순서다.
 *
 * 키 입력 대신 클릭인 이유: 브라우저가 "사용자 활성화"로 쳐 주는 키가 한정돼 있어
 * 게임이 안 듣는 키를 골라 눌러 봐야 잠금이 안 풀린다. 화면 맨 구석이라 누를 것이 없다.
 * 새로고침하면 활성화가 풀리므로 reload 뒤에는 매번 다시 눌러야 한다.
 */
async function firstTouch(page: Page) {
  await page.mouse.click(2, 2);
}

/**
 * 게임 안에서 화면을 옮긴다.
 *
 * ⚠️ `page.goto` 를 쓰면 안 된다. 그건 새로고침이라 자바스크립트 문맥째로 다시 뜨고,
 * 흐르던 오디오 요소도 같이 날아간다. 사람은 그렇게 게임하지 않는다. 여기서는 주소만
 * 갈아 끼우고 popstate 를 흘려 라우터가 화면을 갈게 한다. 게임 안의 이동 버튼이
 * 부르는 것과 같은 경로다.
 *
 * 걸어가야 닿는 곳(공방·숲)은 이 방법을 쓴다. 메뉴 한 번으로 가는 곳(가방·내 몬스터)은
 * 아래에서 진짜 메뉴를 눌러 확인한다.
 */
async function spaGoto(page: Page, to: string, state?: unknown) {
  await page.evaluate(({ p, st }) => {
    window.history.pushState(st === undefined ? {} : { usr: st }, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, { p: to, st: state });
  await expect(page.locator("#root")).not.toBeEmpty();
}

/** 우상단 메뉴에서 항목을 고른다 (게임 안의 진짜 이동 경로) */
async function menuGo(page: Page, item: string) {
  const menu = page.getByRole("button", { name: /메뉴/ });
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await menu.click();
  await page.getByRole("menuitem", { name: item }).click();
}

/** 화면 왼쪽 위의 "← 베이스캠프" */
async function backToCamp(page: Page) {
  await page.getByRole("button", { name: /베이스캠프/ }).first().click();
}

async function waitForTrack(page: Page, name: string) {
  await expect.poll(async () => audible(await snap(page)).map((x) => nameOf(x.file)),
    { timeout: 15_000, message: `${name} 이(가) 안 나온다` }).toContain(name);
}

// ── 소리 설정은 진짜 UI 로 만진다. 여기서 볼 것이 "슬라이더가 즉시 먹는가"다 ───
async function openSoundSettings(page: Page) {
  const menu = page.getByRole("button", { name: /메뉴/ });
  await expect(menu).toBeVisible({ timeout: 20_000 });
  await menu.click();
  await page.getByRole("menuitem", { name: "소리" }).click();
  await expect(page.getByText("SOUND")).toBeVisible();
}

/** BGM 슬라이더(첫 번째)를 옮긴다. 0~1 → 0~100 */
async function dragBgm(page: Page, v: number) {
  await page.getByRole("slider").first().fill(String(Math.round(v * 100)));
}

async function toggleMute(page: Page) {
  await page.getByRole("button", { name: /음소거/ }).click();
}

test.describe("audio:", () => {
  test("로그인 화면에서 타이틀 곡이 흐른다", async ({ page }) => {
    await seed(page, { authed: false });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /게스트로 시작/ })).toBeVisible();
    await firstTouch(page);
    await waitForTrack(page, "title");

    const t = await trackOf(page, "title");
    expect(t!.loop, "타이틀 곡이 반복으로 안 걸렸다").toBe(true);
  });

  test("마을 ↔ 가방 ↔ 내 몬스터 — 같은 곡이 되감기지 않는다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    // 곡이 충분히 흐른 뒤에 화면을 옮긴다. 되감기면 이 값보다 작아진다.
    await page.waitForTimeout(1500);
    const before = (await trackOf(page, "basecamp"))!.time;
    expect(before).toBeGreaterThan(0.5);

    // 메뉴 → 가방 → 돌아오기 → 메뉴 → 내 몬스터 → 돌아오기. 사람이 누르는 그대로다.
    for (const item of ["가방", "내 몬스터"]) {
      await menuGo(page, item);
      await page.waitForTimeout(400);
      await backToCamp(page);
      await page.waitForTimeout(400);
    }

    const camps = (await snap(page)).filter((x) => nameOf(x.file) === "basecamp");
    expect(camps.length, "마을 곡을 화면마다 새로 만들었다 — 되감김의 원인이다").toBe(1);
    expect(camps[0].paused, "마을 곡이 중간에 멈췄다").toBe(false);
    expect(camps[0].time, `되감겼다 (${before}s → ${camps[0].time}s)`).toBeGreaterThan(before);
  });

  test("마을 → 공방 → 마을 — 곡이 겹쳐 넘어간다 (정적 없음)", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");
    await page.waitForTimeout(800);

    await spaGoto(page, "/workshop");

    // 넘어가는 동안을 촘촘히 들여다본다. 한 순간이라도 둘 다 조용하면 정적이다.
    let sawOverlap = false;
    const silentAt: number[] = [];
    for (let i = 0; i < 40; i++) {
      const now = audible(await snap(page));
      if (now.length === 0) silentAt.push(i);
      if (now.length >= 2) sawOverlap = true;
      if (sawOverlap && now.length === 1 && nameOf(now[0].file) === "workshop") break;
      await page.waitForTimeout(50);
    }
    expect(silentAt, "곡이 바뀌는 사이에 아무 소리도 안 나는 순간이 있었다").toEqual([]);
    expect(sawOverlap, "앞 곡이 끊기고 뒷 곡이 시작했다 — 겹쳐 넘기지 않았다").toBe(true);
    await waitForTrack(page, "workshop");

    await spaGoto(page, "/");
    await waitForTrack(page, "basecamp");
  });

  test("마을 → 숲 → 전투 → 마을 — 중간에 조용해지지 않는다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    for (const [path, expected] of [
      ["/forest", "forest"], ["/battle", "battle"], ["/", "basecamp"],
    ] as const) {
      await spaGoto(page, path);
      // 화면이 뜨고 곡이 넘어가는 내내 무언가는 나고 있어야 한다
      for (let i = 0; i < 14; i++) {
        expect(audible(await snap(page)).length,
          `${path} 로 들어가는 동안 소리가 끊겼다`).toBeGreaterThan(0);
        await page.waitForTimeout(60);
      }
      await waitForTrack(page, expected);
    }
  });

  test("보스 층에서는 보스 곡, 그 사이 층은 보통 전투곡", async ({ page }) => {
    await seed(page);
    await page.goto("/battle");
    await expect(page.locator("#root")).not.toBeEmpty();
    await firstTouch(page);
    await waitForTrack(page, "battle");

    // 층은 라우트 state 로만 정해진다. 다음 층으로 올라가는 것과 같은 이동이다.
    for (const [floor, expected] of [[10, "boss"], [11, "battle"]] as const) {
      await spaGoto(page, "/battle", { floor });
      await expect(page.getByTestId("battle-panel")).toHaveAttribute("data-floor", String(floor));
      await waitForTrack(page, expected);
    }
  });

  /**
   * 진짜로 플레이해서 듣는다.
   *
   * 위 검사들은 주소를 갈아 끼워 화면을 옮긴다. 라우터가 보기엔 같은 길이지만,
   * 사람이 실제로 지나는 길은 메뉴를 누르고 탑에 들어가고 숲으로 걸어 들어가는 쪽이다.
   * 그 길에는 화면 전환 커버(SceneTransition)와 Phaser 씬 파괴가 끼어 있어서, 곡이
   * 끊긴다면 여기서 끊긴다. 지나는 내내 소리가 한 번이라도 비면 실패한다.
   */
  test("실제 플레이 — 마을에서 탑으로, 전투에서 마을로, 마을에서 숲으로", async ({ page }) => {
    test.slow();
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    /** 무언가 나고 있는지 지켜보면서 기다린다 */
    async function watch(ms: number, where: string) {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        expect(audible(await snap(page)).length, `${where} — 소리가 끊겼다`).toBeGreaterThan(0);
        await page.waitForTimeout(80);
      }
    }

    // ── 숲 입구까지 가서 걸어 들어간다 ──
    // 순서가 중요하다: Phaser 를 만지는 단계를 첫 마을 화면에서 한다. 전투에 다녀오면
    // 마을 화면이 통째로 다시 서면서 씬도 새로 만들어져, 창에 남아 있는 참조가 이미
    // 버려진 씬을 가리킨다. 거기에 대고 순간이동시키면 아무 일도 안 일어난다.
    await page.waitForFunction(() => {
      const g = (window as unknown as { __phaserGame?: { scene?: { getScene?: (k: string) => unknown } } }).__phaserGame;
      const sc = g?.scene?.getScene?.("BaseCampScene") as { player?: unknown } | null;
      return Boolean(sc?.player);
    }, undefined, { timeout: 20_000 });
    await page.evaluate(([px, py]) => {
      const g = (window as unknown as {
        __phaserGame: { scene: { getScene: (k: string) => { player: { setPosition: (a: number, b: number) => void } } } };
      }).__phaserGame;
      g.scene.getScene("BaseCampScene").player.setPosition(px, py);
    }, [1150, 1980]);   // campCollision 의 숲 복귀 좌표 — 판정 반경 안이다
    // 한 걸음 밀어 씬이 근접을 다시 재게 한다. 순간이동만으로는 안내가 안 뜬다
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.up("ArrowRight");
    await expect.poll(() => page.evaluate(() => {
      const g = (window as unknown as {
        __phaserGame: { scene: { getScene: (k: string) => { children: { getByName: (n: string) => { text: string } | null } } } };
      }).__phaserGame;
      return g.scene.getScene("BaseCampScene").children.getByName("interactHint")?.text ?? "";
    }), { timeout: 10_000, message: "숲 입구 안내가 안 떴다" }).toContain("숲");
    await page.keyboard.press("E");   // 베이스캠프의 상호작용 키는 E 다 (공방은 Space)
    await watch(900, "숲으로 걸어 들어가는 중");
    await waitForTrack(page, "forest");

    // ── 숲에서 마을로 (화면의 되돌아가기 버튼) ──
    await backToCamp(page);
    await watch(900, "숲에서 나오는 중");
    await waitForTrack(page, "basecamp");

    // ── 메뉴 → 무한의 탑 → 1층부터 시작 ──
    await menuGo(page, "무한의 탑");
    await page.getByRole("button", { name: "1층부터 시작" }).click();
    await watch(900, "탑에 들어가는 중");
    await waitForTrack(page, "battle");

    // ── 전투에서 마을로 ──
    await page.getByRole("button", { name: "나가기" }).click();
    await watch(900, "전투에서 나오는 중");
    await waitForTrack(page, "basecamp");
  });

  /**
   * 전투를 실제로 이겨서 결과 화면을 거쳐 마을로 돌아온다.
   *
   * 여기가 제일 의심스러운 자리다. 결과 화면은 전투 화면 위에 덮이는 것이라 곡이
   * 바뀔 이유가 없는데, 화면이 하나 더 있는 것처럼 다뤄지면 전투곡 → 무언가 → 마을곡
   * 으로 두 번 바뀌거나 그 사이가 비게 된다. 전투 내내 전투곡 하나만 흘렀는지,
   * 마을로 나올 때 딱 한 번 넘어갔는지를 센다.
   */
  test("실제 전투 — 이기고 결과 화면을 거쳐 마을로 (곡은 딱 한 번 바뀐다)", async ({ page }) => {
    test.slow();
    await seed(page, { save: STRONG_SAVE });
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    await menuGo(page, "무한의 탑");
    await page.getByRole("button", { name: "1층부터 시작" }).click();
    await waitForTrack(page, "battle");

    await playFloor(page, 1);
    await expect(page.getByText("WIN!", { exact: true })).toBeVisible();

    // 전투 내내 만들어진 곡은 마을 것과 전투 것 둘뿐이어야 한다
    const madeInBattle = new Set((await snap(page)).map((x) => nameOf(x.file)));
    expect([...madeInBattle].sort(), "전투 중에 엉뚱한 곡이 끼어들었다")
      .toEqual(["basecamp", "battle"]);
    expect(audible(await snap(page)).map((x) => nameOf(x.file)),
      "결과 화면에서 전투곡이 아니다").toEqual(["battle"]);

    // 결과 화면 → 마을. 나오는 내내 소리가 있어야 하고, 곡은 한 번만 바뀐다
    await page.getByRole("button", { name: /베이스캠프/ }).first().click();
    for (let i = 0; i < 15; i++) {
      expect(audible(await snap(page)).length, "마을로 나오는 동안 소리가 끊겼다")
        .toBeGreaterThan(0);
      await page.waitForTimeout(80);
    }
    await waitForTrack(page, "basecamp");
    const made = (await snap(page)).map((x) => nameOf(x.file));
    expect(made.filter((n) => n === "basecamp").length,
      "마을 곡을 두 번 이상 새로 걸었다 — 결과 화면에서 한 번 더 바뀌었다는 뜻이다").toBe(2);
  });

  test("여섯 곡이 전부 받아지고 길이가 제대로 읽힌다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    // 화면을 돌아 여섯 곡을 다 건드린다. 하나라도 404 면 여기서 길이가 안 잡힌다
    for (const [path, name] of [
      ["/workshop", "workshop"], ["/forest", "forest"], ["/battle", "battle"],
    ] as const) {
      await spaGoto(page, path);
      await waitForTrack(page, name);
    }
    await spaGoto(page, "/battle", { floor: 10 });
    await waitForTrack(page, "boss");
    await spaGoto(page, "/ending");
    await waitForTrack(page, "title");

    const lens = await page.evaluate(() => {
      const out: Record<string, number> = {};
      for (const a of window.__AUDIO__ ?? []) {
        const n = (a.src.split("/").pop() ?? "").replace(/\.(ogg|m4a)$/, "");
        if (Number.isFinite(a.duration)) out[n] = Math.round(a.duration * 1000) / 1000;
      }
      return out;
    });
    console.log("[audio] 곡 길이(초):", JSON.stringify(lens));
    for (const name of ["title", "basecamp", "forest", "workshop", "battle", "boss"]) {
      expect(lens[name], `${name} 을(를) 못 받았거나 길이를 못 읽었다`).toBeGreaterThan(5);
    }
  });

  test("한 바퀴 도는 이음매에서 소리가 끊기지 않는다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");
    await page.waitForTimeout(900);   // 페이드인이 끝난 뒤에 재야 음량 변화와 안 섞인다

    // 처음부터 한 곡을 다 트는 건 검사로 할 짓이 아니라(2분) 끝 1.2초로 보내고 이음매만 본다.
    const dur = await page.evaluate(() => {
      const el = (window.__AUDIO__ ?? []).find((a) => a.src.includes("basecamp"))!;
      el.currentTime = Math.max(0, el.duration - 1.2);
      return el.duration;
    });
    expect(dur, "길이를 못 읽었다 — 파일이 안 받아졌다").toBeGreaterThan(5);

    // 이음매를 사이에 두고 2.4초를 촘촘히 잰다. 흐른 소리의 양이 흐른 시간과 같아야
    // 한다. 되감는 순간 버퍼가 비어 잠깐 멈추면 그만큼 모자라고, 그게 사람 귀에는
    // 정적으로 들린다.
    const t0 = Date.now();
    let played = 0;
    let last = (await trackOf(page, "basecamp"))!.time;
    let wraps = 0;
    while (Date.now() - t0 < 2400) {
      await page.waitForTimeout(60);
      const b = (await trackOf(page, "basecamp"))!;
      expect(b.paused, "이음매에서 곡이 멈췄다 — 정적이 생긴다").toBe(false);
      expect(b.ready, "이음매에서 버퍼가 비었다 — 소리가 끊긴다").toBeGreaterThanOrEqual(2);
      // 되감기면 남은 꼬리 + 새로 시작한 만큼
      if (b.time < last) { played += (dur - last) + b.time; wraps++; }
      else played += b.time - last;
      last = b.time;
    }
    const wall = (Date.now() - t0) / 1000;
    expect(wraps, "한 바퀴를 안 돌았다 — 이음매를 지나지 않았다").toBe(1);
    // 재는 동안의 오차를 넉넉히 봐도, 이음매에서 멈추면 0.2초 이상 모자란다
    expect(played, `이음매에서 ${(wall - played).toFixed(2)}초가 비었다`)
      .toBeGreaterThan(wall - 0.2);
  });

  /**
   * Safari 는 ogg 를 못 읽어 m4a 로 떨어진다. AAC 는 인코더가 앞뒤에 여백을 붙이는
   * 포맷이라 반복할 때 정적이 생기기 제일 쉬운 쪽이다. 여기서는 못 듣는 브라우저의
   * 파일이므로, 포맷 고르는 곳을 속여 크로미움에 m4a 를 물리고 같은 자를 댄다.
   */
  test("Safari 쪽 파일(m4a)도 이음매에서 안 끊긴다", async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => {
      const orig = HTMLMediaElement.prototype.canPlayType;
      HTMLMediaElement.prototype.canPlayType = function (type: string) {
        return type.includes("ogg") ? "" : orig.call(this, type);
      };
    });
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");
    expect((await trackOf(page, "basecamp"))!.file, "m4a 로 안 떨어졌다").toMatch(/\.m4a$/);
    await page.waitForTimeout(900);

    const dur = await page.evaluate(() => {
      const el = (window.__AUDIO__ ?? []).find((a) => a.src.includes("basecamp"))!;
      el.currentTime = Math.max(0, el.duration - 1.2);
      return el.duration;
    });

    const t0 = Date.now();
    let played = 0, wraps = 0;
    let last = (await trackOf(page, "basecamp"))!.time;
    while (Date.now() - t0 < 2400) {
      await page.waitForTimeout(60);
      const b = (await trackOf(page, "basecamp"))!;
      expect(b.paused, "m4a 이음매에서 곡이 멈췄다").toBe(false);
      if (b.time < last) { played += (dur - last) + b.time; wraps++; }
      else played += b.time - last;
      last = b.time;
    }
    const wall = (Date.now() - t0) / 1000;
    expect(wraps, "m4a 가 한 바퀴를 안 돌았다").toBe(1);
    expect(played, `m4a 이음매에서 ${(wall - played).toFixed(2)}초가 비었다`)
      .toBeGreaterThan(wall - 0.2);
  });

  /**
   * 여섯 곡을 합치면 20MB 다. 처음에 다 받으면 첫 화면이 그만큼 늦는다.
   * 들어간 화면의 곡만 받아야 한다.
   */
  test("곡은 그 화면에 들어갈 때만 받는다", async ({ page }) => {
    const got: string[] = [];
    page.on("request", (r) => {
      const u = r.url();
      if (u.includes("/assets/audio/")) got.push(u.split("/").pop()!.replace(/\?.*$/, ""));
    });

    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");
    await page.waitForTimeout(500);
    expect([...new Set(got)], "마을에 들어갔는데 마을 곡 말고 다른 것도 받았다")
      .toEqual([expect.stringMatching(/^basecamp\./)]);

    await spaGoto(page, "/forest");
    await waitForTrack(page, "forest");
    await page.waitForTimeout(300);
    expect([...new Set(got)].length, "숲에 들어갔는데 받은 곡이 둘이 아니다").toBe(2);
  });

  test("소리 설정 슬라이더가 지금 나오는 곡에 바로 먹는다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");
    await page.waitForTimeout(1000);   // 페이드인이 끝날 때까지

    const vol = async () => (await trackOf(page, "basecamp"))!.volume;
    expect(await vol(), "기본 음량이 0.5 가 아니다").toBeCloseTo(0.5, 1);

    await openSoundSettings(page);

    // 슬라이더 → 지금 나오는 곡이 바로 따라와야 한다 (다음 곡부터면 안 된다)
    await dragBgm(page, 0.1);
    await expect.poll(vol, { timeout: 3000, message: "슬라이더가 지금 곡에 안 먹었다" })
      .toBeCloseTo(0.1, 2);

    // 음소거 → 0, 해제 → 원래 값으로 복귀
    await toggleMute(page);
    await expect.poll(vol, { timeout: 3000 }).toBe(0);
    await toggleMute(page);
    await expect.poll(vol, { timeout: 3000, message: "음소거를 풀었는데 원래 음량으로 안 왔다" })
      .toBeCloseTo(0.1, 2);

    // 0 으로 두고 화면을 옮겨다녀도 아무 소리가 안 나야 한다
    await dragBgm(page, 0);
    await expect.poll(vol, { timeout: 3000 }).toBe(0);
    for (const path of ["/workshop", "/forest", "/"]) {
      await spaGoto(page, path);
      await page.waitForTimeout(400);
      expect(audible(await snap(page)).map((x) => x.file),
        `${path} 에서 음량 0 인데 소리가 났다`).toEqual([]);
    }
  });

  test("설정이 새로고침 뒤에도 남는다", async ({ page }) => {
    await seed(page);
    await page.goto("/");
    await firstTouch(page);
    await waitForTrack(page, "basecamp");

    await openSoundSettings(page);
    await dragBgm(page, 0.25);
    await toggleMute(page);
    await page.waitForTimeout(300);

    await page.reload();
    await firstTouch(page);
    await page.waitForTimeout(800);

    const saved = await page.evaluate((k) =>
      JSON.parse(localStorage.getItem(k) ?? "{}").state, AUDIO_KEY);
    expect(saved.bgmVolume, "음량이 안 남았다").toBeCloseTo(0.25, 2);
    expect(saved.muted, "음소거가 안 남았다").toBe(true);
    // 음소거를 켠 채로 다시 열었으니 아무 소리도 안 나야 한다
    expect(audible(await snap(page))).toEqual([]);
  });
});
