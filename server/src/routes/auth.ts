import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";
import { env } from "../env.js";
import { asyncHandler } from "../asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** 같은 IP 에서 15분간 20회. 정상 플레이어는 안 닿지만 비밀번호 대입은 막히는 수준 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
});

function issueToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

authRouter.post("/register", authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
    return;
  }
  if (!USERNAME_RE.test(username)) {
    res.status(400).json({ error: "아이디는 영문/숫자/밑줄 3~20자여야 합니다." });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { username, passwordHash } });

  res.status(201).json({ token: issueToken(user.id), username: user.username });
}));

authRouter.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  res.json({ token: issueToken(user.id), username: user.username });
}));
