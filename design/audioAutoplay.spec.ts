import { test, expect } from "@playwright/test";
import { seed, snap, audible, firstTouch, waitForTrack } from "./audioProbe";

/**
 * 자동재생 잠금이 실제로 걸리는 브라우저에서 본다.
 *
 * ⚠️ audio.spec.ts 는 이 구간을 못 본다. 플레이라이트가 크로뮴을 띄울 때
 * `--autoplay-policy=no-user-gesture-required` 를 기본으로 넣어서, 손도 대기 전에
 * 소리가 나 버리기 때문이다. 실제 크롬은 안 그렇고, 게임이 끝까지 조용했던 것도
 * 정확히 이 구간이었다. 여기만 그 인자를 빼고 진짜 정책으로 띄운다.
 *
 * launchOptions 는 describe 안에서 못 바꾼다(워커가 새로 떠야 해서). 파일이 갈린 이유다.
 */
test.use({
  launchOptions: {
    ignoreDefaultArgs: ["--autoplay-policy=no-user-gesture-required"],
    args: ["--autoplay-policy=document-user-activation-required"],
  },
});

test("audio: 건드리기 전에는 조용하고, 건드리면 난다", async ({ page }) => {
  await seed(page);
  await page.goto("/");
  await page.waitForTimeout(1500);
  expect(audible(await snap(page)), "손대기 전에 소리가 났다").toEqual([]);

  await firstTouch(page);
  await waitForTrack(page, "basecamp");
});

test("audio: 이른 클릭 한 번이 잠금 해제를 태워 먹지 않는다", async ({ page }) => {
  // 화면이 뜨자마자 아무 데나 한 번 누르는 사람. 그 클릭은 곡을 걸기도 전에 도착해서
  // 풀 것이 아직 없다 — 예전엔 이 한 번으로 리스너가 떨어져 나가 끝까지 조용했다.
  await seed(page);
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    });
  });
  await page.goto("/");
  await page.waitForTimeout(1500);
  expect(audible(await snap(page)), "이른 클릭에 소리가 났다").toEqual([]);

  await firstTouch(page);
  await waitForTrack(page, "basecamp");
});
