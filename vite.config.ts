import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 전부 한 덩어리(1.7MB)로 나가면 게임 코드를 한 줄만 고쳐도 사용자가 Phaser까지 다시 받는다.
        // 거의 바뀌지 않는 의존성을 갈라두면 그쪽 캐시가 재배포마다 살아남는다.
        manualChunks: {
          phaser: ["phaser"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});