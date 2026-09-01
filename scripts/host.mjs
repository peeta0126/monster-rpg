#!/usr/bin/env node
/**
 * 서버와 터널을 한 번에 켜고, 배포된 화면이 볼 주소까지 갱신한다.
 *
 *   npm run host
 *
 * 이 창을 켜 두는 동안 남들은 https://amugeona0159.github.io 로 들어와 그냥 플레이한다.
 * 터널 주소는 켤 때마다 바뀌지만 게임을 다시 빌드할 필요는 없다 — 화면이 실행 중에 읽는
 * server-config.json 한 장만 Pages 에 올리면 된다(빌드 2분 → 푸시 3초).
 *
 * 옵션
 *   --no-tunnel    서버만. 로컬에서 확인할 때
 *   --no-publish   터널까지 켜지만 Pages 에는 안 올린다. 주소만 받아볼 때
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SERVER_DIR = path.join(ROOT, "server");
const PAGES_REPO = "https://github.com/amugeona0159/amugeona0159.github.io.git";
const PAGES_ORIGIN = "https://amugeona0159.github.io";
const CONFIG = path.join(ROOT, "public", "server-config.json");
const PORT = Number(process.env.PORT ?? 4000);

const noTunnel = process.argv.includes("--no-tunnel");
const noPublish = process.argv.includes("--no-publish") || noTunnel;

const children = new Set();
let shuttingDown = false;

/* ── 준비 ─────────────────────────────────────────────────────────── */

/** 실행 파일의 절대 경로. 셸을 거치면 Ctrl+C 때 자식이 아니라 셸만 죽는다 */
function which(bin) {
  const cmd = process.platform === "win32" ? "where" : "which";
  try {
    return execFileSync(cmd, [bin], { encoding: "utf8" }).split(/\r?\n/)[0].trim() || null;
  } catch {
    return null;
  }
}

/**
 * .env 를 배포용으로 맞춘다. 값을 지우지 않고 모자란 것만 채운다.
 * 이 둘이 빠지면 화면은 뜨는데 저장만 조용히 안 되는 상태가 된다 — 제일 찾기 어려운 고장이다.
 */
function ensureEnv() {
  const file = path.join(SERVER_DIR, ".env");
  if (!fs.existsSync(file)) {
    console.error("server/.env 가 없습니다. 먼저 .\\server\\setup.ps1 (또는 bash server/setup.sh) 을 돌리세요.");
    process.exit(1);
  }

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const fixed = [];
  let sawCors = false;
  let sawProxy = false;

  const patched = lines.map((line) => {
    const cors = line.match(/^CORS_ORIGIN\s*=\s*"?([^"]*)"?\s*$/);
    if (cors) {
      sawCors = true;
      const origins = cors[1].split(",").map((s) => s.trim()).filter(Boolean);
      if (origins.includes(PAGES_ORIGIN)) return line;
      fixed.push(`CORS_ORIGIN 에 ${PAGES_ORIGIN} 추가`);
      return `CORS_ORIGIN="${[PAGES_ORIGIN, ...origins].join(",")}"`;
    }
    // 터널 뒤에서는 req.ip 가 프록시 IP 라, 안 켜면 요청 제한이 사람별이 아니라 전역이 된다
    if (/^TRUST_PROXY\s*=/.test(line)) {
      sawProxy = true;
      if (/^TRUST_PROXY\s*=\s*1\s*$/.test(line)) return line;
      fixed.push("TRUST_PROXY=1");
      return "TRUST_PROXY=1";
    }
    return line;
  });

  if (!sawCors) {
    patched.push(`CORS_ORIGIN="${PAGES_ORIGIN},http://localhost:5173,http://localhost:4173"`);
    fixed.push("CORS_ORIGIN 추가");
  }
  if (!sawProxy) {
    patched.push("TRUST_PROXY=1");
    fixed.push("TRUST_PROXY=1 추가");
  }

  if (fixed.length) {
    fs.writeFileSync(file, patched.join("\n"));
    console.log(`      server/.env 손질 — ${fixed.join(" · ")}`);
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", (err) => resolve(err.code === "EADDRINUSE"));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(port, "127.0.0.1");
  });
}

async function health(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.ok === true;
  } catch {
    return false;
  }
}

async function waitFor(fn, { timeoutMs, everyMs = 1000, label }) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const got = await fn();
    if (got) return got;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  throw new Error(`${label} — ${Math.round(timeoutMs / 1000)}초 안에 응답이 없습니다.`);
}

/* ── 프로세스 ─────────────────────────────────────────────────────── */

function track(child, name) {
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.on("error", (err) => console.error(`[${name}] ${err.message}`));
  return child;
}

/** 윈도우의 kill 은 즉사라 SQLite 저널이 남는다. 먼저 곱게 닫아 보고 안 되면 그때 끊는다 */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T"], { stdio: "ignore" });
    } catch {
      /* 이미 죽었으면 그만 */
    }
    setTimeout(() => {
      try {
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } catch {
        /* 이미 죽었으면 그만 */
      }
    }, 3000).unref();
    return;
  }
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 3000).unref();
}

function startServer() {
  const entry = path.join(SERVER_DIR, "dist", "index.js");
  if (!fs.existsSync(entry)) {
    console.log("      서버 빌드가 없어 먼저 굽습니다");
    execFileSync("npm", ["--prefix", "server", "run", "build"], { cwd: ROOT, stdio: "inherit", shell: true });
  }
  const child = spawn(process.execPath, [entry], { cwd: SERVER_DIR, stdio: ["ignore", "pipe", "pipe"] });
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => process.stdout.write(chunk));
  }
  child.once("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n서버가 멈췄습니다 (code ${code}). 포트 ${PORT} 을 다른 프로세스가 쥐고 있는지 보세요.`);
    shutdown(1);
  });
  return track(child, "server");
}

/**
 * 임시 터널을 켜고 주소를 받아 온다.
 * 다시 켜지면 주소가 통째로 바뀌므로, 그때마다 onUrl 로 알려 화면 설정을 다시 올린다.
 */
function startTunnel(bin, onUrl) {
  const child = spawn(bin, ["tunnel", "--url", `http://localhost:${PORT}`], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let found = null;

  const scan = (chunk) => {
    // 로그에는 api.trycloudflare.com(발급 요청 주소)도 섞여 나온다. 그건 터널이 아니다.
    const hit = chunk.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
    if (hit && hit[0] !== found) {
      found = hit[0];
      onUrl(found);
    }
  };
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", scan);
  }

  child.once("exit", (code) => {
    if (shuttingDown) return;
    console.error(`\n터널이 끊겼습니다 (code ${code}). 5초 뒤 다시 켭니다 — 새 주소로 갱신됩니다.`);
    setTimeout(() => {
      if (!shuttingDown) startTunnel(bin, onUrl);
    }, 5000);
  });
  return track(child, "tunnel");
}

/* ── 화면에 주소 알리기 ───────────────────────────────────────────── */

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: cmd === "npm" });
}

/**
 * Pages 에 올라간 server-config.json 한 장만 갈아 끼운다.
 * 빌드 산출물은 건드리지 않으므로, 게임을 안 고쳤다면 다시 빌드할 이유가 없다.
 *
 * 저장소의 public/server-config.json 은 빈 채로 둔다. 여기에 터널 주소를 적으면
 * 개발 서버와 e2e 까지 그 주소를 보게 되어, 노트북 서버를 켜 두고도 로컬에서 아무 것도 안 붙는다.
 */
function publishApiBase(apiBase) {
  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "voyager-config-"));
  try {
    run("git", ["clone", "-q", "--depth", "1", PAGES_REPO, staging], os.tmpdir());
    if (!fs.existsSync(path.join(staging, "index.html"))) {
      console.warn("      경고: Pages 에 게임이 아직 없습니다. node scripts/deploy-pages.mjs 를 한 번 돌리세요.");
    }

    const target = path.join(staging, "server-config.json");
    const config = JSON.parse(fs.readFileSync(fs.existsSync(target) ? target : CONFIG, "utf8"));
    config.apiBase = apiBase;
    fs.writeFileSync(target, `${JSON.stringify(config, null, 2)}\n`);

    run("git", ["add", "server-config.json"], staging);
    const changed = execFileSync("git", ["status", "--porcelain"], { cwd: staging, encoding: "utf8" }).trim();
    if (!changed) {
      console.log("      Pages 에 이미 같은 주소가 올라가 있습니다");
      return;
    }
    run(
      "git",
      ["-c", "user.name=peeta0126", "-c", "user.email=kim3106611@gmail.com",
       "commit", "-q", "-m", `서버 주소 갱신 — ${new URL(apiBase).host}`],
      staging,
    );
    run("git", ["push", "-q", "origin", "main"], staging);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

/** Pages 가 실제로 새 주소를 내주기까지 기다린다. 여기까지 봐야 "이제 들어와도 된다"고 말할 수 있다 */
async function pagesServes(apiBase) {
  try {
    const res = await fetch(`${PAGES_ORIGIN}/server-config.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.apiBase === apiBase;
  } catch {
    return false;
  }
}

/* ── 흐름 ─────────────────────────────────────────────────────────── */

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n정리하고 종료합니다…");
  for (const child of children) killTree(child);
  setTimeout(() => process.exit(code), 500).unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => shutdown(0));

async function main() {
  console.log("[1/4] 준비 확인");
  ensureEnv();

  const cloudflared = noTunnel ? null : which("cloudflared");
  if (!noTunnel && !cloudflared) {
    console.error(
      "cloudflared 를 못 찾았습니다.\n" +
        "  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n" +
        "설치했는데도 이러면 새 터미널에서 다시 해 보세요(PATH 반영).",
    );
    process.exit(1);
  }

  console.log("[2/4] 서버");
  const localHealth = `http://localhost:${PORT}/api/health`;
  if (await portInUse(PORT)) {
    if (!(await health(localHealth))) {
      console.error(`포트 ${PORT} 을 다른 프로세스가 쥐고 있습니다. 그것부터 끄세요.`);
      process.exit(1);
    }
    console.log("      이미 떠 있는 서버를 그대로 씁니다");
  } else {
    startServer();
    await waitFor(() => health(localHealth), { timeoutMs: 20000, label: "서버가 안 떴습니다" });
    console.log(`      ${localHealth} → ok`);
  }

  if (noTunnel) {
    console.log("\n서버만 켠 상태입니다(--no-tunnel). Ctrl+C 로 끕니다.");
    return;
  }

  console.log("[3/4] 터널");
  let current = null;
  let publishing = null;

  async function announce(apiBase) {
    console.log(`      터널 주소 ${apiBase}`);
    await waitFor(() => health(`${apiBase}/health`), {
      timeoutMs: 30000,
      label: "터널로는 서버가 안 보입니다",
    });

    if (noPublish) {
      console.log("      --no-publish 라 Pages 에는 안 올립니다");
      return;
    }
    console.log("[4/4] 화면에 새 주소 알리기");
    publishApiBase(apiBase);
    process.stdout.write("      Pages 반영을 기다립니다");
    const tick = setInterval(() => process.stdout.write("."), 5000);
    try {
      await waitFor(() => pagesServes(apiBase), {
        timeoutMs: 240000,
        everyMs: 5000,
        label: "Pages 가 아직 옛 주소를 주고 있습니다",
      });
      console.log("\n\n" + "─".repeat(58));
      console.log("  준비 끝. 이 주소를 보내면 됩니다:");
      console.log(`  ${PAGES_ORIGIN}`);
      console.log("─".repeat(58));
      console.log("  상대는 「바로 시작」만 누르면 됩니다. 설치도 가입도 없습니다.");
      console.log("  이 창을 켜 두는 동안 진행이 서버에 저장됩니다.");
      console.log("  창을 닫아도 게임은 돌아갑니다 — 그동안은 그쪽 브라우저에만 남습니다.\n");
    } catch (err) {
      console.warn(`\n      ${err.message} 잠시 뒤 다시 열어 보세요.`);
    } finally {
      clearInterval(tick);
    }
  }

  const onUrl = (url) => {
    current = url;
    const apiBase = `${url}/api`;
    // 주소가 바뀔 때마다 이어서 돌린다. 겹쳐 돌리면 두 커밋이 같은 브랜치를 밀어 하나가 튕긴다.
    publishing = (publishing ?? Promise.resolve())
      .then(() => announce(apiBase))
      .catch((err) => console.error(`      알리기 실패: ${err.message}`));
  };

  startTunnel(cloudflared, onUrl);
  await waitFor(() => current, { timeoutMs: 60000, label: "터널 주소를 못 받았습니다" });
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  shutdown(1);
});
