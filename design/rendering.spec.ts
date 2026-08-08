import { test, expect, type Page } from "@playwright/test";

/**
 * image-rendering 이 붙어야 할 곳에만 붙어 있는지 확인한다.
 *
 * 픽셀아트(스프라이트·아이콘)는 nearest-neighbor 로 그려야 획이 또렷하다. 반대로 배경
 * 일러스트는 픽셀 그리드가 없는 안티에일리어싱 그림이라, 2400px 원본을 화면 크기로
 * 줄일 때 nearest 를 먹이면 픽셀이 규칙적으로 버려져 지저분해진다.
 *
 * 이 구분은 클래스 이름 패턴으로 자동 적용하다가 한 번 사고를 낸 적이 있어(몬스터
 * 일러스트에 계단이 생겼다) 지금은 .pixel-img 를 명시적으로만 건다. 그 규칙이 유지되는지
 * 계산된 스타일로 지킨다.
 */

const AUTH_STORAGE_KEY = "monster-rpg-auth";
const GUEST_AUTH_STATE = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

async function asGuest(page: Page, path: string) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [AUTH_STORAGE_KEY, GUEST_AUTH_STATE],
  );
  await page.goto(path);
}

const renderingOf = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).imageRendering);

test.describe("rendering:", () => {
  test("공방 배경은 부드럽게 축소된다", async ({ page }) => {
    await asGuest(page, "/workshop");
    await expect(page.locator('img[alt="제작 공방"]')).toBeVisible();
    expect(await renderingOf(page, 'img[alt="제작 공방"]')).toBe("auto");
  });

  test("공방 플레이어 스프라이트는 pixelated 를 유지한다", async ({ page }) => {
    await asGuest(page, "/workshop");
    await expect(page.locator('img[alt="player"]')).toBeVisible();
    // index.css 가 pixelated 와 crisp-edges 를 함께 선언한다(브라우저별 지원 차이).
    // 어느 쪽으로 계산되는지는 브라우저 사정이라, "auto 가 아니다"만 지킨다.
    expect(await renderingOf(page, 'img[alt="player"]')).not.toBe("auto");
  });

  test("로그인 배경은 부드럽게 축소된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("img.login-bg-img")).toBeVisible();
    expect(await renderingOf(page, "img.login-bg-img")).toBe("auto");
  });
});
