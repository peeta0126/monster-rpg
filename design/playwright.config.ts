import { defineConfig } from "@playwright/test";

/**
 * 디자인 캡처 전용 설정.
 *
 * 루트 playwright.config.ts 는 testDir 이 ./e2e 라서 design/ 밑의 스펙을 찾지 못한다.
 * 자동 플레이(E2E)와 캡처는 목적도 타임아웃도 뷰포트도 달라서 설정을 나눠 둔다.
 *
 * 백엔드(server/)는 필요 없다 — 스펙이 게스트 세션을 localStorage 에 직접 심는다.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /(capture|visual)\.spec\.ts$/,
  timeout: 90 * 1000,
  expect: { timeout: 20 * 1000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../test-results/design",
  use: {
    baseURL: "http://localhost:5173",
    // 디자인 검토 기준 해상도. 바꾸면 이전 캡처와 비교가 무의미해지니 고정한다.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    actionTimeout: 20 * 1000,
    // 캡처마다 배경 애니메이션이 다른 위상에서 찍히면 비교가 어렵다
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
