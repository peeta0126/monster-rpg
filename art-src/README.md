# art-src — 원본 아트

`scripts/optimize-assets.mjs` 가 여기 있는 원본을 읽어 `public/` 으로 내보냅니다.
**이 폴더의 파일은 스크립트가 절대 쓰지 않습니다.** 입력과 출력을 물리적으로 갈라 둔 것이
이 폴더의 존재 이유입니다.

## ⚠️ git 추적 대상이 아닙니다

`.gitignore` 에 걸려 있습니다(README 만 예외). 원본 몇 개가 수 MB씩이라 저장소를
불리지 않으려는 선택입니다. 대신 **마스터 보관은 사람 책임입니다.** 새로 클론하면
이 폴더는 비어 있고, 그 상태로 스크립트를 돌리면 해당 레시피는 조용히 건너뜁니다
(이미 만들어진 `public/` 산출물은 그대로 둡니다).

원본을 잃으면 되돌릴 방법이 없습니다. 실제로 한 번 잃을 뻔했습니다 — 아래 참고.

## 왜 갈랐나

예전 `optimize-assets.mjs` 는 `public/` 안에서 원본을 읽고 그 자리에 결과를 썼습니다.

- 변환 후 원본 PNG 를 지웠고, 다음 실행에서 그 없는 PNG 를 열려다 첫 항목에서 죽었습니다.
- 키아트는 원본 PNG 를 절반 크기 폴백으로 **덮어썼습니다.** 두 번 돌리면 이미 절반이 된
  PNG 로 WebP 를 다시 구워 원본 해상도가 소리 없이 깎이는 구조였습니다.

앞의 버그가 뒤의 버그를 막아준 덕에 커밋된 파일에는 실제 손실이 없었습니다
(`node scripts/audit-asset-resolution.mjs` 로 38개 전수 확인).
다만 공방 배경 마스터(2400×1792)는 커밋되기 전에 폴백으로 덮여, 저장소에는 축소본만
들어갔습니다. 원본은 나중에 따로 복구해 여기 넣었습니다.

지금은 스크립트가 시작할 때 "출력이 어떤 레시피의 입력도 아닌가"를 검사하고, 어기면
아무것도 하지 않고 죽습니다. `tests/optimizeAssets.test.mjs` 가 두 번 돌려 결과가
같은지 확인합니다.

## 현재 들어 있어야 하는 것

| 파일 | 크기 | 나가는 곳 |
| --- | --- | --- |
| `housing_bg.png` | 2400×1792 | `public/assets/housing/housing_bg.webp` |

## 없어진 마스터

아래는 원본을 지우던 시절에 이미 사라졌습니다. `public/` 의 WebP 가 사실상 마스터입니다.
원본이 다시 생기면 같은 이름으로 여기 넣으면 그때부터 레시피가 붙습니다.

`start-loading.png` · `basecamp-bg.png` · `basecamp-bg-1.png` ·
`Orion_portrait.png` · `Baros_portrait.png` · `monsters/*.png`

## 쓰는 법

```
node scripts/optimize-assets.mjs --dry     # 무엇을 할지만
node scripts/optimize-assets.mjs           # 변환
node scripts/optimize-assets.mjs --png8    # 픽셀아트 PNG-8 재인코딩까지
```

`--png8` 은 `public/assets/player/` 의 스프라이트를 제자리에서 다시 씁니다. 그것들은
산출물이자 마스터라 갈라놓을 데가 없습니다. 이미 전부 PNG-8 이라 지금 돌리면 0~1% 밖에
안 줄고 파일만 흔들어서, 새 스프라이트를 넣었을 때만 씁니다.
