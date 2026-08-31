import { useCallback, useEffect, useState } from "react";
import { fetchAdminStats, type AdminStats } from "./adminApi";
import { resolveApiBase } from "../shared/apiBase";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function formatDate(iso: string | null) {
  if (!iso) return "없음";
  return new Date(iso).toLocaleString("ko-KR");
}

/** 파일을 못 읽는 환경이 있어서 null 이 온다 */
function formatBytes(bytes: number | null) {
  if (bytes === null) return "알 수 없음";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "3시간 21분" 처럼 읽는다. 초 단위 숫자는 켠 직후가 아니면 아무도 안 센다 */
function formatUptime(seconds: number) {
  if (seconds < 60) return `${seconds}초`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "normal" | "good" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-shadow-700 py-2 first:border-t-0">
      <span className="text-pixel-sm text-sand-300">{label}</span>
      <span
        className={`text-pixel-sm break-all text-right ${tone === "good" ? "text-moss-500" : "text-cream-100"}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * 서버가 지금 어떤 상태인지만 본다.
 *
 * 재시작·초기화 같은 조작은 일부러 없다. 관리자 키 하나가 새면 그게 그대로 서버 조작
 * 권한이 되는데, 여기서 얻는 것은 "버튼 하나로 껐다 켜기" 정도라 남는 장사가 아니다.
 */
export default function ServerPanel({ secret }: { secret: string }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setStats(await fetchAdminStats(secret));
    } catch (err) {
      setError(err instanceof Error ? err.message : "서버 상태를 못 읽었습니다.");
    } finally {
      setPending(false);
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-lg">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>
          서버 상태
        </h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={pending}
          className="rounded border border-stone-600 px-3 py-1.5 text-pixel-sm text-sand-300 transition hover:border-mist-500 hover:text-mist-300 disabled:opacity-40"
        >
          {pending ? "…" : "새로고침"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded border border-ember-700/60 bg-ember-700/11 px-3 py-2 text-pixel-sm text-ember-500">
          {error}
        </p>
      )}

      {!stats && !error && <p className="text-pixel-sm text-sand-300">불러오는 중…</p>}

      {stats && (
        <div className="rounded-lg border border-shadow-700 bg-shadow-800 px-4 py-2">
          <Row label="상태" value="살아 있음" tone="good" />
          <Row label="켜진 지" value={formatUptime(stats.uptimeSeconds)} />
          <Row label="켜진 시각" value={formatDate(stats.startedAt)} />
          <Row label="서버 주소" value={resolveApiBase()} />
          <Row label="Node" value={stats.nodeVersion} />
          <Row label="세이브 파일" value={formatBytes(stats.dbBytes)} />
          <Row label="계정" value={`${stats.userCount}명`} />
          <Row label="올라온 세이브" value={`${stats.saveCount}개`} />
          <Row label="보관된 이력" value={`${stats.historyCount}판`} />
          <Row label="마지막 저장" value={formatDate(stats.lastSavedAt)} />
        </div>
      )}

      <p className="mt-4 text-pixel-sm text-sand-300">
        세이브는 전부 이 파일 하나(server/prisma/dev.db)에 들어 있습니다. 복사해 두는 것이 곧 백업입니다.
      </p>
    </div>
  );
}
