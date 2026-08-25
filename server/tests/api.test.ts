import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { prepareTestDb, startTestServer, api, type TestServer } from "./helpers.js";

/**
 * 세이브 서버의 계약을 지킨다.
 *
 * 클라이언트(`src/auth/api.ts`·`useSaveSync.ts`)가 여기 응답 모양에 그대로 기대고 있다.
 * 특히 409 는 본문에 서버 세이브를 실어 보내야 한다 — 클라이언트가 그걸로 자기 상태를 맞춘다.
 */

prepareTestDb();

let server: TestServer;
const base = () => server.url;

before(async () => {
  server = await startTestServer();
});

after(async () => {
  await server.close();
});

interface AuthBody {
  token: string;
  username: string;
  isAnonymous?: boolean;
  password?: string;
  error?: string;
}

interface SaveBody {
  data: string | null;
  version: number | null;
  revision: number;
  updatedAt: string | null;
  error?: string;
  conflict?: boolean;
}

interface AdminStats {
  uptimeSeconds: number;
  startedAt: string;
  nodeVersion: string;
  dbBytes: number | null;
  userCount: number;
  anonCount: number;
  saveCount: number;
  historyCount: number;
  lastSavedAt: string | null;
}

async function newAnon(): Promise<AuthBody> {
  const res = await api<AuthBody>(base(), "/api/auth/anon", { method: "POST" });
  assert.equal(res.status, 201);
  return res.body;
}

const save = (obj: unknown) => JSON.stringify(obj);

describe("health", () => {
  test("DB 까지 확인한다", async () => {
    const res = await api<{ ok: boolean; db: boolean }>(base(), "/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.db, true);
  });
});

describe("회원가입·로그인", () => {
  test("가입하면 토큰이 나온다", async () => {
    const res = await api<AuthBody>(base(), "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "voyager_1", password: "pw1234" }),
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.username, "voyager_1");
    assert.ok(res.body.token);
  });

  test("같은 아이디는 409", async () => {
    const res = await api<AuthBody>(base(), "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "voyager_1", password: "pw1234" }),
    });
    assert.equal(res.status, 409);
  });

  test("아이디 형식과 비밀번호 길이를 본다", async () => {
    const badName = await api(base(), "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "짧", password: "pw1234" }),
    });
    assert.equal(badName.status, 400);

    const shortPw = await api(base(), "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "voyager_2", password: "pw" }),
    });
    assert.equal(shortPw.status, 400);
  });

  test("없는 계정과 틀린 비밀번호가 같은 응답이다", async () => {
    const noUser = await api<AuthBody>(base(), "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "nobody_here", password: "pw1234" }),
    });
    const badPw = await api<AuthBody>(base(), "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "voyager_1", password: "wrong" }),
    });
    assert.equal(noUser.status, 401);
    assert.equal(badPw.status, 401);
    assert.equal(noUser.body.error, badPw.body.error);
  });
});

describe("익명 계정", () => {
  test("아이디 없이 계정을 받고, 받은 비밀번호로 다시 로그인된다", async () => {
    const anon = await newAnon();
    assert.ok(anon.username.startsWith("guest_"));
    assert.equal(anon.isAnonymous, true);
    assert.ok(anon.password);

    const again = await api<AuthBody>(base(), "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: anon.username, password: anon.password }),
    });
    assert.equal(again.status, 200);
    assert.equal(again.body.isAnonymous, true);
  });

  test("아이디를 붙이면 정식 계정이 되고 세이브가 남는다", async () => {
    const anon = await newAnon();
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 7 }), version: 2, baseRevision: 0 }),
    });

    const linked = await api<AuthBody>(base(), "/api/auth/link", {
      method: "POST",
      token: anon.token,
      body: JSON.stringify({ username: "linked_one", password: "pw1234" }),
    });
    assert.equal(linked.status, 200);
    assert.equal(linked.body.username, "linked_one");
    assert.equal(linked.body.isAnonymous, false);

    const kept = await api<SaveBody>(base(), "/api/save", { token: linked.body.token });
    assert.equal(kept.body.data, save({ bestFloor: 7 }));
  });

  test("이미 아이디가 있는 계정은 다시 연결할 수 없다", async () => {
    const login = await api<AuthBody>(base(), "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "linked_one", password: "pw1234" }),
    });
    const again = await api(base(), "/api/auth/link", {
      method: "POST",
      token: login.body.token,
      body: JSON.stringify({ username: "another_one", password: "pw1234" }),
    });
    assert.equal(again.status, 409);
  });
});

describe("세이브", () => {
  test("인증이 없으면 401", async () => {
    assert.equal((await api(base(), "/api/save")).status, 401);
    assert.equal(
      (await api(base(), "/api/save", { method: "PUT", body: JSON.stringify({ data: "{}" }) })).status,
      401,
    );
  });

  test("비어 있으면 data 가 null 이고 revision 은 0 이다", async () => {
    const anon = await newAnon();
    const res = await api<SaveBody>(base(), "/api/save", { token: anon.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
    assert.equal(res.body.revision, 0);
  });

  test("올릴 때마다 revision 이 1씩 는다", async () => {
    const anon = await newAnon();
    const first = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 2, baseRevision: 0 }),
    });
    assert.equal(first.body.revision, 1);

    const second = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 2 }), version: 2, baseRevision: 1 }),
    });
    assert.equal(second.body.revision, 2);
  });

  test("version 을 그대로 돌려준다 — 서버 세이브도 마이그레이션을 타야 한다", async () => {
    const anon = await newAnon();
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 1, baseRevision: 0 }),
    });
    const res = await api<SaveBody>(base(), "/api/save", { token: anon.token });
    assert.equal(res.body.version, 1);
  });

  test("JSON 객체가 아니면 400", async () => {
    const anon = await newAnon();
    for (const data of ["not json", "[1,2,3]", "null"]) {
      const res = await api(base(), "/api/save", {
        method: "PUT",
        token: anon.token,
        body: JSON.stringify({ data, version: 2, baseRevision: 0 }),
      });
      assert.equal(res.status, 400, `data=${data}`);
    }
  });

  test("너무 크면 413", async () => {
    const anon = await newAnon();
    const big = save({ pad: "x".repeat(520 * 1024) });
    const res = await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: big, version: 2, baseRevision: 0 }),
    });
    assert.equal(res.status, 413);
  });
});

describe("충돌 — 서버가 이긴다", () => {
  test("뒤처진 baseRevision 은 409 로 되돌리고 서버 세이브를 함께 준다", async () => {
    const anon = await newAnon();
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 10 }), version: 2, baseRevision: 0 }),
    });
    // 다른 기기가 먼저 올렸다고 치자
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 20 }), version: 2, baseRevision: 1 }),
    });

    // 이쪽은 아직 revision 1 을 들고 있다
    const stale = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 11 }), version: 2, baseRevision: 1 }),
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.conflict, true);
    assert.equal(stale.body.data, save({ bestFloor: 20 }));
    assert.equal(stale.body.revision, 2);

    // 서버는 안 밀렸다
    const current = await api<SaveBody>(base(), "/api/save", { token: anon.token });
    assert.equal(current.body.data, save({ bestFloor: 20 }));
  });

  test("baseRevision 을 안 보내면 그냥 덮어쓴다(첫 업로드 경로)", async () => {
    const anon = await newAnon();
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 2, baseRevision: 0 }),
    });
    const res = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: save({ bestFloor: 5 }), version: 2, baseRevision: null }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data, save({ bestFloor: 5 }));
  });
});

describe("세이브 이력", () => {
  test("덮이기 전 세이브가 남고, 10판까지만 유지된다", async () => {
    const anon = await newAnon();
    const admin = process.env.ADMIN_SECRET!;

    for (let i = 0; i <= 14; i += 1) {
      await api(base(), "/api/save", {
        method: "PUT",
        token: anon.token,
        body: JSON.stringify({ data: save({ bestFloor: i }), version: 2, baseRevision: i }),
      });
    }

    const users = await api<{ id: string; username: string }[]>(base(), "/api/admin/users", {
      adminSecret: admin,
    });
    const me = users.body.find((u) => u.username === anon.username)!;
    assert.ok(me);

    const history = await api<{ id: string; revision: number }[]>(
      base(),
      `/api/admin/users/${me.id}/history`,
      { adminSecret: admin },
    );
    assert.equal(history.body.length, 10);

    // 되돌리면 그 내용이 현재 세이브가 된다
    const oldest = history.body[history.body.length - 1];
    const restored = await api<{ revision: number }>(
      base(),
      `/api/admin/users/${me.id}/restore/${oldest.id}`,
      { method: "POST", adminSecret: admin },
    );
    assert.equal(restored.status, 200);

    // 이력 한 줄의 revision 은 "덮이기 전 판 번호"다. 그 판에 들어 있던 값은 하나 앞선 것이다.
    const now = await api<SaveBody>(base(), "/api/save", { token: anon.token });
    assert.equal(now.body.data, save({ bestFloor: oldest.revision - 1 }));
  });

  test("같은 내용을 다시 올리면 이력이 늘지 않는다", async () => {
    const anon = await newAnon();
    const admin = process.env.ADMIN_SECRET!;
    const same = save({ bestFloor: 3 });

    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: same, version: 2, baseRevision: 0 }),
    });
    await api(base(), "/api/save", {
      method: "PUT",
      token: anon.token,
      body: JSON.stringify({ data: same, version: 2, baseRevision: 1 }),
    });

    const users = await api<{ id: string; username: string }[]>(base(), "/api/admin/users", {
      adminSecret: admin,
    });
    const me = users.body.find((u) => u.username === anon.username)!;
    const history = await api<unknown[]>(base(), `/api/admin/users/${me.id}/history`, {
      adminSecret: admin,
    });
    assert.equal(history.body.length, 0);
  });
});

describe("관리자", () => {
  test("비밀키가 없으면 401", async () => {
    assert.equal((await api(base(), "/api/admin/users")).status, 401);
    assert.equal((await api(base(), "/api/admin/users", { adminSecret: "wrong" })).status, 401);
  });

  test("세이브가 없는 익명 계정을 청소한다", async () => {
    const admin = process.env.ADMIN_SECRET!;
    await newAnon(); // 방금 만든 것은 24시간 기준에 안 걸린다

    const none = await api<{ deleted: number }>(base(), "/api/admin/cleanup-anon", {
      method: "POST",
      adminSecret: admin,
    });
    assert.equal(none.body.deleted, 0);

    // 기준을 0시간으로 낮추면 세이브 없는 익명 계정이 지워진다
    const swept = await api<{ deleted: number }>(base(), "/api/admin/cleanup-anon?hours=0", {
      method: "POST",
      adminSecret: admin,
    });
    assert.ok(swept.body.deleted > 0);
  });

  test("서버 통계는 비밀키가 있어야 나온다", async () => {
    assert.equal((await api(base(), "/api/admin/stats")).status, 401);
    assert.equal((await api(base(), "/api/admin/stats", { adminSecret: "wrong" })).status, 401);
  });

  test("계정과 세이브를 하나 더 만들면 통계도 하나씩 는다", async () => {
    const admin = process.env.ADMIN_SECRET!;
    const stats = () => api<AdminStats>(base(), "/api/admin/stats", { adminSecret: admin });

    const before = (await stats()).body;

    const user = await newAnon();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 3 }), version: 2, baseRevision: 0 }),
    });

    const after = (await stats()).body;
    assert.equal(after.userCount, before.userCount + 1);
    assert.equal(after.saveCount, before.saveCount + 1);
    assert.equal(after.anonCount, before.anonCount + 1);
    assert.ok(after.lastSavedAt, "방금 저장했으니 마지막 저장 시각이 있어야 한다");

    // 켜진 시간과 DB 크기는 값 자체를 못 박을 수 없다. 모양만 본다 —
    // 파일을 못 읽는 환경에서도 통계 전체가 죽지 않아야 하므로 null 을 허용한다.
    assert.equal(typeof after.uptimeSeconds, "number");
    assert.ok(after.dbBytes === null || typeof after.dbBytes === "number");
  });
});
