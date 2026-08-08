# Monster RPG — 아트 디렉션 / 디자인 스펙

이 문서는 Claude Code가 읽고 작업하는 기준 문서입니다. 디자인 관련 작업을 시킬 때
`@docs/ART_DIRECTION.md 기준으로 …` 라고 참조시키세요.
값이 바뀌면 **여기를 먼저 고치고**, 코드는 이 문서를 따라갑니다.

작성 기준: 2026-08-07 / 대상 커밋: `main`

---

## 0. 한 줄 요약

이 게임의 아트는 **이미 정해져 있습니다**. `public/start-loading.png`(드래곤 키아트)와
`public/assets/basecamp/basecamp-bg.png`(베이스캠프)가 정답이고, 나머지 화면은 전부 이 두 장의
규격에 맞춰 끌어올리는 작업입니다. **새로 정할 게 아니라 맞추는 겁니다.**

---

## 1. 아트 바이블 (움직이지 않는 기준)

### 1-1. 스타일 정의

| 항목 | 값 |
| --- | --- |
| 장르 룩 | 고밀도 픽셀아트 (Moonlighter / Stardew Valley / Eastward 계열) |
| 시점 | 필드·실내 = 3/4 탑다운, 전투 = 사이드뷰 |
| 픽셀 밀도 | 1 논리픽셀 = 화면 2~3px (극저해상도 8비트 아님. 디테일 있는 16/32비트 계열) |
| 광원 | 좌상단 고정. 모든 오브젝트의 그림자는 우하단으로 |
| 아웃라인 | 검정 아웃라인 없음. 어두운 동일계열 색으로 경계 처리 (베이스캠프 방식) |
| 채도 | 중간. 형광색·순수 원색 금지 |
| 그림자 | 캐릭터/오브젝트 발밑에 타원형 소프트 섀도 |

### 1-2. 마스터 팔레트 (키아트 2장에서 실측 추출)

두 키아트가 이미 같은 팔레트를 공유하고 있습니다. 이게 이 게임의 아이덴티티입니다.

| 역할 | HEX | 출처 | 용도 |
| --- | --- | --- | --- |
| `shadow-900` | `#0D1223` | 드래곤 최암부 | 화면 최심부, 모달 백드롭 |
| `shadow-800` | `#183B4F` | 드래곤/베이스캠프 공통 그림자 | 게임 전체 그림자 기준색 (검정 대신 이걸 씀) |
| `shadow-700` | `#1E354A` | 베이스캠프 그림자 | 패널 배경 |
| `stone-600`  | `#423D46` | 바위/석재 | 구조물, 비활성 UI |
| `earth-500`  | `#844B3F` | 목재/흙 | 패널 테두리 |
| `earth-400`  | `#AC7B62` | 벽돌/나무 | 보조 표면 |
| `sand-300`   | `#CDB27E` | 석재 밝은 면 | 보조 텍스트 |
| `sand-200`   | `#E0C69B` | 베이스캠프 하이라이트 | 본문 텍스트 |
| `cream-100`  | `#F3E5B9` | 드래곤 최명부 | 제목 텍스트, 강조 텍스트 |
| `ember-500`  | `#E99441` | 드래곤 화염 | 주 강조색 (CTA, 선택, HP) |
| `ember-600`  | `#C25828` | 화염 중간 | 강조 hover/active |
| `ember-700`  | `#A83D1F` | 화염 암부 | 위험, 경고, 데미지 |
| `mist-300`   | `#AEE2D5` | 드래곤 마법 기운 | 보조 강조색 (마나, 회복, 마법) |
| `mist-500`   | `#5C9396` | 청록 중간 | 정보성 요소, 링크 |
| `moss-500`   | `#7A8455` | 베이스캠프 초목 | 자연/식물 계열, 성공 상태 |
| `moss-700`   | `#39412A` | moss-500 의 그늘 | 숲 원경·밤하늘 (2026-08-08 추가) |

**규칙**

- 표에 없는 색은 쓰지 않습니다. 필요하면 **이 표에 먼저 추가**하세요.
- `ember-500`은 한 화면에 **3곳 이하**. 강조색을 남발하면 강조가 사라집니다. (60-30-10 법칙)
- 검정(`#000`)과 순백(`#FFF`)을 쓰지 마세요. 대신 `shadow-900` / `cream-100`을 씁니다.
- 그림자는 `rgba(0,0,0,…)` 대신 `rgba(24,59,79,…)`(`shadow-800`) 기반으로.

### 1-3. Tailwind 4 토큰 등록 (반드시 이 형태로)

`src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-shadow-900: #0D1223;
  --color-shadow-800: #183B4F;
  --color-shadow-700: #1E354A;
  --color-stone-600:  #423D46;
  --color-earth-500:  #844B3F;
  --color-earth-400:  #AC7B62;
  --color-sand-300:   #CDB27E;
  --color-sand-200:   #E0C69B;
  --color-cream-100:  #F3E5B9;
  --color-ember-500:  #E99441;
  --color-ember-600:  #C25828;
  --color-ember-700:  #A83D1F;
  --color-mist-300:   #AEE2D5;
  --color-mist-500:   #5C9396;
  --color-moss-500:   #7A8455;
  --color-moss-700:   #39412A;

  --font-pixel: "Galmuri11", "Neo둥근모", monospace;
  --font-title: "Galmuri14", "Galmuri11", monospace;

  /* 픽셀 폰트 전용 크기 스케일 — 1-4 표 참고 */
  --text-pixel-sm: 12px;
  --text-pixel-md: 24px;
  --text-pixel-lg: 36px;
  --text-title-sm: 16px;
  --text-title-md: 32px;
}
```

실물은 `src/index.css` 입니다. 값이 어긋나면 그쪽이 정답이고, `npm run lint` 에 물린
색 검사가 표 밖의 색을 잡아냅니다.

> **완료 (2026-08-08)** — 하드코딩 HEX 100종 이상과 Tailwind 기본 팔레트 클래스 674곳을
> 전부 토큰으로 치환했습니다. Phaser 는 CSS 변수를 못 읽어서 씬 코드는 같은 값을 담은
> `src/shared/palette.ts` 를 씁니다. 색을 바꿀 때는 **1-2 표 → index.css → palette.ts**
> 셋 다 고쳐야 합니다.

### 1-4. 폰트

| 용도 | 폰트 | 라이선스 | 비고 |
| --- | --- | --- | --- |
| 본문/대사 | Galmuri11 (12px 및 배수) | SIL OFL — 상업·임베딩 자유 | https://galmuri.quiple.dev/ |
| 제목/강조 | Galmuri14 또는 Neo둥근모 | SIL OFL | https://neodgm.dalgona.dev/ |
| (현재) Press Start 2P | ❌ 제거 | — | 한글 글리프가 없습니다. 한글이 fallback 폰트로 렌더되어 톤이 깨집니다 |

CDN 한 줄로 즉시 적용 가능:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css">
```

**픽셀 폰트 철칙**: 폰트 크기는 반드시 기준 크기의 **정수배만** (Galmuri11 → 12/24/36px,
Galmuri14 → 16/32px). 14px, 18px 같은 비정수배를 쓰면 글자가 뭉개집니다.

`src/index.css` 의 `@theme` 에 전용 스케일이 있습니다. Tailwind 기본 `text-sm` / `text-lg` 대신
이것만 씁니다.

| 클래스 | 크기 | 폰트 |
| --- | --- | --- |
| `text-pixel-sm` | 12px | Galmuri11 |
| `text-title-sm` | 16px | Galmuri14 |
| `text-pixel-md` | 24px | Galmuri11 ×2 |
| `text-title-md` | 32px | Galmuri14 ×2 |
| `text-pixel-lg` | 36px | Galmuri11 ×3 |

### 1-5. 해상도 규격 (필수 준수)

| 에셋 종류 | 규격 | 화면 표시 배율 |
| --- | --- | --- |
| 플레이어/NPC 스프라이트 | 64×64 | 정수배만 (×2 = 128px). ❌ 현재 110px |
| 몬스터 전투 스프라이트 | 128×128 또는 192×192 | 정수배 |
| 몬스터 도감 일러스트 | 512×512 통일 | 자유 (픽셀 렌더링 끔) |
| 아이템 아이콘 | 32×32 | ×2 = 64px |
| 실내 배경 (공방 등) | 1536×1310 이상 | 축소만 허용 |
| 필드 배경 | 1536×2730 (베이스캠프 기준) | 축소만 허용 |

**절대 규칙** — 픽셀아트는 축소는 되지만 **확대는 안 됩니다**. `image-rendering: pixelated`가
걸린 상태에서 1.72배 같은 비정수 확대를 하면 어떤 픽셀은 1px, 어떤 픽셀은 2px가 되어 화질이
깨져 보입니다. (현재 발생 중)

---

## 2. 코드 진단 — "화질이 깨진다"의 정확한 원인

> **이 장은 2026-08-07 시점의 진단 기록입니다.** 여기 적힌 파일·줄 번호는 이미 낡았고,
> 지적된 문제는 전부 처리됐습니다(토큰화, Galmuri 교체, pixelated 계층 분리, 공방 카메라,
> 에셋 34MB→3.9MB). 지금 코드를 고칠 때 이 장의 줄 번호를 믿지 마세요.
> 남아 있는 유일한 항목은 **공방 배경 재생성**(2-2 사실 ③)입니다.

### 2-1. `image-rendering: pixelated`는 로그인 창 전용이 아닙니다 ⚠️

실제 적용 위치:

| 파일 | 위치 | 적용 대상 |
| --- | --- | --- |
| `src/index.css:21` | `.pixel-img, img[class*="monster"], img[class*="pixel"]` | 전역 (main.tsx에서 import) |
| `src/index.css:27` | `canvas` | 모든 Phaser 캔버스 |
| `src/auth/LoginPage.css:31` | 로그인 배경 | 로그인 전용 |
| `src/camp/ForestPage.tsx:580` | 인라인 | 숲 |
| `src/workshop/WorkshopPage.tsx:406` | 인라인 | 공방 플레이어 |
| `src/workshop/RpsIcon.tsx:134` | 인라인 | 미니게임 아이콘 |
| `src/monster/FarmPage.tsx:149,195,231` | 인라인 ×3 | 농장 |
| `src/monster/monsterImages.ts:20` | `monsterImgStyle()` | 모든 몬스터 이미지 |
| `src/shared/phaser/phaserConfig.ts:13,33` | `pixelArt: true` | 베이스캠프·전투 게임 |

→ **전역입니다.** `src/index.css`가 `main.tsx`에서 import되므로 앱 전체에 적용됩니다.

### 2-2. ⚠️ 진단 정정 — 실제 화면 캡처 후 확인된 사실

초기 가설("공방 배경 해상도 부족이 주원인")은 **틀렸습니다**. 1440×900으로 6개 화면을 실제
캡처해 비교한 결과는 다음과 같습니다.

**사실 ① 공방은 튀는 화면이 아니다**
로그인 · 베이스캠프 · 공방 — 이 셋은 픽셀아트가 제대로 들어가 있어 같은 게임으로 보입니다.
실제로 튀는 건 **농장 · 몬스터 · 숲** 세 화면입니다. 아트가 전혀 없는 검은 공백 + zinc 회색 UI
조합이라 같은 게임으로 보이지 않습니다. 농장 화면은 세로 공간의 약 70%가 빈 검정입니다.

**사실 ② 공방이 어색했던 진짜 원인은 줌 레벨 불일치다**

| 화면 | 캐릭터 크기 | 보이는 범위 | 카메라 |
| --- | --- | --- | --- |
| 베이스캠프 | 크게 | 지도의 일부만 | 플레이어 추적 (Phaser) |
| 공방 | 작게 | 방 전체 | 고정 (React `<img>`) |

같은 세계인데 축척이 다릅니다. 공방에 들어가는 순간 카메라가 확 뒤로 빠집니다. 배경을
고해상도로 재생성해도 이건 해결되지 않습니다. **공방도 베이스캠프와 같은 배율로 확대하고
카메라가 플레이어를 따라가야 합니다.** → 3-1 참고.

**사실 ③ 해상도보다 "원본이 흐리다"가 더 정확한 표현**
픽셀 블록 크기를 측정한 결과 공방·베이스캠프 둘 다 블록 크기 1 — 즉 굵은 픽셀 그리드에 정렬된
진짜 픽셀아트가 아니라, 네이티브 해상도로 생성된 "픽셀아트 풍" 이미지입니다. 따라서 그리드 스냅
정수배 확대로는 개선되지 않습니다. 다만 1:1로 확대해 비교하면 베이스캠프는 경계가 선명하고
공방은 안티에일리어싱이 먹어 뭉개져 있습니다. → 공방 배경은 크기 문제가 아니라 **생성 품질**
문제이며, 재생성이 유일한 해결책입니다(우선순위는 낮음).

**사실 ④ 여전히 유효한 코드 결함 2개**

- `WorkshopPage.tsx` — `objectFit: "fill"`은 비율을 무시하고 늘립니다. → `"contain"`
- `PLAYER_DISPLAY = 110` — 64×64를 1.72배로 확대. `pixelated`와 결합되면 픽셀이 1px/2px로
  들쭉날쭉해집니다. → **128px** (정확히 2배)

### 2-2b. 에셋 유지/교체 실측

| 구분 | 개수 | 용량 | 내용 |
| --- | --- | --- | --- |
| 유지 | 18 | 27.2MB | 드래곤 키아트, 베이스캠프 배경 2, 몬스터 15 전부 |
| 교체 | 19 | 3.1MB | 공방 배경 3 + 플레이어 스프라이트 16(법적 필수) |
| 나중에 | 13 | 13KB | 아이템 SVG |

용량 기준 90%가 유지됩니다. 교체 실체는 "**배경 3장 + 캐릭터 1명**"입니다.

### 2-3. 몬스터 이미지가 이상해 보이는 원인

`src/monster/monsterImages.ts:20`의 `monsterImgStyle()`이 모든 몬스터에 `pixelated`를
강제합니다. 그런데 몬스터 PNG는 픽셀아트가 아니라 **매끄러운 애니풍 일러스트**(leafy 500px,
dragon 2048px)입니다. 부드러운 그라데이션에 nearest-neighbor를 적용하면 계단이 생깁니다.

→ 몬스터 일러스트는 `pixelated`를 빼세요. 아래 3-4의 아트 계층 분리 참고.

### 2-4. 용량 문제 (성능 = 체감 품질)

| 파일 | 현재 | 문제 |
| --- | --- | --- |
| `basecamp-bg.png` | 7.6MB | LTE에서 다운로드만 6초 |
| `dragon.png` (2048×2048) | 5.6MB | 디코딩 시 VRAM 16MB 점유 |
| `start-loading.png` | 4.8MB | 첫 화면이 가장 무거움 |
| 전체 에셋 | 약 25MB | 3G/혼잡망에서 1분 이상 |

→ WebP 변환(quality 82)으로 70~90% 감소. `assetPaths.ts`에 이미 `.webp` 상수가 있으니 파일만
만들면 됩니다.

```js
// scripts/optimize-assets.mjs
import sharp from 'sharp';
await sharp('public/assets/basecamp/basecamp-bg.png')
  .webp({ quality: 82, effort: 6 })
  .toFile('public/assets/basecamp/basecamp-bg.webp');   // 7.6MB → ~400KB
```

⚠️ 픽셀아트를 리사이즈할 때는 반드시 `kernel: 'nearest'`. 기본 lanczos 보간은 픽셀을 뭉갭니다.

---

## 3. 화면별 리디자인 스펙

### 3-0. 농장 · 몬스터 · 숲 — 실제 최우선

세 화면의 공통 문제는 하나입니다: **배경이 없어서 검은 공백에 UI가 떠 있다.**
새 그림은 한 장도 필요 없습니다. 전부 코드로 해결됩니다.

**공통 규칙 — "빈 화면" 3단 처리**

1. **배경 레이어** — 순수 `bg-zinc-950`(검정) 금지. 최소한 다음 중 하나:
   - 기존 배경 에셋을 어둡게 깔기 (`basecamp-bg`를 `blur(8px) brightness(.35)`로 재활용 — 새 에셋 0장)
   - 또는 `shadow-900` → `shadow-700` 세로 그라디언트 + 미세 노이즈/비네트
2. **콘텐츠 폭 제한** — 콘텐츠를 화면 전체에 흩뿌리지 말고 `max-w-5xl mx-auto`로 묶습니다.
   가로로 퍼지면 빈 공간이 더 도드라집니다.
3. **빈 상태(Empty State)** 를 세로 중앙이 아니라 콘텐츠 영역 **상단 1/3**에 배치. 현재 농장은
   빈 상태가 위쪽에 있고 그 아래로 검정이 700px 이어집니다.

**화면별 추가 지시**

| 화면 | 파일 | 핵심 조치 |
| --- | --- | --- |
| 농장 | `src/monster/FarmPage.tsx` (530줄) | 아이템 0개일 때도 **빈 슬롯 그리드**(4×5 등)를 회색으로 표시. 인벤토리는 "칸이 보여야" 인벤토리로 읽힙니다. 지금은 아무것도 없어 화면이 고장 난 것처럼 보입니다 |
| 몬스터 | `src/monster/MonstersPage.tsx` (883줄) | 3열 레이아웃이 세로로 안 채워집니다. 열마다 `min-h` 주고 카드가 없으면 점선 플레이스홀더 슬롯 표시. 파티 6칸은 항상 6칸이 보이게 |
| 숲 | `src/camp/ForestPage.tsx` (1722줄) | 배경이 CSS 그라디언트 + 삼각형입니다. 게임에서 가장 약한 화면. `basecamp-bg`를 블러 처리해 깔거나, 최소한 팔레트의 `moss-500`/`shadow-700` 기반으로 층을 나누고 안개·빛줄기 오버레이 추가 |

### 3-1. 제작 공방 (`src/workshop/WorkshopPage.tsx`)

**목표: 베이스캠프와 같은 축척으로 보이게 만든다.** ← 배경 화질보다 이게 먼저입니다.

#### A. 줌 / 카메라 통일 (최우선, 코드만으로 가능)

현재 공방은 배경 전체를 화면에 맞춰 넣고(`min(100vw, 100vh*ratio)`) 플레이어가 그 위를 % 좌표로
움직입니다. 베이스캠프는 Phaser가 카메라로 플레이어를 추적합니다. 그래서 축척이 다릅니다.

두 가지 해법 중 택일:

1. **(권장) 확대 + 카메라 추적** — 배경을 화면에 맞추지 말고 고정 배율(예: 2배)로 확대한 뒤,
   플레이어를 화면 중앙에 두고 배경을 `transform: translate(...)`로 반대 방향 이동.
   베이스캠프와 동일한 체감이 됩니다.
2. (대안) 공방도 Phaser 씬으로 이전 — 일관성은 최고지만 709줄 재작성이라 비용이 큽니다.

#### B. 배경 재생성 (에셋 작업 — 우선순위 낮음)

새 `housing_bg.png` 생성 조건:

- 해상도 1536×1310 이상 (현재 835×714의 3.4배 픽셀 수)
- 시점: 베이스캠프와 동일한 3/4 탑다운 (현재 공방도 3/4이라 시점은 맞음)
- 팔레트: 위 1-2 마스터 팔레트. 특히 현재 공방은 붉은 갈색(`#653A33`, `#5D2827`)에 치우쳐 있고
  베이스캠프는 올리브/이끼색(`#7A8455`, `#515A52`)이 강합니다. → 공방에 이끼 초록과
  `shadow-800`(`#183B4F`) 계열 그림자를 섞어 톤을 맞출 것
- 광원: 좌상단 (베이스캠프와 동일)
- 창밖 풍경은 베이스캠프의 벚꽃·초목과 같은 색으로

생성 프롬프트 템플릿:

```
탑다운 3/4 시점 판타지 제작 공방 실내, 고밀도 픽셀아트,
Moonlighter / Stardew Valley 스타일, 1536x1310,
좌상단 광원, 검정 아웃라인 없음,
팔레트: 딥 틸 그림자 #183B4F, 목재 #844B3F, 석재 #423D46,
샌드 하이라이트 #E0C69B, 이끼 초록 #7A8455, 화염 강조 #E99441,
모루·연금술 작업대·아티팩트 제작대·책장·침대 배치,
따뜻한 실내 조명, 창밖에 초록 나무와 벚꽃
```

→ 첨부 참조 이미지로 `basecamp-bg.png`를 함께 넣으면 톤이 훨씬 잘 맞습니다
(Nano Banana Pro / Flux Kontext의 스타일 전이 기능 활용).

#### B. 코드 수정 (에셋 없이도 지금 가능)

```diff
- const PLAYER_DISPLAY = 110;
+ const PLAYER_DISPLAY = 128;   // 64 × 2 (정수배 필수)

- style={{ objectFit: "fill" }}
+ style={{ objectFit: "contain" }}
```

#### C. 상호작용 UI 규격 통일

현재 SPACE 안내 배지가 하드코딩 색(`#b47828`, `#f5e6c8`, `rgba(18,9,2,0.94)`)을 씁니다.
→ 공용 컴포넌트 `<InteractionPrompt>`로 분리하고 토큰 사용:

```tsx
// src/shared/ui/InteractionPrompt.tsx
export function InteractionPrompt({ keyLabel = "SPACE", children }: Props) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-earth-500/75
                    bg-shadow-900/94 px-5 py-2.5 font-pixel text-sm text-sand-200
                    shadow-[0_0_28px_rgba(233,148,65,0.25)]">
      <span className="rounded bg-ember-500 px-2 py-0.5 text-xs font-black
                       tracking-wider text-shadow-900">{keyLabel}</span>
      <span>{children}</span>
    </div>
  );
}
```

→ 공방·베이스캠프·숲에서 전부 이걸 씁니다. **같은 UI가 화면마다 다르게 생긴 게 "일관성 없음"의
실체입니다.**

### 3-2. 전투 UI (`src/battle/BattlePage.tsx`, 912줄) — 2순위

전투 화면은 **정보 위계**가 전부입니다. 예쁘게 만들려 하지 말고 **읽히게** 만드세요.

**레이아웃 골격 (JRPG 표준 3분할)**

```
┌──────────────────────────────────────────────┐
│  [적 HP바 + 이름 + Lv]              (좌상단) │  ← 상단 15%
│                                              │
│                    [적 스프라이트]           │  ← 중앙 55%
│      [아군 스프라이트]                       │     전투 무대
│                                              │
│  [아군 HP/MP바 + 이름 + Lv]        (우하단)  │
├──────────────────────────────────────────────┤
│  로그: "리피가 잎사귀 베기를 사용했다!"      │  ← 로그 10%
├──────────────────────────────────────────────┤
│  ┌────────┬────────┐                         │
│  │ 공격   │ 스킬   │                         │  ← 커맨드 20%
│  ├────────┼────────┤                         │
│  │ 가방   │ 도망   │                         │
│  └────────┴────────┘                         │
└──────────────────────────────────────────────┘
```

**규칙**

- 적은 좌상단, 아군은 우하단 — **대각선 배치**. 시선이 자연스럽게 흐릅니다. (포켓몬/FF 공통)
- **HP바는 화면에서 두 번째로 큰 요소여야 합니다.** 전투에서 가장 자주 보는 정보입니다.
- HP바 색: 100~50% `moss-500` / 50~20% `ember-500` / 20% 이하 `ember-700` + 깜빡임
- 커맨드 버튼은 **2×2 그리드 고정**. 리스트로 나열하지 마세요 — 방향키 조작이 직관적이지
  않아집니다.
- 선택 커서는 **색이 아니라 형태**로 표시 (▶ 마커 + 배경 밝기). 색약 대응이자 픽셀아트
  관례입니다.
- 로그 영역은 **높이 고정**. 텍스트 길이에 따라 레이아웃이 흔들리면 안 됩니다.
- 모든 패널: `bg-shadow-700/95` + `border-2 border-earth-500` + `rounded-lg`. 이 조합을
  전투·인벤토리·상점에서 동일하게.

**타격감 (이펙트) — 코드로만 되는 것들**

```ts
// 피격 시 (Phaser)
this.tweens.add({ targets: sprite, x: sprite.x + 6, duration: 40, yoyo: true, repeat: 3 });
sprite.setTintFill(0xF3E5B9);                     // 흰 플래시
this.time.delayedCall(80, () => sprite.clearTint());
this.cameras.main.shake(120, 0.006);              // 화면 흔들림
// 데미지 숫자는 위로 떠오르며 페이드아웃
```

이펙트 에셋을 그리기 전에 **트윈만으로 얻을 수 있는 타격감을 먼저 소진**하세요. 투자 대비
효과가 가장 큽니다.

**레퍼런스 수집 방법**
Game UI Database(https://www.gameuidatabase.com/)에서 Genre: RPG + UI Element: Combat 필터 →
15장 이상 모으고, 각각을 **회색 박스로만** 다시 그려서 공통 레이아웃 골격을 뽑으세요. 색·아트를
훔치는 게 아니라 **배치 비율과 정보 순서**를 가져오는 겁니다.

### 3-3. 플레이어 스프라이트 교체 (법적 필수) — 최우선 병행

`public/assets/player/player-{down,up,left,right}*.png`는 **포켓몬 리핑 에셋**입니다. 닌텐도는
팬게임에 예외를 두지 않습니다. **배포 전 반드시 교체하세요.**

**규격**

| 항목 | 값 |
| --- | --- |
| 크기 | 64×64 (현재와 동일 — 코드 변경 최소화) |
| 방향 | 8방향 (S, SE, E, NE, N, NW, W, SW) |
| 프레임 | 방향당 idle 1 + walk 4 (또는 6) |
| 좌우 대칭 | SE/E/NE만 그리고 SW/W/NW는 좌우 반전으로 생성 → 작업량 40% 절감 |
| 출력 | Aseprite 스프라이트시트 + JSON (Phaser `load.aseprite()` 직접 로드 가능) |
| 톤 | 로그인 화면의 배낭 멘 여행자 실루엣을 그대로 캐릭터 디자인으로 승격 |

💡 로그인 화면(`start-loading.png`)의 작은 여행자 실루엣이 이미 이 게임의 주인공입니다. 새로
디자인하지 말고 저 실루엣을 64×64로 확대·정면화하는 게 가장 일관성 있는 답입니다.

**8방향 애니메이션 코드 골격**

> 실제 구현은 `src/shared/playerSprite.ts` 에 있습니다. 아래는 그 요약이고,
> 값이 어긋나면 구현 쪽이 정답입니다(단위 테스트가 8방향을 전부 검증합니다).

```ts
const DIRS = ["S","SE","E","NE","N","NW","W","SW"] as const;

function dirFromVector(dx: number, dy: number) {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;       // -180..180
  // ⚠️ (deg + 90) 이 아니라 (90 - deg) 다. 화면 좌표계는 y가 아래로 증가해서
  //    atan2 는 시계 방향으로 커지는데 DIRS 는 반시계 방향 나열이라 부호를 뒤집어야 한다.
  //    부호를 틀리면 E/W 만 좌우 대칭이라 우연히 맞고 나머지 6방향이 어긋난다 —
  //    걸어보면 대각선에서만 이상해서 알아채기 어렵다.
  const idx = Math.round(((90 - deg + 360) % 360) / 45) % 8;
  return DIRS[idx];
}

DIRS.forEach((d) => {
  this.anims.create({
    key: `walk_${d}`,
    frames: this.anims.generateFrameNames("player", {
      prefix: `walk_${d}_`, start: 0, end: 3, zeroPad: 2,
    }),
    frameRate: 8,
    repeat: -1,
  });
});
```

### 3-4. 아트 계층 분리 (중요한 판단)

몬스터 일러스트와 필드 픽셀아트를 **억지로 통일하지 마세요**. 이건 실제 상용 게임의 정석입니다.

| 계층 | 스타일 | pixelated | 해당 에셋 |
| --- | --- | --- | --- |
| 필드 계층 | 픽셀아트 | ✅ 켬 | 배경, 플레이어, NPC, 타일, 아이템 아이콘 |
| 전투/도감 계층 | 일러스트 | ❌ 끔 | 몬스터 PNG, 캐릭터 초상화 |
| UI 계층 | 픽셀 폰트 + 픽셀 프레임 | ✅ 켬 | 패널, 버튼, HP바 |

두 계층을 이어주는 접착제는 **동일 팔레트 + 동일 광원**입니다. 스타일이 달라도 색이 같으면 한
게임으로 보입니다.

→ 조치: `monsterImages.ts:20`의 `monsterImgStyle()`에서 `pixelated` 제거.
→ 조치: `index.css`의 `img[class*="monster"]` 셀렉터 제거 (이게 몬스터 일러스트를 망치는 범인).

---

## 4. 작업 목록

실행용 프롬프트는 `docs/PROMPTS.md`에 전부 정리되어 있습니다. 여기서는 무엇이 있는지만
나열합니다.

**코드로 해결 (Claude Code)**

1. 디자인 토큰 `@theme` 등록 + zinc 램프 치환 (674곳, 매핑 규칙 10개로 커버)
2. Galmuri 한글 픽셀 폰트 적용 / Press Start 2P 제거
3. 아트 계층 분리 — 몬스터 일러스트에서 `pixelated` 제거
4. 농장 · 몬스터 · 숲 빈 화면 처리 ← **효과 가장 큼**
5. 공방 줌/카메라 통일, `PLAYER_DISPLAY` 128, `objectFit` contain
6. 전투 UI 레이아웃 재설계
7. 공용 컴포넌트 추출 (Panel / InteractionPrompt / StatBar / EmptyState / SlotGrid)
8. 8방향 스프라이트 수용 코드(에셋 도착 즉시 꽂을 수 있게)
9. 에셋 WebP 변환 + 텍스처 아틀라스
10. 검증 루프 (Playwright 캡처 / CLAUDE.md 규칙 / design-critic 서브에이전트)

**사람이 해야 하는 것**

- 공방 배경 재생성 (이미지 생성 도구)
- 플레이어 8방향 스프라이트 (PixelLab 등 — 계정·결제 필요)
- 아이템 아이콘 32×32 픽셀 PNG
- 몬스터 일러스트 512×512 정규화 (Upscayl)
- MCP 서버 설치 / API 키 발급
- 레퍼런스 15장 수집 및 취향 결정
- 라이선스 확인, 플레이테스트

---

## 5. 검증 루프 (디자인을 "감각" 대신 "측정"으로 다루기)

### 5-1. 스크린샷 스크립트

`design/capture.spec.ts` — `npm run design:shot`

7개 화면(login / basecamp / forest / farm / monsters / workshop / battle)을 1440×900으로
캡처해 `design/screenshots/<label>/*.png`로 저장합니다. 로그인은 zustand persist 키
`"monster-rpg-auth"`에 게스트 세션을 심어 우회합니다 — 이 키가 바뀌면 스펙도 같이 고쳐야 합니다.

Phaser 씬에는 준비 플래그가 필요합니다 (캔버스는 접근성 트리에 안 잡혀서 캡처 도구가 렌더 완료를
알 수 없음). `src/shared/phaser/sceneReady.ts`의 `markSceneReady(this)`를
`BaseCampScene.create()` / `BattleScene.create()` 마지막 줄에서 호출하고, shutdown/destroy에서
자동 해제합니다.

```json
"design:shot":   "playwright test --config design/playwright.config.ts",
"design:before": "cross-env SHOT_LABEL=before npm run design:shot",
"design:after":  "cross-env SHOT_LABEL=after  npm run design:shot",
"design:sheet":  "node design/contact-sheet.mjs"
```

`node design/contact-sheet.mjs <label>`로 7장을 3열 그리드 한 장
(`design/contact-sheet-<label>.png`)으로 합칩니다. 화면을 한 장씩 열어보면 "화면끼리 톤이 안
맞는다"가 안 보이므로 **항상 나란히 놓고 봅니다.**

### 5-1b. 비주얼 리그레션

`design/visual.spec.ts` 가 7개 화면을 기준 이미지와 비교합니다
(`maxDiffPixelRatio` 0.02 — 폰트 힌팅 차이로는 안 깨지고 레이아웃이 밀리면 깨지는 값).

```
npm run design:visual          검사
npm run design:visual:update   의도한 변경이면 기준 이미지 갱신
```

기준 이미지는 `design/visual.spec.ts-snapshots/` 에 커밋합니다. 개별 캡처
(`design/screenshots/`)와 달리 이건 저장소에 남겨야 비교가 성립합니다.

### 5-1c. 색 검사

`scripts/check-hardcoded-colors.mjs` 가 `npm run lint` 에 물려 있습니다. 금지하는 건
"hex 를 쓰는 것"이 아니라 **1-2 표에 없는 색을 쓰는 것**입니다. 알파가 필요하면
`rgba(토큰값, .4)` 는 통과합니다 — CSS 에서 토큰에 알파를 먹이는 깔끔한 방법이
없어서입니다. 예외는 그 줄 끝에 `// palette-ok: 이유`.

### 5-2. Claude Code에게 시키는 프롬프트 (그대로 복붙)

```
@docs/ART_DIRECTION.md 를 기준으로 전투 화면을 리디자인해.

1. `npm run design:shot` 실행 → design/screenshots/current/battle.png 캡처
2. 그 이미지와 design/screenshots/current/basecamp.png 를 둘 다 읽고,
   아래 4개 축으로만 차이를 나열해:
   - 색 팔레트 (ART_DIRECTION 1-2 표에 없는 색이 쓰였는가)
   - 여백 리듬 (4px 그리드를 벗어난 값이 있는가)
   - 정보 위계 (가장 큰 요소가 가장 중요한 정보인가)
   - 컴포넌트 일관성 (같은 역할의 UI가 다르게 생겼는가)
3. 각 차이에 대해 "어떤 파일 몇 번째 줄을 어떻게 바꿀지" 한 줄씩 계획
4. 수정. 색은 @theme 토큰에서만. hex 하드코딩 금지
5. 다시 스크린샷 → 2번 목록 재평가, [x]/[ ] 표시
6. 남은 게 있으면 한 번만 더 반복. 2패스 후에도 남으면 고치지 말고 보고

제약: 라우팅/그리드 컬럼 수 변경 금지. 새 라이브러리 추가 금지.
```

실전 데이터: 1패스에서 격차의 70%, 2패스에서 95%가 해소됩니다. 3패스부터는 픽셀 단위
헛수고입니다. 같은 문제를 3번째 교정하고 있다면 컨텍스트가 오염된 것이므로 `/clear` 후
재시작하세요.

### 5-3. CLAUDE.md에 넣을 하드 룰

```markdown
## 디자인 규칙 (UI 변경 시 필수)
- 색은 index.css @theme 토큰만 사용. hex 하드코딩 금지. 신규 색은 docs/ART_DIRECTION.md 1-2 표에 먼저 추가.
- 픽셀 스프라이트 표시 크기는 원본의 정수배만 (64 → 128 ○, 110 ✗).
- 폰트 크기는 Galmuri 기준 크기의 정수배만 (12/24/36px).
- 몬스터 일러스트에 image-rendering: pixelated 를 적용하지 말 것.
- 여백은 4px 그리드. Tailwind 임의값(p-[13px]) 금지.
- UI 변경 후 `npm run design:shot` 을 실행하고 PNG를 Read로 직접 확인할 것.
- Phaser 캔버스는 접근성 트리에 안 잡힌다. browser_snapshot 대신 스크린샷을 쓸 것.
```

---

## 6. 이 문서를 유지하는 법

- **색을 새로 쓰고 싶으면** → 1-2 표에 먼저 추가하고 코드를 고칩니다. 반대 순서로 하지 마세요.
- **새 화면을 만들면** → 3장에 스펙을 먼저 씁니다. 그리고 Claude Code에게 그 절을 참조시킵니다.
- **디자인이 막히면** → 색·폰트가 아니라 **정보 위계**를 의심하세요. 대부분의 "촌스러움"은 색
  문제가 아니라 "중요한 게 작고 안 중요한 게 큰" 문제입니다.
