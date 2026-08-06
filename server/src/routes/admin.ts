import { Router } from "express";
import { prisma } from "../prismaClient.js";
import { requireAdmin } from "../middleware/admin.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { saveData: { select: { updatedAt: true } } },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      username: u.username,
      createdAt: u.createdAt,
      saveUpdatedAt: u.saveData?.updatedAt ?? null,
    })),
  );
});

adminRouter.delete("/users/:id", async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } }).catch(() => null);
  res.status(204).end();
});
