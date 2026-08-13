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

## 전투 난이도 (숫자를 만지기 전에)
- 난이도 등급은 **'상'**이고 정의는 하나다 — 특정 층에서 막히고, 그 벽은 **제작·강화로만** 넘어간다.
  레벨로 못 넘는다: `expLevelGapMultiplier` 가 자기보다 6레벨 낮은 층의 경험치를 0 으로 만든다.
- 관문은 **5층마다**다. n0층은 이름 있는 보스(`isBossFloor`), 15·25·35·45층은 `GATE_FLOORS`.
  이름 있는 보스는 n0층에만 세울 것.
- 값을 고쳤으면 `npx tsx scripts/sim/gateCheck.ts` 로 합격선을 확인한다
  (보스 맨몸 ≤25% · 정규 장비 60~78%, 관문 맨몸 35~60% · 정규 ≥82%).
  실제 UI 증명은 `npx playwright test e2e/balanceRun.spec.ts` — "맨몸은 막히고, 장비를 갖추면 넘는다" 두 판이다.
- 시뮬 도구가 틀리면 밸런스도 틀린다. 물약은 **시행마다 새로** 만들고, 파티는
  `scripts/sim/loadout.ts` 로만 만든다(진화를 안 태우면 플레이어를 5배 과소평가한다).

## 충돌 박스
- 형상은 `src/camp/campCollision.ts`(베이스캠프) · `src/workshop/workshopLayout.ts`(공방)
  두 곳에만 있다. 씬/페이지에 좌표를 적지 말 것.
- **베이스캠프 배경은 두 장이다.** `basecamp-bg`(depth 0) 위에 바닥만 도려낸
  `basecamp-bg-1`(depth 3000)이 덮인다. 전경 쪽으로 걸어 들어가면 플레이어가 그 뒤로
  가려진다 — 이미지 위를 지나가는 게 아니라 안으로 들어가 보이는 연출이다. 여기를
  막으면 안 된다. 지형 충돌은 그 알파에서 뽑는다(`node scripts/gen-camp-collision.mjs`
  → `campGroundMask.ts`, 손으로 고치지 말 것). 배경을 갈면 다시 돌려야 한다.
- 바닥 밖으로 얼마나 더 들어갈 수 있는지는 **거리가 아니라 가시성**으로 정한다. 그 자리에
  섰을 때 스프라이트가 35% 이상 보이는 칸만 열린다(진짜 바닥은 15%). 고정 거리를 쓰면
  나무 밑에서는 몸이 사라지고 낮은 수풀에서는 너무 안 들어간다 — 예전에 우물 앞이 0% 였다.
- 전경 밑을 **지나가는** 자리(남쪽 아치)는 가려져도 열어야 한다. 생성기의 `TUNNELS` 에
  적는다. 빠뜨리면 연결성 검사가 생성 단계에서 죽으니 조용히 막히지는 않는다.
- 바닥 구멍 **안**에 있는 물건(작업대·화단·좌판)은 배경 레이어라 플레이어가 그 위에
  그려진다. 알파로 안 잡히니 `CAMP_PROP_BOXES` 에 손으로 적는다.
- 탑·숲·집의 판정 좌표와 **복귀 좌표**는 `CAMP_INTERACTIONS` 한 벌뿐이다. 씬이나 테스트에
  숫자를 다시 적지 말 것. 복귀 좌표를 즉석에서 더하다가 숲이 벽 안에서 시작한 적이 있다.
- 공방 배경은 한 장이라 전경 레이어가 없다. 가려지는 연출이 안 되므로 물체는
  실루엣째로 막는다.
- 고쳤으면 `npm run design:collision` → 원화 위에 겹친 PNG 를 Read 로 확인.
  베이스캠프 캡처는 스폰에서 걸어 닿는 칸을 청록으로 칠한다 — 지붕·숲까지 번지면 틈이 있는 것이다.
- **`collision-basecamp-people-*.png` 를 반드시 같이 볼 것.** 닿는 자리마다 플레이어를 세워
  게임과 같은 순서로 겹쳐 찍은 것이다. 박스 오버레이는 "설 수 있다"까지만 보여 주는데,
  정작 문제는 화단 위에 올라섰거나 몸이 사라지는 쪽에 있다 — 그건 이 그림에서만 보인다.
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

## 숲 원정 저장
- 저장은 `src/camp/forest/runStorage.ts` 한 곳(`monster-rpg-forest-run`). 사건의 굴림은
  저장하지 않는다 — (seed, depth) 로 고정돼 있어 화면에서 다시 나온다.
- **걸음 안의 진행까지 저장한다**(`run.step`). 시도 횟수를 화면 상태로 두면 새로고침이
  곧 리롤이다: 같은 시도 번호는 상대가 같은 수를 내므로, 지고 나서 F5 하면 이길 수 있다.
  포획 결과 화면은 사람을 기다리는 화면이라 여기서 제일 오래 머문다(`step.pending`).
- 걸음 안의 상태를 새로 만들면 `StepProgress` 에 넣고 `patchStep` 으로만 고칠 것.
  포획 결과는 900ms 뒤에 오므로 `setRun(값)` 으로 덮으면 그 사이 태운 시도가 되살아난다.
- 정산 화면도 저장한다. 런은 끝났는데 재료는 아직 창고 밖이라 여기서 잃으면 제일 아프다.
- 읽을 수 없는 세이브는 마이그레이션하지 않는다. 가방만 건져 100% 정산(`stale`)으로 보낸다.
- 회귀는 `node --import tsx --test tests/forestRunStorage.test.ts` 와
  `npx playwright test e2e/forest.spec.ts` (새로고침·정산 복원·옛 세이브).

## git 규칙
- 한 단계(phase) 작업이 끝나면 main 에 병합하고 push 한다. 브랜치에 오래 쌓아두지 않는다.
- push 는 사용자가 요청할 때만 한다. 단 작업 완료 보고 시 "push 필요 여부"를 항상 알린다.
- force push 와 rebase 는 하지 않는다.
