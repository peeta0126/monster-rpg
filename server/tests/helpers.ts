import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import type { Server } from "node:http";

/**
 * 테스트는 개발용 dev.db 를 건드리지 않는다.
 *
 * e2e 가 이미 dev.db 에 계정을 쌓고 있어서, 여기서까지 같은 파일을 쓰면
 * "이력 10판" 같은 개수 검사가 남의 데이터에 걸려 흔들린다.
 * DATABASE_URL 은 prismaClient 를 import 하기 전에 바꿔야 한다 — 그래서 동적 import 를 쓴다.
 */
const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_DB = path.join(SERVER_DIR, "prisma", "test.db");

export function prepareTestDb(): void {
  process.env.DATABASE_URL = "file:./test.db";
  process.env.JWT_SECRET ??= "test-secret-not-used-anywhere-else";
  process.env.ADMIN_SECRET ??= "test-admin-secret";

  // 매번 새로 만든다. 남은 행이 있으면 "몇 판 남았나" 류의 검사가 앞 실행에 물린다.
  for (const suffix of ["", "-journal"]) {
    const file = `${TEST_DB}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    encoding: "utf8",
    shell: true,
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy 실패:\n${result.stdout}\n${result.stderr}`);
  }
}

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** 포트를 0 으로 열어 OS 가 고르게 한다. 고정 포트를 쓰면 개발 서버가 떠 있을 때 충돌한다 */
export async function startTestServer(): Promise<TestServer> {
  const { createApp } = await import("../src/app.js");
  const { prisma } = await import("../src/prismaClient.js");

  const server: Server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("포트를 얻지 못했다");

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await prisma.$disconnect();
    },
  };
}

export interface ApiResult<T> {
  status: number;
  body: T;
}

export async function api<T = Record<string, unknown>>(
  base: string,
  path: string,
  init?: RequestInit & { token?: string; adminSecret?: string },
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  if (init?.adminSecret) headers["x-admin-secret"] = init.adminSecret;

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string>) },
  });
  const body = res.status === 204 ? ({} as T) : ((await res.json().catch(() => ({}))) as T);
  return { status: res.status, body };
}
