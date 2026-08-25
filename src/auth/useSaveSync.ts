import { useCallback, useEffect, useRef } from "react";
import { useAuthStore } from "./authStore";
import { fetchSaveApi, putSaveApi, ApiError, SaveConflictError, type SaveEnvelope } from "./api";
import { usePlayerStore, normalizeState, migrateSave, PERSIST_VERSION } from "../shared/playerStore";
import { useSaveStatusStore } from "../shared/saveStatusStore";

/** 매 상태 변경마다 서버에 저장하면 과하므로, 활동이 잦아든 뒤 한 번만 업로드한다.
 *  층 클리어·퀘스트 완료 등 "주요 지점"은 그 직후 자연히 조작이 멎으므로
 *  이 debounce 창이 지나면 결과적으로 그 시점의 상태가 저장된다. */
const PUSH_DEBOUNCE_MS = 4000;

/** 창을 오갈 때마다 서버를 두드리지 않도록. 다른 기기에서 진행하고 돌아오는 간격으로는 충분하다 */
const MIN_PULL_INTERVAL_MS = 30 * 1000;

const MAX_RETRY_DELAY_MS = 60 * 1000;

/**
 * 숲 원정은 기기에 매인 상태라 서버 세이브에 안 들어간다(forest/runStorage.ts).
 * 원정 도중에 서버 세이브를 받아 덮으면 정산 전 재료가 통째로 사라지므로, 그동안은 내려받지 않는다.
 */
const FOREST_RUN_KEY = "monster-rpg-forest-run";

function forestRunInProgress(): boolean {
  try {
    return localStorage.getItem(FOREST_RUN_KEY) !== null;
  } catch {
    return false;
  }
}

export function useSaveSync() {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const logout = useAuthStore((s) => s.logout);

  const active = !isGuest && !!token;
  const activeRef = useRef(active);
  activeRef.current = active;

  /** 서버가 마지막으로 알려 준 판 번호. 이걸 같이 보내야 다른 기기가 먼저 저장한 걸 알아챈다 */
  const revisionRef = useRef<number | null>(null);
  const pulledForToken = useRef<string | null>(null);
  /**
   * 초기 pull이 끝나기 전에는 업로드를 하지 않는다.
   * pull은 비동기라, 그 사이에 상태가 한 번이라도 바뀌면 debounce가 만료되면서
   * "아직 서버 세이브를 받아오기 전의 로컬 상태"를 서버에 덮어쓸 수 있다
   * (새 기기에서 로그인했을 때 기존 진행도가 날아가는 시나리오).
   */
  const pullSettledRef = useRef(false);
  const lastPullAtRef = useRef(0);
  /** 올려야 할 변경이 남아 있는가. 창을 닫을 때와 온라인 복귀 때 이걸 본다 */
  const dirtyRef = useRef(false);
  const inFlightRef = useRef(false);
  /** 서버 세이브를 반영하는 중. 그 setState 가 다시 업로드를 부르지 않게 막는다 */
  const applyingRef = useRef(false);
  const failureCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useSaveStatusStore((s) => s.setStatus);

  const applyServerSave = useCallback((envelope: SaveEnvelope) => {
    revisionRef.current = envelope.revision;
    if (!envelope.data) return;
    const parsed = JSON.parse(envelope.data) as Record<string, unknown>;
    applyingRef.current = true;
    try {
      // 버전을 같이 받아 두었으므로 서버 세이브도 로컬과 똑같이 마이그레이션을 지난다.
      usePlayerStore.setState(migrateSave(parsed, envelope.version ?? PERSIST_VERSION));
    } finally {
      applyingRef.current = false;
    }
  }, []);

  const push = useCallback(
    async (opts?: { keepalive?: boolean }): Promise<void> => {
      if (!activeRef.current || !pullSettledRef.current) return;
      if (inFlightRef.current) {
        // 앞 업로드가 아직 안 끝났다. 그냥 돌아가면 이번 변경은 다음 변경이 생길 때까지
        // 영영 안 올라간다 — 마지막 층을 깨고 창을 닫으면 그 판이 사라지는 자리다.
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (dirtyRef.current) void pushRef.current?.();
        }, 500);
        return;
      }

      inFlightRef.current = true;
      const snapshot = normalizeState(usePlayerStore.getState());
      // 여기까지의 변경은 이 스냅샷에 담겼다. 요청이 도는 동안 생긴 변경은 다시 dirty 로
      // 찍히고 debounce 가 한 번 더 돈다. 성공한 뒤에 내리면 그 사이 변경이 지워진다.
      dirtyRef.current = false;
      setStatus("saving", { mode: "server" });

      try {
        const saved = await putSaveApi(
          JSON.stringify(snapshot),
          PERSIST_VERSION,
          revisionRef.current,
          opts,
        );
        revisionRef.current = saved.revision;
        failureCountRef.current = 0;
        setStatus("saved", { mode: "server" });
      } catch (err) {
        if (err instanceof SaveConflictError) {
          // 다른 기기가 먼저 저장했다. 규칙은 "서버가 이긴다" — 받아서 덮고, 사람에게 알린다.
          applyServerSave(err.server);
          dirtyRef.current = false;
          failureCountRef.current = 0;
          setStatus("saved", { mode: "server", message: "다른 기기의 진행을 불러왔습니다" });
          return;
        }
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        // 로컬 저장은 zustand persist 가 이미 끝냈다. 여기서 실패해도 진행이 사라지지는 않는다.
        dirtyRef.current = true;
        failureCountRef.current += 1;
        console.warn("[saveSync] 세이브 업로드 실패(오프라인일 수 있음). 잠시 후 재시도합니다.", err);
        setStatus("error", { mode: "server", message: "서버 저장 실패 — 로컬에는 보관됨" });

        // 서버가 잠깐 없는 것과 오래 없는 것을 같은 간격으로 두드리면, 노트북이 꺼져 있는 동안
        // 몇 시간을 2초 간격으로 실패한다. 실패가 쌓일수록 뜸해지게 둔다.
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        const delay = Math.min(MAX_RETRY_DELAY_MS, 2000 * 2 ** (failureCountRef.current - 1));
        retryTimerRef.current = setTimeout(() => {
          if (dirtyRef.current) void pushRef.current?.();
        }, delay);
      } finally {
        inFlightRef.current = false;
      }
    },
    [applyServerSave, logout, setStatus],
  );

  // 재시도 타이머는 자기 자신을 다시 부른다. ref 를 거쳐야 push 를 자기 의존성에 넣지 않는다.
  const pushRef = useRef<typeof push | null>(null);
  pushRef.current = push;

  const pull = useCallback(async (): Promise<void> => {
    if (!activeRef.current) return;
    lastPullAtRef.current = Date.now();
    try {
      const envelope = await fetchSaveApi();
      if (envelope.data) {
        applyServerSave(envelope);
      } else {
        // 서버가 비었다 — 이 기기의 현재 상태가 이 계정의 첫 세이브가 된다.
        revisionRef.current = envelope.revision;
        pullSettledRef.current = true;
        await push();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      console.warn("[saveSync] 서버와 동기화하지 못했습니다. 오프라인(로컬 저장)으로 계속 진행합니다.", err);
    } finally {
      // 실패했어도 업로드를 영영 막아 두진 않는다. 서버가 돌아오면 다음 변경부터 다시 동기화된다.
      pullSettledRef.current = true;
    }
  }, [applyServerSave, logout, push]);

  // 로그인(토큰 발급) 시 1회: 서버 세이브가 있으면 적용, 없으면 현재 로컬 상태를 업로드
  useEffect(() => {
    if (!active || !token) return;
    if (pulledForToken.current === token) return;
    pulledForToken.current = token;
    pullSettledRef.current = false;
    revisionRef.current = null;
    void pull();
  }, [active, token, pull]);

  // 이후 변경사항은 debounce 후 서버에 업로드
  useEffect(() => {
    if (!active) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = usePlayerStore.subscribe(() => {
      if (applyingRef.current) return; // 서버에서 받아 반영하는 중이면 되돌려 보낼 게 없다
      dirtyRef.current = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [active, push]);

  // 창으로 돌아왔을 때 / 창을 닫을 때 / 네트워크가 돌아왔을 때
  useEffect(() => {
    if (!active) return;

    function onVisible() {
      if (document.visibilityState === "hidden") {
        // 4초 디바운스가 만료되기 전에 창이 닫히면 그 판이 통째로 사라진다.
        // keepalive 로 보내야 문서가 사라진 뒤에도 전송이 끝난다.
        if (dirtyRef.current) void push({ keepalive: true });
        return;
      }
      refresh();
    }

    function refresh() {
      if (dirtyRef.current) {
        // 올릴 게 남아 있으면 먼저 올린다. 서버가 그새 앞서 있으면 409 로 되받아 서버가 이긴다.
        void push();
        return;
      }
      if (Date.now() - lastPullAtRef.current < MIN_PULL_INTERVAL_MS) return;
      if (forestRunInProgress()) return;
      void pull();
    }

    function onOnline() {
      if (dirtyRef.current) void push();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", onOnline);
    };
  }, [active, pull, push]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);
}
