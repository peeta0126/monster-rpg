import { test, type Page, type CDPSession } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { FRESH_SAVE } from "./freshSave";

/**
 * 성능 실측. npm run perf
 *
 * 결과는 design/PERF.md 에 표로 남는다. 이게 앞으로의 기준선이다.
 * 추측하지 말고 이 숫자를 고칠 것.
 */

const GUEST = JSON.stringify({
  state: { token: null, username: null, isGuest: true, isDev: false }, version: 0,
});

/** Chrome DevTools Protocol 의 네트워크 스로틀 프리셋 */
const NETWORKS = [
  { name: "무제한",  latency: 0,   down: -1,                    up: -1 },
  { name: "Fast 3G", latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 },
  { name: "Slow 3G", latency: 400, down: (400 * 1024) / 8,        up: (400 * 1024) / 8 },
];

const SCREENS = [
  { name: "login",    path: "/", auth: false, phaser: false },
  { name: "basecamp", path: "/", auth: true,  phaser: true  },
  { name: "battle",   path: "/battle", auth: true, phaser: true },
  { name: "forest",   path: "/forest", auth: true, phaser: false },
];

interface Row {
  network: string; screen: string;
  fcpMs: number; loadMs: number; bytes: number; requests: number;
}

async function throttle(cdp: CDPSession, n: (typeof NETWORKS)[number]) {
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: n.latency,
    downloadThroughput: n.down,
    uploadThroughput: n.up,
  });
}

async function measure(page: Page, cdp: CDPSession, screen: typeof SCREENS[number]): Promise<Row> {
  let bytes = 0, requests = 0;
  const onData = (e: { encodedDataLength: number }) => { bytes += e.encodedDataLength; };
  const onReq = () => { requests += 1; };
  cdp.on("Network.loadingFinished", onData);
  cdp.on("Network.requestWillBeSent", onReq);

  const started = Date.now();
  await page.goto(screen.path, { waitUntil: "load" });
  if (screen.phaser) {
    await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 120_000 });
  }
  const loadMs = Date.now() - started;

  // load 직후에는 paint 엔트리가 아직 안 들어와 있을 수 있다. 잠깐 기다렸다 읽는다.
  const fcpMs = await page.evaluate(() => new Promise<number>((resolve) => {
    const read = () => {
      const e = performance.getEntriesByName("first-contentful-paint")[0];
      return e ? Math.round(e.startTime) : null;
    };
    const now = read();
    if (now !== null) return resolve(now);
    const deadline = Date.now() + 3000;
    const poll = setInterval(() => {
      const v = read();
      if (v !== null || Date.now() > deadline) { clearInterval(poll); resolve(v ?? -1); }
    }, 50);
  }));

  cdp.off("Network.loadingFinished", onData);
  cdp.off("Network.requestWillBeSent", onReq);
  return { network: "", screen: screen.name, fcpMs, loadMs, bytes, requests };
}

/** Phaser 화면의 FPS 를 샘플링한다 */
async function sampleFps(page: Page, seconds: number) {
  return page.evaluate((sec) => new Promise<{ avg: number; min: number; frames: number }>((resolve) => {
    const frames: number[] = [];
    let last = performance.now();
    const deadline = last + sec * 1000;
    const tick = (now: number) => {
      const dt = now - last; last = now;
      if (dt > 0) frames.push(1000 / dt);
      if (now < deadline) requestAnimationFrame(tick);
      else {
        // 첫 프레임은 로딩 직후라 튄다. 앞 10개는 버린다.
        const s = frames.slice(10);
        resolve({
          avg: Math.round(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)),
          min: Math.round(Math.min(...s)),
          frames: s.length,
        });
      }
    };
    requestAnimationFrame(tick);
  }), seconds);
}

test("perf: 측정", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await page.addInitScript(({ g, fresh }) => {
    localStorage.setItem("monster-rpg-auth", g);
    localStorage.setItem("monster-rpg-player", fresh);
  }, { g: GUEST, fresh: FRESH_SAVE });

  const rows: Row[] = [];
  for (const net of NETWORKS) {
    await throttle(cdp, net);
    for (const screen of SCREENS) {
      await context.clearCookies();
      // 캐시를 비워야 매번 같은 조건에서 잰다
      await cdp.send("Network.clearBrowserCache");
      const r = await measure(page, cdp, screen);
      rows.push({ ...r, network: net.name });
      console.log(`${net.name.padEnd(8)} ${screen.name.padEnd(9)} FCP ${String(r.fcpMs).padStart(5)}ms  ` +
        `load ${String(r.loadMs).padStart(6)}ms  ${(r.bytes / 1024).toFixed(0).padStart(5)}KB  ${r.requests}건`);
    }
  }

  // FPS — 스로틀 해제 후
  await throttle(cdp, NETWORKS[0]);
  const fps: Record<string, { avg: number; min: number }> = {};
  for (const s of SCREENS.filter((x) => x.phaser)) {
    await page.goto(s.path);
    await page.waitForFunction(() => window.__PHASER_READY__ === true, undefined, { timeout: 60_000 });
    await page.waitForTimeout(1500);
    const r = await sampleFps(page, 20);
    fps[s.name] = r;
    console.log(`FPS ${s.name}: 평균 ${r.avg} / 최저 ${r.min} (${r.frames}프레임)`);
  }

  writeReport(rows, fps);
});

function writeReport(rows: Row[], fps: Record<string, { avg: number; min: number }>) {
  const byNet = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byNet.has(r.network)) byNet.set(r.network, []);
    byNet.get(r.network)!.push(r);
  }

  let md = `# 성능 기준선\n\n`;
  md += `프로덕션 빌드(\`npm run build\`) + \`vite preview\` 로 측정. 1440x900, 캐시 비운 상태.\n`;
  md += `재측정: \`npm run perf\`\n\n`;

  for (const [net, list] of byNet) {
    md += `## ${net}\n\n`;
    md += `| 화면 | FCP | 로드 완료 | 전송량 | 요청 수 |\n| --- | ---: | ---: | ---: | ---: |\n`;
    for (const r of list) {
      md += `| ${r.screen} | ${r.fcpMs}ms | ${r.loadMs}ms | ${(r.bytes / 1024).toFixed(0)}KB | ${r.requests} |\n`;
    }
    md += `\n`;
  }

  md += `## FPS (20초 샘플)\n\n| 화면 | 평균 | 최저 |\n| --- | ---: | ---: |\n`;
  for (const [name, v] of Object.entries(fps)) md += `| ${name} | ${v.avg} | ${v.min} |\n`;

  // 표 아래의 분석 글은 사람이 쓴 것이라 재측정해도 날리지 않는다
  const out = path.resolve(process.cwd(), "design", "PERF.md");
  const MARKER = "<!-- 아래는 수동 분석. 재측정해도 유지됩니다 -->";
  const prev = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  const keep = prev.includes(MARKER) ? prev.slice(prev.indexOf(MARKER)) : `${MARKER}\n`;
  fs.writeFileSync(out, `${md}\n${keep}`);
  console.log("\ndesign/PERF.md 작성 완료");
}
