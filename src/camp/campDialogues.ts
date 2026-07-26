import type { PersistedStoryFlag, QuestStatus, StoryFlag } from "../shared/playerStore";
import { isStoryFlagSet } from "../shared/playerStore";

export interface QuestDef {
  id: string;
  npcId: "orion" | "baros";
  /** 수락 조건: flag 충족 + (있다면) bestFloor 최소치 */
  requires: { flag: StoryFlag; minFloor?: number };
  objective: { itemId: string; amount: number };
  rewards: { itemId: string; amount: number }[];
  acceptLines: string[];
  completeLines: string[];
  /** 진행중 + 재료 부족일 때 재생하는 독촉 대사 */
  progressLines: string[];
  setsFlag: PersistedStoryFlag;
}

export interface DialogueEntry {
  requires: StoryFlag;
  lines: string[];
  setsFlag?: PersistedStoryFlag;
  quest?: QuestDef;
}

// ─── 퀘스트 ────────────────────────────────────────────────────────────────────

export const BAROS_FIRST_HUNT_QUEST: QuestDef = {
  id: "baros_first_hunt",
  npcId: "baros",
  requires: { flag: "met_baros" },
  objective: { itemId: "herb", amount: 3 },
  rewards: [
    { itemId: "herb", amount: 2 },
    { itemId: "root", amount: 2 },
    { itemId: "magic_dust", amount: 1 },
  ],
  acceptLines: [
    "이왕 여기까지 왔으니, 하나 시켜보겠다.",
    "숲에서 약초를 3개 구해와라. 물약도 제대로 못 만들면 탑에서 죽는다.",
    "약초 3개다. 잊지 마라.",
  ],
  progressLines: ["아직이냐. 약초 3개는 채워와라."],
  completeLines: [
    "약초 3개, 확인했다.",
    "쓸만하군. 이 정도면 자격이 있다.",
    "받아라.",
  ],
  setsFlag: "quest_baros_done",
};

export const ORION_MOTHERS_MEDICINE_QUEST: QuestDef = {
  id: "orion_mothers_medicine",
  npcId: "orion",
  requires: { flag: "quest_baros_done", minFloor: 3 },
  objective: { itemId: "slime_extract", amount: 2 },
  rewards: [
    { itemId: "crystal", amount: 1 },
    { itemId: "monster_essence", amount: 1 },
    { itemId: "iron_fragment", amount: 2 },
  ],
  acceptLines: [
    "실은 부탁이 하나 있네.",
    "마을 아랫집 노모께서 편찮으신데, 슬라임 추출물이 있어야 약을 지을 수 있다는군.",
    "슬라임 추출물 두 개만 구해다 주게.",
  ],
  progressLines: ["슬라임 추출물은 아직인가? 급한 사정이니 서둘러주게."],
  completeLines: [
    "오, 정말 구해왔구먼! 고맙네.",
    "이걸로 노모께 드릴 약을 지을 수 있겠어.",
    "자네 덕에 마을 하나를 살렸네. 이건 사례일세.",
  ],
  setsFlag: "quest_orion_done",
};

// ─── 대사 ──────────────────────────────────────────────────────────────────────

export const ORION_DIALOGUES: DialogueEntry[] = [
  {
    requires: "always",
    setsFlag: "met_orion",
    lines: [
      "오, 자네가 새로 온 탐험가로군.",
      "나는 이 마을의 이장, 오리온일세.",
      "탑과 숲을 오가려거든 먼저 이 늙은이한테 인사부터 하고 가게.",
      "숲 어귀에 얕은 숲이 있으니, 처음엔 그곳부터 둘러보게. 겁먹을 것 없네, Lv.1에서 8 사이의 순한 녀석들뿐이니까.",
      "무운을 비네.",
    ],
  },
  {
    requires: "met_orion",
    lines: [
      "숲에서 몬스터를 몰아붙이면 도망칠 준비를 하지. 그때 붙잡아보게.",
      "상대의 체력이 30% 아래로 떨어지면 포획을 시도할 수 있다네.",
      "몸이 성치 않은 녀석일수록 붙잡기 쉬운 법이야.",
    ],
  },
  {
    requires: "first_capture",
    lines: [
      "허허, 벌써 한 마리를 붙잡았군! 장하네.",
      "약초 두 뿌리만 있으면 물약을 만들 수 있으니 잘 챙겨두게.",
      "열매 두 알로는 해독제를 만들 수 있지. 상태이상엔 그게 최고일세.",
    ],
  },
  {
    requires: "quest_baros_done",
    quest: ORION_MOTHERS_MEDICINE_QUEST,
    lines: [
      "노모께서 자네 덕에 훨씬 편안해지셨다는군. 고맙네.",
    ],
  },
  {
    requires: "floor_5",
    lines: [
      "탑의 5층까지 올랐다고? 벌써 실력이 제법이군.",
      "방심하지 말고 꾸준히 오르게.",
    ],
  },
  {
    requires: "floor_10",
    lines: [
      "10층이라... 이 마을에서 그만큼 오른 이는 몇 없었네.",
      "자네라면 더 위까지 갈 수 있을 게야.",
    ],
  },
  {
    requires: "floor_20",
    lines: [
      "20층까지 갔다는 소식은 나도 들었네.",
      "탑의 중턱을 넘어섰으니, 이제부터가 진짜일세.",
    ],
  },
  {
    requires: "floor_40",
    lines: [
      "40층이라니, 믿기지가 않는구먼.",
      "탑 꼭대기에 무엇이 있는지는 나도 알지 못하네. 부디 조심하게.",
    ],
  },
];

export const BAROS_DIALOGUES: DialogueEntry[] = [
  {
    requires: "always",
    lines: ["이장 영감한테 먼저 가봐라."],
  },
  {
    requires: "met_orion",
    setsFlag: "met_baros",
    lines: [
      "왔군. 나는 이 탑을 지키는 바로스다.",
      "이 탑에는 층마다 더 강한 몬스터가 기다리고 있다.",
      "약한 채로 오르면 죽는다. 각오해라.",
    ],
  },
  {
    requires: "met_baros",
    quest: BAROS_FIRST_HUNT_QUEST,
    lines: ["탑에 오르기 전에 준비를 단단히 해라."],
  },
  {
    requires: "first_capture",
    lines: [
      "몬스터를 붙잡았다고 들었다.",
      "그 정도로 만족하지 마라. 탑은 훨씬 더 높다.",
    ],
  },
  {
    requires: "floor_5",
    lines: ["5층까지 왔군. 나쁘지 않다."],
  },
  {
    requires: "floor_10",
    lines: ["10층. 제법이다.", "하지만 방심은 금물이다."],
  },
  {
    requires: "floor_20",
    lines: ["20층까지 올랐나. 이 탑에서 살아남는 자는 드물다."],
  },
  {
    requires: "floor_40",
    lines: [
      "40층이라... 여기까지 온 자는 손에 꼽는다.",
      "위쪽은 나도 잘 모른다. 스스로 알아내라.",
    ],
  },
];

/** requires를 만족하는 항목 중 배열에서 가장 마지막 것을 반환 */
export function selectDialogueEntry(
  entries: DialogueEntry[],
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
): DialogueEntry | undefined {
  let selected: DialogueEntry | undefined;
  for (const entry of entries) {
    if (isStoryFlagSet(entry.requires, storyFlags, bestFloor)) {
      selected = entry;
    }
  }
  return selected;
}

export interface NpcInteractionResult {
  lines: string[];
  setsFlag?: PersistedStoryFlag;
  acceptQuestId?: string;
  completeQuest?: {
    questId: string;
    objective: { itemId: string; amount: number };
    rewards: { itemId: string; amount: number }[];
    setsFlag: PersistedStoryFlag;
  };
}

/**
 * 퀘스트가 걸린 NPC는 미수락/진행중/완료 상태에 따라 acceptLines·progressLines·completeLines를
 * 우선 재생한다. 조건 미충족이거나 이미 완료된 퀘스트는 기존 대사 선택 로직(selectDialogueEntry)으로 넘긴다.
 */
export function resolveNpcInteraction(
  dialogues: DialogueEntry[],
  storyFlags: Record<PersistedStoryFlag, boolean>,
  bestFloor: number,
  materials: Record<string, number>,
  questStatus: Record<string, QuestStatus>,
): NpcInteractionResult | undefined {
  const quest = dialogues.find((e) => e.quest)?.quest;
  if (quest) {
    const flagOk = isStoryFlagSet(quest.requires.flag, storyFlags, bestFloor);
    const floorOk = quest.requires.minFloor === undefined || bestFloor >= quest.requires.minFloor;
    const status = questStatus[quest.id] ?? "not_accepted";

    if (flagOk && floorOk && status !== "completed") {
      if (status === "not_accepted") {
        return { lines: quest.acceptLines, acceptQuestId: quest.id };
      }
      const have = materials[quest.objective.itemId] ?? 0;
      if (have >= quest.objective.amount) {
        return {
          lines: quest.completeLines,
          completeQuest: {
            questId:   quest.id,
            objective: quest.objective,
            rewards:   quest.rewards,
            setsFlag:  quest.setsFlag,
          },
        };
      }
      return { lines: quest.progressLines };
    }
  }

  const entry = selectDialogueEntry(dialogues, storyFlags, bestFloor);
  if (!entry) return undefined;
  return { lines: entry.lines, setsFlag: entry.setsFlag };
}
