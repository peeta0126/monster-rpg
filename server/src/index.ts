import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { saveRouter } from "./routes/save.js";
import { adminRouter } from "./routes/admin.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/save", saveRouter);
app.use("/api/admin", adminRouter);

app.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
});
