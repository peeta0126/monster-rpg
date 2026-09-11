#!/usr/bin/env bash
# 서버를 처음 세우는 기기에서 한 번만 돌린다 (macOS/Linux, 또는 Windows 의 Git Bash).
#   bash server/setup.sh
#
# 하는 일: 의존성 설치 → .env 생성(비밀키는 여기서 랜덤 생성) → DB 마이그레이션 → 빌드.
# .env 가 이미 있으면 건드리지 않는다 — 덮어쓰면 기존 계정의 토큰이 전부 무효가 된다.
set -euo pipefail

cd "$(dirname "$0")"

secret() { openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'; }

echo "[1/4] 의존성 설치"
npm install

if [ -f .env ]; then
  echo "[2/4] .env 가 이미 있습니다 - 그대로 둡니다"
else
  echo "[2/4] .env 생성 (비밀키 랜덤 생성)"
  ADMIN_SECRET_VALUE="$(secret)"
  cat > .env <<EOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="$(secret)"
JWT_EXPIRES_IN="7d"
PORT=4000
CORS_ORIGIN="http://localhost:5173,http://localhost:4173"
TRUST_PROXY=0
ADMIN_SECRET="${ADMIN_SECRET_VALUE}"
EOF
  echo "  관리자 키: ${ADMIN_SECRET_VALUE}"
  echo "  (/admin 페이지에서 쓴다. 지금 적어 두세요)"
fi

echo "[3/4] DB 마이그레이션"
npx prisma migrate deploy

echo "[4/4] 빌드"
npm run build

cat <<'EOF'

끝. 이제 서버를 띄우세요:
  npm --prefix server start

화면은 저장소 뿌리에서 따로 띄웁니다 (`npm run dev`). /api 는 vite 가 여기로 넘깁니다.
둘을 한 번에: `npm run dev:all`

이 서버는 이 기기의 것입니다. 계정도 세이브도 다른 사람 것과 섞이지 않습니다.
누가 어디까지 했는지는 두 곳에서 봅니다:
  npm --prefix server run report     터미널에서 한 줄로 (서버가 꺼져 있어도 됩니다)
  /admin                             브라우저에서. 위에 찍힌 관리자 키를 넣습니다
EOF
