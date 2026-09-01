import { createApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./prismaClient.js";
import { pruneFailures } from "./loginLog.js";

const server = createApp().listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});

// 오래된 로그인 실패는 기동할 때 한 번만 턴다. 스케줄러를 들이기에는 이 서버가 너무
// 작고, 켜 두는 시간이 길어야 며칠이라 기동 때마다면 충분하다. 성공 기록은 안 지운다.
void pruneFailures().then((n) => {
  if (n > 0) console.log(`[server] 30일 지난 로그인 실패 ${n}건을 지웠습니다.`);
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
