import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { env } from "./env.js";
import { prisma } from "./prismaClient.js";
import { authRouter } from "./routes/auth.js";
import { saveRouter } from "./routes/save.js";
import { adminRouter } from "./routes/admin.js";
import { asyncHandler } from "./asyncHandler.js";

/**
 * 앱 조립만 하고 listen 은 하지 않는다.
 * index.ts 가 포트를 열고, 테스트는 이 app 을 그대로 받아 쓴다 — 테스트마다 포트를 잡으면
 * 병렬 실행에서 서로 포트를 뺏는다.
 */
export function createApp() {
  const app = express();

  // 터널·리버스 프록시 뒤에서는 X-Forwarded-For 를 믿어야 요청 제한이 IP 별로 동작한다.
  if (env.trustProxy) app.set("trust proxy", 1);

  app.use(cors({ origin: env.corsOrigins }));
  // 기본값 100kb 는 도감·보관함이 커진 세이브에 모자란다(넘치면 413 으로 조용히 동기화가 끊긴다).
  // 실제 상한은 save 라우트의 MAX_SAVE_LENGTH 가 정하고, 여기서는 그보다 살짝 여유를 둔다.
  app.use(express.json({ limit: "1mb" }));

  // DB 까지 확인한다. 프로세스만 살아 있고 DB 파일이 없는 상태를 "정상"으로 보고하면
  // 클라이언트가 폴백할 시점을 놓친다.
  app.get(
    "/api/health",
    asyncHandler(async (_req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ ok: true, db: true });
      } catch {
        res.status(503).json({ ok: false, db: false });
      }
    }),
  );

  app.use("/api/auth", authRouter);
  app.use("/api/save", saveRouter);
  app.use("/api/admin", adminRouter);

  // 라우트에서 next(err) 로 넘어온 오류의 최종 처리 지점.
  // asyncHandler 가 async 라우트의 거부를 여기로 보내니까, DB 장애가 나도 요청이 안 매달리고 500 으로 끝난다.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[server] 처리되지 않은 오류:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  });

  return app;
}
