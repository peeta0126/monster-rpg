import { defineConfig } from "@playwright/test";

/**
 * 자동 플레이(E2E) 설정.
 *
 * 백엔드(server/)는 필요 없다 — 스크립트가 게스트 세션을 직접 주입하므로
 * Vite 개발 서버만 띄우면 된다.
 */
export default defineConfig({
  testDir: "./e2e",
  // 1층부터 50층까지 실제로 전투를 진행하므로 넉넉하게 잡는다
  timeout: 30 * 60 * 1000,
  expect: { timeout: 15 * 1000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    // Phaser 캔버스(960×540)와 하단 배틀 패널이 모두 보이는 크기
    viewport: { width: 1280, height: 900 },
    actionTimeout: 15 * 1000,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
