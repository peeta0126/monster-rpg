import { test, expect } from "@playwright/test";

/**
 * 세이브 서버가 안 떠 있을 때의 문구.
 *
 * 서버(4000)가 꺼져 있으면 vite 프록시가 **본문 없는 500** 을 대신 낸다. 우리 서버의
 * 에러 미들웨어를 안 거쳤으니 `{ error: ... }` 가 없고, 그걸 안 가르면 화면에
 * "요청에 실패했습니다. (500)" 만 떠서 서버를 켜면 끝날 일을 가입 로직의 버그로 읽게 된다.
 * 실제로 한 번 그렇게 헤맸다.
 *
 * 백엔드는 필요 없다 — 프록시가 내는 응답을 여기서 그대로 흉내 낸다.
 */

/** vite 7 의 프록시 오류 응답 그대로: 500 · text/plain · 빈 몸 (`config.js` 의 proxy.on("error")) */
const PROXY_DOWN = { status: 500, contentType: "text/plain", body: "" };

const DOWN_MESSAGE = /세이브 서버가 켜져 있는지/;

test("server-down: 서버가 꺼져 있으면 회원가입이 상태 코드 대신 이유를 말한다", async ({ page }) => {
  await page.route("**/api/auth/register", (route) => route.fulfill(PROXY_DOWN));

  await page.goto("/");
  await page.getByRole("button", { name: "회원가입" }).click();

  // 로그인 폼도 뒤에 그대로 살아 있어 아이디 칸이 둘이다. 가입 창 쪽으로 좁힌다.
  const modal = page.locator("form").filter({ hasText: "비밀번호 확인" });
  await modal.getByPlaceholder("voyager").fill("down_probe");
  const passwords = modal.getByPlaceholder("••••••••");
  await passwords.nth(0).fill("test1234");
  await passwords.nth(1).fill("test1234");
  await modal.getByRole("button", { name: "가입하기" }).click();

  await expect(page.getByText(DOWN_MESSAGE)).toBeVisible();
  await expect(page.getByText("(500)")).toHaveCount(0);
});

test("server-down: 서버가 낸 500 은 서버의 문구를 그대로 보여준다", async ({ page }) => {
  // 프록시의 500 과 갈라야 하는 쪽. 여기까지 왔다는 건 서버에 닿았다는 뜻이므로
  // "켜져 있는지 확인해주세요" 로 덮으면 진짜 서버 오류가 가려진다.
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "서버 오류가 발생했습니다." }) }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "회원가입" }).click();

  // 로그인 폼도 뒤에 그대로 살아 있어 아이디 칸이 둘이다. 가입 창 쪽으로 좁힌다.
  const modal = page.locator("form").filter({ hasText: "비밀번호 확인" });
  await modal.getByPlaceholder("voyager").fill("down_probe");
  const passwords = modal.getByPlaceholder("••••••••");
  await passwords.nth(0).fill("test1234");
  await passwords.nth(1).fill("test1234");
  await modal.getByRole("button", { name: "가입하기" }).click();

  await expect(page.getByText("서버 오류가 발생했습니다.")).toBeVisible();
  await expect(page.getByText(DOWN_MESSAGE)).toHaveCount(0);
});

test("server-down: 로그인도 같은 문구를 쓴다", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill(PROXY_DOWN));

  await page.goto("/");
  await page.getByPlaceholder("voyager").fill("down_probe");
  await page.getByPlaceholder("••••••••").fill("test1234");
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page.getByText(DOWN_MESSAGE)).toBeVisible();
  await expect(page.getByText("(500)")).toHaveCount(0);
});
