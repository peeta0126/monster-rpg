# monster-rpg

React + Phaser 3 로 만든 몬스터 수집 RPG. 구조·밸런스·함정은 `Handoff.md` 를 먼저 읽을 것.

## 디자인 규칙 (UI 변경 시 필수)
- 색은 index.css @theme 토큰만 사용. hex 하드코딩 금지.
  신규 색은 docs/ART_DIRECTION.md 1-2 표에 먼저 추가한 뒤 사용.
- 픽셀 스프라이트 표시 크기는 원본의 정수배만 (64 → 128 O, 110 X).
- 폰트 크기는 Galmuri 기준 크기의 정수배만 (12/24/36px). text-pixel-* / text-title-* 만 쓴다.
- 몬스터 일러스트에 image-rendering: pixelated 를 적용하지 말 것.
- 여백은 4px 그리드. Tailwind 임의값(p-[13px]) 금지.
- UI 변경 후 `npm run design:shot` 실행하고 PNG 를 Read 로 직접 확인할 것.
- Phaser 캔버스는 접근성 트리에 안 잡힌다. browser_snapshot 대신 스크린샷을 쓸 것.
- 한국어 문구를 추가하면 폰트 서브셋이 다시 돌아야 한다. 빌드에 물려 있지만
  dev 서버만 볼 때 글자가 폴백으로 나오면 `npm run fonts:subset`.

## 충돌 박스
- 형상은 `src/camp/campCollision.ts`(베이스캠프) · `src/workshop/workshopLayout.ts`(공방)
  두 곳에만 있다. 씬/페이지에 좌표를 적지 말 것.
- **베이스캠프 배경은 두 장이다.** `basecamp-bg`(depth 0) 위에 바닥만 도려낸
  `basecamp-bg-1`(depth 3000)이 덮인다. 전경 쪽으로 걸어 들어가면 플레이어가 그 뒤로
  가려진다 — 이미지 위를 지나가는 게 아니라 안으로 들어가 보이는 연출이다. 여기를
  막으면 안 된다. 지형 충돌은 그 알파에서 뽑는다(`node scripts/gen-camp-collision.mjs`
  → `campGroundMask.ts`, 손으로 고치지 말 것). 배경을 갈면 다시 돌려야 한다.
- 바닥 구멍 **안**에 있는 물건(작업대·화단·좌판)은 배경 레이어라 플레이어가 그 위에
  그려진다. 알파로 안 잡히니 `CAMP_PROP_BOXES` 에 손으로 적는다.
- 공방 배경은 한 장이라 전경 레이어가 없다. 가려지는 연출이 안 되므로 물체는
  실루엣째로 막는다.
- 고쳤으면 `npm run design:collision` → 원화 위에 겹친 PNG 를 Read 로 확인.
  베이스캠프 캡처는 스폰에서 걸어 닿는 칸을 청록으로 칠한다 — 지붕·숲까지 번지면 틈이 있는 것이다.
- 게임 안 확인은 개발자 모드(로그인 → 개발자 코드). 빨간 선으로 그려지고 F9 로 껐다 켠다.
- 좌표를 옮겼으면 `node --import tsx --test tests/campCollision.test.ts` 와
  `-g "workshop:|basecamp:"` 스펙을 돌릴 것. 상호작용 지점이 벽 뒤로 넘어가면 여기서 잡힌다.

## 숲 배경
- 구역 표는 `src/camp/forest/areas.ts` 한 벌. 이름·레벨·해금 층수부터 강조색·배경
  이미지까지 전부 여기서 나온다. 씬/페이지에 티어별 분기를 흩뿌리지 말 것.
  해금 층수는 `unlockFloor` 만 본다 — 예전에 JSX 에 11/21 이 따로 박혀 있었다.
- **`public/assets/forest/*.webp` 는 다시 굽지 말 것.** 톤 보정·스크림·비네트까지
  구워져 들어온 최종본이다. `optimize-assets.mjs` 의 `PRESERVED_DIRS` 가 막고 있고,
  레시피를 추가하면 스크립트가 아무것도 안 하고 죽는다. 경로는 assetPaths 상수만 참조.
- **탐험 중 화면에만 스크림을 깐다** (`<ForestBackdrop dim>`). 원화의 스크림은 카드가
  놓이는 가운데만 눌러 둔 것이라, UI 가 화면 전체에 흩어지는 노드 맵에는 안 맞는다.
  구역 선택 화면은 원화 그대로 나간다 — 거기서는 카드가 자기 판을 들고 있다.
- 판 없이 원화 위에 바로 놓이는 UI 에 반투명 채움을 쓰지 말 것. 이동 선택 버튼이
  `rgba(cream, .04)` 였는데 옛 그라디언트 배경에서만 성립하던 값이라, 원화로 바꾸자
  버튼이 통째로 사라졌다. 자기 판(shadow-900 .8 이상)을 들리거나 텍스트 그림자를 깐다.
- 강조색(moss/mist/ember)은 24px 굵은 글자·테두리·버튼 채움에만. 12px 글자에 쓰면
  얕은 숲 카드에서 4.2:1 까지 떨어진다. 작은 글자는 sand 계열.
- 고쳤으면 `npm run design:shot` → `forest-{shallow,deep,ancient,nodes}.png` 를 Read 로
  확인. 배경이 실제로 다른지, 노드 맵의 이동 버튼이 읽히는지는 눈으로만 잡힌다.
- 회귀는 `npx playwright test e2e/forestTiers.spec.ts` (해금·기본 선택·프리로드·스크림·
  reduced-motion) 와 `node --import tsx --test tests/forestAreas.test.ts`.
