import { defineConfig } from "@playwright/test";

/**
 * 성능 측정 전용 설정.
 *
 * dev 서버로 재면 의미가 없다 — 번들이 안 합쳐지고 소스맵·HMR 이 붙는다.
 * 반드시 프로덕션 빌드 + preview 로 잰다.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /(perf|requests)\.spec\.ts$/,
  timeout: 5 * 60 * 1000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "../test-results/perf",
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 180 * 1000,
  },
});
