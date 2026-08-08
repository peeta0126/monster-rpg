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
