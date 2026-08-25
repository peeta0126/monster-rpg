import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * 허용 출처는 쉼표로 여러 개 받는다.
 * 배포하면 게임 화면(Pages)과 서버(터널)가 다른 도메인에 사니까, 개발용 5173 하나만으로는
 * 배포한 화면에서 오는 요청이 전부 CORS 에 막힌다.
 */
function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return ["http://localhost:5173"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  /** 익명 계정은 아이디를 아무도 안 외우고 있어서, 토큰이 만료되면 그 세이브로 돌아갈 길이 사실상 끊긴다.
   *  그래서 정식 계정보다 훨씬 길게 준다(복구용 비밀번호도 함께 내려주지만 보험을 이중으로 건다). */
  anonJwtExpiresIn: process.env.ANON_JWT_EXPIRES_IN ?? "365d",
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  /** 미설정 시 관리자 라우트는 항상 401 (플레이어 인증과 무관한 별도 비밀키) */
  adminSecret: process.env.ADMIN_SECRET ?? null,
  /** 터널·리버스 프록시 뒤에 있으면 켠다. 안 켜면 req.ip 가 프록시 IP 라 요청 제한이 전역 제한이 된다 */
  trustProxy: process.env.TRUST_PROXY === "1",
};
