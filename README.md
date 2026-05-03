# Monster RPG

React, TypeScript, Phaser를 기반으로 만든 웹 몬스터 RPG 프로젝트입니다. 플레이어는 베이스캠프를 중심으로 탐험, 전투, 포획, 파티 관리, 물약 제작, 하우징 꾸미기를 진행하며 몬스터와 재화를 수집합니다.

## 주요 기능

- 베이스캠프에서 캐릭터를 이동하며 던전, 숲, 집으로 진입
- 층 기반 전투와 보스층, 경험치 획득, 레벨업, 재료 드롭
- 몬스터 포획, 도감 등록, 파티/보관함 관리
- 숲 탐험을 통한 몬스터 조우, 가위바위보 기반 포획, 재료 획득
- 농장 화면에서 몬스터 관리, 물약 인벤토리 확인, 물약 제작, 파티 HP 회복
- 하우징 화면에서 가구 제작/배치/회전/제거, 벽지/바닥/벽장식 커스터마이징
- 하우징 세트 효과를 통한 전투 및 성장 보너스 적용
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

실행 후 터미널에 표시되는 Vite 주소로 접속합니다. 기본적으로 `http://localhost:5173`에서 실행됩니다.

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

## 조작 및 화면 흐름

| 경로 | 화면 | 설명 |
| --- | --- | --- |
| `/` | Basecamp | 시작 화면입니다. 플레이어를 이동해 던전, 숲, 집으로 진입하고 도감을 열 수 있습니다. |
| `/battle` | Battle | 층 기반 몬스터 전투 화면입니다. 스킬, 파티 교체, 물약 사용, 조건부 포획을 처리합니다. |
| `/forest` | Forest | 탐험 구역을 선택해 몬스터와 조우하거나 재료를 얻습니다. 포획은 가위바위보 결과에 따라 확률이 달라집니다. |
| `/farm` | Farm | 파티와 보관함을 관리하고, 보유 물약/재료를 확인하며 물약을 제작합니다. |
| `/housing` | Housing | 방을 이동하고 가구, 벽지, 바닥, 벽장식을 편집합니다. |

기본 이동은 `WASD` 또는 방향키를 사용합니다. 베이스캠프와 하우징의 문 근처에서는 `E`로 상호작용합니다. 베이스캠프에서는 `P`로 도감을 열 수 있습니다.

## 기술 스택

- React 19
- TypeScript
- Vite
- Phaser 3
- React Router
- Zustand
- Tailwind CSS 4
- ESLint

## 프로젝트 구조

```text
monster-rpg/
├─ public/
│  └─ assets/                 # Phaser에서 직접 로드하는 공개 이미지 리소스
├─ src/
│  ├─ assets/                 # React 번들에서 import하는 이미지 리소스
│  ├─ components/
│  │  └─ rps/                 # 숲 포획용 가위바위보 UI
│  ├─ constants/              # 하우징 방 크기, 문 위치 등 상수
│  ├─ data/                   # 몬스터, 기술, 아이템, 가구, 층 테이블 등 게임 데이터
│  ├─ game/
│  │  └─ phaser/              # Phaser 게임 생성, 이벤트, 씬, 위치/전투 초기화 저장소
│  ├─ pages/                  # 라우트별 React 화면
│  ├─ store/                  # 플레이어 상태 저장소
│  ├─ types/                  # 게임/하우징 타입 정의
│  ├─ utils/                  # 전투 계산, 아이소메트릭 배치 유틸
│  ├─ App.tsx                 # 라우팅 정의
│  └─ main.tsx                # React 진입점
├─ package.json               # 스크립트와 의존성
├─ vite.config.ts             # Vite 설정
└─ tsconfig*.json             # TypeScript 설정
```

## 주요 시스템

### Basecamp

`src/pages/BaseCampPage.tsx`와 `src/game/phaser/scenes/BaseCampScene.ts`가 담당합니다. Phaser 씬에서 배경 맵, 플레이어 이동, 충돌 영역, 포털 근접 판정을 처리하고, 이벤트를 통해 React 라우터로 화면을 전환합니다.

- 던전 입구: 전투 화면으로 이동
- 숲 입구: 숲 탐험 화면으로 이동
- 집 입구: 하우징 화면으로 이동
- `P` 또는 화면 버튼: 몬스터 도감 모달 열기

### Battle

`src/pages/BattlePage.tsx`, `src/utils/battle.ts`, `src/data/floorTable.ts`가 핵심입니다. 전투 화면은 React UI와 Phaser 전투 씬을 함께 사용하며, 전투 계산은 유틸 함수로 분리되어 있습니다.

- 층 번호에 따라 적 몬스터와 레벨이 결정됩니다.
- 10층 단위는 보스층으로 처리됩니다.
- 스킬 명중, 타입 상성, 상태이상, 공격 버프, AI 행동 선택을 계산합니다.
- 승리 시 경험치, 레벨업, 재료 드롭, 최고 도달 층 기록이 반영됩니다.
- 포획 가능 구역에서는 적 HP가 30% 이하일 때 포획을 시도할 수 있습니다.
- 하우징 보너스가 HP, 공격, 방어, 속도, 경험치, 포획률, 물약 효과 등에 적용됩니다.

### Housing

`src/pages/HousingPage.tsx`, `src/utils/isometric.ts`, `src/data/furniture.ts`, `src/data/wallpapers.ts`, `src/data/floorTiles.ts`, `src/data/wallDecorations.ts`가 담당합니다.

- 아이소메트릭 방에서 플레이어를 이동합니다.
- 편집 모드에서 가구를 선택해 타일에 배치하고, 기존 가구를 이동/회전/제거합니다.
- 벽지, 바닥 타일, 벽장식을 제작하거나 적용합니다.
- 배치 가능 여부는 방 범위, 점유 타일, 회전 크기, 가구별 최대 배치 수를 기준으로 검증됩니다.
- 가구 세트에 따라 전투와 성장에 영향을 주는 보너스가 계산됩니다.

### Monster

몬스터 데이터는 `src/data/monsters.ts`에 정의되어 있고, 전투용 확장 상태는 `src/utils/battle.ts`에서 생성됩니다. 플레이어가 소유한 몬스터는 `src/store/playerStore.ts`의 `OwnedMonster` 형태로 관리됩니다.

- 기본 능력치: HP, 공격, 방어, 속도
- 타입: fire, water, grass, electric, ice, normal, poison
- 기술 목록과 레벨, 경험치, 다음 레벨 경험치
- 진화 체인 정보
- 파티 최대 3마리, 보관함 최대 30마리
- 도감은 발견 목록과 포획 목록을 별도로 저장합니다.

### Inventory

인벤토리는 별도 파일 하나가 아니라 `usePlayerStore`에 저장되는 여러 상태와 Farm/Housing UI가 함께 구성합니다.

- `materials`: 숲 탐험과 전투 보상으로 얻는 제작 재료
- `potions`: 제작하거나 전투에서 사용하는 물약
- `furnitureInventory`: 제작한 가구 보유 수량
- `wallDecoInventory`: 제작한 벽장식 보유 수량
- `unlockedWallpapers`, `unlockedFloorTiles`: 해금된 벽지와 바닥 타일

물약 제작은 `src/data/items.ts`의 레시피를 사용하고, 가구/하우징 제작은 `src/data/furniture.ts` 및 하우징 데이터 파일의 레시피를 사용합니다.

## 상태 저장

플레이어 진행도는 `src/store/playerStore.ts`에서 Zustand로 관리하며 `persist` 미들웨어를 사용합니다. 브라우저 로컬 스토리지 키는 `monster-rpg-player`입니다.

저장되는 주요 데이터는 파티, 보관함, 도감, 재료, 물약, 최고 층, 가구 인벤토리, 배치된 가구, 벽지/바닥/벽장식 상태입니다. 저장 데이터 구조가 바뀐 경우를 대비해 일부 하우징 데이터 마이그레이션 로직도 포함되어 있습니다.

## 주요 데이터 파일

| 파일 | 역할 |
| --- | --- |
| `src/data/monsters.ts` | 몬스터 기본 데이터와 진화 정보 |
| `src/data/moves.ts` | 전투 기술 정의 |
| `src/data/typeChart.ts` | 타입 상성표 |
| `src/data/learnset.ts` | 몬스터별 레벨업 기술 습득 정보 |
| `src/data/floorTable.ts` | 층별 적 등장, 보스, 레벨 스케일링 |
| `src/data/items.ts` | 재료와 물약 레시피/효과 |
| `src/data/furniture.ts` | 가구 제작, 배치 속성, 세트 보너스 |
| `src/data/wallpapers.ts` | 벽지 데이터와 해금 레시피 |
| `src/data/floorTiles.ts` | 바닥 타일 데이터와 해금 레시피 |
| `src/data/wallDecorations.ts` | 벽장식 데이터와 제작 레시피 |

## 개발 참고 사항

- React 라우팅은 `src/App.tsx`에서 정의합니다.
- Phaser 씬과 React 화면은 `src/game/phaser/events.ts`의 이벤트 버스로 통신합니다.
- Phaser에서 직접 참조하는 에셋은 `public/assets` 아래에 있어야 합니다.
- React 컴포넌트에서 import하는 에셋은 `src/assets` 아래에 있습니다.
- 게임 밸런스 변경은 대부분 `src/data`의 데이터 파일 수정으로 처리할 수 있습니다.
- 기존 저장 데이터가 꼬였을 때는 브라우저 로컬 스토리지의 `monster-rpg-player` 키를 삭제하면 새 상태로 시작할 수 있습니다.
