import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { env } from "../env.js";

/**
 * 길이를 흘리지 않는 비밀키 비교.
 * `!==` 는 첫 다른 바이트에서 바로 끝나서 비교 시간이 값에 따라 달라진다.
 * timingSafeEqual 은 길이가 다르면 던지니까 길이를 먼저 본다(길이 자체는 비밀이 아니다).
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"];
  if (!env.adminSecret || typeof secret !== "string" || !safeEqual(secret, env.adminSecret)) {
    res.status(401).json({ error: "관리자 인증이 필요합니다." });
    return;
  }
  next();
}
