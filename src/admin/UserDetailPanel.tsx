import { useEffect, useState, type ReactNode } from "react";
import { fetchUserSave, type AdminUserSave } from "./adminApi";
import { digestSave, type SaveDigest, type MonsterLine, type CountLine } from "./saveDigest";

const pixelFont = { fontFamily: "var(--font-pixel)" };

function formatDate(iso: string | null) {
  if (!iso) return "없음";
  return new Date(iso).toLocaleString("ko-KR");
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="mb-2 flex items-baseline gap-2 text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>
        {title}
        {note && <span className="text-pixel-sm font-normal text-sand-300">{note}</span>}
      </h3>
      {children}
    </section>
  );
}

/** 한 줄짜리 사실. 값이 곧 답인 자리라 문장으로 바꾸지 않는다 */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-shadow-700 py-2 first:border-t-0">
      <span className="text-pixel-sm text-sand-300">{label}</span>
      <span className="text-pixel-sm text-right text-cream-100">{value}</span>
    </div>
  );
}

function MonsterRow({ m }: { m: MonsterLine }) {
  return (
    <li className="border-t border-shadow-700 py-2 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-pixel-sm text-cream-100">{m.name}</span>
        <span className="text-pixel-sm text-sand-300">Lv.{m.level} · HP {m.hp}</span>
      </div>
      {m.gear.length > 0 && (
        <p className="mt-1 text-pixel-sm text-sand-300">장비 {m.gear.join(" · ")}</p>
      )}
    </li>
  );
}

/** 이름과 개수를 늘어놓는다. 스무 칸 넘게 나오는 자리라 표로 만들면 화면을 통째로 먹는다 */
function Chips({ lines }: { lines: CountLine[] }) {
  if (lines.length === 0) return <p className="text-pixel-sm text-sand-300">없음</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {lines.map((l) => (
        <li
          key={l.key}
          className="rounded border border-shadow-700 bg-shadow-900 px-2 py-1 text-pixel-sm text-sand-200"
        >
          {l.name} <span className="text-cream-100">{l.count}</span>
        </li>
      ))}
    </ul>
  );
}

const QUEST_LABEL = {
  completed: "완료",
  in_progress: "진행 중",
  not_accepted: "아직",
} as const;

/**
 * 한 사람이 어디까지 갔고 무엇을 들고 있나.
 *
 * 서버는 세이브 원본과 숫자 요약만 준다. 이름을 붙이는 것은 `saveDigest.ts` 가 게임 표를
 * 읽어서 한다 — 표를 서버에 한 벌 더 두면 게임에서 이름을 고친 날 여기만 옛 이름이 남는다.
 *
 * 조작은 넣지 않는다. 세이브를 되돌리는 것은 이력 화면(`SaveHistoryPanel`)의 일이고,
 * 여기서까지 고칠 수 있으면 "보러 들어왔다가 건드리는" 자리가 하나 더 생긴다.
 */
export default function UserDetailPanel({
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
  const [save, setSave] = useState<AdminUserSave | null>(null);
  const [digest, setDigest] = useState<SaveDigest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchUserSave(secret, userId)
      .then((body) => {
        if (!alive) return;
        setSave(body);
        setDigest(digestSave(body.data));
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "세이브를 못 읽었습니다.");
      });
    return () => {
      alive = false;
    };
  }, [secret, userId]);

  return (
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-shadow-900/85 px-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border-2 border-ember-700/50 bg-shadow-800 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-cream-100" style={{ ...pixelFont, fontSize: 12 }}>
            {username} — 진행 상황
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
          <p className="rounded border border-ember-700/60 bg-ember-700/11 px-3 py-2 text-pixel-sm text-ember-500">
            {error}
          </p>
        )}

        {!save && !error && <p className="text-pixel-sm text-sand-300">불러오는 중…</p>}

        {save && (
          <>
            <Section title="계정">
              <div className="rounded-lg border border-shadow-700 bg-shadow-900 px-4 py-2">
                <Fact label="가입" value={formatDate(save.createdAt)} />
                <Fact label="마지막 로그인" value={formatDate(save.lastLoginAt)} />
                <Fact label="마지막 저장" value={formatDate(save.updatedAt)} />
                <Fact label="세이브 판 번호" value={save.revision ? `${save.revision}판` : "아직 없음"} />
              </div>
            </Section>

            {/* 세이브가 없으면 아래가 전부 빈칸이 된다. 빈칸 열 줄을 보여 주느니 한 줄로 말한다 */}
            {!digest && (
              <p className="mt-4 rounded border border-shadow-700 bg-shadow-900 px-3 py-3 text-pixel-sm text-sand-300">
                {save.data
                  ? "세이브를 읽을 수 없습니다. 아래 원본으로 확인해주세요."
                  : "아직 한 번도 저장되지 않았습니다 — 가입만 하고 게임을 시작하지 않았거나, 플레이하는 동안 서버가 꺼져 있었습니다."}
              </p>
            )}

            {digest && (
              <>
                <Section title="어디까지 갔나">
                  <div className="rounded-lg border border-shadow-700 bg-shadow-900 px-4 py-2">
                    <Fact
                      label="탑 최고 층"
                      value={
                        digest.towerCleared
                          ? `${digest.bestFloor}층 · 엔딩까지 봄`
                          : `${digest.bestFloor}층`
                      }
                    />
                    <Fact
                      label="도감"
                      value={`잡은 것 ${digest.dexCaught} · 본 것 ${digest.dexSeen} (전체 ${digest.dexTotal})`}
                    />
                    <Fact
                      label="몬스터"
                      value={`파티 ${digest.party.length}마리 · 보관함 ${digest.storage.length}마리`}
                    />
                  </div>
                </Section>

                <Section title="파티" note={`${digest.party.length}마리`}>
                  {digest.party.length === 0 ? (
                    <p className="text-pixel-sm text-sand-300">
                      비어 있음 — 아직 이장에게 첫 몬스터를 안 받았습니다.
                    </p>
                  ) : (
                    <ul className="rounded-lg border border-shadow-700 bg-shadow-900 px-4 py-1">
                      {digest.party.map((m) => (
                        <MonsterRow key={m.key} m={m} />
                      ))}
                    </ul>
                  )}
                </Section>

                {digest.storage.length > 0 && (
                  <Section title="보관함" note={`${digest.storage.length}마리`}>
                    <ul className="rounded-lg border border-shadow-700 bg-shadow-900 px-4 py-1">
                      {digest.storage.map((m) => (
                        <MonsterRow key={m.key} m={m} />
                      ))}
                    </ul>
                  </Section>
                )}

                {/* 장착한 것과 가방에 있는 것을 한 칸에 낸다. 가방만 세면 바로 위 파티 줄에는
                    장비 이름이 보이는데 여기는 "0개" 라고 적힌다 — 한 화면이 자기 말을 뒤집는다 */}
                <Section
                  title="장비"
                  note={
                    digest.artifacts.length === 0
                      ? "0개"
                      : `${digest.artifacts.length}개 (장착 ${digest.equippedCount} · 가방 ${
                          digest.artifacts.length - digest.equippedCount
                        })`
                  }
                >
                  {digest.artifacts.length === 0 ? (
                    <p className="text-pixel-sm text-sand-300">없음</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {digest.artifacts.map((a) => (
                        <li
                          key={a.key}
                          className="rounded border border-shadow-700 bg-shadow-900 px-2 py-1 text-pixel-sm text-sand-200"
                        >
                          {a.name}
                          {a.quality && <span className="ml-1 text-mist-300">{a.quality}</span>}
                          {a.grade && <span className="ml-1 text-cream-100">{a.grade}</span>}
                          {a.equippedTo && <span className="ml-1 text-sand-300">— {a.equippedTo}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Section title="재료">
                  <Chips lines={digest.materials} />
                </Section>

                <Section title="물약">
                  <Chips lines={digest.potions} />
                </Section>

                <Section title="퀘스트">
                  <ul className="rounded-lg border border-shadow-700 bg-shadow-900 px-4 py-1">
                    {digest.quests.map((q) => (
                      <li
                        key={q.id}
                        className="flex items-baseline justify-between gap-3 border-t border-shadow-700 py-2 first:border-t-0"
                      >
                        <span className="text-pixel-sm text-cream-100">{q.title}</span>
                        <span
                          className={`text-pixel-sm ${
                            q.status === "completed"
                              ? "text-moss-500"
                              : q.status === "in_progress"
                                ? "text-ember-500"
                                : "text-sand-300"
                          }`}
                        >
                          {QUEST_LABEL[q.status]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="이야기">
                  <ul className="flex flex-wrap gap-2">
                    {digest.flags.map((f) => (
                      <li
                        key={f.key}
                        className={`rounded border px-2 py-1 text-pixel-sm ${
                          f.done
                            ? "border-moss-500/60 bg-shadow-900 text-moss-500"
                            : "border-shadow-700 bg-shadow-900 text-sand-300"
                        }`}
                      >
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </Section>
              </>
            )}

            {/* 풀어 쓴 것이 틀렸을 때 맞춰 볼 곳. 지우면 어긋난 걸 알아도 확인할 길이 없다 */}
            {save.data && (
              <details className="mt-5">
                <summary className="cursor-pointer text-pixel-sm text-sand-300 transition hover:text-sand-200">
                  세이브 원본 보기 ({(save.data.length / 1024).toFixed(1)}KB · 형식 v{save.version ?? "?"})
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-shadow-700 bg-shadow-900 p-3 text-pixel-sm text-sand-300">
                  {save.data}
                </pre>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
