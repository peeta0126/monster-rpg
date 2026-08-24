import { create } from "zustand";

/**
 * 저장 상태 표시용 스토어.
 *
 * 자동 저장(로컬 persist + 로그인하면 서버 업로드)인데 화면에 아무 표시가 없어서,
 * 플레이어는 "지금 진행이 저장된 건가?"를 알 방법이 없었다. 저장 경로들이 여기에
 * 상태를 알려 주고 `SaveIndicator` 가 그걸 보여준다.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusState {
  status: SaveStatus;
  /** 서버 동기화 중인지(로그인) 로컬 저장만인지(게스트) */
  mode: "local" | "server";
  /** 마지막으로 저장이 끝난 시각 (표시용) */
  savedAt: number | null;
  /** 상태가 바뀔 때마다 1씩 는다. 표시 컴포넌트가 이 알림을 이미 닫았는지 구분하는 데 쓴다 */
  seq: number;
  message: string | null;
  setStatus: (status: SaveStatus, opts?: { mode?: "local" | "server"; message?: string | null }) => void;
}

export const useSaveStatusStore = create<SaveStatusState>()((set) => ({
  status: "idle",
  mode: "local",
  savedAt: null,
  seq: 0,
  message: null,
  setStatus: (status, opts) =>
    set((s) => ({
      status,
      mode: opts?.mode ?? s.mode,
      message: opts?.message ?? null,
      seq: s.seq + 1,
      savedAt: status === "saved" ? Date.now() : s.savedAt,
    })),
}));
