import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * 허용 출처는 쉼표로 여러 개 받는다.
 * 지금은 화면과 서버가 같은 PC 에 있어 개발 서버(5173)와 미리보기(4173)면 충분하지만,
 * 둘을 갈라 놓는 날이 오면 여기서 늘린다.
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
  port: Number(process.env.PORT ?? 4000),
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  /** 미설정 시 관리자 라우트는 항상 401 (플레이어 인증과 무관한 별도 비밀키) */
  adminSecret: process.env.ADMIN_SECRET ?? null,
  /** 리버스 프록시 뒤에 있으면 켠다. 안 켜면 req.ip 가 프록시 IP 라 요청 제한이 전역 제한이 된다 */
  trustProxy: process.env.TRUST_PROXY === "1",
};
