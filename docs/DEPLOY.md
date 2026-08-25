# 배포 — 화면은 상시 호스팅, 서버는 노트북

## 구성

```
브라우저 ──▶ Cloudflare Pages          (게임 화면. 늘 살아 있다)
                 │
                 │ /server-config.json 이 가리키는 주소로
                 ▼
            Cloudflare Tunnel  ──▶  노트북의 localhost:4000  ──▶  SQLite (dev.db)
                                     (세이브 서버. 노트북이 켜져 있을 때만)
```

화면과 서버를 나눈 이유는 하나다. **노트북이 꺼져도 게임 링크는 살아 있어야 하기 때문**이다.
서버에 못 닿으면 게임은 브라우저 저장소만 쓰고 계속 돌아간다 — 저장 표시가
"서버 저장 실패 — 로컬에는 보관됨" 으로 바뀔 뿐이다. 노트북을 다시 켜고 창으로 돌아오면
쌓여 있던 변경이 자동으로 올라간다.

---

## 1. 서버 노트북 (한 번만)

Node.js 24 와 git 이 필요하다.

```bash
git clone <이 저장소> monster-rpg
cd monster-rpg
```

PowerShell 이면:

```powershell
.\server\setup.ps1
```

Git Bash / macOS / Linux 면:

```bash
bash server/setup.sh
```

의존성 설치 · `.env` 생성(JWT 키와 관리자 키를 랜덤으로 만든다) · DB 마이그레이션 · 빌드를
한 번에 한다. **화면에 찍히는 관리자 키를 적어 두세요** — `/admin` 페이지에서 쓴다.
`.env` 가 이미 있으면 건드리지 않는다(덮어쓰면 발급된 토큰이 전부 무효가 된다).

서버 실행:

```bash
npm --prefix server start
```

`http://localhost:4000/api/health` 가 `{"ok":true,"db":true}` 를 주면 정상이다.

### 노트북이 자면 서버도 잔다

심사 기간에는 절전을 꺼 두어야 한다.

```powershell
# 전원 연결 상태에서 대기 모드·화면 끄기 없음 (Windows)
powercfg /change standby-timeout-ac 0
powercfg /change monitor-timeout-ac 0
```

덮개를 닫아도 안 자게 하려면 제어판 → 전원 옵션 → "덮개를 닫을 때 수행할 작업" → "아무 것도 안 함".

---

## 2. 터널 열기

[cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
를 설치하고 **서버와 다른 창에서**:

```bash
cloudflared tunnel --url http://localhost:4000
```

`https://무작위-단어.trycloudflare.com` 같은 주소가 찍힌다. 이게 서버의 바깥 주소다.

> 이 주소는 **cloudflared 를 다시 켤 때마다 바뀐다.** 바뀌면 3단계의 `server-config.json` 만
> 고쳐 다시 올리면 된다(1분). 도메인을 Cloudflare 에 붙일 수 있으면
> `cloudflared tunnel create` 로 이름 있는 터널을 만들어 주소를 고정하는 편이 낫다.

---

## 3. 게임 화면 배포 (Cloudflare Pages)

`public/server-config.json` 의 `apiBase` 에 **2단계 주소 + `/api`** 를 넣는다.

```json
{
  "apiBase": "https://무작위-단어.trycloudflare.com/api"
}
```

빌드하고 올린다:

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=voyager-atelier
```

처음이면 `wrangler login` 으로 브라우저 로그인이 한 번 뜬다. 배포가 끝나면
`https://voyager-atelier.pages.dev` 같은 주소가 나온다 — **이게 제출할 링크다.**

마지막으로 서버 `.env` 의 `CORS_ORIGIN` 에 그 주소를 더하고 서버를 다시 띄운다.

```
CORS_ORIGIN="https://voyager-atelier.pages.dev,http://localhost:5173"
```

---

## 4. 연결 확인

1. 시크릿 창으로 Pages 주소를 연다.
2. **「바로 시작」 하나로 게임에 들어가진다** (로그인 화면에서 멈추면 안 된다 — 제출 규정 필수 조건).
3. 베이스캠프에서 아무 것이나 하고 5초쯤 기다린다 → 저장 표시가 "저장됨" 이 되는지.
4. 다른 브라우저(또는 다른 기기)에서 같은 주소를 열고 개발자 코드 → 「내 세이브로 입장」 →
   같은 진행이 보이는지.
5. 서버를 끄고 게임을 계속해 본다 → 멈추지 않고 "로컬에는 보관됨" 이 뜨는지.
   서버를 켜고 게임 창으로 돌아오면 다시 올라간다.

서버가 안 보이면 브라우저 콘솔에서 `[saveSync]` 로 시작하는 경고를 본다.
대개 CORS(3단계 마지막 줄) 아니면 `server-config.json` 의 주소 끝에 `/api` 를 안 붙인 경우다.

### 급할 때: 주소창으로 서버 갈아 끼우기

`https://…pages.dev/?api=https://새터널주소/api` 로 한 번 열면 그 브라우저는 계속 그 서버를 본다.
재배포 없이 확인만 하고 싶을 때 쓴다.

---

## 5. 관리자 페이지

`https://…pages.dev/admin` → 1단계에서 적어 둔 관리자 키를 넣는다.

- 계정 목록과 마지막 저장 시각
- 세이브 이력(사용자당 10판) 열람 · 되돌리기
- 세이브가 한 번도 안 올라온 익명 계정 청소

---

## 6. 백업

세이브는 전부 `server/prisma/dev.db` 한 파일에 있다. 노트북에서 하루 한 번:

```bash
# 실행 중에도 안전하게 뜬다
npx prisma db execute --stdin <<< "VACUUM INTO 'backup-$(date +%Y%m%d).db';"
```

또는 서버를 잠깐 끄고 `dev.db` 를 복사한다. 서버 안에 이미 세이브 이력이 10판씩 쌓이므로,
사람 한 명이 실수로 덮어쓴 건 관리자 페이지에서 되돌릴 수 있다. 파일 백업은 노트북 자체가
고장 났을 때를 위한 것이다.
