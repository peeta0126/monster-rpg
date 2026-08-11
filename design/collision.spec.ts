import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  COLLISION_BOXES, CRAFTING_STATIONS, EXIT_ZONE, PLAYER_BOUNDS, BG_W, BG_H,
} from "../src/workshop/workshopLayout";
import {
  CAMP_COLLISION_BOXES, CAMP_PROP_BOXES, CAMP_MAP_W, CAMP_MAP_H,
  reachableCells, bodyYFromSpriteY,
} from "../src/camp/campCollision";
import { getCampPosition } from "../src/camp/campPositionStore";

/**
 * 충돌 형상을 배경 원화 위에 그대로 겹쳐 찍는다.
 *
 * 실행: `npm run design:collision` → design/screenshots/collision-*.png
 *
 * 게임 안(개발자 모드 F9)에서도 같은 형상이 보이지만, 거기서는 카메라가 따라다녀
 * 방 전체를 한 장에 담을 수 없다. 좌표를 고칠 때는 이 캡처로 재고, 고친 결과를
 * 게임 안에서 걸어 다니며 확인하는 순서가 맞다.
 *
 * 오버레이는 게임 화면이 아니라 원화 위에 직접 그리므로 카메라·줌과 무관하다.
 * 그래서 좌표계 실수가 그대로 드러난다 — 그게 이 캡처의 목적이다.
 */

const OUT = path.resolve("design/screenshots");
const LINE = "#ff0000"; // palette-ok: 개발용 판정 선. 게임에 없는 색이어야 눈에 띈다
const ZONE = "#00ffcc";   // palette-ok: 상호작용 반경. 충돌 선과 구분되는 색
const GROUND = "#ff8c00"; // palette-ok: 자동 생성된 지형. 손으로 잰 소품과 구분하려고 다른 색

function grid(step: number, w: number, h: number, scale: number) {
  const cols = Array.from({ length: Math.floor(w / step) + 1 }, (_, i) => i * step);
  const rows = Array.from({ length: Math.floor(h / step) + 1 }, (_, i) => i * step);
  return (
    cols.map((v) => `
      <div style="position:absolute;left:${v * scale}px;top:0;width:1px;height:100%;background:rgba(255,255,255,.22)"></div>
      <div style="position:absolute;left:${v * scale}px;top:0;font:9px monospace;color:#fff;background:#000">${v}</div>`).join("") +
    rows.map((v) => `
      <div style="position:absolute;top:${v * scale}px;left:0;height:1px;width:100%;background:rgba(255,255,255,.22)"></div>
      <div style="position:absolute;top:${v * scale}px;left:0;font:9px monospace;color:#fff;background:#000">${v}</div>`).join("")
  );
}

function shell(w: number, h: number, inner: string) {
  return `<body style="margin:0;background:#000">
    <div style="position:relative;width:${w}px;height:${h}px">${inner}</div></body>`;
}

test("collision: 공방", async ({ page }) => {
  const scale = 1200 / BG_W;
  const w = Math.round(BG_W * scale);
  const h = Math.round(BG_H * scale);
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/workshop"); // 같은 origin 이어야 배경 이미지를 상대경로로 읽는다

  await page.setContent(shell(w, h, `
    <img src="/assets/housing/housing_bg.webp" style="position:absolute;inset:0;width:100%;height:100%">
    ${grid(240, BG_W, BG_H, scale)}
    <div style="position:absolute;left:${PLAYER_BOUNDS.minX}%;top:${PLAYER_BOUNDS.minY}%;
      width:${PLAYER_BOUNDS.maxX - PLAYER_BOUNDS.minX}%;height:${PLAYER_BOUNDS.maxY - PLAYER_BOUNDS.minY}%;
      border:2px dashed #ffff00"></div>
    ${COLLISION_BOXES.map((b) => `
      <div style="position:absolute;left:${b.x}%;top:${b.y}%;width:${b.width}%;height:${b.height}%;
        border:2px solid ${LINE};background:rgba(255,0,0,.14)">
        <span style="font:11px monospace;color:${LINE};background:rgba(0,0,0,.75)">${b.id}</span></div>`).join("")}
    ${[...CRAFTING_STATIONS, EXIT_ZONE].map((z) => `
      <div style="position:absolute;left:${z.x}%;top:${z.y}%;width:${z.radius * 2}%;height:${z.radius * 2}%;
        transform:translate(-50%,-50%);border-radius:50%;border:2px solid ${ZONE};background:rgba(0,255,204,.10)"></div>`).join("")}
  `));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, "collision-workshop.png") });
});

test("collision: 베이스캠프", async ({ page }) => {
  const scale = 760 / CAMP_MAP_W;
  const w = Math.round(CAMP_MAP_W * scale);
  const h = Math.round(CAMP_MAP_H * scale);
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto("/");

  const STEP = 20;
  const spawn = getCampPosition();
  const reachable = [...reachableCells({ x: spawn.x, y: bodyYFromSpriteY(spawn.y) }, STEP)];

  const overlay = (s: number) => `
    <img src="/assets/basecamp/basecamp-bg.webp"
      style="position:absolute;inset:0;width:${CAMP_MAP_W * s}px;height:${CAMP_MAP_H * s}px">
    ${reachable.map((k) => {
      const [x, y] = k.split(",").map(Number);
      return `<div style="position:absolute;left:${(x - STEP / 2) * s}px;top:${(y - STEP / 2) * s}px;
        width:${STEP * s}px;height:${STEP * s}px;background:rgba(0,255,204,.32)"></div>`;
    }).join("")}
    ${grid(100, CAMP_MAP_W, CAMP_MAP_H, s)}
    ${CAMP_COLLISION_BOXES.map((b) => {
      // 지형(전경 레이어에서 자동 생성)과 소품(손으로 잰 것)을 색으로 나눈다.
      // 지형은 가장자리 40px 이 열려 있어야 정상이고, 소품은 딱 물건만 덮어야 한다.
      const prop = CAMP_PROP_BOXES.includes(b as never);
      const color = prop ? LINE : GROUND;
      return `<div style="position:absolute;left:${b.x * s}px;top:${b.y * s}px;
        width:${b.w * s}px;height:${b.h * s}px;
        border:1px solid ${color};background:${prop ? "rgba(255,0,0,.28)" : "rgba(255,140,0,.18)"}">
        ${prop ? `<span style="font:10px monospace;color:${color};background:rgba(0,0,0,.75)">${b.id}</span>` : ""}</div>`;
    }).join("")}`;

  await page.setContent(shell(w, h, overlay(scale)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "collision-basecamp.png"), fullPage: true });

  // 좌표를 실제로 재려면 축소본으로는 부족하다. 원본 배율로 세 토막을 더 남긴다.
  await page.setViewportSize({ width: CAMP_MAP_W, height: 950 });
  await page.setContent(shell(CAMP_MAP_W, CAMP_MAP_H, overlay(1)));
  await page.waitForTimeout(500);
  for (const [i, top] of [0, 910, 1820].entries()) {
    await page.screenshot({
      path: path.join(OUT, `collision-basecamp-${i + 1}.png`),
      fullPage: true,
      clip: { x: 0, y: top, width: CAMP_MAP_W, height: 910 },
    });
  }
});

/**
 * 걸어 닿는 자리마다 플레이어를 세워 놓고 **게임과 같은 순서**로 겹쳐 찍는다.
 *   배경(basecamp-bg) → 플레이어 → 전경(basecamp-bg-1)
 *
 * 위의 박스 오버레이가 못 보는 것을 본다. 오버레이는 배경 위에 사각형을 그릴 뿐이라
 * "여기 설 수 있다"까지만 보여 주는데, 정작 문제는 **서면 어떻게 보이는가** 쪽에 있었다.
 * 화단 위에 올라서 있거나, 벽 뒤로 들어가 몸이 통째로 사라지거나 하는 것은 이 그림에서만
 * 한눈에 보인다(실제로 우물 앞 0% 구간과 남쪽 소품 누락을 이걸로 찾았다).
 *
 * 소품 박스를 새로 그려 넣었으면 이 캡처를 Read 로 열어 "물건 위에 선 사람"이 없는지 볼 것.
 */
test("collision: 베이스캠프 인물 배치", async ({ page }) => {
  await page.setViewportSize({ width: CAMP_MAP_W, height: 950 });
  await page.goto("/");

  const GRID = 150;
  const spawn = getCampPosition();
  const cells = [...reachableCells({ x: spawn.x, y: bodyYFromSpriteY(spawn.y) }, 10)];

  // 격자 칸마다 중심에 가장 가까운 자리 하나만 세운다 — 촘촘하면 서로 겹쳐 못 읽는다
  const best = new Map<string, { d: number; x: number; y: number }>();
  const bodyToSprite = bodyYFromSpriteY(0);
  for (const k of cells) {
    const [bx, by] = k.split(",").map(Number);
    const gx = Math.round(bx / GRID), gy = Math.round(by / GRID);
    const d = Math.hypot(bx - gx * GRID, by - gy * GRID);
    const key = `${gx},${gy}`;
    const cur = best.get(key);
    if (!cur || d < cur.d) best.set(key, { d, x: bx, y: by - bodyToSprite });
  }

  await page.setContent(shell(CAMP_MAP_W, CAMP_MAP_H, `
    <img src="/assets/basecamp/basecamp-bg.webp"
      style="position:absolute;left:0;top:0;width:${CAMP_MAP_W}px;height:${CAMP_MAP_H}px">
    ${[...best.values()].map((p) => `
      <img src="/assets/player/player-down.png" class="pixel-img"
        style="position:absolute;left:${Math.round(p.x) - 80}px;top:${Math.round(p.y) - 80}px;
          width:160px;height:160px;image-rendering:pixelated">`).join("")}
    <img src="/assets/basecamp/basecamp-bg-1.webp"
      style="position:absolute;left:0;top:0;width:${CAMP_MAP_W}px;height:${CAMP_MAP_H}px">
  `));
  await page.waitForTimeout(800);
  for (const [i, top] of [0, 910, 1820].entries()) {
    await page.screenshot({
      path: path.join(OUT, `collision-basecamp-people-${i + 1}.png`),
      fullPage: true,
      clip: { x: 0, y: top, width: CAMP_MAP_W, height: 910 },
    });
  }
});

/**
 * 공방을 실제로 걸어 다니며 확인한다. 정적 오버레이는 "박스가 그림과 맞는가"를 보고,
 * 이건 "밀어붙였을 때 스프라이트가 가구에 파묻히는가"를 본다.
 */
const DEV_AUTH = JSON.stringify({
  state: { token: null, username: "admin", isGuest: true, isDev: true },
  version: 0,
});

async function openWorkshopAsDev(page: Page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    ["monster-rpg-auth", DEV_AUTH],
  );
  await page.goto("/workshop");
  await expect(page.locator('img[alt="player"]')).toBeVisible();
  await page.waitForTimeout(300);
}

function readPos(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('img[alt="player"]')!.parentElement!;
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  });
}

test("collision: 공방 인게임", async ({ page }) => {
  await openWorkshopAsDev(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);

  const runs: Array<{ keys: string[]; shot: string }> = [
    { keys: ["ArrowLeft"], shot: "left" },
    { keys: ["ArrowUp"], shot: "topleft" },
    { keys: ["ArrowRight", "ArrowUp"], shot: "topright" },
    { keys: ["ArrowDown", "ArrowRight"], shot: "bottomright" },
  ];

  for (const run of runs) {
    for (const k of run.keys) await page.keyboard.down(k);
    await page.waitForTimeout(3000);
    for (const k of run.keys) await page.keyboard.up(k);
    await page.waitForTimeout(200);

    const p = await readPos(page);
    const inside = COLLISION_BOXES.find(
      (b) => p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height,
    );
    expect(inside?.id, `${run.shot}: ${inside?.id} 안으로 들어갔다`).toBeUndefined();

    await page.screenshot({ path: path.join(OUT, `collision-ingame-workshop-${run.shot}.png`) });
  }
});
