#!/usr/bin/env python3
"""메뉴(TAB) 아이콘을 32x32 픽셀 격자에 그려 SVG 로 내보낸다.

    python scripts/build_menu_icons.py            # src/assets/ui/*.svg 갱신
    python scripts/build_menu_icons.py --preview  # 미리보기 PNG 도 같이 굽는다
    python scripts/build_menu_icons.py --dry-run  # 쓰지 않고 크기만 본다

## 그리는 순서

    실루엣(재질 표식) → 재질별로 형태를 따라 칠하기 → 세부 → 테두리

먼저 도형을 `M1`~`M4` 같은 **재질 표식**으로만 채운다. 색은 그다음에 `tint_cyl` /
`tint_sphere` 가 그 표식이 찍힌 칸에만 입힌다. 사각형을 겹쳐 칠하면 둥글게 깎아 둔
실루엣 밖으로 색이 삐져나가는데, 이 순서면 그럴 수가 없다.

## 음영은 경계선이 아니라 형태를 따라간다

네모 경계선만 한 겹 어둡게 하면 원통이든 공이든 상자든 다 똑같이 보인다. 32px 에서
종이 스티커를 오려 붙인 것처럼 되는 이유다.

    tint_cyl     원통 — 탑 몸통, 두루마리 축, 잔, 문. 세로 띠로 빛이 왼쪽에서 감긴다
    tint_sphere  공 — 몬스터 머리, 봉랍. 왼쪽 위 광원에서의 거리로 색을 고른다

## 테두리도 한 색이 아니다

그늘 쪽(빈 칸의 위나 왼쪽에 그림이 있는 경우)은 진한 #1a1a1a, 빛 쪽은 맞닿은 색과
같은 계열의 어두운 색이다. 사방을 같은 검정으로 두르면 안을 아무리 잘 칠해도
도형이 배경에서 뚝 떨어져 보인다.

격자는 32 다. PixelIcon 이 16/32/64 로만 그리므로 그 정수배·정수분의 1 이라야 칸 폭이
안 흔들린다. 도형은 3~28 안에 두어 테두리가 밖으로 한 칸 나갈 자리를 남긴다.

색은 docs/ART_DIRECTION.md 1-2 표의 값만 쓴다. 그늘 테두리 #1a1a1a 하나만 예외인데,
기존 아이콘 스물다섯 개가 전부 쓰는 값이라 여기만 팔레트를 지키면 같은 화면에서
메뉴 아이콘만 테두리가 옅어 보인다.
"""
from __future__ import annotations

import argparse
import math
import pathlib
import sys

SIZE = 32
OUT_DIR = pathlib.Path(__file__).resolve().parent.parent / "src" / "assets" / "ui"

DARK = "#1a1a1a"          # 그늘 쪽 테두리

CREAM = "#f3e5b9"
SAND2 = "#e0c69b"
SAND3 = "#cdb27e"
EARTH4 = "#ac7b62"
EARTH5 = "#844b3f"
EMBER5 = "#e99441"
EMBER6 = "#c25828"
EMBER7 = "#a83d1f"
MIST3 = "#aee2d5"
MIST5 = "#5c9396"
MOSS5 = "#7a8455"
MOSS7 = "#39412a"
STONE6 = "#423d46"
SHADOW7 = "#1e354a"
SHADOW8 = "#183b4f"
SHADOW9 = "#0d1223"

# 빛 쪽 테두리. 계열을 유지한다 — 갈색 물건에 남색 테두리를 두르면 구멍처럼 보인다.
LIGHT_EDGE = {
    CREAM: EARTH5, SAND2: EARTH5, SAND3: EARTH5, EARTH4: EARTH5, EARTH5: STONE6,
    EMBER5: EMBER7, EMBER6: EMBER7, EMBER7: EARTH5,
    MIST3: MIST5, MIST5: SHADOW8,
    MOSS5: MOSS7, MOSS7: SHADOW9,
    STONE6: SHADOW9, SHADOW7: SHADOW9, SHADOW8: SHADOW9, SHADOW9: SHADOW9,
}

# 재질 표식. 색이 아니라 "여기는 나무", "여기는 돌" 이라는 자리 표시다.
M1, M2, M3, M4 = "§1", "§2", "§3", "§4"
MATERIALS = (M1, M2, M3, M4)

# 왼쪽(밝음) → 오른쪽(어두움)
RAMP_STONE = [SAND2, SAND3, EARTH4, EARTH5]
RAMP_WOOD = [SAND3, EARTH4, EARTH5, STONE6]
RAMP_PAPER = [CREAM, SAND2, SAND3]
RAMP_GOLD = [SAND2, EMBER5, EMBER6, EMBER7]
RAMP_MOSS = [MOSS5, MOSS5, MOSS7]
RAMP_WAX = [EMBER5, EMBER6, EMBER7]
RAMP_TEAL = [MIST3, MIST3, MIST3]


class Grid:
    def __init__(self) -> None:
        self.px: list[list[str | None]] = [[None] * SIZE for _ in range(SIZE)]

    def set(self, x: int, y: int, color: str | None) -> None:
        if 0 <= x < SIZE and 0 <= y < SIZE:
            self.px[y][x] = color

    def rect(self, x: int, y: int, w: int, h: int, color: str | None) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, color)

    def clear(self, x: int, y: int, w: int, h: int) -> None:
        self.rect(x, y, w, h, None)

    def frame(self, x: int, y: int, w: int, h: int, color: str, t: int = 1) -> None:
        self.rect(x, y, w, t, color)
        self.rect(x, y + h - t, w, t, color)
        self.rect(x, y, t, h, color)
        self.rect(x + w - t, y, t, h, color)

    def disc(self, cx: float, cy: float, r: float, color: str | None) -> None:
        """진짜 원. 모서리를 계단으로 깎은 사각형과는 곡률이 다르다."""
        for y in range(SIZE):
            for x in range(SIZE):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, color)

    def round_rect(self, x: int, y: int, w: int, h: int, r: int, color: str) -> None:
        self.rect(x + r, y, w - 2 * r, h, color)
        self.rect(x, y + r, w, h - 2 * r, color)
        for cx, cy in ((x + r, y + r), (x + w - r - 1, y + r),
                       (x + r, y + h - r - 1), (x + w - r - 1, y + h - r - 1)):
            self.disc(cx, cy, r + 0.4, color)

    def arch(self, x: int, y: int, w: int, h: int, color: str) -> None:
        """위가 반원인 기둥. 문·창처럼 아치가 필요한 자리에 쓴다."""
        r = w / 2 - 0.5
        self.disc(x + r, y + r, r + 0.4, color)
        self.rect(x, y + int(r), w, h - int(r), color)

    def egg(self, cx: float, cy: float, rx: float, ry: float, color: str) -> None:
        """달걀꼴. 위가 좁고 아래가 불룩하다 — 정타원으로 그리면 그냥 알약이 된다."""
        for y in range(SIZE):
            t = (y - cy) / ry
            if abs(t) > 1:
                continue
            half = rx * math.sqrt(1 - t * t) * (1 + 0.16 * t)
            for x in range(SIZE):
                if abs(x - cx) <= half:
                    self.set(x, y, color)

    def claw(self, cx: int, y: int, h: int, color: str, lean: int = 0) -> None:
        """발톱. 밑동 3칸에서 끝 1칸으로 좁아지며 lean 만큼 바깥으로 휜다.

        곧게 세우면 손톱처럼 보인다. 휘어야 짐승 발톱이 된다.
        """
        for i in range(h):
            w = 3 if i < h // 2 else (2 if i < h - 1 else 1)
            off = round(lean * i * 2 / max(1, h - 1))
            self.rect(cx - w // 2 + off, y - i, w, 1, color)

    def cone(self, x: int, y: int, w: int, h0: int, h1: int, color: str) -> None:
        for i in range(w):
            half = h0 + (h1 - h0) * i // max(1, w - 1)
            self.rect(x + i, y - half, 1, half * 2 + 1, color)

    # ── 재질에 색을 입힌다 ────────────────────────────────────────────────────
    def _cells(self, mat: str) -> list[tuple[int, int]]:
        return [(x, y) for y in range(SIZE) for x in range(SIZE) if self.px[y][x] == mat]

    def tint_cyl(self, mat: str, ramp: list[str]) -> None:
        """원통. 재질이 찍힌 칸을 자기 폭 안에서 세로 띠로 나눠 왼쪽부터 밝게."""
        cells = self._cells(mat)
        if not cells:
            return
        x0 = min(x for x, _ in cells)
        x1 = max(x for x, _ in cells)
        span = max(1, x1 - x0 + 1)
        for x, y in cells:
            i = (x - x0) * len(ramp) // span
            self.px[y][x] = ramp[min(i, len(ramp) - 1)]

    def tint_sphere(self, mat: str, ramp: list[str]) -> None:
        """공. 왼쪽 위에 광원을 두고 거리로 색을 고른다. 가장자리가 자연스럽게 말린다."""
        cells = self._cells(mat)
        if not cells:
            return
        x0, x1 = min(x for x, _ in cells), max(x for x, _ in cells)
        y0, y1 = min(y for _, y in cells), max(y for _, y in cells)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        r = max(x1 - x0, y1 - y0) / 2
        lx, ly = cx - r * 0.5, cy - r * 0.5
        span = r * 1.75
        for x, y in cells:
            d = math.hypot(x - lx, y - ly) / span
            self.px[y][x] = ramp[min(int(d * len(ramp)), len(ramp) - 1)]

    def tint_flat(self, mat: str, color: str) -> None:
        for x, y in self._cells(mat):
            self.px[y][x] = color

    # ── 마무리 ────────────────────────────────────────────────────────────────
    def outline(self) -> None:
        src = [row[:] for row in self.px]

        def at(x: int, y: int) -> str | None:
            return src[y][x] if 0 <= x < SIZE and 0 <= y < SIZE else None

        for y in range(SIZE):
            for x in range(SIZE):
                if src[y][x] is not None:
                    continue
                above, left = at(x, y - 1), at(x - 1, y)
                below, right = at(x, y + 1), at(x + 1, y)
                if above is not None or left is not None:
                    self.px[y][x] = DARK                       # 그늘 쪽
                elif below is not None or right is not None:
                    base = below if below is not None else right
                    self.px[y][x] = LIGHT_EDGE.get(base, DARK)  # 빛 쪽

    def bounds(self) -> tuple[int, int, int, int]:
        xs = [x for y in range(SIZE) for x in range(SIZE) if self.px[y][x] is not None]
        ys = [y for y in range(SIZE) for x in range(SIZE) if self.px[y][x] is not None]
        return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)

    def to_svg(self) -> str:
        """같은 색이 이어지는 칸을 직사각형으로 묶는다.

        가로로만 묶으면 한 줄에 rect 하나씩 나와 파일이 손으로 그린 것의 열 배가 된다.
        가로로 뻗은 뒤 같은 폭이 이어지는 만큼 세로로도 내려가면 그 대부분이 사라진다.
        """
        used = [[False] * SIZE for _ in range(SIZE)]
        parts: list[str] = []
        for y in range(SIZE):
            for x in range(SIZE):
                c = self.px[y][x]
                if c is None or used[y][x]:
                    continue
                w = 1
                while x + w < SIZE and self.px[y][x + w] == c and not used[y][x + w]:
                    w += 1
                h = 1
                while y + h < SIZE and all(
                    self.px[y + h][x + i] == c and not used[y + h][x + i] for i in range(w)
                ):
                    h += 1
                for yy in range(y, y + h):
                    for xx in range(x, x + w):
                        used[yy][xx] = True
                parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')
        return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" '
                f'shape-rendering="crispEdges">{"".join(parts)}</svg>\n')


# ── 아이콘 ────────────────────────────────────────────────────────────────────

def tower(g: Grid) -> None:
    """무한의 탑 — 돌탑."""
    g.rect(9, 12, 14, 15, M1)                 # 몸통
    g.rect(7, 7, 18, 5, M1)                   # 총안 띠
    for x in (11, 16):                        # 홈 둘만 판다. 셋이면 성가퀴가 이쑤시개가 된다
        g.clear(x, 7, 3, 3)
    g.rect(7, 27, 18, 3, M2)                  # 기단
    g.tint_cyl(M1, RAMP_STONE)
    g.tint_cyl(M2, RAMP_WOOD)

    # 구멍은 창 하나만. 문까지 뚫으면 좁은 몸통이 갉아먹혀 폐허처럼 읽힌다.
    g.arch(14, 16, 4, 5, SHADOW9)             # 창
    g.rect(13, 15, 6, 1, EARTH5)              # 창 위 돌띠
    g.rect(10, 13, 1, 13, CREAM)              # 왼쪽에 걸린 빛
    g.rect(10, 8, 1, 3, CREAM)
    for y in (19, 23):                        # 돌 이음매
        g.rect(11, y, 3, 1, EARTH5)
        g.rect(18, y, 4, 1, EARTH5)


def quest(g: Grid) -> None:
    """퀘스트 — 봉랍이 붙은 두루마리."""
    g.rect(9, 6, 14, 20, M1)                  # 양피지
    g.tint_cyl(M1, RAMP_PAPER)
    for y in (10, 13, 16):
        g.rect(12, y, 8, 1, EARTH4)
    g.rect(12, 19, 5, 1, EARTH4)

    g.round_rect(6, 3, 20, 4, 1, M2)          # 위 축
    g.round_rect(6, 25, 20, 4, 1, M2)         # 아래 축
    g.tint_cyl(M2, RAMP_STONE)

    g.disc(17, 21, 3.2, M3)                   # 봉랍
    g.tint_sphere(M3, RAMP_WAX)
    g.rect(16, 21, 1, 1, SAND2)


def monsters(g: Grid) -> None:
    """내 몬스터 — 몬스터 알.

    발자국을 두 판 그려 봤지만 발가락이 몇이든 곰 발바닥에서 못 벗어났다. 발톱을 세우면
    32px 에서는 촛불로 읽혀 더 나빠졌다. 형태를 아예 바꾼다 — 알은 실루엣 하나로 끝나고,
    도감(책)·퀘스트(두루마리)·가방과도 안 겹친다.

    껍질은 구체로 굴리고 얼룩만 청록으로 찍는다. 얼룩이 없으면 그냥 달걀이다.
    """
    g.egg(16, 18, 8.2, 11.0, M1)             # 껍질
    g.tint_sphere(M1, [CREAM, SAND2, SAND3])

    # 금(균열)을 그어 봤더니 32px 에서는 선이 아니라 검불처럼 읽혀 지웠다.
    # 얼룩만으로도 달걀이 아니라 몬스터 알로 읽힌다.
    for x, y, w, h in ((11, 14, 3, 2), (18, 12, 3, 2), (20, 18, 2, 2),
                       (12, 21, 2, 2), (16, 24, 3, 2), (15, 17, 2, 2)):
        g.rect(x, y, w, h, MIST5)
    for x, y in ((11, 14), (18, 12), (16, 24)):
        g.rect(x, y, 1, 1, MIST3)


def bag(g: Grid) -> None:
    """가방 — 어깨끈 달린 손가방.

    처음엔 둥근 몸통 위에 넓은 덮개를 얹었는데 영락없는 도토리였다. 덮개가 몸통보다
    넓게 튀어나오면 깍정이로 읽힌다. 덮개를 몸통과 같은 폭으로 맞추고 아래를
    각지게 해서 도토리 실루엣을 지웠다.
    """
    g.round_rect(11, 4, 10, 12, 5, M3)       # 어깨끈
    g.round_rect(13, 6, 6, 10, 3, None)      # 속을 비운다
    g.clear(13, 13, 6, 3)
    g.tint_cyl(M3, RAMP_STONE)

    g.round_rect(6, 13, 20, 15, 2, M1)       # 몸통 — 아래를 각지게 둔다
    g.tint_cyl(M1, RAMP_WOOD[:3])            # 마지막 단까지 가면 오른쪽이 검게 죽는다

    g.round_rect(6, 13, 20, 7, 2, M2)        # 덮개 — 몸통과 같은 폭
    g.tint_cyl(M2, RAMP_STONE)
    g.rect(6, 19, 20, 1, EARTH5)             # 덮개 끝선

    g.rect(14, 17, 4, 6, EARTH5)             # 세로 잠금끈
    g.rect(14, 17, 1, 6, EARTH4)
    g.round_rect(13, 21, 6, 4, 1, EMBER7)    # 버클
    g.rect(14, 22, 4, 2, EMBER5)
    g.rect(14, 22, 1, 1, SAND2)


def dex(g: Grid) -> None:
    """도감 — 펼친 책."""
    g.rect(21, 4, 2, 8, EMBER6)               # 서표
    g.rect(21, 4, 1, 8, EMBER5)

    g.round_rect(3, 8, 26, 20, 1, M3)         # 표지
    g.tint_flat(M3, MIST5)
    g.rect(5, 10, 10, 16, M1)                 # 왼쪽 면
    g.rect(17, 10, 10, 16, M2)                # 오른쪽 면
    g.tint_cyl(M1, [CREAM, CREAM, SAND2, SAND3])
    g.tint_cyl(M2, [SAND3, SAND2, SAND2, SAND3])
    g.rect(15, 8, 2, 20, SHADOW8)             # 책등

    for y in (13, 16, 19, 22):
        g.rect(7, y, 6, 1, SAND3)
        g.rect(19, y, 6, 1, EARTH4)


def trophy(g: Grid) -> None:
    """엔딩 다시 보기 — 우승컵."""
    g.frame(4, 6, 6, 10, M2, t=2)             # 손잡이
    g.frame(22, 6, 6, 10, M2, t=2)
    g.tint_flat(M2, EMBER6)

    g.rect(10, 4, 12, 12, M1)                 # 잔
    g.rect(11, 16, 10, 1, M1)
    g.rect(12, 17, 8, 1, M1)
    g.rect(13, 18, 6, 1, M1)
    g.rect(14, 19, 4, 4, M1)                  # 기둥
    g.tint_cyl(M1, RAMP_GOLD)

    g.rect(11, 23, 10, 2, M3)                 # 받침
    g.round_rect(8, 26, 16, 3, 1, M4)         # 굽
    g.tint_cyl(M3, [EMBER5, EMBER6, EMBER7])
    g.tint_cyl(M4, RAMP_WOOD)

    g.rect(12, 7, 2, 6, SAND2)                # 잔에 비친 빛
    g.rect(12, 6, 1, 1, CREAM)


def _speaker(g: Grid) -> None:
    g.rect(4, 13, 5, 6, M1)                   # 몸통
    g.cone(9, 16, 8, 3, 8, M1)                # 나팔
    g.tint_cyl(M1, [SAND2, SAND3, EARTH4])
    g.rect(15, 10, 1, 13, SAND3)              # 나팔 입구 테


def sound(g: Grid) -> None:
    """소리 — 스피커와 음파."""
    _speaker(g)
    g.rect(19, 13, 2, 7, M2)                  # 가까운 음파
    g.set(19, 13, None)
    g.set(19, 19, None)
    g.rect(23, 10, 2, 13, M2)                 # 먼 음파
    g.set(23, 10, None)
    g.set(23, 22, None)
    g.tint_cyl(M2, RAMP_TEAL)


def mute(g: Grid) -> None:
    """음소거 — 같은 스피커에 가위표."""
    _speaker(g)
    for i in range(8):
        g.rect(20 + i, 11 + i, 2, 2, M2)
        g.rect(20 + i, 18 - i, 2, 2, M2)
    g.tint_cyl(M2, [EMBER5, EMBER6, EMBER7])


def door(g: Grid) -> None:
    """로그아웃 / 계정 연결 — 아치 문."""
    g.arch(6, 3, 20, 27, M2)                  # 문틀
    g.arch(9, 6, 14, 24, M1)                  # 문짝
    g.tint_cyl(M2, [EARTH4, EARTH5, STONE6])
    g.tint_cyl(M1, RAMP_WOOD)

    for x in (13, 18):                        # 판자 이음매
        g.rect(x, 8, 1, 22, EARTH5)
    g.rect(10, 12, 12, 1, EARTH5)             # 띠쇠
    g.rect(10, 25, 12, 1, EARTH5)
    g.rect(11, 10, 1, 19, SAND2)              # 왼쪽 판자에 걸린 빛

    g.rect(20, 17, 2, 3, EMBER5)              # 손잡이
    g.rect(20, 17, 1, 1, SAND2)


ICONS = {
    "tower": tower, "quest": quest, "monsters": monsters, "bag": bag, "dex": dex,
    "trophy": trophy, "sound": sound, "mute": mute, "door": door,
}


def build(name: str) -> Grid:
    g = Grid()
    ICONS[name](g)
    left = {c for row in g.px for c in row if c in MATERIALS}
    if left:
        raise SystemExit(f"{name}: 색을 안 입힌 재질이 남았다 {sorted(left)}")
    g.outline()
    return g


def preview(grids: dict[str, Grid], path: pathlib.Path) -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow 가 없어 미리보기를 건너뜁니다 (pip install pillow)", file=sys.stderr)
        return

    scale, pad, cols = 6, 10, 5
    cell = SIZE * scale + pad
    rows = (len(grids) + cols - 1) // cols
    img = Image.new("RGB", (cols * cell + pad, rows * cell + pad), (13, 18, 35))
    for i, g in enumerate(grids.values()):
        ox, oy = pad + (i % cols) * cell, pad + (i // cols) * cell
        for y in range(SIZE):
            for x in range(SIZE):
                c = g.px[y][x]
                if c is None:
                    continue
                rgb = tuple(int(c[k:k + 2], 16) for k in (1, 3, 5))
                for dy in range(scale):
                    for dx in range(scale):
                        img.putpixel((ox + x * scale + dx, oy + y * scale + dy), rgb)
    img.save(path)
    print(f"미리보기: {path}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", metavar="PATH", nargs="?", const="menu-icons-preview.png")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    grids = {name: build(name) for name in ICONS}
    for name, g in grids.items():
        x0, y0, x1, y1 = g.bounds()
        if x0 < 0 or y0 < 0 or x1 > SIZE - 1 or y1 > SIZE - 1:
            raise SystemExit(f"{name}: 격자를 넘었다 ({x0},{y0})-({x1},{y1})")
        text = g.to_svg()
        if not args.dry_run:
            (OUT_DIR / f"{name}.svg").write_text(text, encoding="utf-8", newline="\n")
        print(f"{name}.svg  {len(text)}B  bbox {x1 - x0 + 1}x{y1 - y0 + 1}")

    if args.preview:
        preview(grids, pathlib.Path(args.preview))


if __name__ == "__main__":
    main()
