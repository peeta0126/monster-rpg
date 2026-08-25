import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prismaClient.js";
import { requireAdmin } from "../middleware/admin.js";
import { asyncHandler } from "../asyncHandler.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/**
 * 세이브 파일의 실제 경로. DATABASE_URL 은 `file:./dev.db` 처럼 prisma 폴더 기준의
 * 상대 경로로 적히므로, 그 기준점을 여기서 붙여 준다. 서버는 어디서 실행되든
 * (`npm --prefix server start` 든 dist 든) 같은 파일을 봐야 한다.
 */
function resolveDbPath(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return null;
  const prismaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "prisma");
  return path.resolve(prismaDir, url.slice("file:".length));
}

/** 파일이 아직 없을 수 있다(테스트용 DB). 크기를 못 읽는다고 통계 전체를 실패시키지 않는다 */
function readDbBytes(): number | null {
  const dbPath = resolveDbPath();
  if (!dbPath) return null;
  try {
    return fs.statSync(dbPath).size;
  } catch {
    return null;
  }
}

/**
 * 서버가 지금 어떤 상태인지 한 화면에 모은다. 읽기만 한다 —
 * 관리 화면은 공개 주소에 올라가므로 여기에 조작을 붙이지 말 것.
 */
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());

    const [userCount, anonCount, saveCount, historyCount, latest] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isAnonymous: true } }),
      prisma.saveData.count(),
      prisma.saveHistory.count(),
      prisma.saveData.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    ]);

    res.json({
      uptimeSeconds,
      startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      nodeVersion: process.version,
      dbBytes: readDbBytes(),
      userCount,
      anonCount,
      saveCount,
      historyCount,
      lastSavedAt: latest?.updatedAt ?? null,
    });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { saveData: { select: { updatedAt: true, revision: true } } },
    });

    res.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        isAnonymous: u.isAnonymous,
        saveUpdatedAt: u.saveData?.updatedAt ?? null,
        saveRevision: u.saveData?.revision ?? null,
      })),
    );
  }),
);

adminRouter.delete(
  "/users/:id",
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id } }).catch(() => null);
    res.status(204).end();
  }),
);

/** 덮이기 전 세이브 목록. 내용은 크니까 여기서는 크기와 시각만 준다 */
adminRouter.get(
  "/users/:id/history",
  asyncHandler(async (req, res) => {
    const history = await prisma.saveHistory.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      history.map((h) => ({
        id: h.id,
        revision: h.revision,
        version: h.version,
        size: h.data.length,
        createdAt: h.createdAt,
      })),
    );
  }),
);

/** 지난 판으로 되돌린다. 되돌리기 직전 상태도 이력에 남겨 두 번 되돌릴 수 있게 한다 */
adminRouter.post(
  "/users/:id/restore/:historyId",
  asyncHandler(async (req, res) => {
    const { id: userId, historyId } = req.params;

    const target = await prisma.saveHistory.findFirst({ where: { id: historyId, userId } });
    if (!target) {
      res.status(404).json({ error: "해당 이력을 찾을 수 없습니다." });
      return;
    }

    const current = await prisma.saveData.findUnique({ where: { userId } });
    if (current) {
      await prisma.saveHistory.create({
        data: { userId, data: current.data, version: current.version, revision: current.revision },
      });
    }

    const restored = await prisma.saveData.upsert({
      where: { userId },
      update: { data: target.data, version: target.version, revision: (current?.revision ?? 0) + 1 },
      create: { userId, data: target.data, version: target.version, revision: 1 },
    });

    res.json({ revision: restored.revision, updatedAt: restored.updatedAt });
  }),
);

/**
 * 세이브가 한 번도 안 올라온 익명 계정 청소.
 * 「바로 시작」은 화면을 열기만 해도 계정을 만드니까, 들어왔다 바로 닫은 사람만큼 빈 행이 쌓인다.
 */
adminRouter.post(
  "/cleanup-anon",
  asyncHandler(async (req, res) => {
    const olderThanHours = Number(req.query.hours ?? 24);
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const { count } = await prisma.user.deleteMany({
      where: { isAnonymous: true, createdAt: { lt: cutoff }, saveData: { is: null } },
    });
    res.json({ deleted: count });
  }),
);
