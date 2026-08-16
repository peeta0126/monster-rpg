import { expect, type Page } from "@playwright/test";
import { PLAYER_BOUNDS, isPlayerBlocked } from "../src/workshop/workshopLayout";
import { FRESH_SAVE } from "./freshSave";

/**
 * 공방 안에서 플레이어를 걸어 다니게 하는 공용 헬퍼.
 *
 * 스펙 두 개(workshop, artifactFlow)가 같은 이동이 필요해서 빼뒀다. 처음엔 스펙마다
 * 따로 짰는데, 두 번째 것이 "목표 방향으로 민다" 수준이라 아티팩트 제작대에서 걸렸다.
 * 그 제작대는 중심이 자기 충돌 박스 안이라 위로 돌아 들어가야 한다.
 */

const AUTH_STORAGE_KEY = "monster-rpg-auth";
const GUEST_AUTH_STATE = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false },
  version: 0,
});

export interface Pt { x: number; y: number }

/** 플레이어 스프라이트의 stage 기준 % 좌표 */
export async function readPos(page: Page): Promise<Pt> {
  return page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('img[alt="player"]')?.parentElement;
    if (!el) throw new Error("플레이어 스프라이트를 찾을 수 없다");
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  });
}

/** 목표 반경 안까지의 경로를 BFS 로 구한다. 못 가면 null. */
export function findPath(from: Pt, target: Pt, radius: number): Pt[] | null {
  const STEP = 1;
  const key = (p: Pt) => `${p.x},${p.y}`;
  const walkable = (p: Pt) =>
    p.x >= PLAYER_BOUNDS.minX && p.x <= PLAYER_BOUNDS.maxX &&
    p.y >= PLAYER_BOUNDS.minY && p.y <= PLAYER_BOUNDS.maxY &&
    !isPlayerBlocked(p);

  const start = { x: Math.round(from.x), y: Math.round(from.y) };
  const prev = new Map<string, Pt | null>([[key(start), null]]);
  const queue: Pt[] = [start];
  let goal: Pt | null = null;

  while (queue.length) {
    const cur = queue.shift()!;
    if (Math.hypot(cur.x - target.x, cur.y - target.y) <= radius) { goal = cur; break; }
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const next = { x: cur.x + dx, y: cur.y + dy };
      if (prev.has(key(next)) || !walkable(next)) continue;
      prev.set(key(next), cur);
      queue.push(next);
    }
  }
  if (!goal) return null;

  const path: Pt[] = [];
  for (let n: Pt | null = goal; n; n = prev.get(key(n)) ?? null) path.unshift(n);
  return path;
}

/** BFS 경로의 웨이포인트를 따라 방향키로 이동한다 */
export async function walkTo(page: Page, target: Pt, tolerance = 3): Promise<boolean> {
  const path = findPath(await readPos(page), target, tolerance);
  if (!path) return false;

  const deadline = Date.now() + 30_000;
  // 매 칸을 정확히 밟을 필요는 없다. 4칸마다 하나씩만 노려도 경로 모양은 유지된다.
  for (const wp of path.filter((_, i) => i % 4 === 0 || i === path.length - 1)) {
    // 한 웨이포인트에서 제자리걸음이면 다음으로 넘어간다. 가구 모서리에 붙으면
    // 한 축이 막힌 채로 남은 축의 오차가 임계값보다 작아 영영 안 움직이는 자리가 있다.
    let stalled = 0;
    let prev = await readPos(page);
    while (Date.now() < deadline && stalled < 6) {
      const p = await readPos(page);
      const dx = wp.x - p.x, dy = wp.y - p.y;
      if (Math.hypot(dx, dy) <= 1.5) break;
      const keys: string[] = [];
      // 임계값은 한 스텝(약 0.4%)보다 작아야 한다. 크면 모서리에서 굳는다.
      if (Math.abs(dx) > 0.3) keys.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(dy) > 0.3) keys.push(dy > 0 ? "ArrowDown" : "ArrowUp");
      if (!keys.length) break;
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(80);
      for (const k of keys) await page.keyboard.up(k);
      stalled = Math.hypot(p.x - prev.x, p.y - prev.y) < 0.2 ? stalled + 1 : 0;
      prev = p;
    }
  }
  const end = await readPos(page);
  return Math.hypot(end.x - target.x, end.y - target.y) <= tolerance + 1.5;
}

/**
 * 게스트 세션과 시작 세이브를 심고 원하는 경로로 들어간다.
 *
 * 세이브까지 심는 이유: 새 세이브는 파티가 비어 있고 첫 몬스터를 이장에게서 받는다.
 * 공방에서 만든 장비를 몬스터에 끼우는 흐름은 파티에 한 마리는 있어야 성립한다.
 */
export async function asGuest(page: Page, path: string) {
  await page.addInitScript(
    ([ak, av, pk, pv]) => {
      window.localStorage.setItem(ak as string, av as string);
      // ⚠ addInitScript 는 **네비게이션마다** 돈다. 무조건 덮으면 공방에서 만든 장비가
      // /monsters 로 넘어가는 순간 사라진다. 없을 때만 심는다.
      if (!window.localStorage.getItem(pk as string)) {
        window.localStorage.setItem(pk as string, pv as string);
      }
    },
    [AUTH_STORAGE_KEY, GUEST_AUTH_STATE, "monster-rpg-player", FRESH_SAVE],
  );
  await page.goto(path);
}

/** 공방으로 들어가 플레이어가 그려질 때까지 기다린다 */
export async function openWorkshop(page: Page) {
  await asGuest(page, "/workshop");
  await expect(page.locator('img[alt="player"]')).toBeVisible();
  await page.waitForTimeout(300);
}

/** 이미 게스트 세션이 있는 상태에서 공방으로 되돌아간다 */
export async function reenterWorkshop(page: Page) {
  await page.goto("/workshop");
  await expect(page.locator('img[alt="player"]')).toBeVisible();
  await page.waitForTimeout(300);
}
