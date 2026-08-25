# 서버를 처음 세우는 노트북에서 한 번만 돌린다.
#   PowerShell 에서:  .\server\setup.ps1
#
# 하는 일: 의존성 설치 → .env 생성(비밀키는 여기서 랜덤 생성) → DB 마이그레이션 → 빌드.
# .env 가 이미 있으면 건드리지 않는다 — 덮어쓰면 기존 계정의 토큰이 전부 무효가 된다.

$ErrorActionPreference = "Stop"
$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $serverDir

function New-Secret {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [System.BitConverter]::ToString($bytes).Replace("-", "").ToLower()
}

Write-Host "[1/4] 의존성 설치"
npm install

$envPath = Join-Path $serverDir ".env"
if (Test-Path $envPath) {
    Write-Host "[2/4] .env 가 이미 있습니다 - 그대로 둡니다"
} else {
    Write-Host "[2/4] .env 생성 (비밀키 랜덤 생성)"
    $jwt = New-Secret
    $admin = New-Secret
    @"
DATABASE_URL="file:./dev.db"
JWT_SECRET="$jwt"
JWT_EXPIRES_IN="7d"
ANON_JWT_EXPIRES_IN="365d"
PORT=4000
CORS_ORIGIN="http://localhost:5173,http://localhost:4173"
TRUST_PROXY=1
ADMIN_SECRET="$admin"
"@ | Out-File -FilePath $envPath -Encoding utf8
    Write-Host "  관리자 키: $admin"
    Write-Host "  (/admin 페이지에서 쓴다. 지금 적어 두세요)"
}

Write-Host "[3/4] DB 마이그레이션"
npx prisma migrate deploy

Write-Host "[4/4] 빌드"
npm run build

Write-Host ""
Write-Host "끝. 이제 서버를 띄우세요:"
Write-Host "  npm --prefix server start"
Write-Host ""
Write-Host "바깥에서 접속하려면 다른 창에서:"
Write-Host "  cloudflared tunnel --url http://localhost:4000"
Write-Host "나온 https 주소를 public/server-config.json 의 apiBase 에 넣고 화면을 다시 배포합니다."
Write-Host "(주소 뒤에 /api 를 붙여야 합니다)"
