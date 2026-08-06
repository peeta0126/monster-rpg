import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"];
  if (!env.adminSecret || secret !== env.adminSecret) {
    res.status(401).json({ error: "관리자 인증이 필요합니다." });
    return;
  }
  next();
}
