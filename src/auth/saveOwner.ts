import { usePlayerStore } from "../shared/playerStore";

/**
 * 이 브라우저에 담긴 진행이 **누구 것인지** 적어 둔다.
 *
 * 세이브는 localStorage 에 남는데 로그아웃은 토큰만 지웠다. 그래서 다음 사람이 들어오면
 * 앞 사람의 파티·재료가 그대로 보였고, 그 계정은 서버가 비어 있으니 그 상태가 첫 세이브로
 * 올라가 굳었다 — 새 계정인데 몇 마리가 들어 있던 게 이것이다.
 *
 * 로그아웃 때 지우지 않고 **들어올 때 주인을 보는** 이유는, 같은 사람이 다시 들어오는
 * 경우를 지우지 않기 위해서다. 서버가 없는 동안 논 진행이 로그아웃 한 번에 사라지면 안 된다.
 */
const OWNER_KEY = "monster-rpg-save-owner";

/**
 * 계정에 딸린 것들. 소리·전투 속도 같은 설정은 사람이 아니라 이 브라우저의 것이라 안 건드린다.
 *
 * 숲 원정은 서버 세이브에 안 들어가고 기기에만 남는다(forest/runStorage.ts). 여기서 안 지우면
 * 새 계정이 앞 사람이 걷던 원정 한가운데에서 시작한다.
 */
const ACCOUNT_SCOPED_KEYS = ["monster-rpg-forest-run"];

function readOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function writeOwner(username: string): void {
  try {
    localStorage.setItem(OWNER_KEY, username);
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)면 주인을 못 적는다.
    // 그러면 다음 로그인이 남의 것으로 보고 지우는데, 지워서 손해 보는 쪽이 아니라 맞는 쪽이다.
  }
}

/**
 * 주인이 안 적혀 있던 시절의 브라우저를 한 번 받아 준다.
 * 이미 로그인해 있는 사람의 세이브는 그 사람 것이 맞으니 지우지 않고 이름만 붙인다.
 * 로그인한 적이 없는데 세이브만 남아 있으면 주인 없는 것으로 두고, 다음에 들어오는 계정이 지운다.
 */
export function adoptSaveOwner(username: string | null): void {
  if (readOwner() !== null) return;
  writeOwner(username ?? "");
}

/**
 * 이 계정이 이 브라우저의 주인임을 선언한다. 앞 주인이 다르면 그 진행을 지운다.
 * 로그인 직후 **화면이 그려지기 전에** 불러야 한다 — 나중에 지우면 앞 사람의 진행이 한 번 보인다.
 */
export function claimSaveFor(username: string): void {
  const previous = readOwner();
  writeOwner(username);
  if (previous === null || previous === username) return;

  usePlayerStore.getState().resetToInitial();
  for (const key of ACCOUNT_SCOPED_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // 못 지워도 로그인은 막지 않는다
    }
  }
}
