/**
 * 잡담 — 이야기도 퀘스트도 남지 않았을 때 하는 말.
 *
 * 없을 때는 다 본 사람이 같은 대사 한 줄을 평생 들었다. 엔딩까지 본 사람이 특히 그랬다.
 *
 * 톤은 이야기 대사를 그대로 따른다(monster-rpg-story.md 6-4).
 *   오리온 — 길고 여백 있음. `~게다 / ~하마 / ~느냐`. 숫자를 안 쓴다. 모르면 모른다고 한다.
 *   바로스 — 짧게 끊는다. `~해라 / ~다`. 숫자는 정확히 쓴다. 모르면 내 일이 아니라고 넘긴다.
 */

export type TalkStage = "early" | "mid" | "late" | "cleared";

/**
 * 잡담이 붙는 조건. 없으면 항상 후보다.
 *
 * 우선순위 계층으로 만들지 않았다 — 그러면 다친 채로 갈 때마다 같은 잔소리를 듣는다.
 * 조건이 맞을 때 후보에 끼기만 하고, 뽑히는 건 여전히 운이다.
 */
export type TalkCondition = "hurt" | "noPotion" | "loaded";

export interface SmallTalkLine {
  text: string;
  when?: TalkCondition;
}

/** 잡담 판정에 필요한 지금 상태 */
export interface TalkState {
  hurt: boolean;
  noPotion: boolean;
  loaded: boolean;
}

/** 재료를 이만큼 넘게 들고 있으면 "쌓아두고 있다"고 본다 */
export const LOADED_MATERIAL_COUNT = 40;

/**
 * 구간.
 *
 * 중반을 10~49층 한 덩어리로 두면 스무 층에서도 마흔다섯 층에서도 같은 말을 하게 돼서
 * 30층에서 한 번 더 끊었다.
 *
 * ⚠️ 후반(30~49층) 잡담은 **용을 말하지 않는다.** 용은 40층 이야기 대사가 처음 꺼내는
 * 것이라, 잡담이 먼저 말하면 그 대사가 죽는다. 후반은 "위에 뭔가 하나 있다"까지만 안다.
 */
export function talkStage(bestFloor: number, towerCleared: boolean): TalkStage {
  if (towerCleared) return "cleared";
  if (bestFloor >= 30) return "late";
  if (bestFloor >= 10) return "mid";
  return "early";
}

// ─── 오리온 — 마을 이장 ────────────────────────────────────────────────────────

const ORION_TALK: Record<TalkStage, SmallTalkLine[]> = {
  early: [
    { text: "어머니는 오늘 좀 나으신 것 같기도 하다. …그런 날이 있고 아닌 날이 있다." },
    { text: "마당의 감나무가 올해는 열매를 안 맺는구나. 작년까진 넘치게 열렸는데." },
    { text: "우물물 맛이 변했다는 사람이 있다. 나는 잘 모르겠다만." },
    { text: "숲에 자주 가는 모양이더구나. 해 지기 전에는 나와라." },
    { text: "이 마을이 원래 이렇게 조용하진 않았다. 젊은 사람이 하나둘 떠나서 그렇지." },
    { text: "네 나이 때 나도 저 탑을 올려다보곤 했다. 지금도 가끔 그런다." },
  ],
  mid: [
    { text: "네가 올라간 만큼 마을에서도 탑이 달라 보인다. 이상한 일이지." },
    { text: "어젯밤에 어머니가 네 이름을 부르셨다. 자면서." },
    { text: "약재상이 값을 올렸다. 약초가 예전만큼 안 들어온다더구나." },
    { text: "저 위에서 본 것을 잊지 말고 적어둬라. 나중엔 기억이 자기 편할 대로 바뀐다." },
    { text: "무리하지 마라. 이 일에 기한이 있는 것도 아니고… 아니, 있긴 하겠구나. 미안하다." },
    { text: "바로스 그 사람도 젊을 적엔 올랐다. 어디까지 갔는지는 말을 안 하더구나." },
  ],
  late: [
    { text: "요즘은 마을 사람들도 네 얘기를 한다. 믿는 사람 반, 안 믿는 사람 반이다." },
    { text: "위로 갈수록 원소가 하나씩 어긋난다고 했지. 나는 아직도 그 말이 무섭다." },
    { text: "어머니가 어제는 하루 종일 주무셨다. …그래도 숨은 고르시더구나." },
    { text: "돌아올 때마다 네 얼굴이 조금씩 달라진다. 좋은 쪽인지는 모르겠다." },
    { text: "밤에 탑 쪽을 보면 꼭대기만 흐릿하다. 안개인지 뭔지." },
    { text: "여기까지 왔으면 내가 해 줄 말은 없다. 그저 살아 돌아오라는 것뿐이다." },
  ],
  cleared: [
    { text: "어머니가 텃밭을 다시 매기 시작하셨다. 말려도 안 듣는구나." },
    { text: "마을 아이들이 탑에 가겠다고 떼를 쓴다. 네 탓이다." },
    { text: "그 용은 어떤 얼굴이었느냐. …아니다, 안 듣는 편이 낫겠다." },
    { text: "저 탑은 여전히 서 있다. 다만 이제는 무섭지 않구나." },
    { text: "가끔 이런 생각을 한다. 내가 그때 안 멈췄더라면 어땠을까 하고." },
    { text: "밥은 먹고 다니느냐. 어머니가 물으시더라." },
  ],
};

const ORION_CONDITIONAL: SmallTalkLine[] = [
  { when: "hurt",     text: "몸이 성치 않구나. 그것들도 쉬어야 한다. 재우고 가라." },
  { when: "noPotion", text: "빈손으로 오르는 게냐. 하다못해 물약 하나는 넣어가라." },
  { when: "loaded",   text: "짐이 무거워 보이는구나. 쌓아두면 썩는다. 뭐라도 만들어라." },
];

// ─── 바로스 — 탑 경비병 ────────────────────────────────────────────────────────

const BAROS_TALK: Record<TalkStage, SmallTalkLine[]> = {
  early: [
    { text: "볼일 없으면 비켜라. 문 앞이다." },
    { text: "약초 둘이면 물약 하나다. 세어서 들어가라." },
    { text: "죽으면 처음부터다. 그거 하나만 기억해라." },
    { text: "어제 웬 놈이 3층에서 기어 내려왔다. 맨몸이었다." },
    { text: "숲이 탑보다 안전한 건 아니다. 다만 되돌아올 수는 있지." },
    { text: "물어볼 게 있으면 지금 해라. 위에선 아무도 안 가르쳐준다." },
  ],
  mid: [
    { text: "몇 층이냐. …그래. 계속해라." },
    { text: "10층마다 하나씩 있다. 그건 안 바뀐다." },
    { text: "장비는 만들고 끝이 아니다. 올려라." },
    { text: "물약 없이 오르는 놈은 안 들여보낸다. 규칙이다." },
    { text: "네 앞에 하나 있었다. 8층에서 그만뒀지. 지금은 대장간에서 일한다." },
    { text: "쉬어라. 지친 채로 오르는 게 제일 빨리 죽는 길이다." },
  ],
  late: [
    { text: "이제 내가 아는 층은 지났다. 그 위는 네가 더 안다." },
    { text: "관문은 15, 25, 35, 45다. 세어두면 놀랄 일이 없다." },
    { text: "장비 하나에 몰아주지 마라. 셋 다 올려라." },
    { text: "위에서 내려온 놈들이 하는 말이 다 다르다. 나는 다 안 믿는다." },
    { text: "…무섭지 않냐고 물은 적 없지. 나도 안 묻겠다." },
    { text: "돌아오면 문은 여기 있다. 그게 내 일이다." },
  ],
  cleared: [
    { text: "이제 뭘 할 거냐. 나는 여전히 여기 서 있는다." },
    { text: "탑은 그대로다. 몬스터도 그대로다. 달라진 건 너 하나다." },
    { text: "위에 뭐가 있었냐고 애들이 묻는다. 네가 대답해라. 나는 안 봤다." },
    { text: "다시 오를 거면 말려도 소용없겠지. 준비는 똑같이 해라." },
    { text: "…고맙다는 말은 안 한다. 그런 건 이장 영감 몫이다." },
    { text: "문 앞에서 비켜라. 아직 내 자리다." },
  ],
};

const BAROS_CONDITIONAL: SmallTalkLine[] = [
  { when: "hurt",     text: "네 놈들 꼴을 봐라. 그 상태로는 안 들여보낸다." },
  { when: "noPotion", text: "약도 없이 왔나. 약초 둘이면 하나다. 만들고 와라." },
  { when: "loaded",   text: "그만큼 들고 다닐 거면 공방에 가라. 재료는 쥐고 있어봐야 안 세진다." },
];

export type SmallTalkNpcId = "orion" | "baros";

const POOLS: Record<SmallTalkNpcId, { stages: Record<TalkStage, SmallTalkLine[]>; conditional: SmallTalkLine[] }> = {
  orion: { stages: ORION_TALK, conditional: ORION_CONDITIONAL },
  baros: { stages: BAROS_TALK, conditional: BAROS_CONDITIONAL },
};

/** 지금 나올 수 있는 잡담 후보 전부 */
export function smallTalkCandidates(
  npcId: SmallTalkNpcId,
  stage: TalkStage,
  state: TalkState,
): string[] {
  const pool = POOLS[npcId];
  const conditional = pool.conditional.filter((l) => l.when && state[l.when]);
  return [...pool.stages[stage], ...conditional].map((l) => l.text);
}

/**
 * 잡담 한 줄.
 *
 * 바로 앞에 한 말은 후보에서 뺀다 — 같은 말이 연달아 두 번 나오면 무작위가 아니라
 * 고장으로 읽힌다. 후보가 하나뿐이면 빼지 않는다(뺄 게 없다).
 *
 * `random` 은 시험에서 고정하려고 열어 뒀다.
 */
export function pickSmallTalk(
  npcId: SmallTalkNpcId,
  stage: TalkStage,
  state: TalkState,
  lastLine?: string,
  random: () => number = Math.random,
): string | undefined {
  const all = smallTalkCandidates(npcId, stage, state);
  if (all.length === 0) return undefined;
  const pool = all.length > 1 ? all.filter((t) => t !== lastLine) : all;
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}
