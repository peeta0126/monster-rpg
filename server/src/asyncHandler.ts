import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4는 async 핸들러가 반환한 거부된 Promise를 잡지 못한다.
 * 그대로 두면 DB 오류 등이 unhandled rejection이 되고, 클라이언트는 응답을 받지 못해
 * 요청이 타임아웃까지 매달린다. 모든 async 라우트를 이 래퍼로 감싸 에러 미들웨어로 넘긴다.
 *
 * (Express 5로 올리면 프레임워크가 같은 일을 해주므로 이 래퍼는 제거할 수 있다.)
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
