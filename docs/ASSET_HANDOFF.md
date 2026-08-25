# 에셋 넣는 곳

플레이어 8방향 스프라이트를 무엇을 어디에 넣고 코드가 뭘 읽는지.

> 밖에서 받아 온 에셋의 출처·라이선스는 [ASSET_CREDITS.md](ASSET_CREDITS.md) 에 적는다.
> 새 에셋을 넣었으면 그 표에도 한 줄 더할 것.

## 1. 파일 위치

```
public/assets/player/player.png     스프라이트시트
public/assets/player/player.json    Aseprite JSON (Array 형식, "Output File" 옆의 JSON Data 체크)
```

이 두 장이 전부다. 방향마다 PNG 를 따로 두던 `player-{down,up,left,right}{,-1,-2}.png`
16장은 지웠다 — 되살리지 말 것.

## 2. 규격

| 항목 | 값 |
| --- | --- |
| 프레임 크기 | 80×80 |
| 방향 | 8방향 — S, SE, E, NE, N, NW, W, SW |
| 프레임 | 방향당 idle 1장 + walk 4장 |
| 시트 크기 | 2048×2048 이하 (지금 400×400) |

인물은 칸에 꽉 차 있고 **발끝은 아래에서 두 번째 줄**이다. 이 값이 곧 발밑 충돌
박스의 기준이라(`campCollision.ts` 의 `PLAYER_FOOT_INSET`), 여백을 바꾼 시트를
넣으면 벽을 뚫거나 화단 위에 올라선다.

**좌우 반전을 쓴다.** SW / W / NW 는 그리지 않는다 — 코드가 SE / E / NE 를 뒤집어 쓴다
(`playerSprite.ts` 의 `MIRROR`). 실제로 그려야 하는 방향은 **S, SE, E, NE, N 다섯 개**다.
시트의 **줄 순서가 곧 이 순서**고(`PLAYER_ATLAS_ROW_DIRS`), 칸 순서는 idle → walk 00~03 이다.

## 3. 프레임 이름 규칙

Aseprite 태그명이 그대로 프레임 이름이 된다. `playerSprite.ts` 의 `atlasFrameName()` 과
반드시 일치해야 한다.

```
idle_S      idle_SE      idle_E      idle_NE      idle_N
walk_S_00   walk_SE_00   walk_E_00   walk_NE_00   walk_N_00
walk_S_01   …            …           …            …
walk_S_02
walk_S_03
```

번호는 2자리 0 패딩(`00`~`03`). 이름이 하나만 어긋나도 Phaser 는 오류 없이 빈 칸을
그린다 — 화면에서는 캐릭터가 사라진 것처럼 보인다. `tests/playerSprite.test.ts` 가
시트를 직접 열어 이름과 칸 크기를 맞춰 본다.

## 4. 코드가 읽는 곳

- `src/shared/playerSprite.ts` — 방향·반전·프레임 번호·칸 크기(`PLAYER_FRAME_SIZE`)의
  단일 출처. 시트를 갈면 여기만 고친다.
- `src/camp/BaseCampScene.ts` — `load.atlas` 로 읽고 줄마다 `walk_*` 애니메이션을 만든다.
  `load.aseprite` 는 못 쓴다(이 JSON 에 `meta.frameTags` 가 없다).
- `src/workshop/WorkshopPage.tsx` — `<img>` 로는 시트에서 한 칸만 뗄 수 없어
  배경 이미지로 잘라 쓴다. 프레임 이름과 `flipX` 는 `getPlayerFrame()` 이 같이 준다.

## 5. 확인

```
npm test                    # 방향 판정 · 시트 이름 대조
npm run design:shot         # 베이스캠프·공방 캡처
npm run design:collision    # 발밑 충돌 박스 + 인물 배치
```

베이스캠프에서 대각선으로 걸어 SE/NE 프레임이 나오는지, 좌측 대각선에서 좌우 반전이
어색하지 않은지(그림자·소지품 위치) 본다. 칸 크기를 바꿨으면 발밑 바디도 따라 움직인다
(`PLAYER_BODY_OFFSET` 이 칸 크기에서 계산된다) — 충돌 캡처로 벽 앞에 선 자리를 다시 볼 것.

## 6. 표시 크기

베이스캠프는 정수배만 쓴다 — 80×80 을 **2배(160px)** 로 그린다. 2.5배 같은 비정수
배율은 `image-rendering: pixelated` 와 만나면 픽셀이 1px/2px로 들쭉날쭉해진다.

공방은 방 전체가 한 화면에 들어오는 붙박이 화면이라 px 을 고정하면 창을 줄였을 때
사람만 커 보인다. 그래서 **무대 높이의 비율**로 잡는다(`PLAYER_DISPLAY_RATIO`,
원화 1792px 안에서 한 칸 441px).

---

# 사운드 넣는 곳

코드 계층은 `src/shared/audio/` 하나다. 파일만 넣으면 소리가 난다 — 없는 상태로도
게임은 정상 동작한다(콘솔 경고만 한 줄).

**BGM 여섯 곡은 들어와 있고 화면마다 걸려 있다. 효과음은 아직 하나도 없다.**

## 1. 파일 위치와 포맷

```
public/assets/audio/ui/click.ogg      + click.m4a
public/assets/audio/battle/hit.ogg    + hit.m4a
public/assets/audio/bgm/basecamp.ogg  + basecamp.m4a
...
```

**두 포맷을 다 준비한다.** ogg 는 Chrome/Firefox, m4a(AAC) 는 Safari 용이다.
코드가 `canPlayType` 으로 브라우저에 맞는 쪽을 고른다 — 파일명은 확장자만 다르면 된다.

mp3 를 안 쓰는 이유: 라이선스 이슈는 끝났지만 같은 용량에서 ogg 가 더 낫고,
Safari 는 어차피 m4a 가 필요해서 두 벌을 만들어야 한다. mp3 를 끼우면 세 벌이 된다.

## 2. 키 목록

`src/shared/audio/keys.ts` 가 원본이다. 경로는 키를 그대로 따른다
(`SFX.hit = "battle/hit"` → `public/assets/audio/battle/hit.ogg`).

| 분류 | 키 |
| --- | --- |
| UI | click, hover, confirm, cancel, error |
| 전투 | hit, critical, miss, faint, levelup, capture_success, capture_fail |
| 필드 | footstep, door, craft_success, craft_fail, item_get |
| BGM | title, basecamp, forest, battle, boss, workshop |

## 3. 길이·음량 기준

| 종류 | 길이 | 비고 |
| --- | --- | --- |
| UI 효과음 | 50~150ms | 짧을수록 좋다. 연타된다 |
| 전투 효과음 | 100~400ms | 타격 연출이 0.9초라 그 안에 끝나야 한다 |
| BGM | 30초~3분 루프 | 이음매가 안 들리게 자를 것 |

들어와 있는 BGM 의 실측 길이 (브라우저가 읽은 값):

| 곡 | 길이 |
| --- | --- |
| title | 100.0초 |
| basecamp | 97.2초 |
| forest | 103.3초 |
| battle | 103.3초 |
| boss | 178.1초 |
| workshop | 107.1초 |

피크는 -3dBFS 이하로 정규화한다. 코드에서 볼륨을 다시 곱하므로 원본이 크면
설정 슬라이더의 조절 폭이 좁아진다.

## 4. 쓰는 법

효과음은 그때그때 부른다:

```ts
import { playSfx, SFX } from "../shared/audio";
playSfx(SFX.hit);
```

**BGM 은 화면이 정한다.** 페이지 컴포넌트 맨 위에서 훅 한 줄이면 끝이다:

```ts
import { useBgm, BGM } from "../shared/audio";
useBgm(BGM.basecamp);
```

지금 걸려 있는 것:

| 화면 | 곡 |
| --- | --- |
| 로그인 · 엔딩 | title |
| 베이스캠프 · 가방 · 내 몬스터 | basecamp |
| 숲 (구역 선택 · 탐험) | forest |
| 공방 | workshop |
| 전투 (보통 층) | battle |
| 전투 (보스 층 — `isBossFloor`) | boss |

지켜야 할 규칙 다섯:

- **화면을 떠날 때 끄지 않는다.** 다음 화면이 자기 곡을 걸면 그때 넘어간다.
  떠날 때 끄면 화면 사이마다 정적이 생긴다. `stopBgm()` 은 소리를 아예 없애야 하는
  자리에만 쓴다.
- **같은 곡이면 아무 일도 안 일어난다.** 마을 ↔ 가방 ↔ 내 몬스터가 전부 basecamp 라
  오가도 되감기지 않는다.
- **두 곡이 겹치지 않는다.** 곡이 바뀌면 앞 곡을 먼저 다 내리고(450ms), 사라진 뒤에
  뒷 곡을 올린다(450ms). 겹쳐 넘기면 서로 다른 조성·박자가 1초 남짓 같이 나서 뭉개진다.
- **곡은 그 화면에 들어갈 때 받는다.** 여섯 곡을 합치면 20MB 다. 미리 다 받으면
  첫 화면이 그만큼 늦는다.
- **보스 판정은 `floorTable.isBossFloor` 하나뿐이다.** 전투 화면에서 10 을 다시 적지 말 것.

⚠️ 브라우저 자동재생 정책 때문에 사용자가 한 번 클릭·키입력 하기 전에는 소리가 안 난다.
먼저 틀어 보고 막히면 기억해 뒀다가, `installAudioUnlock()` 이 잡은 첫 상호작용에서 다시
시도한다 — 호출부는 신경 쓸 필요 없다. 잠금 플래그로 처음부터 막지 않는 이유는, 재방문
처럼 브라우저가 이미 허용해 주는 경우에도 클릭할 때까지 조용해지기 때문이다.

볼륨 설정은 `monster-rpg-audio` 키로 저장되고, 메뉴 → 소리에서 조절한다. 슬라이더는
**지금 나오는 곡**에 바로 먹는다 (페이드 중이어도).

`public/assets/audio` 는 `optimize-assets.mjs` 의 보존 목록에 있다. 이미 다듬어 들어온
최종본이라 다시 인코딩하면 소리만 나빠진다.

회귀 검사: `npx playwright test --config design/playwright.config.ts -g "audio:"`
— 실제로 화면을 돌아다니며 브라우저가 만든 오디오 요소를 들여다본다(되감김·정적·
이중 전환·음량 반영·이음매·받는 시점).

---

# 폰트

`scripts/subset-fonts.mjs` 가 **빌드할 때 자동으로** 돈다. 따로 할 일은 없다.

`node_modules/galmuri` 의 TTF 에서 소스(`src/`, `server/src/`)에 실제로 쓰인 글자만
뽑아 `public/assets/fonts/*.woff2` 로 내보낸다. 1207KB → 65KB.

산출물은 `.gitignore` 대상이다 — 빌드마다 다시 만들어지므로 커밋하지 않는다.

⚠️ **한국어 문구를 추가하면 서브셋도 다시 돌아야 한다.** 빌드에 물려 뒀으니 보통은
저절로 되지만, dev 서버만 띄우고 확인할 때 새 글자가 폴백 폰트로 보이면
`npm run fonts:subset` 을 한 번 돌리면 된다.

이 방식이 안전한 이유: 사용자가 한글을 입력할 수 있는 곳이 없다. 아이디는 서버에서
`/^[a-zA-Z0-9_]{3,20}$/` 로 막고, 몬스터 `nickname` 은 읽기만 하며 설정 UI 가 없다.
**닉네임 입력 기능을 추가한다면 이 전제가 깨진다** — 그때는 서브셋 범위를
KS X 1001 상용 2,350자 이상으로 넓혀야 한다.

---

# 아이템 아이콘

재료·물약·아티팩트 21종은 그림 파일로 나간다. 새 아이콘을 넣는 절차:

1. `art-src/icons/<아이템 id>.png` 로 넣는다. 파일명이 곧 아이템 id 다
   (`src/shared/items.ts` 가 `icon` 을 `id` 와 같게 둔다).
2. `npm run build:icons:sheet`
3. `design/screenshots/icons-sheet.png` 을 눈으로 확인한다. 체커 배경이 비쳐야 정상이고,
   흰 네모가 보이면 배경이 안 지워진 것이다.
4. `src/shared/ui/icons.ts` 에 같은 이름의 SVG 폴백을 하나 그려 둔다.
5. [ASSET_CREDITS.md](ASSET_CREDITS.md) 표에 출처를 적는다.

원본은 `art-src/` 에, 산출물은 `public/assets/icons/` 에 나온다. **원본을 `public/` 에 두지
말 것** — `scripts/optimize-assets.mjs` 가 "출력은 어떤 레시피의 입력도 될 수 없다"를
검사로 막고 있다. 그리고 `public/assets/icons` 는 그 스크립트의 보존 디렉터리다.
64×64 무손실로 이미 구워진 것이라 quality 82 로 다시 구우면 픽셀 테두리가 번진다.

굽는 규칙(합집합 틀·논리 격자·정수배 확대)은 `scripts/build-icons.mjs` 머리말에 있다.
표시 크기는 **16 / 32 / 64** 만 쓴다.
