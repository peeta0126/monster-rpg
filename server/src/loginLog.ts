import type { Request } from "express";
import { prisma } from "./prismaClient.js";

/**
 * 들어온 흔적을 한 줄씩 남긴다.
 *
 * `User.lastLoginAt` 은 덮어쓰기라 "마지막 한 번" 밖에 못 말한다. 그걸로는 매일 들어오는
 * 사람과 두 달 전에 한 번 들어온 사람이 같은 칸에 앉는다 — 관리 화면에서 알고 싶은 것은
 * 정확히 그 차이다. 그래서 덮어쓰지 않고 쌓는다.
 *
 * 실패까지 담는 건 남의 계정을 두드린 흔적이 여기 말고는 아무 데도 안 남기 때문이다.
 * 요청 제한(`rateLimit`)은 막기만 하고 누가 두드렸는지는 안 알려준다.
 */
export type LoginKind = "login" | "register" | "fail";

/** 사람이 만든 문자열이라 길이를 믿지 않는다. 표에 담기지도 않는 길이는 잘라 둔다 */
const MAX_UA = 200;

/**
 * 프록시 뒤에서는 `trust proxy` 가 켜져 있어야 `req.ip` 가 진짜 클라이언트가 된다
 * (`app.ts` 가 `TRUST_PROXY` 로 켠다). 안 켜져 있으면 전부 프록시 IP 로 보이는데,
 * 그건 여기서 고칠 일이 아니라 설정에서 고칠 일이다.
 */
function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

function userAgent(req: Request): string | null {
  const ua = req.headers["user-agent"];
  return typeof ua === "string" ? ua.slice(0, MAX_UA) : null;
}

/**
 * 기록이 로그인을 막지 않는다.
 *
 * 이건 곁다리 장부다 — 여기서 던진 오류가 로그인 응답을 500 으로 바꾸면, 관리 화면 하나
 * 보자고 게임을 못 들어가게 만든 셈이 된다. 그래서 실패는 삼키고 콘솔에만 남긴다.
 */
export async function recordLogin(
  req: Request,
  kind: LoginKind,
  username: string,
  userId: string | null,
): Promise<void> {
  try {
    await prisma.loginEvent.create({
      data: { kind, username, userId, ip: clientIp(req), userAgent: userAgent(req) },
    });
  } catch (err) {
    console.error("[server] 접속 기록 실패:", err);
  }
}

/**
 * 실패 기록만 오래된 것을 버린다. 30일이 지난 실패는 "지금 누가 두드리고 있나" 에 아무
 * 답도 못 하는데, 대입 공격 한 번이면 수천 줄이 쌓인다.
 *
 * **성공(login·register)은 지우지 않는다.** 그걸 지우면 "몇 번 들어왔나" 가 조용히 줄어든다 —
 * 화면이 세는 숫자가 어느 날부터 거짓말이 되는 것이 이 표에서 제일 나쁜 고장이다.
 */
const FAIL_KEEP_DAYS = 30;

export async function pruneFailures(): Promise<number> {
  const cutoff = new Date(Date.now() - FAIL_KEEP_DAYS * 86400_000);
  try {
    const { count } = await prisma.loginEvent.deleteMany({
      where: { kind: "fail", createdAt: { lt: cutoff } },
    });
    return count;
  } catch (err) {
    console.error("[server] 오래된 실패 기록 정리 실패:", err);
    return 0;
  }
}
