import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 는 async 핸들러가 돌려준 거부된 Promise 를 못 잡는다.
 * 그대로 두면 DB 오류 같은 게 unhandled rejection 이 되고, 클라이언트는 응답을 못 받아
 * 요청이 타임아웃까지 매달린다. async 라우트는 전부 이 래퍼로 감싸 에러 미들웨어로 넘긴다.
 *
 * (Express 5 로 올리면 프레임워크가 같은 일을 해 주니까 이 래퍼는 지워도 된다.)
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
