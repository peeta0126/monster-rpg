import { ELEMENT_KO, type ElementType, type Monster } from "../../shared/game";
import { chainKeyOf, chainMembers } from "../../monster/imprint";
import { RPS_KO, type RpsChoice } from "../../workshop/rps";
import type { Rng } from "./steps";
import type { ScoutLevel } from "./alert";
import { withJosa } from "../../shared/josa";

/**
 * 상대의 버릇 — 야생 몬스터가 어느 수를 즐겨 내는가.
 *
 * 예전엔 상대 손이 완전 균등이라 세 버튼의 기대값이 전부 0.44 로 **수학적으로 같았다.**
 * 헷갈리는 버튼이 아니라 진짜로 똑같은 버튼 세 개였고, 그게 숲에서 제일 자주 누르는
 * 버튼이었다.
 *
 * 단위가 **종이 아니라 속성**인 이유: 종은 15개라 못 외우고 속성은 7개라 외워진다.
 * 그리고 속성 칩은 이미 카드에 붙어 있어서 표를 새로 보여 줄 자리를 만들 필요가 없다.
 *
 * ⚠️ 이 표는 여기 한 벌뿐이다. 시뮬(gameModel)도 이걸 불러 쓴다 — 사본을 만들면
 *    측정이 게임이 아니라 사본을 잰다.
 */

export const TELL_HAND: Record<ElementType, RpsChoice | null> = {
  fire:     "rock",      // 힘으로 밀어붙인다
  electric: "rock",
  water:    "paper",     // 감싸고 흘린다
  ice:      "paper",
  grass:    "scissors",  // 베고 좀먹는다
  poison:   "scissors",
  normal:   null,        // 읽히지 않는다
};

/**
 * 선호하는 수가 나올 확률. 나머지 둘이 남은 45%를 반씩(각 22.5%) 갖는다.
 *
 * 이 값이 곧 "버릇을 아는 것의 값"이다. 포획률(win .72 / draw .42 / lose .18)에
 * 얹으면 한 시도의 기대 포획률이 이렇게 갈린다.
 *
 *   모르고 아무거나        0.440   (어떤 편향에서도 불변이다 — 세 손의 평균)
 *   버릇을 알고 카운터      0.531   (+20.7%)
 *   버릇대로 맞받아 무승부   0.434
 *   버릇에 지는 수 (최악)    0.356   (-19.2%)
 *
 * 55% 인 이유. 45% 로 낮추면 카운터가 0.489 라 아는 값이 +11% 뿐인데, 시도가 3번밖에
 * 없어서 플레이어가 그 차이를 체감할 표본이 안 나온다. 70% 로 올리면 카운터가 0.594 ·
 * 최악이 0.297 로 벌어져 "버릇을 아느냐"가 사실상 필수 조건이 되고, 정보를 통째로
 * 막는 고대 숲이 의도보다 훨씬 가혹해진다. 55% 는 카운터를 내고도 절반 가까이 놓치는
 * 자리라 정답 맞히기가 되지 않으면서, 시도당 소란 비용(catchRules.ATTEMPT_ALERT)에
 * 걸리는 평균 시도 수를 눈에 띄게 줄인다.
 */
export const TELL_WEIGHT = 0.55;

/** 손 순서. rollHand 의 누적 비교가 이 순서를 믿는다 */
const HANDS: RpsChoice[] = ["rock", "paper", "scissors"];

/** 몬스터의 속성. 무속성(null)은 노말과 같이 버릇이 없다 */
export function tellTypeOf(m: Pick<Monster, "type">): ElementType {
  return m.type ?? "normal";
}

/** 이 속성이 즐겨 내는 수. 없으면 null */
export function tellOf(type: ElementType): RpsChoice | null {
  return TELL_HAND[type];
}

/** 이 속성의 손 분포. normal 은 균등이다 */
export function handWeights(type: ElementType): Record<RpsChoice, number> {
  const tell = TELL_HAND[type];
  if (!tell) return { rock: 1 / 3, paper: 1 / 3, scissors: 1 / 3 };
  const rest = (1 - TELL_WEIGHT) / 2;
  return {
    rock:     tell === "rock"     ? TELL_WEIGHT : rest,
    paper:    tell === "paper"    ? TELL_WEIGHT : rest,
    scissors: tell === "scissors" ? TELL_WEIGHT : rest,
  };
}

/**
 * 이 몬스터가 이번에 내는 수.
 *
 * ⚠️ rng() 를 **정확히 한 번**만 쓴다. 시도 시드(attemptRng)는 손 다음에 최종 포획
 * 굴림을 이어서 뽑으므로, 여기서 굴림 횟수가 바뀌면 그 뒤가 전부 밀린다.
 */
export function rollHand(type: ElementType, rng: Rng): RpsChoice {
  const w = handWeights(type);
  let r = rng();
  for (const hand of HANDS) {
    r -= w[hand];
    if (r < 0) return hand;
  }
  return HANDS[HANDS.length - 1];
}

/** 이 수를 이기는 수 */
export function counterTo(hand: RpsChoice): RpsChoice {
  return hand === "rock" ? "paper" : hand === "paper" ? "scissors" : "rock";
}

/** 화면에 적는 버릇 한 줄 */
export function tellText(type: ElementType): string {
  const tell = TELL_HAND[type];
  return tell ? `주로 ${withJosa(RPS_KO[tell], "을를")} 낸다` : "버릇이 없다 — 아무거나 낸다";
}

/** 속성 칩에 적는 글자 */
export function typeText(type: ElementType): string {
  return ELEMENT_KO[type];
}

// ── 무엇까지 보여 줄 것인가 ──────────────────────────────────────────────────

/**
 * 버릇을 얼마나 열어 줄지.
 *
 * 항상 보여 주면 가위바위보가 정답 맞히기가 된다. 그래서 이 정보는 **사는 것**이다 —
 * 낮은 소란도(정찰)와 도감이 그 값을 치른다. 처음 보는 몬스터의 버릇을 못 읽는 건
 * 불친절이 아니라 규칙이다. 친절해 보이려고 임의로 열지 말 것.
 */
export type TellReveal =
  /** 버릇을 글자로 명시한다 */
  | "hand"
  /** 속성만 보여 준다 — 표는 플레이어가 외워야 한다 */
  | "type"
  /** 아무것도 */
  | "none";

export function tellReveal({ dexCaught, revealTypes, scout }: {
  /** 이 **계열**을 잡아 본 적이 있는가 */
  dexCaught: boolean;
  /** 구역이 속성을 드러내는가 (고대 숲만 false) */
  revealTypes: boolean;
  scout: ScoutLevel;
}): TellReveal {
  // 도감이 먼저다. 잡아 본 계열이면 고대 숲에서도, 소란이 아무리 높아도 보인다 —
  // 도감을 목록에서 기능으로 바꾸는 자리이자 "고대 숲은 아는 놈만 상대한다"는 규칙이다
  if (dexCaught) return "hand";
  // 고대 숲은 속성을 가린다. 속성이 안 보이면 버릇도 못 읽는 게 맞다
  if (!revealTypes) return "none";
  if (scout === "detail") return "hand";
  if (scout === "type") return "type";
  return "none";
}

/**
 * 도감에 이 **계열**을 잡은 기록이 있는가.
 *
 * 종이 아니라 계열로 세는 건 각인과 같은 이유다 — 진화시키는 순간 알던 버릇을
 * 다시 모르게 되면 진화가 손해가 된다.
 */
export function chainInDex(
  m: Pick<Monster, "id" | "evolutionChainId">,
  dexCaught: readonly string[],
): boolean {
  const key = chainKeyOf(m);
  const members = chainMembers(key);
  if (members.length === 0) return dexCaught.includes(m.id);
  return members.some((x) => dexCaught.includes(x.id));
}
