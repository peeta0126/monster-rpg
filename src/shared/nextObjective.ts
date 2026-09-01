import type { PersistedStoryFlag } from "./playerStore";
import { isBossFloor, isGateFloor } from "./floorTable";

/**
 * "지금 할 일" 한 줄.
 *
 * 강제 튜토리얼 대신 이걸 쓴다. 긴 튜토리얼은 이탈률만 높이고 한 번 닫으면 다시
 * 못 본다. 이 줄은 진행 상태에서 뽑아내는 거라 따로 저장할 것도 없고, 언제 돌아와도
 * 맞는 값이 나온다.
 *
 * 톤은 monster-rpg-story.md 를 따른다. 들뜬 안내문 말고 담담한 한 줄.
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
  /**
   * 가방의 **회복** 물약 수. 전체 개수와 따로 받는 이유가 있다 — 해독제와 공격 버프만
   * 잔뜩 남은 채로 보스 앞에 서는 게 이 게임에서 제일 흔한 패배 경로다(40층 실측:
   * 회복 0~1개). 밸런스도 "관문 앞에서는 내려가 만들어 온다"를 전제로 맞춰 놨으니,
   * 화면이 그 말을 안 하면 사람만 그걸 모르는 채로 벽을 맞는다.
   */
  healPotionCount?: number;
  /**
   * 지금 진행 중인 부탁 한 줄. 퀘스트 표를 여기서 안 읽고 받아 오는 건, 이 함수가
   * 화면 없이도 시험되는 순수 함수로 남아야 해서다.
   *
   * 이게 앞에 서는 이유는, 원래 1층 이후로 "N층에 도전해 보세요"만 반복했기 때문이다.
   * 난이도 설계는 "장비로만 넘는다"인데 제작·강화·각인을 한 번도 안 짚어 줘서, 벽에
   * 부딪힌 사람이 갈 곳을 몰랐다. 부탁은 그 자리를 딱 가리킨다.
   */
  activeQuest?: { text: string; where?: string } | null;
}

/**
 * 관문·보스 앞에 서 있고 회복 물약이 모자라면 그 층을 뭐라고 부를지.
 * 안 모자라거나 일반 층이면 null. 관문(15·25·35·45)과 보스(n0)는 이름이 다르다 —
 * 화면이 둘을 섞어 부르면 "관문은 5층마다"라는 규칙이 흐려진다.
 */
function restockWarning(bestFloor: number, healPotionCount: number): string | null {
  const next = bestFloor + 1;
  if (healPotionCount >= 3) return null;
  if (isBossFloor(next)) return `${next}층에는 보스가 있습니다`;
  if (isGateFloor(next)) return `${next}층은 관문입니다`;
  return null;
}

export function getNextObjective(
  { storyFlags, bestFloor, potionCount, healPotionCount, activeQuest }: ObjectiveInput,
): Objective | null {
  if (!storyFlags.met_orion)     return { text: "이장 오리온에게 말을 걸어 보세요", where: "마을 안쪽" };
  if (!storyFlags.met_baros)     return { text: "탑 앞의 바로스에게 말을 걸어 보세요", where: "탑 입구" };
  if (!storyFlags.first_capture) return { text: "숲에서 몬스터를 포획해 보세요", where: "숲" };
  if (bestFloor === 0)           return { text: "무한의 탑 1층에 도전해 보세요", where: "탑" };
  if (potionCount === 0)         return { text: "공방에서 물약을 만들어 보세요", where: "집" };
  // 부탁보다 앞에 세운다. 관문 하나가 회복 물약 대여섯 개를 먹는데, 빈손으로 올라가면
  // 그 층이 어려워서가 아니라 가방이 비어서 막힌다.
  const warning = restockWarning(bestFloor, healPotionCount ?? potionCount);
  if (warning) return { text: `${warning}. 공방에서 회복 물약을 채워 가세요`, where: "집" };
  if (activeQuest)               return activeQuest;
  if (!storyFlags.tower_cleared) return { text: `무한의 탑 ${bestFloor + 1}층에 도전해 보세요`, where: "탑" };
  return null;   // 엔딩까지 봤고 남은 부탁도 없으면 더 시킬 것이 없다
}
