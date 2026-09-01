import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../prismaClient.js";
import { requireAdmin } from "../middleware/admin.js";
import { summarizeSave } from "../saveSummary.js";
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

    const [userCount, saveCount, historyCount, latest, loginCount, failCount, firstEvent] =
      await Promise.all([
        prisma.user.count(),
        prisma.saveData.count(),
        prisma.saveHistory.count(),
        prisma.saveData.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
        prisma.loginEvent.count({ where: { kind: { in: ["login", "register"] } } }),
        prisma.loginEvent.count({ where: { kind: "fail" } }),
        prisma.loginEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      ]);

    res.json({
      uptimeSeconds,
      startedAt: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      nodeVersion: process.version,
      dbBytes: readDbBytes(),
      userCount,
      saveCount,
      historyCount,
      lastSavedAt: latest?.updatedAt ?? null,
      loginCount,
      failCount,
      // 접속 기록은 이 기능이 들어간 날부터 쌓인다. 그 전의 접속은 어디에도 없으므로
      // 화면이 "0회" 로 적지 않게 언제부터인지를 같이 준다.
      trackingSince: firstEvent?.createdAt ?? null,
    });
  }),
);

/**
 * 계정 목록. 세이브 본문까지 읽어 "어디까지 갔나" 를 같이 낸다.
 *
 * 목록에서 요약이 안 보이면 스무 명을 하나씩 눌러 봐야 누가 진짜로 플레이했는지 알 수 있다.
 * 세이브가 사람당 수십 KB 라 몇백 명까지는 이대로 읽어도 된다 — 그보다 커지면 요약을
 * 저장할 자리를 만들 때다.
 */
adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const [users, logins] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { saveData: { select: { updatedAt: true, revision: true, data: true } } },
      }),
      // 사람마다 세면 계정 수만큼 질의가 나간다. 한 번에 묶어 세고 여기서 나눠 붙인다.
      prisma.loginEvent.groupBy({
        by: ["userId"],
        where: { kind: { in: ["login", "register"] } },
        _count: { _all: true },
      }),
    ]);

    const countByUser = new Map(logins.map((g) => [g.userId, g._count._all]));

    res.json(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        saveUpdatedAt: u.saveData?.updatedAt ?? null,
        saveRevision: u.saveData?.revision ?? null,
        loginCount: countByUser.get(u.id) ?? 0,
        summary: summarizeSave(u.saveData?.data),
      })),
    );
  }),
);

/**
 * 한 사람의 세이브 원본. 이름을 붙이는 것은 관리 화면이 한다 — 몬스터·아이템 표가
 * 게임 쪽에만 있어서, 여기서 풀면 같은 표를 서버에도 한 벌 두게 된다.
 */
adminRouter.get(
  "/users/:id/save",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { saveData: true },
    });
    if (!user) {
      res.status(404).json({ error: "계정을 찾을 수 없습니다." });
      return;
    }

    res.json({
      username: user.username,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      data: user.saveData?.data ?? null,
      version: user.saveData?.version ?? null,
      revision: user.saveData?.revision ?? 0,
      updatedAt: user.saveData?.updatedAt ?? null,
      summary: summarizeSave(user.saveData?.data),
    });
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

/** 접속 화면이 한 번에 받아 간다. 사람 목록·요약·최근 기록이 따로 오면 세 번 왕복한다 */
const ACCESS_WINDOW_DAYS = 7;
const RECENT_LIMIT = 200;

/**
 * "누가 언제 들어왔나".
 *
 * `User.lastLoginAt` 은 마지막 한 번뿐이라 매일 오는 사람과 두 달 전에 한 번 온 사람이
 * 같아 보인다. 그 차이를 내는 것이 이 라우트의 전부다 — 조작은 없다.
 *
 * **`trackingSince` 를 반드시 같이 낸다.** 이 표는 기능이 들어간 날부터 쌓이므로 그 전에
 * 들어온 사람은 0회로 보인다. 화면이 그걸 "한 번도 안 들어옴" 으로 읽으면, 없는 사실을
 * 지어내는 셈이 된다.
 */
adminRouter.get(
  "/access",
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || ACCESS_WINDOW_DAYS, 1), 365);
    const since = new Date(Date.now() - days * 86400_000);

    const [users, rollup, recent, firstEvent, windowCounts] = await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        include: { saveData: { select: { updatedAt: true } } },
      }),
      prisma.loginEvent.groupBy({ by: ["userId", "kind"], _count: { _all: true } }),
      prisma.loginEvent.findMany({ orderBy: { createdAt: "desc" }, take: RECENT_LIMIT }),
      prisma.loginEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.loginEvent.groupBy({
        by: ["userId"],
        where: { kind: { in: ["login", "register"] }, createdAt: { gte: since } },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    const count = (userId: string, kind: string) =>
      rollup.find((g) => g.userId === userId && g.kind === kind)?._count._all ?? 0;
    const inWindow = new Map(windowCounts.map((g) => [g.userId, g]));

    // 마지막 접속은 기록에서 읽되, 기록이 없으면 lastLoginAt 으로 물러난다.
    // 기록 이전에 들어온 사람의 마지막 접속을 "없음" 으로 적으면 안 된다.
    const lastEventByUser = new Map<string, Date>();
    for (const e of recent) {
      if (!e.userId || e.kind === "fail") continue;
      const prev = lastEventByUser.get(e.userId);
      if (!prev || e.createdAt > prev) lastEventByUser.set(e.userId, e.createdAt);
    }

    res.json({
      days,
      trackingSince: firstEvent?.createdAt ?? null,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        saveUpdatedAt: u.saveData?.updatedAt ?? null,
        loginCount: count(u.id, "login") + count(u.id, "register"),
        failCount: count(u.id, "fail"),
        recentLoginCount: inWindow.get(u.id)?._count._all ?? 0,
        lastEventAt: lastEventByUser.get(u.id) ?? null,
      })),
      // 계정이 없는 실패(없는 아이디를 찍어 본 것)는 사람 목록에 안 붙으므로 여기서만 보인다
      recent: recent.map((e) => ({
        id: e.id,
        userId: e.userId,
        username: e.username,
        kind: e.kind,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
      truncated: recent.length === RECENT_LIMIT,
    });
  }),
);

/** 한 사람의 접속 기록. 목록에서 누르면 펼친다 */
adminRouter.get(
  "/users/:id/logins",
  asyncHandler(async (req, res) => {
    const events = await prisma.loginEvent.findMany({
      where: { userId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
    });
    res.json(
      events.map((e) => ({
        id: e.id,
        kind: e.kind,
        username: e.username,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
      })),
    );
  }),
);
