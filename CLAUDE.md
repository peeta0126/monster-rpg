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
- 고쳤으면 `npm run design:collision` → 원화 위에 겹친 PNG 를 Read 로 확인.
  베이스캠프 캡처는 스폰에서 걸어 닿는 칸을 청록으로 칠한다 — 지붕·숲까지 번지면 틈이 있는 것이다.
- 게임 안 확인은 개발자 모드(로그인 → 개발자 코드). 빨간 선으로 그려지고 F9 로 껐다 켠다.
- 좌표를 옮겼으면 `node --import tsx --test tests/campCollision.test.ts` 와
  `-g "workshop:|basecamp:"` 스펙을 돌릴 것. 상호작용 지점이 벽 뒤로 넘어가면 여기서 잡힌다.
