import { test } from "@playwright/test";
import { FRESH_SAVE } from "./freshSave";

/** 화면별로 실제 무엇을 받는지 나열한다. 추측 대신 목록을 본다. */
const GUEST = JSON.stringify({ state: { token: null, username: null, isGuest: true, isDev: false }, version: 0 });

test("perf: 요청 목록", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await page.addInitScript(({ g, fresh }) => {
    localStorage.setItem("monster-rpg-auth", g);
    localStorage.setItem("monster-rpg-player", fresh);
  }, { g: GUEST, fresh: FRESH_SAVE });

  for (const [name, url] of [["basecamp", "/"], ["forest", "/forest"], ["battle", "/battle"]] as const) {
    const seen: { url: string; bytes: number }[] = [];
    const onFinish = (e: { requestId: string; encodedDataLength: number }) => {
      const u = pending.get(e.requestId);
      if (u) seen.push({ url: u, bytes: e.encodedDataLength });
    };
    const pending = new Map<string, string>();
    const onSend = (e: { requestId: string; request: { url: string } }) => pending.set(e.requestId, e.request.url);
    cdp.on("Network.requestWillBeSent", onSend);
    cdp.on("Network.loadingFinished", onFinish);

    await cdp.send("Network.clearBrowserCache");
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(2500);

    cdp.off("Network.requestWillBeSent", onSend);
    cdp.off("Network.loadingFinished", onFinish);

    const total = seen.reduce((a, r) => a + r.bytes, 0);
    console.log(`\n=== ${name} — ${seen.length}건 / ${(total / 1024).toFixed(0)}KB ===`);
    for (const r of seen.sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
      console.log(`  ${(r.bytes / 1024).toFixed(0).padStart(6)}KB  ${r.url.replace(/^https?:\/\/[^/]+/, "")}`);
    }
  }
});
