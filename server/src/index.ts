import { createApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./prismaClient.js";

const server = createApp().listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});

// 노트북에서 켜 두고 쓰는 서버라 껐다 켜는 일이 잦다. 연결을 안 닫고 죽으면
// SQLite 파일에 저널이 남아 다음 기동이 느려지거나 잠긴다.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`[server] ${signal} — 종료합니다.`);
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
