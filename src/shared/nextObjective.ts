import type { PersistedStoryFlag } from "./playerStore";

/**
 * "지금 할 일" 한 줄.
 *
 * 강제 튜토리얼 대신 이걸 쓴다 — 긴 튜토리얼은 이탈률을 높이고, 한 번 닫으면
 * 다시 못 본다. 이 줄은 진행 상태에서 파생되므로 따로 저장할 것도 없고
 * 언제 돌아와도 맞는 값이 나온다.
 *
 * 톤은 monster-rpg-story.md 를 따른다 — 들뜬 안내문이 아니라 담담한 한 줄.
 */
export interface Objective {
  text: string;
  /** 어디로 가야 하는지 (베이스캠프 안의 지형지물 이름) */
  where?: string;
}

interface ObjectiveInput {
  storyFlags: Record<PersistedStoryFlag, boolean>;
  bestFloor: number;
  potionCount: number;
}

export function getNextObjective({ storyFlags, bestFloor, potionCount }: ObjectiveInput): Objective | null {
  if (!storyFlags.met_orion)     return { text: "이장 오리온에게 말을 걸어 보세요", where: "마을 안쪽" };
  if (!storyFlags.met_baros)     return { text: "탑 앞의 바로스에게 말을 걸어 보세요", where: "탑 입구" };
  if (!storyFlags.first_capture) return { text: "숲에서 몬스터를 포획해 보세요", where: "숲" };
  if (bestFloor === 0)           return { text: "무한의 탑 1층에 도전해 보세요", where: "탑" };
  if (potionCount === 0)         return { text: "공방에서 물약을 만들어 보세요", where: "집" };
  if (!storyFlags.tower_cleared) return { text: `무한의 탑 ${bestFloor + 1}층에 도전해 보세요`, where: "탑" };
  return null;   // 엔딩까지 봤으면 더 시킬 것이 없다
}
