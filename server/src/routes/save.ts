import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const saveRouter = Router();

/** 세이브 문자열 최대 길이. 정상 세이브는 수십 KB 수준이라 넉넉한 상한이다(본문 파서 한도보다 작아야 한다) */
const MAX_SAVE_LENGTH = 512 * 1024;

/** 덮이기 직전 상태를 사용자당 이만큼 남긴다 */
const HISTORY_KEEP = 10;

/**
 * 클라이언트는 4초 디바운스로 올리지만, 창을 여러 개 띄우거나 코드가 어긋나면
 * 초당 여러 번이 될 수 있다. 세이브는 인증을 통과한 뒤라 IP 가 아니라 사용자로 센다.
 */
const saveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "저장 요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
  key: (req) => (req as AuthedRequest).userId ?? req.ip ?? "unknown",
});

saveRouter.get(
  "/",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const save = await prisma.saveData.findUnique({ where: { userId: req.userId! } });
    if (!save) {
      res.json({ data: null, version: null, revision: 0, updatedAt: null });
      return;
    }
    res.json({ data: save.data, version: save.version, revision: save.revision, updatedAt: save.updatedAt });
  }),
);

saveRouter.put(
  "/",
  requireAuth,
  saveLimiter,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data, version, baseRevision } = req.body ?? {};
    if (typeof data !== "string") {
      res.status(400).json({ error: "data는 JSON 문자열이어야 합니다." });
      return;
    }
    if (data.length > MAX_SAVE_LENGTH) {
      res.status(413).json({ error: "세이브 데이터가 너무 큽니다." });
      return;
    }
    // 파싱 가능한 JSON 객체인지만 본다. 내용 검증은 클라이언트의 normalizeState 가 하지만,
    // 깨진 문자열을 그대로 저장해 두면 다음 로그인에서 복구 못 하는 세이브가 된다.
    try {
      const parsed: unknown = JSON.parse(data);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
    } catch {
      res.status(400).json({ error: "data는 JSON 객체 문자열이어야 합니다." });
      return;
    }

    const saveVersion = Number.isInteger(version) ? (version as number) : 2;
    const existing = await prisma.saveData.findUnique({ where: { userId: req.userId! } });

    // 다른 기기가 그 사이에 올렸다. 규칙은 "서버가 이긴다" 이므로 덮어쓰지 않고
    // 지금 서버에 있는 것을 그대로 돌려준다 — 클라이언트가 그걸 받아 자기 상태를 맞춘다.
    if (existing && Number.isInteger(baseRevision) && baseRevision !== existing.revision) {
      res.status(409).json({
        error: "다른 기기에서 먼저 저장했습니다.",
        conflict: true,
        data: existing.data,
        version: existing.version,
        revision: existing.revision,
        updatedAt: existing.updatedAt,
      });
      return;
    }

    try {
      if (!existing) {
        const created = await prisma.saveData.create({
          data: { userId: req.userId!, data, version: saveVersion, revision: 1 },
        });
        res.json({ data: created.data, version: created.version, revision: created.revision, updatedAt: created.updatedAt });
        return;
      }

      // 내용이 실제로 달라졌을 때만 이력을 남긴다. 같은 내용이 반복해 올라오는 것만으로
      // 열 판이 채워지면, 정작 사고가 났을 때 되돌아갈 지점이 다 밀려나 있다.
      if (existing.data !== data) {
        await prisma.saveHistory.create({
          data: {
            userId: req.userId!,
            data: existing.data,
            version: existing.version,
            revision: existing.revision,
          },
        });
        await pruneHistory(req.userId!);
      }

      const updated = await prisma.saveData.update({
        where: { userId: req.userId! },
        data: { data, version: saveVersion, revision: existing.revision + 1 },
      });
      res.json({ data: updated.data, version: updated.version, revision: updated.revision, updatedAt: updated.updatedAt });
    } catch (err) {
      // 토큰은 유효한데 계정이 지워진 경우. 외래키 오류를 500 으로 흘리면 클라이언트가
      // 서버 장애로 알고 영영 재시도한다.
      if (isMissingUser(err)) {
        res.status(401).json({ error: "계정을 찾을 수 없습니다." });
        return;
      }
      throw err;
    }
  }),
);

async function pruneHistory(userId: string): Promise<void> {
  const stale = await prisma.saveHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: HISTORY_KEEP,
    select: { id: true },
  });
  if (stale.length === 0) return;
  await prisma.saveHistory.deleteMany({ where: { id: { in: stale.map((h) => h.id) } } });
}

function isMissingUser(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2003";
}
