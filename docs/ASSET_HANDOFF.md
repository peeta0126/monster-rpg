# 에셋 넣는 곳

플레이어 8방향 스프라이트를 받았을 때 무엇을 어디에 넣고 코드에서 뭘 켜는지.

## 1. 파일 위치

```
public/assets/player/player.png     스프라이트시트
public/assets/player/player.json    Aseprite JSON (Array 형식, "Output File" 옆의 JSON Data 체크)
```

기존 `player-{down,up,left,right}{,-1,-2}.png` 16장은 아틀라스로 대체된 뒤 지운다.

## 2. 규격

| 항목 | 값 |
| --- | --- |
| 프레임 크기 | 64×64 |
| 방향 | 8방향 — S, SE, E, NE, N, NW, W, SW |
| 프레임 | 방향당 idle 1장 + walk 4장 |
| 시트 크기 | 2048×2048 이하 |

**좌우 반전을 쓴다.** SW / W / NW 는 그리지 않는다 — 코드가 SE / E / NE 를 뒤집어 쓴다
(`playerSprite.ts` 의 `MIRROR`). 실제로 그려야 하는 방향은 **S, SE, E, NE, N 다섯 개**다.

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

번호는 2자리 0 패딩(`00`~`03`).

## 4. 코드에서 켜는 것 — 3곳

1. `src/shared/playerSprite.ts` — `ASSET_MODE` 를 `"legacy4"` → `"atlas"`
2. `src/camp/BaseCampScene.ts` `preload()` — `this.load.aseprite(...)` 주석 해제,
   `player-*` 개별 `load.image` 16줄 삭제
3. `src/camp/BaseCampScene.ts` `updateImpl()` — `setTexture(getPlayerTextureKey(...))` 를
   `play(\`walk_${this.facing}\`, true)` 로. 정지 상태는 `stop()` 후 `idle_${dir}` 프레임.

공방(`WorkshopPage.tsx`)은 고칠 게 없다. `getPlayerFrame()` 이 아틀라스 프레임명과
`flipX` 를 같이 돌려주고, 이미 `transform: scaleX(-1)` 로 반전을 처리하고 있다.

## 5. 확인

```
npm test              # 방향 판정 단위 테스트
npm run design:shot   # 베이스캠프·공방 캡처
```

베이스캠프에서 대각선으로 걸어 SE/NE 프레임이 나오는지, 좌측 대각선에서 좌우 반전이
어색하지 않은지(그림자·소지품 위치) 본다.

## 6. 표시 크기

64×64 원본은 화면에서 **128px**(정확히 2배)로만 쓴다. 110px 같은 비정수 배율은
`image-rendering: pixelated` 와 만나면 픽셀이 1px/2px로 들쭉날쭉해진다.

---

# 사운드 넣는 곳

코드 계층은 이미 있다(`src/shared/audio/`). 파일만 넣으면 소리가 난다.
지금은 파일이 하나도 없고, 없는 상태로도 게임이 정상 동작한다(콘솔 경고만 한 줄).

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
| BGM | 30초~2분 루프 | 이음매가 안 들리게 자를 것 |

피크는 -3dBFS 이하로 정규화한다. 코드에서 볼륨을 다시 곱하므로 원본이 크면
설정 슬라이더의 조절 폭이 좁아진다.

## 4. 쓰는 법

```ts
import { playSfx, playBgm, SFX, BGM } from "../shared/audio";

playSfx(SFX.hit);
playBgm(BGM.battle);        // 기본 loop, 400ms 페이드인
```

⚠️ 브라우저 자동재생 정책 때문에 사용자가 한 번 클릭·키입력 하기 전에는 소리가 안 난다.
`installAudioUnlock()` 이 `main.tsx` 에서 첫 상호작용을 잡아 잠금을 푼다.
그 전에 요청된 BGM 은 큐에 담겼다가 잠금 해제 시 재생된다 — 호출부는 신경 쓸 필요 없다.

볼륨 설정은 `monster-rpg-audio` 키로 저장되고, 메뉴 → 소리에서 조절한다.
