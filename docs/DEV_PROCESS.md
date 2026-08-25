# 개발 과정 — AI 도구를 어디에 어떻게 썼나

이 저장소는 **Claude Code** 로 작업했다. 아래는 실제로 있었던 일만 적은 것이다.
제출 폼에 「AI 도구 활용」류 항목을 쓸 때 여기서 가져다 쓰면 된다.

> Codex 로 진행한 작업은 아직 없다. 쓰게 되면 맨 아래 절에 따로 적는다 —
> 두 도구를 섞어 적으면 어느 쪽이 뭘 했는지 나중에 아무도 구분 못 한다.

---

## 1. 어디에 썼는가

| 영역 | 한 일 |
|---|---|
| 구조 파악·원인 진단 | 세이브가 기기마다 갈리는 원인을 코드에서 짚어냄 (아래 3절) |
| 백엔드 | 익명 계정 발급, 판 번호 기반 충돌 처리, 세이브 이력, 운영용 미들웨어 |
| 프론트 | 「바로 시작」 진입, 동기화 훅 재작성, 개발자 모드 분기, 계정 연결 화면 |
| 테스트 | 서버 통합 테스트 20개, e2e 3개, 마이그레이션 테스트 3개, CI 에 서버 job |
| 문서·산출물 | 배포 절차서, 제출 문서, 16:9 썸네일 생성 스펙, 데모 영상 녹화 스펙 |
| 밸런스 | **안 씀.** 숫자는 `scripts/sim/` 시뮬레이션 결과로 정한다 |

## 2. 무엇을 구현했는가

**서버** (`server/`)
- `src/routes/auth.ts` — `POST /auth/anon`(아이디 없이 계정 발급 + 복구용 비밀번호 반환),
  `POST /auth/link`(익명 → 정식 계정), `GET /auth/me`
- `src/routes/save.ts` — `revision` 기반 낙관적 동시성, 409 응답에 서버 세이브 동봉,
  덮이기 전 세이브를 `SaveHistory` 에 10판 보관
- `src/routes/admin.ts` — 이력 열람·되돌리기, 빈 익명 계정 청소
- `src/app.ts` 분리(테스트가 `listen` 없이 붙게), DB ping 헬스체크, 종료 처리,
  다중 CORS 오리진, 세이브 요청 제한, `trust proxy`
- `prisma/schema.prisma` — `User.isAnonymous`, `SaveData.version/revision`, `SaveHistory` 추가

**클라이언트** (`src/`)
- `auth/anonSession.ts` — 「바로 시작」. 서버에 못 닿으면 로컬 전용으로 폴백
- `auth/useSaveSync.ts` — 창 복귀 시 갱신, 창 닫을 때 `keepalive` 업로드, 충돌 시 서버 우선 반영,
  지수 백오프 재시도, 숲 원정 중 내려받기 차단
- `auth/DevCodeModal.tsx` — 「내 세이브로 입장」/「테스트 프리셋으로 입장」 분기
- `auth/LinkAccountModal.tsx` — 익명 계정에 아이디 붙이기
- `shared/apiBase.ts` — API 주소를 런타임에 결정(`/server-config.json`)
- `shared/playerStore.ts` — `migrateSave`·`PERSIST_VERSION` 공개(서버 세이브도 마이그레이션을 타게)

**검증**
- `server/tests/api.test.ts` 20개, `e2e/saveSync.spec.ts` 3개(두 기기 충돌 포함),
  `tests/saveMigration.test.ts` 3개 추가, `.github/workflows/ci.yml` 에 server job

## 3. 어떤 문제를 풀었는가

**진단이 이 작업의 절반이었다.** "서버를 만들어 달라"는 요청이었는데 서버는 이미 있었다.
갈린 원인은 셋이었고, 코드를 읽어야만 나오는 것들이었다.

1. `enterDevMode()` 가 `token: null · isGuest: true` 로 들여보내서, `useSaveSync` 의
   `if (isGuest || !token) return;` 에 걸려 **개발자 모드로 논 진행은 한 번도 서버에 안 올라갔다.**
2. 개발자 모드 입장이 `loadDevPreset()` 으로 세이브를 통째로 덮었다.
3. 서버가 `localhost:4000` 에만 있고 배포 설정이 저장소에 하나도 없었다.

작업 중에 걸린 것들:

- **`/api-config.json` 이 개발 중에만 404 였다.** vite 개발 서버가 `/api` 로 시작하는 요청을
  전부 백엔드로 넘긴다. `/server-config.json` 으로 옮겨 해결.
- **업로드가 도는 중에 생긴 변경이 유실됐다.** `inFlight` 면 그냥 반환하는 구조라, 그 사이 변경은
  다음 변경이 생길 때까지 안 올라갔다. 스냅샷을 뜬 직후에 dirty 를 내리고, 진행 중이면 짧게
  재시도를 걸도록 고쳤다.
- **테스트가 `dev.db` 를 공유해 "이력 10판" 검사가 흔들렸다.** 전용 `test.db` 를 매번 새로 만들게 했다.
- 데모 영상을 1280×720 으로 찍었더니 전투 화면 위아래가 까맣게 남았다. 캔버스 540 + 아래 패널이
  들어가는 최소 16:9 크기(1440×810)로 찍고 720p 로 줄였다.

## 4. 사람이 결정한 지점

도구가 정할 수 없는 것들이고, 전부 물어서 정했다.

- **충돌은 서버가 이긴다** — 대신 덮이기 전 10판을 남겨 되돌릴 수 있게 했다.
- **로그인 없이 들어갈 수 있어야 한다** — 대신 그 진입도 서버 계정(익명)을 쓴다.
  "로컬 전용" 경로를 없애야 기기별 어긋남이 원천적으로 사라지기 때문.
- **개발자 프리셋은 동기화하지 않는다** — 프리셋이 세이브를 갈아치우므로 올리면 진짜 세이브를 덮는다.
- **화면은 상시 호스팅, 서버는 노트북 + 터널** — 노트북이 꺼져도 게임 링크가 살아 있게.
- 밸런스 숫자는 AI 가 정하지 않는다. `scripts/sim/gateCheck.ts` 의 합격선이 정한다.

---

## Codex 로 한 작업

*(아직 없다. 실제로 돌린 뒤에 여기에 적는다 — 무엇을 맡겼고, 어디서 막혔고, 사람이 뭘 정했는지.)*

Codex 에 넘기기 좋은, 설계가 끝났고 구현만 남은 것들:

| 작업 | 손댈 곳 | 확인 방법 |
|---|---|---|
| 26~49층 고정 구성 | `src/monster/floorTable.ts` | `npx tsx scripts/sim/gateCheck.ts` 합격선 |
| 모바일 조작 | `src/camp/BaseCampScene.ts` · `shared/ui/ControlHint.tsx` | `npm run design:responsive` (390×844) |
| 세이브 크기 줄이기 | `playerStore` 의 `Move[]` 를 `moveIds` 로 | `PERSIST_VERSION` 올리고 마이그레이션 |

어느 쪽이든 아래를 지나가야 한다 — 이 저장소의 검증선이다.

```bash
npm run lint && npx tsc -b && npm --prefix server run typecheck
npm test && npm --prefix server test
```
