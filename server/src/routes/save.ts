import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const saveRouter = Router();

saveRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const save = await prisma.saveData.findUnique({ where: { userId: req.userId! } });
  if (!save) {
    res.json({ data: null, updatedAt: null });
    return;
  }
  res.json({ data: save.data, updatedAt: save.updatedAt });
});

saveRouter.put("/", requireAuth, async (req: AuthedRequest, res) => {
  const { data } = req.body ?? {};
  if (typeof data !== "string") {
    res.status(400).json({ error: "data는 JSON 문자열이어야 합니다." });
    return;
  }

  const save = await prisma.saveData.upsert({
    where: { userId: req.userId! },
    update: { data },
    create: { userId: req.userId!, data },
  });

  res.json({ data: save.data, updatedAt: save.updatedAt });
});
