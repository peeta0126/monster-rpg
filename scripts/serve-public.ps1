# 게임을 바깥에 낸다. 터널 하나로 화면과 서버를 같이 내보내므로 화면이 서버와 같은
# 주소에 살고, 그래서 CORS 도 주소를 적어두는 파일도 필요 없다 — /api 는 vite 프록시가
# 4000 으로 넘긴다. 주소를 정하는 곳은 vite.config.ts 하나뿐이다.
#
#   powershell -ExecutionPolicy Bypass -File scripts\serve-public.ps1
#
# 끄려면 이 창에서 Ctrl+C. 창을 닫으면 세 프로세스가 같이 죽는다.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cloudflared = @(
  "C:\Program Files (x86)\cloudflared\cloudflared.exe",
  "C:\Program Files\cloudflared\cloudflared.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cloudflared) {
  Write-Host "cloudflared 가 없다. 먼저: winget install --id Cloudflare.cloudflared" -ForegroundColor Red
  exit 1
}

# 포트를 먼저 비운다. 4000 을 쥔 프로세스가 남아 있으면 새 서버는 EADDRINUSE 로 죽고
# 옛 설정을 문 서버가 계속 도는데, 화면상으로는 "고쳤는데 그대로" 로만 보인다.
foreach ($port in 4000, 4173) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      Write-Host "포트 $port 을 쥔 프로세스 $_ 종료"
      Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}

$logDir = Join-Path $env:TEMP "monster-rpg-serve"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$tunnelLog = Join-Path $logDir "tunnel.log"
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

Write-Host "`n빌드 중..." -ForegroundColor Cyan
npm run build            | Out-Null
npm --prefix server run build | Out-Null

Write-Host "세이브 서버 (:4000)" -ForegroundColor Cyan
$server = Start-Process npm -ArgumentList "--prefix", "server", "start" -PassThru -NoNewWindow

Write-Host "게임 화면 (:4173)" -ForegroundColor Cyan
$preview = Start-Process npm -ArgumentList "run", "preview", "--", "--host", "--port", "4173" -PassThru -NoNewWindow

Write-Host "터널 여는 중..." -ForegroundColor Cyan
$tunnel = Start-Process $cloudflared `
  -ArgumentList "tunnel", "--url", "http://localhost:4173", "--no-autoupdate" `
  -PassThru -NoNewWindow -RedirectStandardError $tunnelLog -RedirectStandardOutput "$logDir\tunnel.out"

# 주소는 켤 때마다 바뀐다. 로그에 찍힐 때까지 기다렸다가 꺼내 준다.
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Milliseconds 500
  if (Test-Path $tunnelLog) {
    $m = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}

if (-not $url) {
  Write-Host "`n터널 주소를 못 찾았다. 로그: $tunnelLog" -ForegroundColor Red
} else {
  Write-Host "`n======================================================" -ForegroundColor Green
  Write-Host "  게임 주소 : $url" -ForegroundColor Green
  Write-Host "  관리 화면 : $url/admin" -ForegroundColor Green
  Write-Host "======================================================" -ForegroundColor Green
  Write-Host "  이 주소는 켤 때마다 바뀐다. 끄려면 Ctrl+C.`n"
}

try {
  Wait-Process -Id $tunnel.Id
} finally {
  foreach ($p in $server, $preview, $tunnel) {
    if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
  }
}
