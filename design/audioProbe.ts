import { expect, type Page } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";

/**
 * BGM 검사가 브라우저를 들여다보는 방법. 스펙 두 벌(audio · audioAutoplay)이 같이 쓴다.
 *
 * 왜 파일을 나눴나: 자동재생 잠금을 진짜로 걸어 보려면 브라우저를 다른 인자로 띄워야
 * 하는데(`launchOptions`), 플레이라이트는 그걸 describe 안에서 못 바꾸게 한다.
 * 그래서 스펙 파일이 갈렸고, 그렇다고 들여다보는 도구까지 두 벌이 될 수는 없다.
 */

export const AUTH_KEY = "monster-rpg-auth";
export const PLAYER_KEY = "monster-rpg-player";
export const AUDIO_KEY = "monster-rpg-audio";
export const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

/**
 * 1층을 확실히 이기는 세이브. 시작 파티(Lv.1 플레미 한 마리)로는 1층에서도 질 수 있어서
 * 검사가 전투 결과가 아니라 운에 걸린다. 여기서 보려는 건 곡이지 난이도가 아니다.
 */
export const STRONG_SAVE = JSON.stringify({
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

export interface Snap {
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
export async function seed(page: Page, { authed = true, save = FRESH_SAVE } = {}) {
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

export const snap = (page: Page): Promise<Snap[]> => page.evaluate(() =>
  (window.__AUDIO__ ?? []).map((a) => ({
    file: a.src.split("/").pop() ?? "",
    paused: a.paused,
    volume: Math.round(a.volume * 1000) / 1000,
    time: a.currentTime,
    loop: a.loop,
    ready: a.readyState,
  })));

/** 지금 실제로 소리를 내고 있는 것들 */
export const audible = (s: Snap[]) => s.filter((x) => !x.paused && x.volume > 0);

/** 브라우저가 어느 포맷을 골랐든 이름만 본다 (ogg / m4a) */
export const nameOf = (file: string) => file.replace(/\.(ogg|m4a)$/, "");

export const trackOf = async (page: Page, name: string) =>
  (await snap(page)).find((x) => nameOf(x.file) === name);

/**
 * 자동재생 잠금을 푸는 첫 상호작용. 사람이 하는 것과 같은 순서다.
 *
 * 키 입력 대신 클릭인 이유: 브라우저가 "사용자 활성화"로 쳐 주는 키가 한정돼 있어
 * 게임이 안 듣는 키를 골라 눌러 봐야 잠금이 안 풀린다. 화면 맨 구석이라 누를 것이 없다.
 * 새로고침하면 활성화가 풀리므로 reload 뒤에는 매번 다시 눌러야 한다.
 */
export async function firstTouch(page: Page) {
  await page.mouse.click(2, 2);
}

export async function waitForTrack(page: Page, name: string) {
  await expect.poll(async () => audible(await snap(page)).map((x) => nameOf(x.file)),
    { timeout: 15_000, message: `${name} 이(가) 안 나온다` }).toContain(name);
}
