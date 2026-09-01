/**
 * 터미널에서 한 줄로 "누가 들어왔고 어디까지 했나" 를 본다.
 *
 *   npm --prefix server run report
 *   npm --prefix server run report -- --user admin
 *   npm --prefix server run report -- --days 30 --json
 *
 * 관리 화면(`/admin`)과 같은 것을 보지만 브라우저도 비밀키도 필요 없다. DB 파일을 직접
 * 읽으므로 **서버가 꺼져 있어도 돈다** — 서버가 안 뜨는 날 상태를 보려는 게 이 스크립트를
 * 만든 이유의 절반이다.
 *
 * ⚠ **이름을 붙이지 않는다.** 몬스터·재료·아티팩트 이름표는 게임 쪽(`src/`)에만 있고,
 * 여기로 가져오면 표가 두 벌이 된다 — 게임에서 이름을 고친 날 이 리포트만 옛 이름을
 * 계속 부른다. 서버가 세어 준 숫자까지가 여기서 낼 수 있는 전부이고, 이름이 필요하면
 * `/admin` 의 「진행」을 본다. `summarizeSave` 도 서버 것을 그대로 가져다 쓴다 —
 * 여기서 다시 세면 관리 화면과 리포트가 다른 숫자를 말하게 된다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/prismaClient.js";
import { summarizeSave, type SaveSummary } from "../src/saveSummary.js";
import { env } from "../src/env.js";

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ── 인자 ────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const has = (flag: string) => argv.includes(flag);
function value(flag: string): string | null {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

const asJson = has("--json");
const days = Math.min(Math.max(Number(value("--days")) || 7, 1), 365);
const onlyUser = value("--user");

/* ── 폭 맞추기 ───────────────────────────────────────────────────────── */

/**
 * 한글은 터미널에서 두 칸을 먹는다. `padEnd` 는 글자 수로 세니까 한글이 섞인 칸을
 * 그대로 두면 표가 어긋난다 — 아이디는 영문이지만 상태 칸("가입만"·"뜸함")이 한글이다.
 */
function width(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    const wide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6);
    w += wide ? 2 : 1;
  }
  return w;
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - width(s)));
const padStart = (s: string, n: number) => " ".repeat(Math.max(0, n - width(s))) + s;

/* ── 시각 ────────────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

function stamp(d: Date | null): string {
  if (!d) return "-";
  return `${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "2시간 전" 이 "09-01 09:01" 보다 먼저 읽힌다. 둘 다 낸다 */
function ago(d: Date | null): string {
  if (!d) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  const day = Math.floor(sec / 86400);
  return day < 30 ? `${day}일 전` : `${Math.floor(day / 30)}달 전`;
}

function bytes(n: number | null): string {
  if (n === null) return "알 수 없음";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ── 곁다리 사실들 ───────────────────────────────────────────────────── */

/**
 * DB 는 직접 읽으므로 서버가 꺼져 있어도 표는 나온다. 그래도 "지금 서버가 떠 있나" 는
 * 같이 알려준다 — 그걸 모르면 화면이 안 열리는 이유를 여기서 못 찾는다.
 */
async function serverAlive(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${env.port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 파일을 못 읽는다고 표 전체를 실패시키지 않는다 (`admin.ts` 의 `readDbBytes` 와 같은 이유) */
function dbBytes(): number | null {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return null;
  try {
    return fs.statSync(path.resolve(SERVER_DIR, "prisma", url.slice("file:".length))).size;
  } catch {
    return null;
  }
}

/* ── 읽기 ────────────────────────────────────────────────────────────── */

interface Row {
  id: string;
  username: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  lastEventAt: Date | null;
  saveUpdatedAt: Date | null;
  revision: number | null;
  loginCount: number;
  failCount: number;
  recentLoginCount: number;
  summary: SaveSummary | null;
}

async function collect() {
  const since = new Date(Date.now() - days * 86400_000);

  const [users, rollup, windowRollup, lastByUser, firstEvent, recent, orphanFails] =
    await Promise.all([
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        include: { saveData: { select: { updatedAt: true, revision: true, data: true } } },
      }),
      // 사람마다 세면 계정 수만큼 질의가 나간다. 한 번에 묶어 세고 여기서 나눠 붙인다.
      prisma.loginEvent.groupBy({ by: ["userId", "kind"], _count: { _all: true } }),
      prisma.loginEvent.groupBy({
        by: ["userId"],
        where: { kind: { in: ["login", "register"] }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.loginEvent.groupBy({
        by: ["userId"],
        where: { kind: { in: ["login", "register"] } },
        _max: { createdAt: true },
      }),
      prisma.loginEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.loginEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
      // 없는 아이디로 온 실패는 어느 계정에도 안 붙어서 사람 목록에는 영영 안 보인다
      prisma.loginEvent.findMany({
        where: { kind: "fail", userId: null },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
    ]);

  const at = (userId: string, kind: string) =>
    rollup.find((g) => g.userId === userId && g.kind === kind)?._count._all ?? 0;
  const win = new Map(windowRollup.map((g) => [g.userId, g._count._all]));
  const last = new Map(lastByUser.map((g) => [g.userId, g._max.createdAt]));

  const rows: Row[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    lastEventAt: last.get(u.id) ?? null,
    saveUpdatedAt: u.saveData?.updatedAt ?? null,
    revision: u.saveData?.revision ?? null,
    loginCount: at(u.id, "login") + at(u.id, "register"),
    failCount: at(u.id, "fail"),
    recentLoginCount: win.get(u.id) ?? 0,
    summary: summarizeSave(u.saveData?.data),
  }));

  return { rows, recent, orphanFails, trackingSince: firstEvent?.createdAt ?? null };
}

/* ── 사람이 읽는 상태 ────────────────────────────────────────────────── */

/**
 * 숫자만 늘어놓으면 스무 줄에서 누구를 봐야 할지 모른다. 한 낱말로 접어 준다.
 * **`아직` 과 `0층` 을 가르는 것과 같은 이유다** — 안 들어온 사람과 들어와서 진 사람은 다르다.
 */
function state(r: Row): string {
  if (!r.saveUpdatedAt && !r.lastLoginAt) return "가입만";
  if (!r.saveUpdatedAt) return "안 논다";
  if (r.recentLoginCount > 0) return "활동";
  const anchor = r.lastEventAt ?? r.saveUpdatedAt ?? r.lastLoginAt;
  const idle = anchor ? (Date.now() - anchor.getTime()) / 86400_000 : Infinity;
  if (idle <= days) return "활동";
  if (idle <= 30) return "뜸함";
  return "떠남";
}

function progress(s: SaveSummary | null): string {
  if (!s) return "아직";
  return s.towerCleared ? `${s.bestFloor}층 클리어` : `${s.bestFloor}층`;
}

const KIND: Record<string, string> = { login: "로그인", register: "가입", fail: "실패" };

/* ── 출력 ────────────────────────────────────────────────────────────── */

async function main() {
  const { rows, recent, orphanFails, trackingSince } = await collect();
  const alive = await serverAlive();

  if (asJson) {
    console.log(JSON.stringify({ alive, days, trackingSince, rows, recent, orphanFails }, null, 2));
    return;
  }

  const withSave = rows.filter((r) => r.saveUpdatedAt).length;
  console.log("");
  console.log(
    `계정 ${rows.length}명 · 세이브 ${withSave}개 · DB ${bytes(dbBytes())} · 서버 ${
      alive ? `살아 있음 (:${env.port})` : "꺼져 있음"
    }`,
  );

  // 기록이 언제부터 쌓였는지를 안 적으면 "접속 0회" 가 "한 번도 안 들어옴" 으로 읽힌다.
  // 이 표는 기능이 들어간 날부터 쌓이고, 그 전의 접속은 아무 데도 안 남아 있다.
  console.log(
    trackingSince
      ? `접속 기록은 ${stamp(trackingSince)} 부터 쌓였습니다. 그 전 접속은 세지 못합니다.`
      : "접속 기록이 아직 없습니다 — 다음 로그인부터 쌓입니다.",
  );
  console.log("");

  if (onlyUser) {
    detail(rows.find((r) => r.username === onlyUser) ?? null);
    return;
  }

  if (rows.length === 0) {
    console.log("가입된 계정이 없습니다.");
    console.log("");
    return;
  }

  // 없는 아이디로 온 실패는 계정 목록에 없다. 그것까지 재야 아래 「최근 접속」 이 안 밀린다.
  const nameW = Math.max(
    6,
    ...rows.map((r) => width(r.username)),
    ...recent.map((e) => width(e.username)),
  );

  console.log(
    `${pad("아이디", nameW)}  ${pad("상태", 7)}  ${pad("가입", 11)}  ${pad("마지막 접속", 24)}  ` +
      `${padStart("접속", 6)}  ${pad("진행", 12)}  ${pad("도감", 10)}  ${pad("퀘스트", 12)}`,
  );
  console.log("-".repeat(nameW + 89));

  for (const r of rows) {
    const seen = r.lastEventAt ?? r.lastLoginAt;
    // 기록이 켜지기 전에 들어온 사람은 "0회" 가 아니라 "기록전" 이다.
    const count = r.loginCount === 0 && r.lastLoginAt ? "기록전" : `${r.loginCount}회`;
    const dex = r.summary ? `${r.summary.dexCaught}/${r.summary.dexSeen}마리` : "-";
    const quest = r.summary ? `${r.summary.questsCompleted}완 ${r.summary.questsInProgress}중` : "-";
    console.log(
      `${pad(r.username, nameW)}  ${pad(state(r), 7)}  ${pad(stamp(r.createdAt), 11)}  ` +
        `${pad(seen ? `${stamp(seen)} (${ago(seen)})` : "-", 24)}  ${padStart(count, 6)}  ` +
        `${pad(progress(r.summary), 12)}  ${pad(dex, 10)}  ${pad(quest, 12)}`,
    );
  }

  console.log("");

  const never = rows.filter((r) => !r.saveUpdatedAt);
  if (never.length > 0) {
    console.log(`· 한 번도 안 논 계정 ${never.length}명: ${never.map((r) => r.username).join(", ")}`);
  }
  const failed = rows.filter((r) => r.failCount > 0);
  if (failed.length > 0) {
    console.log(`· 로그인 실패: ${failed.map((r) => `${r.username} ${r.failCount}회`).join(", ")}`);
  }
  if (orphanFails.length > 0) {
    const names = [...new Set(orphanFails.map((e) => e.username))].join(", ");
    console.log(`· 없는 아이디로 시도 ${orphanFails.length}건: ${names}`);
  }

  if (recent.length > 0) {
    console.log("");
    console.log("최근 접속");
    for (const e of recent) {
      console.log(
        `  ${stamp(e.createdAt)}  ${pad(KIND[e.kind] ?? e.kind, 8)}${pad(e.username, nameW)}  ${e.ip ?? "-"}`,
      );
    }
  }
  console.log("");
}

/** 한 사람만. 이름 없이 숫자만 낸다 — 이름은 `/admin` 의 「진행」이 붙인다 */
function detail(r: Row | null) {
  if (!r) {
    console.log(`그런 아이디가 없습니다: ${onlyUser}`);
    process.exitCode = 1;
    return;
  }
  const s = r.summary;
  const line = (k: string, v: string) => console.log(`  ${pad(k, 14)}${v}`);
  const seen = r.lastEventAt ?? r.lastLoginAt;

  console.log(r.username);
  line("가입", `${stamp(r.createdAt)} (${ago(r.createdAt)})`);
  line("마지막 접속", seen ? `${stamp(seen)} (${ago(seen)})` : "-");
  line(
    "접속",
    r.loginCount === 0 && r.lastLoginAt
      ? "기록이 켜지기 전이라 셀 수 없습니다"
      : `${r.loginCount}회 (최근 ${days}일 ${r.recentLoginCount}회)`,
  );
  line("로그인 실패", `${r.failCount}회`);
  line(
    "마지막 저장",
    r.saveUpdatedAt ? `${stamp(r.saveUpdatedAt)} (${ago(r.saveUpdatedAt)}) · rev${r.revision}` : "-",
  );

  if (!s) {
    console.log("");
    console.log("  세이브가 없거나 읽을 수 없습니다.");
    console.log("");
    return;
  }
  console.log("");
  line("진행", progress(s));
  line("파티", `${s.partyCount}마리 (보관함 ${s.storageCount})`);
  line("도감", `본 것 ${s.dexSeen} · 잡은 것 ${s.dexCaught}`);
  line("장비", `${s.artifacts}개`);
  line("재료", `${s.materials}개`);
  line("물약", `${s.potions}개`);
  line("퀘스트", `완료 ${s.questsCompleted} · 진행 ${s.questsInProgress}`);
  line("세이브 크기", bytes(s.bytes));
  console.log("");
  console.log("  아이템·몬스터 이름은 /admin 의 「진행」에서 봅니다 (표가 게임 쪽에만 있습니다).");
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
