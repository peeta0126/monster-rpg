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

## 실행 방법

### 요구 사항

- Node.js
- npm

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

Vite가 출력하는 로컬 주소로 접속합니다. 기본 주소는 보통 `http://localhost:5173`입니다.

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
| --- | --- | --- |
| `/` | BaseCamp | 시작 화면입니다. 캐릭터를 이동해 전투, 숲, 공방으로 진입합니다. |
| `/battle` | Battle | 층 기반 몬스터 전투 화면입니다. 공격, 교체, 물약 사용, 포획을 처리합니다. |
| `/forest` | Forest | 숲 탐험 화면입니다. 몬스터 조우와 재료 획득이 일어납니다. |
| `/farm` | Farm | 파티, 보관함, 도감, 재료, 물약, 제작품을 관리합니다. |
| `/monsters` | Monsters | 몬스터 목록과 관련 정보를 확인합니다. |
| `/workshop` | Workshop | 물약과 아티팩트를 제작하는 공방 화면입니다. |
| `/housing` | Workshop | 현재는 공방 화면과 같은 컴포넌트로 연결되어 있습니다. |

기본 이동은 `WASD` 또는 방향키를 사용합니다. 베이스캠프에서는 특정 위치에 접근해 다른 화면으로 이동합니다.

## 기술 스택

- React 19
- TypeScript
- Vite 7
- Phaser 3
- React Router 7
- Zustand
- Tailwind CSS 4
- ESLint 9

## 프로젝트 구조

```text
monster-rpg/
├─ public/
│  ├─ vite.svg
│  └─ assets/
│     ├─ basecamp/        # 베이스캠프 배경 이미지
│     ├─ housing/         # 공방/하우징 배경 이미지
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
│  ├─ App.tsx             # 라우팅 정의
│  ├─ main.tsx            # React 진입점
│  └─ index.css           # 전역 스타일
├─ index.html
├─ package.json
├─ vite.config.ts
├─ eslint.config.js
└─ tsconfig*.json
```

## 주요 파일

| 파일 | 역할 |
| --- | --- |
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

## 상태 저장

플레이어 진행 상태는 `src/shared/playerStore.ts`에서 Zustand로 관리하며 `persist` 미들웨어를 사용합니다. 브라우저 로컬 스토리지 키는 `monster-rpg-player`입니다.

저장되는 주요 데이터는 파티, 보관함, 도감, 재료, 물약, 최고 도달 층, 제작 아이템, 아티팩트, 장착 아티팩트입니다. 저장 데이터 구조가 바뀐 경우를 대비해 재수화 시 누락된 배열과 객체를 기본값으로 보정합니다.

## 개발 참고

- Phaser에서 직접 로드하는 정적 이미지는 `public/assets` 아래에 둡니다.
- React 컴포넌트에서 import하는 아이콘과 SVG는 `src/assets` 아래에 둡니다.
- 전투 관련 코드는 `src/battle`, 몬스터 데이터는 `src/monster`, 공용 타입과 저장소는 `src/shared`에 있습니다.
- 공방 제작 UI와 미니게임은 `src/workshop`에 있습니다.
- 기존 저장 데이터 때문에 테스트가 꼬이면 브라우저 로컬 스토리지의 `monster-rpg-player` 값을 삭제하고 새로 시작할 수 있습니다.
