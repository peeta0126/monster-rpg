import { useEffect, useState } from "react";
import { fetchSaveHistory, restoreSave, type AdminSaveHistoryEntry } from "./adminApi";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 한 계정의 세이브 이력(덮이기 전 판 10개)과 되돌리기.
 *
 * 동기화 규칙이 "서버가 이긴다" 라서, 기기가 엇갈리면 한쪽 진행이 조용히 덮인다.
 * 그때 되돌릴 곳이 여기다. 되돌리기 자체도 이력을 남기므로 잘못 되돌려도 다시 돌아갈 수 있다.
 */
export default function SaveHistoryPanel({
  secret,
  userId,
  username,
  onClose,
}: {
  secret: string;
  userId: string;
  username: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<AdminSaveHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchSaveHistory(secret, userId)
      .then((list) => { if (alive) setEntries(list); })
      .catch((err: unknown) => { if (alive) setError(err instanceof Error ? err.message : "이력을 못 읽었습니다."); });
    return () => { alive = false; };
  }, [secret, userId]);

  async function handleRestore(historyId: string) {
    setPending(true);
    setError(null);
    try {
      const { revision } = await restoreSave(secret, userId, historyId);
      setNotice(`되돌렸습니다. 현재 판 번호 ${revision}`);
      setEntries(await fetchSaveHistory(secret, userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "되돌리기에 실패했습니다.");
    } finally {
      setPending(false);
      setConfirmId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-shadow-900/85 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border-2 border-ember-700/50 bg-shadow-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>
            {username} — 세이브 이력
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-title-sm leading-none text-sand-300 transition hover:text-sand-200"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded border border-ember-700/60 bg-ember-700/11 px-3 py-2 text-pixel-sm text-ember-500">
            {error}
          </p>
        )}
        {notice && <p className="mb-3 text-pixel-sm text-moss-500">{notice}</p>}

        {entries === null && <p className="text-pixel-sm text-sand-300">불러오는 중…</p>}
        {entries?.length === 0 && (
          <p className="text-pixel-sm text-sand-300">덮인 세이브가 아직 없습니다.</p>
        )}

        {entries && entries.length > 0 && (
          <table className="w-full text-left text-pixel-sm">
            <thead className="text-sand-300">
              <tr>
                <th className="py-2 font-medium">판</th>
                <th className="py-2 font-medium">덮인 시각</th>
                <th className="py-2 font-medium">크기</th>
                <th className="py-2 text-right font-medium">되돌리기</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-shadow-700">
                  <td className="py-2">{e.revision}</td>
                  <td className="py-2 text-sand-300">{formatDate(e.createdAt)}</td>
                  <td className="py-2 text-sand-300">{(e.size / 1024).toFixed(1)}KB</td>
                  <td className="py-2 text-right">
                    {confirmId === e.id ? (
                      <span className="inline-flex gap-2">
                        <button
                          onClick={() => handleRestore(e.id)}
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
                        onClick={() => setConfirmId(e.id)}
                        className="rounded border border-stone-600 px-2 py-1 text-pixel-sm text-sand-300 transition hover:border-ember-700 hover:text-ember-500"
                      >
                        이 판으로
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
