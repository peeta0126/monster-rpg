import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminAccess,
  fetchUserLogins,
  type AdminAccess,
  type AdminAccessUser,
  type AdminLoginEvent,
} from "./adminApi";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function formatDate(iso: string | null) {
  if (!iso) return "없음";
  return new Date(iso).toLocaleString("ko-KR");
}

/** "2시간 전" 이 절대 시각보다 먼저 읽힌다. 목록에서는 이쪽이 답이다 */
function ago(iso: string | null): string {
  if (!iso) return "-";
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "방금";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  const day = Math.floor(sec / 86400);
  return day < 30 ? `${day}일 전` : `${Math.floor(day / 30)}달 전`;
}

const KIND: Record<AdminLoginEvent["kind"], string> = {
  login: "로그인",
  register: "가입",
  fail: "실패",
};

/**
 * 한 낱말로 접어 준다. 숫자만 늘어놓으면 스무 줄에서 누구를 봐야 할지 모른다.
 * 「사용자」 탭이 세이브 없는 계정을 `0층` 이 아니라 `아직` 이라고 적는 것과 같은 이유다 —
 * 안 들어온 사람과 들어와서 진 사람은 다르다.
 */
function state(u: AdminAccessUser, days: number): { label: string; tone: string } {
  if (!u.saveUpdatedAt && !u.lastLoginAt) return { label: "가입만", tone: "text-sand-300" };
  if (!u.saveUpdatedAt) return { label: "안 논다", tone: "text-sand-300" };
  if (u.recentLoginCount > 0) return { label: "활동", tone: "text-moss-500" };

  const anchor = u.lastEventAt ?? u.saveUpdatedAt ?? u.lastLoginAt;
  const idle = anchor ? (Date.now() - new Date(anchor).getTime()) / 86400_000 : Infinity;
  if (idle <= days) return { label: "활동", tone: "text-moss-500" };
  if (idle <= 30) return { label: "뜸함", tone: "text-cream-100" };
  return { label: "떠남", tone: "text-sand-300" };
}

/**
 * 누가 언제 들어왔나.
 *
 * `User.lastLoginAt` 은 덮어쓰기라 마지막 한 번밖에 못 말한다 — 매일 오는 사람과 두 달 전에
 * 한 번 온 사람이 같은 칸에 앉는다. 그 차이를 내는 것이 이 탭의 전부다.
 *
 * ⚠ **조작을 붙이지 말 것.** 여기는 읽기만 한다(`ServerPanel` 과 같은 이유).
 */
export default function AccessPanel({ secret }: { secret: string }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AdminAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [logins, setLogins] = useState<AdminLoginEvent[] | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setData(await fetchAdminAccess(secret, days));
    } catch (err) {
      setError(err instanceof Error ? err.message : "접속 기록을 못 읽었습니다.");
    } finally {
      setPending(false);
    }
  }, [secret, days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(u: AdminAccessUser) {
    if (openId === u.id) {
      setOpenId(null);
      return;
    }
    setOpenId(u.id);
    setLogins(null);
    try {
      setLogins(await fetchUserLogins(secret, u.id));
    } catch {
      setLogins([]);
    }
  }

  const orphans = (data?.recent ?? []).filter((e) => e.kind === "fail" && !e.userId);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>
          접속 기록
        </h2>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`rounded border px-3 py-1.5 text-pixel-sm transition ${
                days === d
                  ? "border-ember-500 bg-ember-700/11 text-ember-500"
                  : "border-stone-600 text-sand-300 hover:border-mist-500 hover:text-mist-300"
              }`}
            >
              {d}일
            </button>
          ))}
          <button
            type="button"
            onClick={() => void load()}
            disabled={pending}
            className="rounded border border-stone-600 px-3 py-1.5 text-pixel-sm text-sand-300 transition hover:border-mist-500 hover:text-mist-300 disabled:opacity-40"
          >
            {pending ? "…" : "새로고침"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded border border-ember-700/60 bg-ember-700/11 px-3 py-2 text-pixel-sm text-ember-500">
          {error}
        </p>
      )}

      {/* 기록이 언제부터 쌓였는지를 안 적으면 "0회" 가 "한 번도 안 들어옴" 으로 읽힌다.
          이 표는 기능이 들어간 날부터 쌓이고, 그 전의 접속은 아무 데도 안 남아 있다. */}
      {data && (
        <p className="mb-4 rounded border border-shadow-700 bg-shadow-800 px-3 py-2 text-pixel-sm text-sand-300">
          {data.trackingSince
            ? `접속 기록은 ${formatDate(data.trackingSince)} 부터 쌓였습니다. 그 전에 들어온 것은 세지 못해 「기록 전」 으로 적습니다.`
            : "접속 기록이 아직 없습니다 — 다음 로그인부터 한 줄씩 쌓입니다."}
        </p>
      )}

      {!data && !error && <p className="text-pixel-sm text-sand-300">불러오는 중…</p>}

      {data && (
        <>
          <div className="overflow-x-auto rounded-lg border border-shadow-700">
            <table className="w-full text-left text-pixel-sm">
              <thead className="bg-shadow-800 text-sand-300">
                <tr>
                  <th className="px-4 py-2 font-medium">아이디</th>
                  <th className="px-4 py-2 font-medium">상태</th>
                  <th className="px-4 py-2 font-medium">가입</th>
                  <th className="px-4 py-2 font-medium">마지막 접속</th>
                  <th className="px-4 py-2 font-medium">접속</th>
                  <th className="px-4 py-2 font-medium">최근 {data.days}일</th>
                  <th className="px-4 py-2 font-medium">실패</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const s = state(u, data.days);
                  const seen = u.lastEventAt ?? u.lastLoginAt;
                  // 기록이 켜지기 전에 들어온 사람은 0 회가 아니다. 그렇게 적으면 없던 사실이 생긴다.
                  const before = u.loginCount === 0 && u.lastLoginAt;
                  return (
                    <tr key={u.id} className="border-t border-shadow-700">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => void toggle(u)}
                          className="text-cream-100 underline decoration-dotted underline-offset-4 transition hover:text-mist-300"
                        >
                          {u.username}
                        </button>
                        {openId === u.id && (
                          <div className="mt-2 rounded border border-shadow-700 bg-shadow-900 p-2">
                            {logins === null && <p className="text-sand-300">불러오는 중…</p>}
                            {logins?.length === 0 && (
                              <p className="text-sand-300">기록이 켜진 뒤로 들어온 적이 없습니다.</p>
                            )}
                            {logins?.map((e) => (
                              <div key={e.id} className="flex gap-3 py-0.5">
                                <span className="text-sand-300">{formatDate(e.createdAt)}</span>
                                <span
                                  className={e.kind === "fail" ? "text-ember-500" : "text-mist-300"}
                                >
                                  {KIND[e.kind]}
                                </span>
                                <span className="text-sand-300">{e.ip ?? "-"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 ${s.tone}`}>{s.label}</td>
                      <td className="px-4 py-2 text-sand-300">{ago(u.createdAt)}</td>
                      <td className="px-4 py-2 text-sand-300" title={formatDate(seen)}>
                        {ago(seen)}
                      </td>
                      <td className="px-4 py-2 text-cream-100">
                        {before ? <span className="text-sand-300">기록 전</span> : `${u.loginCount}회`}
                      </td>
                      {/* 전체를 못 세면 최근 며칠도 못 센다. 한쪽만 0 으로 적으면 서로 어긋나 보인다 */}
                      <td className="px-4 py-2 text-sand-300">
                        {before ? "-" : `${u.recentLoginCount}회`}
                      </td>
                      <td className="px-4 py-2">
                        {u.failCount > 0 ? (
                          <span className="text-ember-500">{u.failCount}회</span>
                        ) : (
                          <span className="text-sand-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.users.length === 0 && <p className="mt-4 text-sand-300">가입된 계정이 없습니다.</p>}

          {/* 없는 아이디로 온 실패는 어느 계정에도 안 붙어서 위 표에는 영영 안 보인다 */}
          {orphans.length > 0 && (
            <div className="mt-6 rounded-lg border border-ember-700/60 bg-ember-700/11 px-4 py-3">
              <h3 className="mb-2 text-ember-500" style={{ ...pixelFont, fontSize: 11 }}>
                없는 아이디로 시도 {orphans.length}건
              </h3>
              {orphans.slice(0, 10).map((e) => (
                <div key={e.id} className="flex gap-3 py-0.5 text-pixel-sm">
                  <span className="text-sand-300">{formatDate(e.createdAt)}</span>
                  <span className="text-cream-100">{e.username}</span>
                  <span className="text-sand-300">{e.ip ?? "-"}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-6 mb-2 text-cream-100" style={{ ...pixelFont, fontSize: 11 }}>
            최근 기록
          </h3>
          {data.recent.length === 0 ? (
            <p className="text-pixel-sm text-sand-300">아직 한 줄도 없습니다.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-shadow-700">
              <table className="w-full text-left text-pixel-sm">
                <tbody>
                  {data.recent.map((e) => (
                    <tr key={e.id} className="border-t border-shadow-700 first:border-t-0">
                      <td className="px-4 py-2 text-sand-300 whitespace-nowrap">
                        {formatDate(e.createdAt)}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap ${
                          e.kind === "fail" ? "text-ember-500" : "text-mist-300"
                        }`}
                      >
                        {KIND[e.kind]}
                      </td>
                      <td className="px-4 py-2 text-cream-100">{e.username}</td>
                      <td className="px-4 py-2 text-sand-300 whitespace-nowrap">{e.ip ?? "-"}</td>
                      <td
                        className="max-w-xs truncate px-4 py-2 text-sand-300"
                        title={e.userAgent ?? ""}
                      >
                        {e.userAgent ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.truncated && (
            <p className="mt-2 text-pixel-sm text-sand-300">
              최근 {data.recent.length}건만 보여줍니다. 더 오래된 것은 아이디를 눌러 봅니다.
            </p>
          )}
        </>
      )}

      <p className="mt-4 text-pixel-sm text-sand-300">
        로그인 실패가 30일이 지나면 서버를 켤 때 지웁니다. 성공한 접속은 지우지 않습니다 —
        지우면 「몇 번 들어왔나」 가 조용히 줄어듭니다.
      </p>
    </div>
  );
}
