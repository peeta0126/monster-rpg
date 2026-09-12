import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./prismaClient.js";

/**
 * DB 가 코드보다 뒤처져 있는지 본다.
 *
 * 둘이 같은 저장소를 쓰면 한쪽이 마이그레이션을 더한 날 다른 쪽의 dev.db 는 그대로다.
 * 그 상태로 서버가 뜨면 로그인할 때가 되어서야
 * `The column main.User.lastLoginAt does not exist` 같은 말로 죽는데, 화면에서는 그냥
 * "로그인이 안 된다" 로만 보인다. 원인이 뭔지 알 길이 없어서 기동할 때 미리 말해 둔다.
 *
 * **막지는 않는다.** 뒤처진 표를 안 건드리는 화면은 멀쩡히 돌아가고, 곁다리 검사 하나로
 * 서버를 못 뜨게 만들 이유가 없다.
 */
export async function warnIfMigrationsPending(): Promise<string[]> {
  let onDisk: string[];
  try {
    // dist/ 에서 돌 때와 tsx 로 src/ 에서 돌 때 둘 다 server/prisma 를 가리켜야 한다.
    const here = dirname(fileURLToPath(import.meta.url));
    onDisk = readdirSync(join(here, "..", "prisma", "migrations"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return []; // 마이그레이션 폴더를 못 읽으면 할 말이 없다
  }

  let applied: Set<string>;
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;
    applied = new Set(rows.map((r) => r.migration_name));
  } catch {
    return []; // 표가 아예 없으면 migrate deploy 가 알아서 만든다
  }

  const pending = onDisk.filter((name) => !applied.has(name)).sort();
  if (pending.length > 0) {
    console.warn(
      `[server] ⚠ DB 에 아직 안 들어간 마이그레이션 ${pending.length}건: ${pending.join(", ")}\n` +
      `[server]   고치려면: npx prisma migrate deploy  (server/ 에서)\n` +
      `[server]   안 하면 그 표를 건드리는 요청부터 500 으로 죽습니다.`,
    );
  }
  return pending;
}
