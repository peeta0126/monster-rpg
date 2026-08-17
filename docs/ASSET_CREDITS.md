# 에셋 출처

밖에서 받아 온 에셋의 출처와 라이선스. 배포 전에 이 표의 **라이선스**와 **출처 표기 필요
여부** 칸이 전부 채워져 있어야 한다.

> ⚠️ 라이선스 칸은 비워 두었다. **사용자가 채울 것** — 같은 사이트에서 받았어도 에셋마다
> 조건이 다르다. 받은 페이지의 라이선스 문구를 그 에셋 줄에 그대로 옮겨 적는다.

## 아이템 아이콘 (재료·물약·아티팩트 21종)

원본은 `art-src/icons/*.png` (512×512). 산출물은 `scripts/build-icons.mjs` 가 굽는
`public/assets/icons/*.webp` (64×64) 다 — 굽는 규칙은 그 스크립트 머리말에 적혀 있다.

출처는 전부 [aetherforgeai.com](https://aetherforgeai.com) 무료 에셋이다.

| 파일명 | 출처 | 라이선스 | 출처 표기 필요 |
| --- | --- | --- | --- |
| `herb.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `berry.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `root.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `crystal.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `wood_plank.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `iron_fragment.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `leather.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `monster_essence.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `slime_extract.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `magic_dust.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `enhancement_stone.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `ormr_essence.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `potion.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `super_potion.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `max_potion.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `antidote.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `attack_buff.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `strong_attack_buff.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `power_necklace.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `guard_bracelet.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |
| `spirit_amulet.png` | aetherforgeai.com (무료 에셋) | *사용자가 채울 것* | *사용자가 채울 것* |

출처 표기가 필요한 것이 하나라도 있으면 게임 안에서도 읽을 수 있는 자리(메뉴 → 정보)에
같은 문구를 넣어야 한다. 저장소 문서에만 적어 두는 것으로는 대개 조건을 못 채운다.

## 그 밖의 아이콘

`src/assets/{ui,materials,potions,artifacts}/*.svg` 는 이 저장소에서 직접 그린 32×32
픽셀 SVG 다. 위 21종의 **폴백**이자, 그림 파일이 없는 것들(상태이상·메뉴·공방 탭)의
본체다. 출처 표기가 필요 없다.

## 아직 정리되지 않은 것

⚠️ `public/assets/player/player-*.png` 는 포켓몬 리핑 에셋이다. **이 상태로 공개 배포하면
안 된다.** 교체 절차는 [ASSET_HANDOFF.md](ASSET_HANDOFF.md) 에 있다.
