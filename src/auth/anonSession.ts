import { startAnonApi, loginApi, ApiError } from "./api";
import { useAuthStore } from "./authStore";

/**
 * 「바로 시작」.
 *
 * 아이디를 묻지 않고 서버 계정을 하나 받아 온다. 받은 비밀번호는 여기에 보관해 두었다가
 * 토큰이 만료되면 같은 계정으로 다시 붙는 데 쓴다 — 없으면 그 세이브로 돌아갈 길이 끊긴다.
 * 인증 스토어에 섞지 않는 건 그 스토어가 화면 여기저기서 읽히기 때문이다.
 */
const RECOVERY_KEY = "monster-rpg-anon";

interface Recovery {
  username: string;
  password: string;
}

function readRecovery(): Recovery | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Recovery>;
    if (typeof parsed.username !== "string" || typeof parsed.password !== "string") return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

function writeRecovery(recovery: Recovery): void {
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
  } catch {
    // 저장소가 막힌 브라우저(시크릿 모드 일부). 이번 세션은 토큰으로 계속 굴러간다.
  }
}

/** 이 브라우저가 전에 받은 계정이 있는가. 서버에 이미 세이브가 있다는 뜻이기도 하다 */
export function hasRecovery(): boolean {
  return readRecovery() !== null;
}

export function clearRecovery(): void {
  try {
    localStorage.removeItem(RECOVERY_KEY);
  } catch {
    /* 무시 */
  }
}

export type StartResult = "anonymous" | "offline";

/**
 * 이 브라우저가 전에 받은 익명 계정이 있으면 거기로 돌아가고, 없으면 새로 발급받는다.
 * 서버에 못 닿으면 로컬 전용으로 들여보낸다 — 여기서 막으면 서버가 꺼진 동안 게임 자체를 못 연다.
 */
export async function startAnonymousSession(): Promise<StartResult> {
  const setAuthed = useAuthStore.getState().setAuthed;
  const recovery = readRecovery();

  if (recovery) {
    try {
      const { token, username } = await loginApi(recovery.username, recovery.password);
      setAuthed(token, username, { isAnonymous: true });
      return "anonymous";
    } catch (err) {
      // 계정이 지워졌거나 비밀번호가 안 맞으면 새로 발급받는다. 그 밖(네트워크)은 아래에서 걸린다.
      if (!(err instanceof ApiError)) {
        useAuthStore.getState().continueOffline();
        return "offline";
      }
      clearRecovery();
    }
  }

  try {
    const { token, username, password } = await startAnonApi();
    writeRecovery({ username, password });
    setAuthed(token, username, { isAnonymous: true });
    return "anonymous";
  } catch {
    useAuthStore.getState().continueOffline();
    return "offline";
  }
}
