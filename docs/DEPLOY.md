# 배포 — 화면은 상시 호스팅, 서버는 노트북

## 구성

```
브라우저 ──▶ GitHub Pages              (게임 화면. 늘 살아 있다)
                 │
                 │ /server-config.json 이 가리키는 주소로
                 ▼
            Cloudflare Tunnel  ──▶  노트북의 localhost:4000  ──▶  SQLite (dev.db)
                                     (세이브 서버. 노트북이 켜져 있을 때만)
```

화면과 서버를 나눈 이유는 하나다. **노트북이 꺼져도 게임 링크는 살아 있어야 하기 때문**이다.
서버에 못 닿으면 게임은 브라우저 저장소만 쓰고 계속 돌아간다 — 저장 표시가
"서버 저장 실패 — 로컬에는 보관됨" 으로 바뀔 뿐이다. 노트북을 다시 켜고 창으로 돌아오면
쌓여 있던 변경이 자동으로 올라간다. 서버가 꺼져 있을 때 처음 들어온 사람도 마찬가지다 —
로컬 전용으로 게임을 하다가, 서버가 살아나면 화면이 알아서 계정을 받아 그동안의 진행을
올린다(`src/auth/offlineUpgrade.ts`). 링크를 받은 쪽은 새로고침조차 할 필요가 없다.

---

## 0. 남에게 열어 줄 때 — 명령 하나

1단계(설치)를 한 번 끝냈으면, 그다음부터는 이것만 켜 두면 된다.

```bash
npm run host
```

서버를 띄우고 · 터널을 열고 · **배포된 화면에 새 터널 주소를 알려 주기까지** 한다.
끝나면 보낼 주소가 찍힌다. 상대는 그 링크를 열고 「바로 시작」만 누르면 된다.

이게 있는 이유는 터널 주소가 켤 때마다 바뀌기 때문이다. 게임 화면은 **실행 중에**
`server-config.json` 을 읽으므로, 그 한 장만 Pages 에 올리면 붙는다 — 다시 빌드할 이유가 없다
(3초. 전체 재배포는 2분). 터널이 도중에 끊기면 다시 켜고 새 주소를 또 올린다.

Ctrl+C 로 서버와 터널이 함께 정리된다. 게임을 고쳐서 화면 자체를 다시 올려야 할 때만
3단계(`deploy:pages`)가 필요하다.

> `npm run host -- --no-tunnel` 은 서버만 띄운다(로컬 확인용).
> `-- --no-publish` 는 터널까지 열고 주소만 찍는다. `--` 를 빠뜨리면 npm 이 삼킨다.

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

`npm run host` 가 대신 해 준다(0단계). 손으로 할 때만 아래를 본다.

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

## 3. 게임 화면 배포 (GitHub Pages)

**배포 주소: https://amugeona0159.github.io/** — 이게 제출할 링크다.
저장소는 `amugeona0159/amugeona0159.github.io` 이고, `main` 브랜치의 최상위가 그대로 서비스된다.

Cloudflare Pages 대신 여기를 쓰는 이유는 계정이 하나도 더 필요 없어서다. GitHub 은
이미 쓰고 있고, `<계정>.github.io` 저장소는 **최상위 주소**로 나간다 — 하위 경로
(`/monster-rpg/`)로 올리면 코드에 박힌 `"/assets/..."` 절대경로 29곳이 전부 404 난다.

### 다시 올리기

**게임을 고쳤을 때** 돌린다. 터널 주소만 바뀐 거라면 `npm run host` 가 알아서 한다(0단계).

```bash
npm run deploy:pages
```

빌드 → `404.html`·`.nojekyll` 추가 → Pages 저장소에 푸시까지 한 번에 한다.
**지금 올라가 있는 서버 주소는 그대로 살려 둔다** — 게임을 고쳤다고 해서 붙어 있던 사람이
떨어지면 안 되니까. 주소를 같이 바꾸려면 인자로 준다.

```bash
node scripts/deploy-pages.mjs https://무작위-단어.trycloudflare.com/api
```

반영까지 보통 1~2분 걸린다(첫 배포는 더 걸린다).

> **저장소의 `public/server-config.json` 은 비워 둘 것.** 여기에 터널 주소를 적으면
> 개발 서버와 e2e 까지 그 주소를 보게 되어, 로컬 서버를 켜 두고도 아무 것도 안 붙는다.
> 실제 주소는 Pages 저장소의 사본에만 산다.

### 세 가지 손질이 들어가 있다

- **`404.html`** — GitHub Pages 는 SPA 폴백이 없다. `/forest` 에서 새로고침하면 404 가
  뜨므로 `index.html` 을 그대로 복사해 둔다. 이러면 라우터가 받아서 정상 화면이 뜬다.
- **`.nojekyll`** — Jekyll 처리를 끈다.
- **`/demo/`** — 제출용 플레이 영상. `design/submission/fullplay.webm` 을 배포할 때
  얹는다. `public/` 에 두지 않는 건 녹화 산출물이라 화면 코드와 수명이 다르고, 14MB 를
  dev 서버와 매 빌드가 다시 복사하기 때문이다. 재생 페이지는 `public/demo/index.html`
  이라 빌드에 들어간다 — 영상 파일만 옆에 놓이면 된다.

  ```
  https://amugeona0159.github.io/demo/                 재생 페이지
  https://amugeona0159.github.io/demo/fullplay.webm    파일 직접
  ```

  영상을 다시 찍었으면 같은 경로에 덮어쓰고 배포만 다시 하면 된다.
  녹화는 `npx playwright test --config design/submission.config.ts -g "fullplay:"`.

### 마지막으로 서버에 이 주소를 알려 준다

노트북의 `server/.env` 를 고치고 서버를 다시 띄운다. 안 하면 브라우저가 CORS 에서 막혀
저장이 조용히 안 된다. `npm run host` 는 켤 때마다 이 두 줄을 확인하고 모자라면 채운다 —
손으로 할 때만 아래를 본다.

```
CORS_ORIGIN="https://amugeona0159.github.io,http://localhost:5173,http://localhost:4173"
TRUST_PROXY=1
```

`TRUST_PROXY` 를 안 켜면 `req.ip` 가 터널의 IP 라, 요청 제한이 사람별이 아니라 전역으로 걸린다.
한 사람이 「바로 시작」을 몇 번 누르면 뒤에 온 사람이 막힌다.

**서버를 다시 띄울 때 포트를 먼저 비울 것.** 4000 을 쥔 프로세스가 남아 있으면 새 서버는
`EADDRINUSE` 로 죽고 옛 설정을 문 서버가 계속 돈다 — 화면상으로는 "고쳤는데 그대로"로 보인다.

> `npx wrangler` 를 이 저장소에서 돌리지 말 것. Vite 프로젝트를 감지해 `@cloudflare/vite-plugin`
> 을 설치하고 `vite.config.ts`·`package.json`·`.gitignore` 를 고쳐 놓는다. `server/.env` 의
> `CORS_ORIGIN` 까지 자기 주소로 덮어쓰고 원본을 `.env.bak` 으로 밀어낸다.

---

## 4. 연결 확인

1. 시크릿 창으로 `https://amugeona0159.github.io` 를 연다.
2. **「바로 시작」 하나로 게임에 들어가진다** (로그인 화면에서 멈추면 안 된다 — 제출 규정 필수 조건).
3. 베이스캠프에서 아무 것이나 하고 5초쯤 기다린다 → 저장 표시가 "저장됨" 이 되는지.
   여기서 "로컬에는 보관됨" 이 뜨면 CORS(3단계 마지막) 아니면 터널이 안 붙은 것이다.
4. 다른 브라우저(또는 다른 기기)에서 같은 주소를 열고 개발자 코드 → 「내 세이브로 입장」 →
   같은 진행이 보이는지.
5. 서버를 끄고 게임을 계속해 본다 → 멈추지 않고 "로컬에는 보관됨" 이 뜨는지.
   서버를 켜고 게임 창으로 돌아오면 다시 올라간다.

서버가 안 보이면 브라우저 콘솔에서 `[saveSync]` 로 시작하는 경고를 본다.
대개 CORS(3단계 마지막 줄) 아니면 `server-config.json` 의 주소 끝에 `/api` 를 안 붙인 경우다.

### 급할 때: 주소창으로 서버 갈아 끼우기

`https://amugeona0159.github.io/?api=https://새터널주소/api` 로 한 번 열면
그 브라우저는 계속 그 서버를 본다.
재배포 없이 확인만 하고 싶을 때 쓴다.

---

## 5. 관리자 페이지

`https://amugeona0159.github.io/admin` → 1단계에서 적어 둔 관리자 키를 넣는다.
관리 화면에는 **서버 주소 칸**도 있다. 터널 주소가 바뀌었을 때 여기에 넣으면 화면을 다시
배포하지 않고도 관리 화면만 새 서버에 붙는다(그 브라우저에만 저장된다).

「사용자」 탭
- 계정 목록과 마지막 저장 시각
- 세이브 이력(사용자당 10판) 열람 · 되돌리기
- 세이브가 한 번도 안 올라온 익명 계정 청소

「서버」 탭 — 보기 전용이다. 재시작·초기화 같은 조작은 일부러 없다. 이 화면은 공개 주소에
그대로 올라가므로, 관리자 키 하나가 새면 그게 곧 서버 조작 권한이 된다.
- 켜진 지 얼마나 됐는지, 어느 주소를 보고 있는지
- 세이브 파일 크기 · 계정 수(익명 포함) · 올라온 세이브와 보관된 이력 수 · 마지막 저장 시각

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
