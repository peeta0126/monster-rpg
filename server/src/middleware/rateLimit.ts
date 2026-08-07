import type { NextFunction, Request, Response } from "express";

/**
 * 간단한 고정 창(fixed window) 요청 제한.
 *
 * 로그인·회원가입이 무제한으로 열려 있으면 비밀번호를 사실상 무한히 대입할 수 있다
 * (비밀번호 최소 길이가 4자라 더욱). 이 서버는 SQLite 기반 단일 프로세스라
 * 외부 저장소 없이 메모리 맵만으로 충분하다 — 프로세스를 여러 개 띄우게 되면
 * Redis 등 공유 저장소 기반으로 교체해야 한다.
 */
export function rateLimit({
  windowMs,
  max,
  message,
}: {
  windowMs: number;
  max: number;
  message: string;
}) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";

    // 만료된 항목 정리 (요청량이 적어 전수 스캔으로 충분하다)
    for (const [k, v] of hits) {
      if (v.resetAt <= now) hits.delete(k);
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
