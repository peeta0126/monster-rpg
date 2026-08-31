import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const API_PROXY = {
  "/api": { target: "http://localhost:4000", changeOrigin: true },
};

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
  // 화면과 서버가 같은 PC 에서 돈다. 배포가 없으니 주소를 런타임에 알아낼 길도 없애고
  // (`src/shared/apiBase.ts`) 여기서 넘긴다 — dev 와 preview 둘 다 걸어야 빌드한 화면도 붙는다.
  server: { proxy: API_PROXY },
  preview: { proxy: API_PROXY },
});