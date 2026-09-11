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
  /**
   * 앞에 선 프록시가 몇 겹인지. 0 이면 안 믿는다.
   * 켜고 끄는 값이 아니라 겹 수인 이유는, 겹이 하나 늘 때마다 X-Forwarded-For 에 줄이
   * 하나 더 붙기 때문이다 — 숫자가 모자라면 req.ip 가 프록시 자신(::1)으로 떨어지고,
   * 그러면 요청 제한이 IP 별이 아니라 전원 공용이 된다.
   * 바깥에 낼 때는 2 다: cloudflared → vite 프록시 → 이 서버.
   */
  trustProxy: Number(process.env.TRUST_PROXY ?? 0) || 0,
};
