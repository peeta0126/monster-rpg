#!/usr/bin/env node
/**
 * 게임 화면을 GitHub Pages 에 올린다.
 *
 *   node scripts/deploy-pages.mjs
 *   node scripts/deploy-pages.mjs https://무작위-단어.trycloudflare.com/api
 *
 * 인자를 주면 `public/server-config.json` 의 apiBase 를 그 값으로 먼저 고친다.
 * 터널 주소는 cloudflared 를 다시 켤 때마다 바뀌므로 그때마다 이 명령 한 줄이면 된다.
 *
 * 배포 대상은 `<계정>.github.io` 저장소다. 하위 경로(`/monster-rpg/`)로 올리면
 * 코드에 박힌 "/assets/..." 절대경로가 전부 404 나기 때문에 최상위 저장소를 쓴다.
 * 절차와 배경은 docs/DEPLOY.md.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PAGES_REPO = "https://github.com/amugeona0159/amugeona0159.github.io.git";
const CONFIG = path.join(ROOT, "public", "server-config.json");

/**
 * npm 은 윈도우에서 npm.cmd 라 셸을 거쳐야 하지만, git 은 거치면 안 된다.
 * 셸을 켜면 인자를 cmd 가 다시 쪼개서, 띄어쓰기가 든 커밋 메시지가 통째로 깨진다.
 */
function run(cmd, args, cwd = ROOT) {
  execFileSync(cmd, args, { cwd, stdio: "inherit", shell: cmd === "npm" });
}

const apiBase = process.argv[2];
if (apiBase) {
  if (!/^https?:\/\//.test(apiBase)) {
    console.error(`주소가 http(s):// 로 시작해야 합니다: ${apiBase}`);
    process.exit(1);
  }
  if (!apiBase.endsWith("/api")) {
    // 이걸 빠뜨리면 화면은 뜨는데 저장만 조용히 안 된다. 제일 흔한 실수라 먼저 막는다.
    console.error(`주소 끝에 /api 를 붙여야 합니다: ${apiBase}/api`);
    process.exit(1);
  }
  console.log(`[1/4] 서버 주소 → ${apiBase}`);
} else {
  console.log("[1/4] 서버 주소는 지금 올라가 있는 것을 그대로 둡니다");
}

console.log("[2/4] 빌드");
run("npm", ["run", "build"]);

console.log("[3/4] 배포 저장소 받기");
const staging = fs.mkdtempSync(path.join(os.tmpdir(), "voyager-pages-"));
// 새로 init 해서 force push 하면 간단하지만, 이 저장소 규칙이 force push 를 금지한다.
// 받아서 내용만 갈아 끼우고 보통 커밋으로 올린다.
run("git", ["clone", "-q", "--depth", "1", PAGES_REPO, staging], os.tmpdir());

// 지금 올라가 있는 서버 주소. `npm run host` 가 터널을 켤 때마다 여기에만 적어 넣는다
// (저장소의 public/server-config.json 은 개발용으로 비어 있다). 갈아엎기 전에 건져 둔다.
const STAGED_CONFIG = path.join(staging, "server-config.json");
const liveApiBase = fs.existsSync(STAGED_CONFIG)
  ? JSON.parse(fs.readFileSync(STAGED_CONFIG, "utf8")).apiBase
  : "";

for (const entry of fs.readdirSync(staging)) {
  if (entry === ".git") continue;
  fs.rmSync(path.join(staging, entry), { recursive: true, force: true });
}
fs.cpSync(path.join(ROOT, "dist"), staging, { recursive: true });

const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
config.apiBase = apiBase ?? liveApiBase ?? "";
fs.writeFileSync(STAGED_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
if (config.apiBase) {
  console.log(`      서버 주소 ${config.apiBase}`);
} else {
  // 빈 채로 올라가면 화면이 자기 도메인의 /api 를 두드린다 — 저장이 통째로 안 된다.
  console.warn("      경고: 서버 주소가 비어 있습니다. npm run host 를 돌리거나 주소를 인자로 주세요.");
}

// 데모 영상은 public/ 이 아니라 여기서 얹는다. 녹화 산출물이라 화면 코드와 수명이 다르고,
// public/ 에 두면 14MB 를 dev 서버와 매 빌드가 통째로 다시 복사한다.
// 재생 페이지(public/demo/index.html)는 빌드에 들어가므로 파일만 옆에 놓으면 된다.
const demoVideo = path.join(ROOT, "design", "submission", "fullplay.webm");
if (fs.existsSync(demoVideo)) {
  fs.mkdirSync(path.join(staging, "demo"), { recursive: true });
  fs.copyFileSync(demoVideo, path.join(staging, "demo", "fullplay.webm"));
  console.log("      데모 영상 포함 — /demo/");
} else {
  // 영상만 빠진 채로 올라가면 재생 페이지가 검은 칸이 된다. 조용히 넘기지 않는다.
  console.warn(`      경고: ${path.relative(ROOT, demoVideo)} 없음 — /demo/ 는 빈 화면이 됩니다`);
}

// GitHub Pages 에는 SPA 폴백이 없다. /forest 에서 새로고침하면 404 라 같은 문서를 404 로도 둔다.
fs.copyFileSync(path.join(staging, "index.html"), path.join(staging, "404.html"));
fs.writeFileSync(path.join(staging, ".nojekyll"), "");

console.log("[4/4] 푸시");
run("git", ["add", "-A"], staging);
const changed = execFileSync("git", ["status", "--porcelain"], { cwd: staging, encoding: "utf8" }).trim();
if (!changed) {
  console.log("바뀐 게 없습니다. 올리지 않습니다.");
} else {
  run(
    "git",
    ["-c", "user.name=peeta0126", "-c", "user.email=kim3106611@gmail.com",
     "commit", "-q", "-m", "빌드 산출물 배포 — Voyager Atelier"],
    staging,
  );
  run("git", ["push", "-q", "origin", "main"], staging);
}

fs.rmSync(staging, { recursive: true, force: true });
console.log("\n끝. https://amugeona0159.github.io/ — 반영까지 1~2분 걸립니다.");
