import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { saveRouter } from "./routes/save.js";
import { adminRouter } from "./routes/admin.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
// 기본값 100kb 는 도감·보관함이 커진 세이브에 모자란다(넘치면 413 으로 조용히 동기화가 끊긴다).
// 실제 상한은 save 라우트의 MAX_SAVE_LENGTH 가 정하고, 여기서는 그보다 살짝 여유를 둔다.
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
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

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});
