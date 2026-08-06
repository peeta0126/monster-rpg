import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

interface AccessTokenPayload {
  userId: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "토큰이 유효하지 않습니다." });
  }
}
