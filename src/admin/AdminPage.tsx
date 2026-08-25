import { useState } from "react";
import { fetchAdminUsers, deleteAdminUser, cleanupAnonUsers } from "./adminApi";
import type { AdminUser } from "./adminApi";
import SaveHistoryPanel from "./SaveHistoryPanel";
import ServerPanel from "./ServerPanel";
import { getApiBaseOverride, setApiBaseOverride } from "../shared/apiBase";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function formatDate(iso: string | null) {
  if (!iso) return "없음";
  return new Date(iso).toLocaleString("ko-KR");
}

type Tab = "users" | "server";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [serverUrl, setServerUrl] = useState(() => getApiBaseOverride() ?? "");
  const [authedSecret, setAuthedSecret] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleEnter() {
    if (pending) return;
    setPending(true);
    setError(null);
    // 키보다 주소를 먼저 정한다. 주소가 틀리면 키가 맞아도 접속 자체가 실패한다.
    setApiBaseOverride(serverUrl.trim() || null);
    try {
      const list = await fetchAdminUsers(secret);
      setUsers(list);
      setAuthedSecret(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "접속에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!authedSecret) return;
    setPending(true);
    setError(null);
    try {
      await deleteAdminUser(authedSecret, id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setPending(false);
      setConfirmId(null);
    }
  }

  /** 세이브가 한 번도 안 올라온 익명 계정을 지운다. 「바로 시작」은 화면만 열어도 계정을 만든다 */
  async function handleCleanup() {
    if (!authedSecret || pending) return;
    setPending(true);
    setError(null);
    try {
      const { deleted } = await cleanupAnonUsers(authedSecret, 24);
      setNotice(`빈 익명 계정 ${deleted}개를 정리했습니다.`);
      setUsers(await fetchAdminUsers(authedSecret));
    } catch (err) {
      setError(err instanceof Error ? err.message : "정리에 실패했습니다.");
    } finally {
      setPending(false);
    }
  }

  if (!authedSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shadow-900 px-4">
        <form
          className="w-full max-w-xs rounded-xl border-2 border-ember-700/50 bg-shadow-800 p-6"
          style={{ boxShadow: "0 0 26px rgba(233,148,65,0.2)" }}
          onSubmit={(e) => { e.preventDefault(); handleEnter(); }}
        >
          <h1 className="mb-4 text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>관리자 접속</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="관리자 비밀키"
            autoFocus
            className="w-full rounded-md border border-stone-600 bg-shadow-900 px-3 py-2 text-pixel-sm text-cream-100 outline-none transition focus:border-ember-500"
          />
          {/* 터널 주소는 서버를 다시 켤 때마다 바뀐다. 여기서 갈아 끼우면 화면을 다시 배포하지 않아도 된다 */}
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="서버 주소 (비우면 기본값)"
            spellCheck={false}
            className="mt-2 w-full rounded-md border border-stone-600 bg-shadow-900 px-3 py-2 text-pixel-sm text-cream-100 outline-none transition focus:border-ember-500"
          />
          <p className="mt-2 text-pixel-sm text-sand-300">
            터널 주소가 바뀌었을 때만 넣습니다. 끝에 /api 까지 붙입니다.
          </p>
          {error && <p className="mt-2 text-pixel-sm text-ember-500">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 w-full rounded-md border-2 border-ember-500/90 bg-gradient-to-b from-ember-500 to-ember-700 py-2 font-bold text-cream-100 transition hover:brightness-110 disabled:opacity-40"
            style={{ ...pixelFont, fontSize: 12 }}
          >
            {pending ? "…" : "입장"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-shadow-900 px-6 py-8 text-sand-200">
      <nav className="mb-6 flex gap-2">
        {([["users", "사용자"], ["server", "서버"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`rounded border px-4 py-2 text-pixel-sm transition ${
              tab === key
                ? "border-ember-500 bg-ember-700/11 text-ember-500"
                : "border-stone-600 text-sand-300 hover:border-mist-500 hover:text-mist-300"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "server" && <ServerPanel secret={authedSecret} />}

      {tab === "users" && (
        <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-cream-100" style={{ ...pixelFont, fontSize: 16 }}>
          유저 관리 ({users.length}명)
        </h1>
        <button
          onClick={handleCleanup}
          disabled={pending}
          className="rounded border border-stone-600 px-3 py-1.5 text-pixel-sm text-sand-300 transition hover:border-ember-700 hover:text-ember-500 disabled:opacity-40"
        >
          빈 익명 계정 정리
        </button>
      </div>

      {notice && <p className="mb-4 text-pixel-sm text-moss-500">{notice}</p>}

      {error && (
        <p className="mb-4 rounded border border-ember-700/60 bg-ember-700/11 px-3 py-2 text-pixel-sm text-ember-500">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-shadow-700">
        <table className="w-full text-left text-pixel-sm">
          <thead className="bg-shadow-800 text-sand-300">
            <tr>
              <th className="px-4 py-2 font-medium">아이디</th>
              <th className="px-4 py-2 font-medium">가입일</th>
              <th className="px-4 py-2 font-medium">최종 저장</th>
              <th className="px-4 py-2 font-medium">판</th>
              <th className="px-4 py-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-shadow-700">
                <td className="px-4 py-2">
                  {u.username}
                  {u.isAnonymous && <span className="ml-2 text-sand-300">(익명)</span>}
                </td>
                <td className="px-4 py-2 text-sand-300">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2 text-sand-300">{formatDate(u.saveUpdatedAt)}</td>
                <td className="px-4 py-2 text-sand-300">{u.saveRevision ?? "-"}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => setHistoryFor(u)}
                    className="mr-2 rounded border border-stone-600 px-2 py-1 text-pixel-sm text-sand-300 transition hover:border-mist-500 hover:text-mist-300"
                  >
                    이력
                  </button>
                  {confirmId === u.id ? (
                    <span className="inline-flex gap-2">
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={pending}
                        className="rounded border border-ember-700 px-2 py-1 text-pixel-sm text-ember-500 transition hover:bg-ember-700/11 disabled:opacity-40"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded border border-stone-600 px-2 py-1 text-pixel-sm text-sand-300 transition hover:bg-shadow-700"
                      >
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(u.id)}
                      className="rounded border border-stone-600 px-2 py-1 text-pixel-sm text-sand-300 transition hover:border-ember-700 hover:text-ember-500"
                    >
                      삭제
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && <p className="mt-4 text-sand-300">가입된 유저가 없습니다.</p>}
        </>
      )}

      {historyFor && (
        <SaveHistoryPanel
          secret={authedSecret}
          userId={historyFor.id}
          username={historyFor.username}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </div>
  );
}
