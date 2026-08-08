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
