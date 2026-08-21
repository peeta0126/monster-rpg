# Monster RPG

React, TypeScript, Phaser 기반의 몬스터 RPG 프로젝트입니다. 베이스캠프에서 전투, 숲 탐험, 몬스터 관리, 공방 제작 화면으로 이동하며 몬스터를 수집하고 성장시키는 브라우저 게임입니다.

## 주요 기능

- Phaser 기반 베이스캠프에서 캐릭터 이동 및 화면 전환
- 층 기반 몬스터 전투, 보스층, 경험치와 레벨업
- 몬스터 포획, 도감 기록, 파티와 보관함 관리
- 숲 탐험을 통한 몬스터 조우 및 재료 획득
- 농장 화면에서 파티/보관함, 재료, 물약, 제작 아이템 관리
- 공방 화면에서 물약과 아티팩트 제작
- 가위바위보, 방향키 입력 미니게임을 통한 제작 품질 결정
- 아티팩트 장착, 강화, 보너스 스탯 관리
- Zustand persist 기반 로컬 저장
- 로그인/회원가입 또는 게스트 모드로 시작, 로그인 시 서버와 세이브 자동 동기화

## 실행 방법

### 요구 사항

- Node.js
- npm

### 설치

프론트엔드와 백엔드(`server/`)는 별도의 `package.json`을 가진 독립된 프로젝트라 각각 설치해야 합니다.

```bash
# 프론트엔드 (루트)
npm install

# 백엔드
npm --prefix server install
```

`server`의 설치는 `postinstall` 스크립트로 `prisma generate`를 자동 실행해 Prisma Client를 생성합니다.

### 환경 변수 설정

백엔드는 `server/.env.example`을 복사한 `server/.env`가 있어야 실행됩니다.

```bash
cp server/.env.example server/.env
```

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | SQLite 파일 경로입니다. 기본값 `file:./dev.db`를 그대로 쓰면 됩니다. |
| `JWT_SECRET` | 로그인 토큰 서명용 비밀키입니다. **반드시 긴 랜덤 문자열로 교체하세요.** |
| `JWT_EXPIRES_IN` | 토큰 만료 기간입니다 (예: `7d`). |
| `PORT` | 백엔드 서버 포트입니다. 기본값은 `4000`입니다. |
| `CORS_ORIGIN` | 요청을 허용할 프론트엔드 주소입니다 (예: `http://localhost:5173`). |
| `ADMIN_SECRET` | `/admin` 페이지 접속용 비밀키입니다. 플레이어 로그인과는 무관하며, 값을 설정하지 않으면 관리자 라우트는 항상 401을 반환합니다. **반드시 교체하세요.** |

### 데이터베이스 준비

`server/prisma/migrations`에 있는 마이그레이션을 SQLite DB에 적용합니다. DB 파일(`server/prisma/dev.db`)은 `.gitignore` 대상이라 저장소에 없으므로, 클론 직후에는 아래 명령으로 직접 생성해야 합니다.

```bash
cd server
npx prisma migrate deploy
```

`migrate deploy`는 이미 작성된 마이그레이션을 그대로 적용만 하는 명령으로, 클론 직후처럼 스키마를 새로 설계하지 않는 상황에 맞습니다 (`migrate dev`는 마이그레이션을 새로 만들거나 로컬에서 스키마를 변경할 때 씁니다).

### 개발 서버 실행

```bash
npm run dev:all
```

프론트엔드(Vite, `http://localhost:5173`)와 백엔드(`http://localhost:4000`)를 `concurrently`로 함께 띄웁니다. 평소에는 이 명령을 사용하면 됩니다.

필요하면 둘을 따로 띄울 수도 있습니다.

```bash
npm run dev         # 프론트엔드만 (Vite)
npm run dev:server  # 백엔드만
```

백엔드 없이 `npm run dev`만 띄워도 로그인 화면에서 "게스트로 시작"을 선택하면 서버 없이 바로 플레이할 수 있습니다. 이 경우 진행 상태는 로컬 저장소에만 저장됩니다.

### 프로덕션 빌드

```bash
npm run build
```

### 빌드 결과 미리보기

```bash
npm run preview
```

### 린트

```bash
npm run lint
```

## 화면 경로

| 경로 | 화면 | 설명 |
|---|---|---|
| `/` | BaseCamp | 시작 화면입니다. 캐릭터를 이동해 전투, 숲, 공방으로 진입합니다. |
| `/battle` | Battle | 층 기반 몬스터 전투 화면입니다. 기술, 방어, 교체, 물약 사용, 도망을 처리합니다. 몬스터 포획은 숲에서만 합니다. |
| `/forest` | Forest | 숲 탐험 화면입니다. 몬스터 조우와 재료 획득이 일어납니다. |
| `/farm` | Farm | 파티, 보관함, 도감, 재료, 물약, 제작품을 관리합니다. |
| `/monsters` | Monsters | 몬스터 목록과 관련 정보를 확인합니다. |
| `/workshop` | Workshop | 물약과 아티팩트를 제작하는 공방 화면입니다. |
| `/ending` | Ending | 엔딩 화면입니다. |
| `/admin` | Admin | 관리자 페이지입니다. `ADMIN_SECRET`으로 보호되며 플레이어 로그인과는 별개입니다. |

기본 이동은 `WASD` 또는 방향키를 사용합니다. 베이스캠프에서는 특정 위치에 접근해 다른 화면으로 이동합니다.

로그인하지 않은 상태(세션 없음)로 위 경로에 접근하면 `/admin`을 제외한 모든 경로에서 로그인 화면이 먼저 표시됩니다. 로그인, 회원가입, 게스트로 시작 중 하나를 선택해야 게임 화면으로 진입합니다.

## 기술 스택

**프론트엔드**
- React 19
- TypeScript
- Vite 7
- Phaser 3
- React Router 7
- Zustand
- Tailwind CSS 4
- ESLint 9

**백엔드** (`server/`)
- Express
- Prisma + SQLite
- JWT (`jsonwebtoken`)
- bcryptjs (비밀번호 해시)
- cors, dotenv
- tsx (개발 서버 실행기)

## 프로젝트 구조

```txt
monster-rpg/
├─ public/
│  ├─ favicon-32.png      # art-src/voyager-atelier-logo.png 에서 굽는다
│  ├─ apple-touch-icon.png
│  └─ assets/
│     ├─ basecamp/        # 베이스캠프 배경 이미지
│     ├─ monsters/        # Phaser와 React에서 사용하는 몬스터 이미지
│     └─ player/          # 플레이어 방향별 스프라이트
├─ src/
│  ├─ assets/
│  │  ├─ icons/           # 탭 UI 아이콘
│  │  ├─ materials/       # 재료 SVG 아이콘
│  │  └─ potions/         # 물약 SVG 아이콘
│  ├─ battle/             # 전투 화면, Phaser 전투 씬, 전투 계산 로직
│  ├─ camp/               # 베이스캠프/숲 화면과 Phaser 베이스캠프 씬
│  ├─ monster/            # 몬스터 데이터, 기술 데이터, 농장/몬스터 화면
│  ├─ shared/             # 공용 게임 타입, 아이템, 제작, 저장소, Phaser 공통 설정
│  │  └─ phaser/          # Phaser 이벤트 버스와 공통 설정
│  ├─ workshop/           # 공방 화면, 제작 모달, 미니게임 컴포넌트
│  ├─ auth/               # 로그인/회원가입 화면, 인증 상태, 서버 세이브 동기화
│  ├─ admin/              # 관리자 페이지
│  ├─ App.tsx             # 라우팅 정의
│  ├─ main.tsx            # React 진입점
│  └─ index.css           # 전역 스타일
├─ server/                # 인증/세이브 동기화 백엔드 (Express + Prisma)
│  ├─ prisma/
│  │  ├─ schema.prisma    # User, SaveData 모델 정의
│  │  └─ migrations/      # DB 마이그레이션
│  ├─ src/
│  │  ├─ routes/          # auth.ts(회원가입/로그인), save.ts(세이브 동기화), admin.ts
│  │  ├─ middleware/      # auth.ts(JWT 검증), admin.ts(ADMIN_SECRET 검증)
│  │  ├─ env.ts           # 환경 변수 로드/검증
│  │  ├─ prismaClient.ts  # Prisma Client 인스턴스
│  │  └─ index.ts         # Express 앱 진입점
│  ├─ .env.example        # 환경 변수 템플릿
│  └─ package.json
├─ index.html
├─ package.json
├─ vite.config.ts
├─ eslint.config.js
└─ tsconfig*.json
```

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/App.tsx` | React Router 경로를 정의합니다. |
| `src/camp/BaseCampPage.tsx` | 베이스캠프 화면을 렌더링합니다. |
| `src/camp/BaseCampScene.ts` | Phaser 베이스캠프 씬과 이동/전환 로직을 담당합니다. |
| `src/battle/BattlePage.tsx` | 전투 UI와 전투 흐름을 담당합니다. |
| `src/battle/BattleScene.ts` | Phaser 전투 씬입니다. |
| `src/battle/battleUtils.ts` | 피해 계산, 상태 이상, 포획, AI 행동, 경험치 처리를 담당합니다. |
| `src/battle/typeChart.ts` | 타입 상성표입니다. |
| `src/shared/floorTable.ts` | 층별 몬스터, 보스, 보상 정보를 정의합니다. |
| `src/monster/monsters.ts` | 몬스터 기본 데이터와 진화 정보를 정의합니다. |
| `src/monster/moves.ts` | 전투 기술 데이터를 정의합니다. |
| `src/monster/learnset.ts` | 몬스터별 레벨업 기술 습득 정보를 정의합니다. |
| `src/shared/items.ts` | 재료와 물약 데이터를 정의합니다. |
| `src/shared/crafting.ts` | 제작 타입, 품질, 아티팩트/물약 제작 결과 타입을 정의합니다. |
| `src/shared/craftingUtils.ts` | 제작 품질, 아티팩트 스탯, 강화 관련 계산을 담당합니다. |
| `src/workshop/craftingRecipes.ts` | 공방 제작 레시피를 정의합니다. |
| `src/shared/playerStore.ts` | Zustand 기반 플레이어 진행 상태를 저장합니다. |
| `src/shared/phaser/events.ts` | React와 Phaser 사이의 이벤트 통신을 담당합니다. |
| `src/shared/phaser/phaserConfig.ts` | Phaser 공통 설정을 정의합니다. |
| `src/shared/phaser/sceneErrorHandler.ts` | Phaser 씬 진입점(create/update/이벤트 핸들러)의 예외를 잡아 React 쪽으로 전달합니다. |
| `src/shared/ErrorBoundary.tsx` | 렌더링 중 발생한 예외를 잡아 폴백 화면을 보여주는 최상위 에러 바운더리입니다. |
| `src/shared/AppErrorBridge.tsx` | Phaser 씬/전역에서 발생한 예외를 `ErrorBoundary`로 전달합니다. |
| `src/auth/AuthGate.tsx` | 세션 여부에 따라 로그인 화면 또는 실제 앱을 보여줍니다. |
| `src/auth/authStore.ts` | 로그인 토큰, 게스트 여부 등 인증 상태를 Zustand persist로 관리합니다. |
| `src/auth/useSaveSync.ts` | 로그인 시 서버 세이브를 불러오고, 이후 변경사항을 서버에 업로드합니다. |
| `src/auth/api.ts` | 백엔드 인증/세이브 API 호출을 담당합니다. |
| `server/src/index.ts` | Express 앱 진입점입니다. |
| `server/src/routes/auth.ts` | 회원가입/로그인 라우트입니다. |
| `server/src/routes/save.ts` | 세이브 데이터 조회/저장 라우트입니다. |
| `server/prisma/schema.prisma` | `User`, `SaveData` 모델을 정의합니다. |

## 상태 저장

플레이어 진행 상태는 `src/shared/playerStore.ts`에서 Zustand로 관리하며 `persist` 미들웨어를 사용합니다. 브라우저 로컬 스토리지 키는 `monster-rpg-player`입니다.

저장되는 주요 데이터는 파티, 보관함, 도감, 재료, 물약, 최고 도달 층, 제작 아이템, 아티팩트, 장착 아티팩트입니다. 저장 데이터 구조가 바뀐 경우를 대비해 재수화 시 누락된 배열과 객체를 기본값으로 보정합니다 (`normalizeState`).

로그인 여부에 따라 저장 방식이 달라집니다.

- **게스트**: 로컬 스토리지에만 저장됩니다. 서버와 통신하지 않습니다.
- **로그인 사용자**: 로그인(토큰 발급) 시 서버에 저장된 세이브가 있으면 불러와 적용하고, 없으면 현재 로컬 상태를 서버에 업로드합니다. 이후 상태가 바뀔 때마다 4초 동안 추가 변경이 없으면 서버에 업로드합니다(`src/auth/useSaveSync.ts`). 서버와 통신하지 못해도 로컬 저장은 항상 별도로 유지되므로, 오프라인이 되어도 진행이 끊기지 않고 다음 변경 시 다시 동기화를 시도합니다. 서버/로컬 어느 쪽에서 불러오든 `normalizeState`로 동일하게 보정됩니다.

## 개발 참고

- Phaser에서 직접 로드하는 정적 이미지는 `public/assets` 아래에 둡니다.
- React 컴포넌트에서 import하는 아이콘과 SVG는 `src/assets` 아래에 둡니다.
- 전투 관련 코드는 `src/battle`, 몬스터 데이터는 `src/monster`, 공용 타입과 저장소는 `src/shared`에 있습니다.
- 공방 제작 UI와 미니게임은 `src/workshop`에 있습니다.
- 기존 저장 데이터 때문에 테스트가 꼬이면 브라우저 로컬 스토리지의 `monster-rpg-player` 값을 삭제하고 새로 시작할 수 있습니다.