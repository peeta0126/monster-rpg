import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient.js";
import { env } from "../env.js";
import { asyncHandler } from "../asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { recordLogin } from "../loginLog.js";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/**
 * 로그인 전용 제한. 같은 IP 에서 15분간 20회 — 정상적인 오타는 안 닿지만 비밀번호 대입은 막힌다.
 * 비밀번호 최소 길이가 4자라 이게 없으면 사실상 무한히 찍어 볼 수 있다.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
});

/**
 * 가입은 따로 센다. 막고 싶은 것이 다르기 때문이다 — 로그인 실패의 반복은 공격 신호지만
 * 가입은 그냥 사람이 한 명 더 온 것이다. 게다가 이 서버는 한 대에서 돌아 여럿이 같은 IP 로
 * 들어오므로, 로그인 제한(20회/15분)을 그대로 씌우면 뒤에 온 사람이 계정을 못 만든다.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
});

function issueToken(userId: string): string {
  return jwt.sign({ userId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

authRouter.post("/register", registerLimiter, asyncHandler(async (req, res) => {
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
  // 가입은 곧바로 로그인 상태가 된다. 여기서 안 찍으면 관리 화면에서 "가입만 하고 한 번도
  // 안 들어온 사람" 과 "가입하고 바로 논 사람" 이 구분이 안 된다.
  const user = await prisma.user.create({
    data: { username, passwordHash, lastLoginAt: new Date() },
  });
  await recordLogin(req, "register", user.username, user.id);

  res.status(201).json({ token: issueToken(user.id), username: user.username });
}));

authRouter.post("/login", loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "아이디와 비밀번호를 입력해주세요." });
    return;
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    // 없는 아이디로 온 실패다. 계정이 안 붙으므로 userId 는 null 이고, 적어 둔 username 이
    // "무엇을 두드렸나" 를 말해 준다 -- 오타인지 남의 아이디를 찍어 보는 중인지가 갈린다.
    await recordLogin(req, "fail", username, null);
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await recordLogin(req, "fail", user.username, user.id);
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await recordLogin(req, "login", user.username, user.id);

  res.json({ token: issueToken(user.id), username: user.username });
}));

/** 토큰이 아직 쓸 수 있는지 확인한다 */
authRouter.get("/me", requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    // 토큰은 유효한데 계정이 지워진 경우. 클라이언트가 로그아웃할 수 있게 401 로 알린다.
    res.status(401).json({ error: "계정을 찾을 수 없습니다." });
    return;
  }
  res.json({ username: user.username });
}));
