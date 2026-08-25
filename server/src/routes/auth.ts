import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { prisma } from "../prismaClient.js";
import { env } from "../env.js";
import { asyncHandler } from "../asyncHandler.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

/** 같은 IP 에서 15분간 20회. 정상 플레이어는 안 닿지만 비밀번호 대입은 막히는 수준 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
});

/**
 * 「바로 시작」 전용 제한.
 * 로그인 제한(20회/15분)을 그대로 쓰면 같은 회선 뒤에 있는 사람 여럿이 동시에 들어올 때
 * 뒤에 온 사람이 게임 시작 자체를 못 한다. 비밀번호 대입과 성격이 다르니 따로 센다.
 */
const anonLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 40,
  message: "잠시 후 다시 시도해주세요.",
});

function issueToken(userId: string, expiresIn = env.jwtExpiresIn): string {
  return jwt.sign({ userId }, env.jwtSecret, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
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

  res.status(201).json({ token: issueToken(user.id), username: user.username, isAnonymous: false });
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

  res.json({ token: issueToken(user.id), username: user.username, isAnonymous: user.isAnonymous });
}));

/**
 * 로그인 없이 바로 시작.
 *
 * 아이디를 묻지 않고 계정을 만들어 주는 대신, 만들어진 비밀번호를 그 자리에서 돌려준다.
 * 클라이언트가 그걸 들고 있으면 토큰이 만료돼도 같은 계정(=같은 세이브)으로 다시 붙는다.
 * 이 경로가 없으면 "저장은 되는데 로그인해야 한다"가 되어, 처음 들어온 사람의 진행이
 * 브라우저 저장소에만 남고 기기마다 갈린다.
 */
authRouter.post("/anon", anonLimiter, asyncHandler(async (_req, res) => {
  const password = randomBytes(18).toString("hex");
  const passwordHash = await bcrypt.hash(password, 10);

  // 아이디가 겹칠 확률은 사실상 없지만, 겹치면 계정 생성이 통째로 실패해 게임에 못 들어간다.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `guest_${randomBytes(6).toString("hex")}`;
    const created = await prisma.user
      .create({ data: { username, passwordHash, isAnonymous: true } })
      .catch(() => null);
    if (created) {
      res.status(201).json({
        token: issueToken(created.id, env.anonJwtExpiresIn),
        username: created.username,
        password,
        isAnonymous: true,
      });
      return;
    }
  }

  res.status(500).json({ error: "계정을 만들지 못했습니다. 잠시 후 다시 시도해주세요." });
}));

/** 익명 계정에 아이디·비밀번호를 붙여 정식 계정으로 만든다. 세이브는 그대로 이어진다 */
authRouter.post("/link", requireAuth, authLimiter, asyncHandler<AuthedRequest>(async (req, res) => {
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

  const me = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!me) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }
  if (!me.isAnonymous) {
    res.status(409).json({ error: "이미 아이디가 있는 계정입니다." });
    return;
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) {
    res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: me.id },
    data: { username, passwordHash: await bcrypt.hash(password, 10), isAnonymous: false },
  });

  res.json({ token: issueToken(updated.id), username: updated.username, isAnonymous: false });
}));

/** 토큰이 아직 쓸 수 있는지, 익명 계정인지 확인한다 */
authRouter.get("/me", requireAuth, asyncHandler<AuthedRequest>(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId! } });
  if (!user) {
    // 토큰은 유효한데 계정이 지워진 경우. 클라이언트가 로그아웃할 수 있게 401 로 알린다.
    res.status(401).json({ error: "계정을 찾을 수 없습니다." });
    return;
  }
  res.json({ username: user.username, isAnonymous: user.isAnonymous });
}));
