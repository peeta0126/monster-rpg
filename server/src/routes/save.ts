import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { asyncHandler } from "../asyncHandler.js";

export const saveRouter = Router();

/** 세이브 문자열 최대 길이. 정상 세이브는 수십 KB 수준이라 넉넉한 상한 (본문 파서 한도보다 작아야 함) */
const MAX_SAVE_LENGTH = 512 * 1024;

saveRouter.get(
  "/",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const save = await prisma.saveData.findUnique({ where: { userId: req.userId! } });
    if (!save) {
      res.json({ data: null, updatedAt: null });
      return;
    }
    res.json({ data: save.data, updatedAt: save.updatedAt });
  }),
);

saveRouter.put(
  "/",
  requireAuth,
  asyncHandler<AuthedRequest>(async (req, res) => {
    const { data } = req.body ?? {};
    if (typeof data !== "string") {
      res.status(400).json({ error: "data는 JSON 문자열이어야 합니다." });
      return;
    }
    if (data.length > MAX_SAVE_LENGTH) {
      res.status(413).json({ error: "세이브 데이터가 너무 큽니다." });
      return;
    }
    // 파싱 가능한 JSON 객체인지만 확인한다 — 내용 검증은 클라이언트의 normalizeState가 담당하지만,
    // 깨진 문자열을 그대로 저장해 두면 다음 로그인에서 복구 불가능한 세이브가 된다.
    try {
      const parsed: unknown = JSON.parse(data);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("not an object");
      }
    } catch {
      res.status(400).json({ error: "data는 JSON 객체 문자열이어야 합니다." });
      return;
    }

    const save = await prisma.saveData.upsert({
      where: { userId: req.userId! },
      update: { data },
      create: { userId: req.userId!, data },
    });

    res.json({ data: save.data, updatedAt: save.updatedAt });
  }),
);
