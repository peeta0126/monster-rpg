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
  saveCount: number;
  historyCount: number;
  lastSavedAt: string | null;
}

/** 테스트용 계정 하나. 아이디가 겹치면 409 라 실행마다 새 이름을 쓴다 */
let seq = 0;
async function newUser(): Promise<AuthBody> {
  seq += 1;
  const res = await api<AuthBody>(base(), "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username: `t${Date.now().toString(36)}_${seq}`, password: "pw1234" }),
  });
  assert.equal(res.status, 201, `계정 생성 실패: ${JSON.stringify(res.body)}`);
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

describe("세이브", () => {
  test("인증이 없으면 401", async () => {
    assert.equal((await api(base(), "/api/save")).status, 401);
    assert.equal(
      (await api(base(), "/api/save", { method: "PUT", body: JSON.stringify({ data: "{}" }) })).status,
      401,
    );
  });

  test("비어 있으면 data 가 null 이고 revision 은 0 이다", async () => {
    const user = await newUser();
    const res = await api<SaveBody>(base(), "/api/save", { token: user.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
    assert.equal(res.body.revision, 0);
  });

  test("올릴 때마다 revision 이 1씩 는다", async () => {
    const user = await newUser();
    const first = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 2, baseRevision: 0 }),
    });
    assert.equal(first.body.revision, 1);

    const second = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 2 }), version: 2, baseRevision: 1 }),
    });
    assert.equal(second.body.revision, 2);
  });

  test("version 을 그대로 돌려준다 — 서버 세이브도 마이그레이션을 타야 한다", async () => {
    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 1, baseRevision: 0 }),
    });
    const res = await api<SaveBody>(base(), "/api/save", { token: user.token });
    assert.equal(res.body.version, 1);
  });

  test("JSON 객체가 아니면 400", async () => {
    const user = await newUser();
    for (const data of ["not json", "[1,2,3]", "null"]) {
      const res = await api(base(), "/api/save", {
        method: "PUT",
        token: user.token,
        body: JSON.stringify({ data, version: 2, baseRevision: 0 }),
      });
      assert.equal(res.status, 400, `data=${data}`);
    }
  });

  test("너무 크면 413", async () => {
    const user = await newUser();
    const big = save({ pad: "x".repeat(520 * 1024) });
    const res = await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: big, version: 2, baseRevision: 0 }),
    });
    assert.equal(res.status, 413);
  });
});

describe("충돌 — 서버가 이긴다", () => {
  test("뒤처진 baseRevision 은 409 로 되돌리고 서버 세이브를 함께 준다", async () => {
    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 10 }), version: 2, baseRevision: 0 }),
    });
    // 다른 기기가 먼저 올렸다고 치자
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 20 }), version: 2, baseRevision: 1 }),
    });

    // 이쪽은 아직 revision 1 을 들고 있다
    const stale = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 11 }), version: 2, baseRevision: 1 }),
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.conflict, true);
    assert.equal(stale.body.data, save({ bestFloor: 20 }));
    assert.equal(stale.body.revision, 2);

    // 서버는 안 밀렸다
    const current = await api<SaveBody>(base(), "/api/save", { token: user.token });
    assert.equal(current.body.data, save({ bestFloor: 20 }));
  });

  test("baseRevision 을 안 보내면 그냥 덮어쓴다(첫 업로드 경로)", async () => {
    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 1 }), version: 2, baseRevision: 0 }),
    });
    const res = await api<SaveBody>(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 5 }), version: 2, baseRevision: null }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data, save({ bestFloor: 5 }));
  });
});

describe("세이브 이력", () => {
  test("덮이기 전 세이브가 남고, 10판까지만 유지된다", async () => {
    const user = await newUser();
    const admin = process.env.ADMIN_SECRET!;

    for (let i = 0; i <= 14; i += 1) {
      await api(base(), "/api/save", {
        method: "PUT",
        token: user.token,
        body: JSON.stringify({ data: save({ bestFloor: i }), version: 2, baseRevision: i }),
      });
    }

    const users = await api<{ id: string; username: string }[]>(base(), "/api/admin/users", {
      adminSecret: admin,
    });
    const me = users.body.find((u) => u.username === user.username)!;
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
    const now = await api<SaveBody>(base(), "/api/save", { token: user.token });
    assert.equal(now.body.data, save({ bestFloor: oldest.revision - 1 }));
  });

  test("같은 내용을 다시 올리면 이력이 늘지 않는다", async () => {
    const user = await newUser();
    const admin = process.env.ADMIN_SECRET!;
    const same = save({ bestFloor: 3 });

    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: same, version: 2, baseRevision: 0 }),
    });
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: same, version: 2, baseRevision: 1 }),
    });

    const users = await api<{ id: string; username: string }[]>(base(), "/api/admin/users", {
      adminSecret: admin,
    });
    const me = users.body.find((u) => u.username === user.username)!;
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

  test("서버 통계는 비밀키가 있어야 나온다", async () => {
    assert.equal((await api(base(), "/api/admin/stats")).status, 401);
    assert.equal((await api(base(), "/api/admin/stats", { adminSecret: "wrong" })).status, 401);
  });

  test("계정과 세이브를 하나 더 만들면 통계도 하나씩 는다", async () => {
    const admin = process.env.ADMIN_SECRET!;
    const stats = () => api<AdminStats>(base(), "/api/admin/stats", { adminSecret: admin });

    const before = (await stats()).body;

    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ bestFloor: 3 }), version: 2, baseRevision: 0 }),
    });

    const after = (await stats()).body;
    assert.equal(after.userCount, before.userCount + 1);
    assert.equal(after.saveCount, before.saveCount + 1);
    assert.ok(after.lastSavedAt, "방금 저장했으니 마지막 저장 시각이 있어야 한다");

    // 켜진 시간과 DB 크기는 값 자체를 못 박을 수 없다. 모양만 본다 —
    // 파일을 못 읽는 환경에서도 통계 전체가 죽지 않아야 하므로 null 을 허용한다.
    assert.equal(typeof after.uptimeSeconds, "number");
    assert.ok(after.dbBytes === null || typeof after.dbBytes === "number");
  });
});

/**
 * 관리 화면이 "이 사람이 어디까지 갔나" 를 읽는 길.
 *
 * 요약은 서버가 세이브 JSON 을 풀어 숫자만 센 것이다. 클라이언트가 만든 문자열이라
 * 깨져 있을 수 있고, 그때 목록 전체가 죽으면 안 된다 — 그게 여기서 제일 중요한 판이다.
 */
describe("관리자 — 진행 상황", () => {
  const admin = () => process.env.ADMIN_SECRET!;

  const progressSave = save({
    party: [{ id: "a" }, { id: "b" }],
    storage: [{ id: "c" }],
    dexSeen: ["a", "b", "c"],
    dexCaught: ["a", "b"],
    materials: { herb: 3, berry: 2 },
    potions: { potion: 1 },
    bestFloor: 27,
    storyFlags: { tower_cleared: true },
    questStatus: { q1: "completed", q2: "in_progress", q3: "not_accepted" },
    craftedArtifacts: [{}, {}],
  });

  interface AdminUserRow {
    id: string;
    username: string;
    lastLoginAt: string | null;
    saveRevision: number | null;
    summary: {
      bestFloor: number;
      towerCleared: boolean;
      partyCount: number;
      storageCount: number;
      dexSeen: number;
      dexCaught: number;
      artifacts: number;
      materials: number;
      potions: number;
      questsCompleted: number;
      questsInProgress: number;
      bytes: number;
    } | null;
  }

  async function rowFor(username: string): Promise<AdminUserRow> {
    const res = await api<AdminUserRow[]>(base(), "/api/admin/users", { adminSecret: admin() });
    const row = res.body.find((u) => u.username === username);
    assert.ok(row, `목록에 ${username} 이 없습니다`);
    return row;
  }

  test("목록이 진행 요약을 같이 낸다", async () => {
    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: progressSave, version: 2, baseRevision: 0 }),
    });

    const row = await rowFor(user.username);
    assert.deepEqual(
      { ...row.summary, bytes: 0 },
      {
        bestFloor: 27,
        towerCleared: true,
        partyCount: 2,
        storageCount: 1,
        dexSeen: 3,
        dexCaught: 2,
        artifacts: 2,
        materials: 5,
        potions: 1,
        questsCompleted: 1,
        questsInProgress: 1,
        bytes: 0,
      },
    );
    assert.ok((row.summary?.bytes ?? 0) > 0, "세이브 크기를 세지 않았습니다");
  });

  test("세이브를 한 번도 안 올린 계정은 요약이 null 이다", async () => {
    const user = await newUser();
    const row = await rowFor(user.username);
    assert.equal(row.summary, null);
    assert.equal(row.saveRevision, null);
  });

  test("세이브가 깨져도 그 사람만 요약이 없고 목록은 뜬다", async () => {
    const user = await newUser();
    // 서버는 JSON 객체까지만 검사한다. 그 안이 게임이 아는 모양인지는 안 본다.
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: save({ 엉뚱한: "값" }), version: 2, baseRevision: 0 }),
    });

    const row = await rowFor(user.username);
    assert.ok(row.summary, "요약 자체가 없으면 안 된다 — 기본값으로 채워져야 한다");
    assert.equal(row.summary?.bestFloor, 0);
    assert.equal(row.summary?.partyCount, 0);
  });

  test("한 사람의 세이브 원본을 그대로 준다", async () => {
    const user = await newUser();
    await api(base(), "/api/save", {
      method: "PUT",
      token: user.token,
      body: JSON.stringify({ data: progressSave, version: 2, baseRevision: 0 }),
    });
    const row = await rowFor(user.username);

    const res = await api<{ data: string | null; revision: number; summary: unknown }>(
      base(),
      `/api/admin/users/${row.id}/save`,
      { adminSecret: admin() },
    );
    assert.equal(res.status, 200);
    assert.equal(res.body.data, progressSave);
    assert.equal(res.body.revision, 1);
    assert.ok(res.body.summary);
  });

  test("없는 계정의 세이브는 404, 비밀키가 없으면 401", async () => {
    assert.equal((await api(base(), "/api/admin/users/nope/save")).status, 401);
    assert.equal(
      (await api(base(), "/api/admin/users/nope/save", { adminSecret: admin() })).status,
      404,
    );
  });

  test("가입과 로그인이 마지막 로그인 시각을 남긴다", async () => {
    const user = await newUser();
    const afterRegister = await rowFor(user.username);
    assert.ok(afterRegister.lastLoginAt, "가입도 로그인이다 — 시각이 찍혀야 한다");

    const login = await api<AuthBody>(base(), "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: user.username, password: "pw1234" }),
    });
    assert.equal(login.status, 200);

    const afterLogin = await rowFor(user.username);
    assert.ok(
      new Date(afterLogin.lastLoginAt!).getTime() >= new Date(afterRegister.lastLoginAt!).getTime(),
      "로그인해도 시각이 안 밀렸습니다",
    );
  });
});
