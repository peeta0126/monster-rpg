import type { PersistedStoryFlag, QuestStatus, StoryFlag } from "../shared/playerStore";
import { isStoryFlagSet } from "../shared/playerStore";

export interface QuestDef {
  id: string;
  title: string;
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
  /** requires 외에 bestFloor 최소치까지 함께 걸어야 할 때 사용 (퀘스트의 minFloor와 짝을 맞추는 용도) */
  minFloor?: number;
  lines: string[];
  setsFlag?: PersistedStoryFlag;
  quest?: QuestDef;
  /** 대사 끝에 건네주는 몬스터. 이미 가지고 있어도 한 번 더 주지는 않는다(플래그가 같이 선다) */
  grantsMonsterId?: string;
}

// ─── 퀘스트 ────────────────────────────────────────────────────────────────────

export const BAROS_FIRST_HUNT_QUEST: QuestDef = {
  id: "baros_first_hunt",
  title: "첫 사냥",
  npcId: "baros",
  requires: { flag: "met_baros" },
  objective: { itemId: "herb", amount: 3 },
  rewards: [
    { itemId: "herb", amount: 2 },
    { itemId: "root", amount: 2 },
    { itemId: "magic_dust", amount: 1 },
  ],
  acceptLines: [
    "말로 들어선 모른다. 직접 해봐라.",
    "얕은 숲에서 약초 셋만 뜯어와. 그거면 네가 숲에서 살아남는지 알 수 있다.",
  ],
  progressLines: ["아직이냐. 약초 3개는 채워와라."],
  completeLines: [
    "살아 돌아왔군. 받아라.",
    "…마법 가루도 하나 넣었다. 원래 깊은 숲에서나 나오는 물건이다.",
    "지금 실력으론 거긴 못 간다. 그러니 미리 줘보는 거야. 위에 뭐가 기다리는지 알아야 준비를 하지.",
    "공방에서 집중의 물약을 만들어봐라. 그 맛을 알면 다음엔 알아서 가고 싶어질 게다.",
  ],
  setsFlag: "quest_baros_done",
};

export const ORION_MOTHERS_MEDICINE_QUEST: QuestDef = {
  id: "orion_mothers_medicine",
  title: "어머니의 약",
  npcId: "orion",
  requires: { flag: "quest_baros_done", minFloor: 3 },
  objective: { itemId: "slime_extract", amount: 2 },
  rewards: [
    { itemId: "crystal", amount: 1 },
    { itemId: "monster_essence", amount: 1 },
    { itemId: "iron_fragment", amount: 2 },
  ],
  acceptLines: [
    "부탁이 하나 있다.",
    "약을 지어보려 한다. 슬라임 추출물이 둘 필요해.",
    "…솔직히 말하마. 이게 들을지 나도 모른다.",
    "원인을 모르는데 약을 짓는다는 게 말이 안 되지. 그래도 가만히 있는 것보단 낫지 않겠느냐.",
    "낫게는 못 해도, 조금 편하시게는 할 수 있을 게다. 그동안 네가 오를 시간을 벌고.",
  ],
  progressLines: ["슬라임 추출물은 아직인가. 급할 것 없다. 천천히 구해오게."],
  completeLines: [
    "고맙다. 오늘 밤에 달여드리마.",
    "이건 가져가라. 내가 오르던 시절 모아둔 것들이다.",
    "힘의 목걸이를 만들 수 있을 게다. 철 조각 둘, 몬스터 정수 하나, 빛의 수정 하나 — 딱 맞을 거야.",
    "빛의 수정은 아껴라. 지금 갈 수 있는 숲에선 안 나온다.",
    "언젠가 스스로 구하게 되겠지. 그때쯤이면 넌 내가 멈춘 곳보다 위에 있을 게다.",
  ],
  setsFlag: "quest_orion_done",
};

/** 퀘스트 로그 UI 등에서 전체 목록이 필요할 때 사용하는 단일 소스 */
export const ALL_QUESTS: QuestDef[] = [BAROS_FIRST_HUNT_QUEST, ORION_MOTHERS_MEDICINE_QUEST];

// ─── 대사 ──────────────────────────────────────────────────────────────────────

export const ORION_DIALOGUES: DialogueEntry[] = [
  // 3-1. 첫 만남 (start)
  {
    requires: "always",
    setsFlag: "met_orion",
    grantsMonsterId: "flameling",
    lines: [
      "어머니 곁에 있다 왔다. …좋지 않구나.",
      "솔직히 말하마. 나도 모른다.",
      "열병도 아니고 독도 아니야. 약초도 안 듣는다. 의원도 손을 들었다.",
      "이장씩이나 돼서 이런 말밖에 못 하는 게 부끄럽다만… 이 마을에서 답을 아는 사람은 없다.",
      "다만 한 가지.",
      "이 마을에서 설명 안 되는 일이 생기면, 늘 저 탑이었다.",
      "근거는 없다. 확신도 없어. …그저 남은 게 그것뿐이라 하는 말이다.",
      "마지막 끄나풀이라도 잡아보겠느냐.",
      "…그 얼굴이면 됐다. 맨몸으로 보내진 않는다.",
      "헛간에 눌러앉은 녀석이 하나 있다. 불씨를 달고 다녀서 겨울에 요긴했지.",
      "데려가라. 이름은 플레미다.",
      "— 플레미가 파티에 들어왔다 —",
      "탑 입구의 바로스를 찾아가라. 그 자가 널 돌려보내지 않는다면, 넌 준비된 게다.",
    ],
  },
  // 3-2. 바로스를 만난 후
  {
    requires: "met_baros",
    lines: [
      "바로스가 통과시켰나. …그자가 사람을 쉽게 들여보내지 않는데.",
      "하나만 일러두마. 서두르지 마라.",
      "뭘 찾아야 하는지도 모르는 채 오르는 거다. 그럴수록 천천히 가야 해.",
      "어머니는 내가 보고 있으마.",
    ],
  },
  // 3-3. 첫 포획 후
  {
    requires: "first_capture",
    lines: [
      "몬스터를 데려왔구나.",
      "저것들이 어디서 왔는지 아느냐. …나도 모른다. 탑이 생긴 뒤로 있었다는 것밖에.",
      "다만 저것들도 저 탑에서 나온 것이라면… 네 어머니를 아프게 한 것과 같은 데서 온 셈이지.",
      "잘 키워라. 네가 데려온 이상 네 책임이다.",
    ],
  },
  // 어머니의 약 (quest_baros_done + 3층 도달 이후) — 미수락/진행중/완료는 QuestDef가 처리, 이 lines는 완료 후 필터
  // minFloor를 quest.requires.minFloor와 맞춰서, 3층 도달 전에는 이 fallback이 뜨지 않고
  // 바로 위 met_baros/first_capture 대사로 자연스럽게 빠지도록 한다.
  {
    requires: "quest_orion_done",
    minFloor: ORION_MOTHERS_MEDICINE_QUEST.requires.minFloor,
    quest: ORION_MOTHERS_MEDICINE_QUEST,
    lines: ["어머니 약은 이미 받았다. 고맙다."],
  },
  // 3-4. 10층 도달 — 2막
  {
    requires: "floor_10",
    lines: [
      "10층이라고? …정말 오르고 있구나.",
      "이상한 걸 봤다는 얼굴이군.",
      "실은 나도 젊을 적에 올랐다. 10층에서 멈췄지.",
      "그때도 이상했다. 몬스터가 제 속성이 아닌 걸 쓰더구나. 불을 쓸 리 없는 놈이 불을 뿜었어.",
      "무서워서 내려온 게 아니다. …이해가 안 돼서 내려온 거다.",
    ],
  },
  // 3-5. 20층 도달 — 3막
  {
    requires: "floor_20",
    lines: [
      "20층. 내가 본 것보다 위구나.",
      "층마다 다른 원소를 쓰는 놈이 나온다고 했나.",
      "…그 얘기를 듣고 밤새 생각했다.",
      "원소가 흩어져 있는 게 아니라, 하나가 흘리고 있는 거라면?",
      "위에 뭔가 있다. 그게 뭔지는 여전히 모르겠다만…",
      "네 어머니가 아픈 것도 거기서 왔을지 모른다. 이제야 그런 생각이 드는구나.",
    ],
  },
  // 3-6. 40층 도달 — 4막 · 정체
  {
    requires: "floor_40",
    lines: [
      "40층….",
      "옛날 이야기 하나 해주마. 아무도 안 믿는 이야기다.",
      "탑 꼭대기에 용이 있다더구나. 불도 얼음도 번개도, 전부 다루는 용이.",
      "나도 안 믿었다. 이 세상 어떤 것도 원소는 하나뿐이니까.",
      "그런데 네가 층마다 다른 원소를 봤다고 했지.",
      "그게 흩어진 게 아니라 한 놈한테서 새어 나온 거라면… 그 이야기가 맞는 게다.",
      "그 힘이 탑 안에만 머물지 못하게 된 거야. 밖으로 흘러나와 세상을 훑고 있는 게지.",
      "그 파장에 닿은 사람이 시드는 거고.",
      "…네 어머니처럼.",
      "미안하다. 이걸 이제야 알아채는구나. 더 일찍 알았다면 널 보내지 않았을 텐데.",
      "아니… 알았어도 보냈겠지. 그게 유일한 길이니까.",
    ],
  },
  // 3-7. 50층 · 오름 처치 — 만물의 정수
  {
    requires: "floor_50",
    lines: [
      "…이게 뭐냐.",
      "만물의 정수라니. 이런 게 정말 있었구나.",
      "그 용을 정말 넘었단 말이지.",
      "이 기운이라면… 어머니를 훑고 간 파장도 씻어낼 수 있을지 모른다.",
      "연금술로 다뤄봐야겠구나. 공방에 가져가라.",
      "물약으로 만들 수 있을 것 같다.",
    ],
  },
  // 3-8. 엔딩 이후 — 어머니가 나은 뒤
  {
    requires: "tower_cleared",
    lines: [
      "어머니는 어제 마당까지 나오셨다.",
      "…아직도 실감이 안 난다.",
      "탑은 그대로 서 있다. 아무것도 안 변했지.",
      "다만 이 마을은 이제 위에 뭐가 있는지 안다. 그게 다르다.",
      "가끔 들러라. 어머니가 네 얼굴을 보고 싶어하신다.",
    ],
  },
];

export const BAROS_DIALOGUES: DialogueEntry[] = [
  // met_orion 이전 게이팅
  {
    requires: "always",
    lines: ["이장 영감한테 먼저 가봐라."],
  },
  // 4-1. 첫 대면 — 탑의 규칙과 "혼자로는 안 된다"까지만.
  // 예전엔 여기서 포획·육성·제작·분해를 19줄에 몰아넣었다. 그 시점에 못 하는 일까지
  // 설명하니 아무것도 안 남았고, 없어진 탑 포획 규칙까지 그대로 읊고 있었다.
  {
    requires: "met_orion",
    setsFlag: "met_baros",
    lines: [
      "멈춰라. …이장 영감이 보냈나.",
      "사정은 들었다. 어머니 일은 안됐군.",
      "하지만 여긴 사정 봐주는 곳이 아니다. 준비 안 된 놈은 돌려보낸다. 그게 내 일이야.",
      "규칙은 간단하다. 한 층에 몬스터 한 마리. 이기면 위로. 지면 처음부터.",
      "10층마다 강한 놈이 지키고 있다. 그건 각오해라.",
      "끝이 몇 층이냐고? 나도 모른다. 끝까지 간 놈이 없으니까.",
      "…한 마리로 어디까지 갈 생각이냐.",
      "탑에서는 못 잡는다. 여기 것들은 잡히라고 있는 게 아니야.",
      "숲으로 가라. 거기서 데려오는 거다. 얕은 숲이면 지금 수준에 맞는다.",
    ],
  },
  // 첫 사냥 (met_baros 이후) — 미수락/진행중/완료는 QuestDef가 처리, 이 lines는 완료 후 필터
  {
    requires: "met_baros",
    quest: BAROS_FIRST_HUNT_QUEST,
    lines: ["탑에 오르기 전에 준비를 단단히 해라."],
  },
  // 4-2. 첫 포획 후 — 파티와 재료 이야기는 실제로 잡아 온 다음에 한다
  {
    requires: "first_capture",
    lines: [
      "데려왔군. 키워라. 묵혀두면 아무 소용 없다.",
      "데리고 오를 수 있는 건 셋까지다. 나머지는 보관함에 둬라.",
      "숲에선 재료도 떨어진다. 약초, 나무뿌리, 가죽.",
      "그걸 들고 공방으로 가라. 약초 둘에 나무뿌리 하나면 물약이다. 그 정도는 지금도 만든다.",
      "하나 더. 숲은 네가 데리고 있는 놈보다 센 걸 내주지 않는다.",
      "위로 오르면 숲도 따라 올라온다. 순서가 그렇다.",
    ],
  },
  // 4-3. 5층 도달 — 장비 이야기는 맨몸이 슬슬 안 먹히는 이 시점에
  {
    requires: "floor_5",
    lines: [
      "5층. …인정하마.",
      "위로 갈수록 놈들이 기술을 하나씩 더 들고 나온다. 6층부터 독 쓰는 놈이 있어. 해독제 챙겨라.",
      "열매 둘이면 해독제 하나다.",
      "그리고 슬슬 맨몸으로는 안 된다. 공방에서 장비를 만들어 채워라.",
      "장비는 만들고 끝이 아니야. 강화석으로 레벨을 올려라. 올리면 부가 능력치가 열린다.",
      "강화석 없으면 안 쓰는 장비를 모루에서 분해해라. 거기서 나온다.",
    ],
  },
  // 4-5. 10층 도달 — 2막 · 복선
  {
    requires: "floor_10",
    lines: [
      "10층 지켰나. 놀랍군.",
      "…하나 묻자.",
      "위에서 이상한 거 못 봤나.",
      "나도 예전엔 올랐다. 그때랑 다르다는 소리가 들려서.",
      "물속에 사는 놈이 불을 뿜었다든가. 풀붙이가 번개를 쳤다든가.",
      "봤다는 얼굴이군.",
      "…나도 뭔지 모른다. 다만 위로 갈수록 심해진다더라.",
      "속성 상성만 믿고 덤비지 마라. 그러다 죽는다.",
    ],
  },
  // 4-6. 20층 도달 — 3막
  {
    requires: "floor_20",
    lines: [
      "20층 보스를 넘었다고. 격노한 모치였나.",
      "그놈은 번개였지. 30층 놈은 얼음이라더군.",
      "…층마다 원소가 다르다.",
      "나는 학자가 아니라 모르겠다. 이장 영감한테 말해봐라. 그 양반은 알지도.",
      "나는 내 일만 하마. 살아 돌아와라.",
    ],
  },
  // 4-7. 엔딩 이후 — 탑을 넘긴 뒤
  {
    requires: "tower_cleared",
    lines: [
      "…네가 그 위까지 갔다는 게 아직도 안 믿긴다.",
      "나는 여기까지가 내 자리였다. 그건 이제 아무래도 좋고.",
      "문은 계속 열어둔다. 오르고 싶으면 올라라.",
      "이번엔 죽으러 가는 게 아니니까.",
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
    const floorOk = entry.minFloor === undefined || bestFloor >= entry.minFloor;
    if (floorOk && isStoryFlagSet(entry.requires, storyFlags, bestFloor)) {
      selected = entry;
    }
  }
  return selected;
}

export interface NpcInteractionResult {
  lines: string[];
  setsFlag?: PersistedStoryFlag;
  grantsMonsterId?: string;
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
      const questEntry = dialogues.find((e) => e.quest === quest);
      const storyEntry = selectDialogueEntry(dialogues, storyFlags, bestFloor);
      if (storyEntry && storyEntry !== questEntry) {
        return {
          lines: storyEntry.lines,
          setsFlag: storyEntry.setsFlag,
          grantsMonsterId: storyEntry.grantsMonsterId,
        };
      }
      return { lines: quest.progressLines };
    }
  }

  const entry = selectDialogueEntry(dialogues, storyFlags, bestFloor);
  if (!entry) return undefined;
  return { lines: entry.lines, setsFlag: entry.setsFlag, grantsMonsterId: entry.grantsMonsterId };
}
