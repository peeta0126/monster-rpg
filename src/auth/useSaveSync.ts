import { useEffect, useRef } from "react";
import { useAuthStore } from "./authStore";
import { fetchSaveApi, putSaveApi, ApiError } from "./api";
import { usePlayerStore, normalizeState } from "../shared/playerStore";

/** 매 상태 변경마다 서버에 저장하면 과하므로, 활동이 잦아든 뒤 한 번만 업로드한다.
 *  층 클리어·퀘스트 완료 등 "주요 지점"은 그 직후 자연히 조작이 멎으므로
 *  이 debounce 창이 지나면 결과적으로 그 시점의 상태가 저장된다. */
const PUSH_DEBOUNCE_MS = 4000;

export function useSaveSync() {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const logout = useAuthStore((s) => s.logout);
  const pulledForToken = useRef<string | null>(null);

  // 로그인(토큰 발급) 시 1회: 서버 세이브가 있으면 적용, 없으면 현재 로컬 상태를 업로드
  useEffect(() => {
    if (isGuest || !token) return;
    if (pulledForToken.current === token) return;
    pulledForToken.current = token;

    (async () => {
      try {
        const { data } = await fetchSaveApi();
        if (data) {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          usePlayerStore.setState(normalizeState(parsed));
        } else {
          const snapshot = normalizeState(usePlayerStore.getState());
          await putSaveApi(JSON.stringify(snapshot));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          return;
        }
        console.warn("[saveSync] 서버와 동기화하지 못했습니다. 오프라인(로컬 저장)으로 계속 진행합니다.", err);
      }
    })();
  }, [token, isGuest, logout]);

  // 이후 변경사항은 debounce 후 서버에 업로드 (게스트/서버 불통 시 조용히 건너뜀 → 로컬 저장은 항상 별도로 유지됨)
  useEffect(() => {
    if (isGuest || !token) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = usePlayerStore.subscribe((state) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const snapshot = normalizeState(state);
        putSaveApi(JSON.stringify(snapshot)).catch((err) => {
          console.warn("[saveSync] 세이브 업로드 실패(오프라인일 수 있음). 다음 변경 시 재시도합니다.", err);
        });
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [token, isGuest]);
}
