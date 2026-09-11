# 바깥에 내기 — 터널 하나로 화면과 서버를 같이

```
브라우저 ──▶ cloudflared 터널 ──▶ localhost:4173 (게임 화면, vite preview)
                                        │  /api 만
                                        ▼
                                   localhost:4000 (세이브 서버) ──▶ SQLite (dev.db)
```

예전 구성(GitHub Pages + 별도 터널)과 다른 점 하나: **화면과 서버가 같은 주소에 산다.**
그래서 CORS 설정도, 서버 주소를 적어두는 파일도 필요 없다. 주소를 정하는 곳은
`vite.config.ts` 의 프록시 하나뿐이다 — 둘이 되면 화면이 어느 서버를 보는지 아무도 모르게 된다.

대신 이 PC 가 꺼지면 게임 링크도 같이 죽는다. 예전 구성은 화면만은 살아 있었다.

## 켜기

```powershell
powershell -ExecutionPolicy Bypass -File scripts\serve-public.ps1
```

빌드 → 서버 → 화면 → 터널을 한 번에 띄우고 주소를 찍어 준다. 끄려면 그 창에서 Ctrl+C.

**주소는 켤 때마다 바뀐다.** `trycloudflare` 의 무료 터널이 그렇다. 고정하려면 Cloudflare
계정에 도메인을 붙이고 `cloudflared tunnel create` 로 이름 있는 터널을 만들어야 한다.

## 처음 한 번

```powershell
winget install --id Cloudflare.cloudflared
```

`server/.env` 의 `TRUST_PROXY` 가 **2** 여야 한다. 이 값은 앞에 선 프록시의 겹 수다
(cloudflared → vite 프록시 → 서버). 모자라면 모든 접속이 `::1` 한 명으로 보여서,
한 사람이 비밀번호를 틀리면 요청 제한이 **다음 사람까지 막는다.** 접속 기록의 IP 도 전부 같아진다.

터널 없이 이 PC 에서만 쓸 때는 0 으로 되돌린다.

## 자면 같이 잔다

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
```

노트북이면 덮개까지: 제어판 → 전원 옵션 → "덮개를 닫을 때 수행할 작업" → "아무 것도 안 함".

## 링크를 아는 사람은 누구나 들어온다

터널 주소는 무작위지만 공개 주소다. **"GitHub 참여자만" 을 링크로는 못 막는다** —
문은 게임의 아이디·비밀번호 로그인이다. 진짜로 사람을 가르려면 Cloudflare Access 를
붙여야 하고, 그건 계정과 도메인이 있어야 한다.

`/admin` 도 같은 주소에 같이 나간다. 관리자 키 하나가 새면 그게 곧 남의 세이브를
들여다보고 되돌리는 권한이다.

## 확인

1. 시크릿 창으로 주소를 연다 → 로그인 화면이 뜬다.
2. 계정을 만들어 베이스캠프에서 아무거나 하고 5초 → 저장 표시가 "저장됨".
   "로컬에는 보관됨" 이 뜨면 서버에 못 닿은 것이다.
3. `npm --prefix server run report` → 방금 그 계정이 접속 1회로 잡히는지.
   IP 가 `::1` 이면 `TRUST_PROXY` 가 2 가 아니다.

## 백업

세이브는 전부 `server/prisma/dev.db` 한 파일이다.

```bash
npx prisma db execute --stdin <<< "VACUUM INTO 'backup-$(date +%Y%m%d).db';"
```

서버 안에도 세이브 이력이 사람당 10판 쌓여서, 한 명이 실수로 덮어쓴 건 `/admin` 에서
되돌릴 수 있다. 파일 백업은 이 PC 자체가 고장 났을 때를 위한 것이다.
