import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// xfwd 가 있어야 브라우저의 진짜 IP 가 4000 까지 간다. 없으면 터널을 통해 들어온 사람이
// 전부 ::1 한 명으로 보여서, 요청 제한이 뒤에 온 사람을 막고 접속 기록의 IP 도 전부 같아진다.
const API_PROXY = {
  "/api": { target: "http://localhost:4000", changeOrigin: true, xfwd: true },
};

// 터널 주소는 켤 때마다 바뀌므로 호스트를 하나 박을 수 없다. vite 7 은 모르는 Host 를
// 기본적으로 막아서, 열어 두지 않으면 터널로 들어온 사람이 "Blocked request" 만 본다.
const TUNNEL_HOSTS = [".trycloudflare.com"];

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
  // 바깥에 낼 때도 이 프록시를 그대로 탄다. 화면이 서버와 같은 주소에 있게 되므로
  // CORS 도 주소를 적어두는 파일도 필요 없다 — 주소를 정하는 곳은 여전히 여기 하나다.
  server: { proxy: API_PROXY, allowedHosts: TUNNEL_HOSTS },
  preview: { proxy: API_PROXY, allowedHosts: TUNNEL_HOSTS },
});
