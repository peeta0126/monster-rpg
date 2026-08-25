import { defineConfig } from "@playwright/test";

/**
 * 제출물 전용 설정 (썸네일 · 데모 영상).
 *
 * 디자인 캡처 설정과 나눈 이유는 해상도다. 캡처는 1440x900 에 묶여 있어야 이전 것과
 * 비교가 되는데, 제출물은 16:9 여야 한다 — 썸네일 1920x1080, 영상 1280x720.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /(thumbnail|demo)\.spec\.ts$/,
  timeout: 10 * 60 * 1000,
  expect: { timeout: 20 * 1000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../test-results/submission",
  use: {
    baseURL: "http://localhost:5173",
    deviceScaleFactor: 1,
    actionTimeout: 20 * 1000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
