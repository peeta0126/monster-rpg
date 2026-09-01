import { useEffect } from "react";
import { useAuthStore } from "./authStore";
import { hasRecovery, startAnonymousSession } from "./anonSession";

/**
 * 서버가 꺼져 있을 때 들어온 사람을, 서버가 돌아오면 조용히 계정에 붙인다.
 *
 * 「바로 시작」은 서버에 못 닿으면 로컬 전용(isGuest)으로 들여보낸다 — 거기서 막으면
 * 게임 자체를 못 열기 때문이다. 그런데 그 상태는 스스로 풀리지 않아서, 서버를 나중에 켜도
 * 그 사람 진행은 영영 브라우저에만 남는다. 링크를 받은 쪽은 "그냥 열어서 하는" 게 전부라
 * 새로고침하라는 말을 전할 방법도 없다. 그래서 화면이 알아서 다시 두드린다.
 *
 * 붙는 순간 세이브 동기화(useSaveSync)가 켜지고, 서버에 그 계정의 세이브가 없으니
 * 여태 로컬에 쌓인 진행이 첫 세이브로 올라간다.
 */

/** 첫 시도까지. 방금 실패한 참이라 곧바로 다시 두드릴 이유가 없다 */
const FIRST_DELAY_MS = 15_000;
const MAX_DELAY_MS = 10 * 60_000;
/** 창을 자주 오가도 그때마다 두드리지 않게 */
const MIN_GAP_MS = 5_000;

export function useOfflineUpgrade(): void {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isGuest = useAuthStore((s) => s.isGuest);
  const isDev = useAuthStore((s) => s.isDev);

  useEffect(() => {
    if (!hasHydrated || !isGuest) return;
    // 개발자 프리셋은 일부러 로컬 전용이다. 붙이면 프리셋이 서버 세이브를 덮는다.
    if (isDev) return;
    // 복구 정보가 있으면 서버에 이 브라우저의 세이브가 이미 있다. 지금 붙으면 그걸 받아
    // 오프라인으로 진행한 만큼을 덮으므로, 그 경우는 사람이 새로고침할 때까지 두는 편이 낫다.
    if (hasRecovery()) return;

    let cancelled = false;
    let delay = FIRST_DELAY_MS;
    let lastAttemptAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (ms: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(attempt, ms);
    };

    async function attempt() {
      if (cancelled) return;
      lastAttemptAt = Date.now();

      // 브라우저가 끊긴 걸 알고 있으면 요청을 만들 것도 없다
      if (navigator.onLine === false) {
        schedule(delay);
        return;
      }

      const result = await startAnonymousSession();
      if (cancelled) return;
      if (result === "anonymous") return; // 붙었다. isGuest 가 풀리며 이 효과는 정리된다

      // 서버가 아직 없다. 꺼 둔 노트북을 몇 시간 두드리지 않도록 간격을 늘린다.
      delay = Math.min(MAX_DELAY_MS, delay * 2);
      schedule(delay);
    }

    /** 창으로 돌아왔거나 네트워크가 살아났다 — 기다리던 간격을 접고 바로 본다 */
    const nudge = () => {
      if (cancelled || Date.now() - lastAttemptAt < MIN_GAP_MS) return;
      schedule(0);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") nudge();
    };

    schedule(FIRST_DELAY_MS);
    window.addEventListener("online", nudge);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", nudge);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasHydrated, isGuest, isDev]);
}
