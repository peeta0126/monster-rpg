/**
 * 스토리 플래그와 퀘스트 상태 — 아무것도 import 하지 않는 바닥 모듈.
 *
 * 원래 playerStore 안에 있었는데, 세이브 마이그레이션이 "지금까지 조건을 만족한 대사"를
 * 계산하려고 대사 표를 읽어야 하면서 playerStore ↔ campDialogues 가 서로를 부르게 됐다.
 * 둘 다 필요로 하는 것은 이 정의들뿐이라 여기로 내렸다. playerStore 가 그대로 다시
 * 내보내므로 기존 import 경로는 살아 있다.
 */

/** always: 항상 충족되는 sentinel. floor_*: bestFloor에서 파생(저장 안 함). 나머지는 저장 대상. */
export type StoryFlag =
  | "always"
  | "met_orion"
  | "met_baros"
  | "first_capture"
  | "quest_baros_done"
  | "quest_orion_done"
  | "tower_cleared"
  | "floor_5"
  | "floor_10"
  | "floor_20"
  | "floor_40"
  | "floor_50";

export type PersistedStoryFlag =
  | "met_orion"
  | "met_baros"
  | "first_capture"
  | "quest_baros_done"
  | "quest_orion_done"
  /** 오름을 쓰러뜨리고 엔딩까지 본 상태. bestFloor >= 50(floor_50)과 달리 "엔딩을 봤는가"를 가린다. */
  | "tower_cleared";

export const DEFAULT_STORY_FLAGS: Record<PersistedStoryFlag, boolean> = {
  met_orion: false,
  met_baros: false,
  first_capture: false,
  quest_baros_done: false,
  quest_orion_done: false,
  tower_cleared: false,
};

export function isStoryFlagSet(
  flag: StoryFlag,
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
): boolean {
  switch (flag) {
    case "always":   return true;
    case "floor_5":  return bestFloor >= 5;
    case "floor_10": return bestFloor >= 10;
    case "floor_20": return bestFloor >= 20;
    case "floor_40": return bestFloor >= 40;
    case "floor_50": return bestFloor >= 50;
    default:         return storyFlags[flag];
  }
}

// ─── 퀘스트 상태 ────────────────────────────────────────────────────────────────

export type QuestStatus = "not_accepted" | "in_progress" | "completed";

export function getQuestStatus(
  questId: string,
  questStatus: Record<string, QuestStatus>,
): QuestStatus {
  return questStatus[questId] ?? "not_accepted";
}
