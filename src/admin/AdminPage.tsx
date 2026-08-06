import { useState } from "react";
import { fetchAdminUsers, deleteAdminUser } from "./adminApi";
import type { AdminUser } from "./adminApi";

const pixelFont = { fontFamily: "var(--pixel-font, monospace)" };

function formatDate(iso: string | null) {
  if (!iso) return "없음";
  return new Date(iso).toLocaleString("ko-KR");
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authedSecret, setAuthedSecret] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleEnter() {
    if (pending) return;
    setPending(true);
    setError(null);
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

  if (!authedSecret) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <form
          className="w-full max-w-xs rounded-xl border-2 border-amber-700/50 bg-zinc-900 p-6"
          style={{ boxShadow: "0 0 26px rgba(180,140,60,0.2)" }}
          onSubmit={(e) => { e.preventDefault(); handleEnter(); }}
        >
          <h1 className="mb-4 text-zinc-100" style={{ ...pixelFont, fontSize: 14 }}>관리자 접속</h1>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="관리자 비밀키"
            autoFocus
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-500"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-3 w-full rounded-md border-2 border-amber-400/90 bg-gradient-to-b from-amber-500 to-amber-800 py-2 font-bold text-amber-50 transition hover:brightness-110 disabled:opacity-40"
            style={{ ...pixelFont, fontSize: 11 }}
          >
            {pending ? "…" : "입장"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-200">
      <h1 className="mb-6 text-zinc-100" style={{ ...pixelFont, fontSize: 16 }}>
        유저 관리 ({users.length}명)
      </h1>

      {error && (
        <p className="mb-4 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">아이디</th>
              <th className="px-4 py-2 font-medium">가입일</th>
              <th className="px-4 py-2 font-medium">최종 저장</th>
              <th className="px-4 py-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-zinc-800">
                <td className="px-4 py-2">{u.username}</td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-2 text-zinc-500">{formatDate(u.saveUpdatedAt)}</td>
                <td className="px-4 py-2 text-right">
                  {confirmId === u.id ? (
                    <span className="inline-flex gap-2">
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={pending}
                        className="rounded border border-red-700 px-2 py-1 text-xs text-red-400 transition hover:bg-red-950/40 disabled:opacity-40"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800"
                      >
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmId(u.id)}
                      className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:border-red-700 hover:text-red-400"
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

      {users.length === 0 && <p className="mt-4 text-zinc-500">가입된 유저가 없습니다.</p>}
    </div>
  );
}
