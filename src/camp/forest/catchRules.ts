import { catchRateWithAlert } from "./alert";
import { handWeights } from "./catchTells";
import { makeRng } from "./runStore";
import type { ElementType } from "../../shared/game";
import type { Rng } from "./steps";
import type { RpsChoice } from "../../workshop/rps";

/**
 * 포획 규칙 한 벌.
 *
 * 가위바위보는 판정이 아니라 **어느 확률로 굴릴지 고르는 보정**이다. 최종 굴림은
 * 한 번뿐이고, 화면에 적히는 숫자가 곧 그 값이다. 시뮬(gameModel)도 이 표를 불러
 * 쓴다 — 예전엔 사본을 들고 있어서 포획률을 고쳐도 측정이 옛 값을 계속 쟀다.
 */

export type RpsResult = "win" | "lose" | "draw";

export const CATCH_RATE: Record<RpsResult, number> = { win: 0.72, draw: 0.42, lose: 0.18 };

/**
 * 한 마리에게 허용하는 시도 횟수.
 * 단판이면 파티를 꾸리는 일이 순전히 운이 된다(첫 조우에서 지면 그냥 사라졌다).
 */
export const CATCH_ATTEMPTS = 3;

/**
 * 이 시도의 굴림.
 *
 * 시도 번호마다 갈래가 다르되 같은 번호는 늘 같은 수를 낸다. 실패하고 새로고침해도
 * 다시 못 굴린다는 뜻이고, 결과 화면을 복원할 때 상대의 수를 여기서 되찾으므로
 * 저장할 것은 내가 낸 수 하나뿐이다.
 *
 * ⚠️ 이 갈래 규칙을 바꾸면 리롤 방지가 통째로 풀린다. 버릇(catchTells)이 붙어도
 *    손은 여전히 이 rng 하나에서 나온다.
 */
export function attemptRng(seed: number, attempt: number): Rng {
  return makeRng((seed ^ (attempt * 0x9E3779B9)) >>> 0).rng;
}

export function getRpsResult(player: RpsChoice, computer: RpsChoice): RpsResult {
  if (player === computer) return "draw";
  const wins =
    (player === "rock" && computer === "scissors") ||
    (player === "scissors" && computer === "paper") ||
    (player === "paper" && computer === "rock");
  return wins ? "win" : "lose";
}

/** 실제로 굴리는 확률. 소란도가 깎은 뒤의 값이다 */
export function catchChance(result: RpsResult, alert: number): number {
  return catchRateWithAlert(CATCH_RATE[result], alert);
}

/**
 * 이 속성 상대로 이 수를 냈을 때의 기대 포획률.
 *
 * 상대 손이 균등하면 세 수의 값이 전부 같다(그게 예전 문제였다). 버릇이 붙으면
 * 여기서 갈린다 — 밸런스 판단도 시뮬 측정도 이 함수 하나만 본다.
 */
export function expectedCatchChance(player: RpsChoice, type: ElementType, alert: number): number {
  const w = handWeights(type);
  return (Object.keys(w) as RpsChoice[])
    .reduce((sum, hand) => sum + w[hand] * catchChance(getRpsResult(player, hand), alert), 0);
}

/**
 * 시도마다 붙는 소란. 첫 시도는 공짜다 — 조우에 들어선 값은 걸음이 이미 치렀다.
 *
 * 예전엔 3번을 다 쓰고 놓친 뒤에야 escapeAlert 가 한 번 붙었다. 그러니 항상 3번을 다
 * 썼다 — 안 쓸 이유가 없으면 그건 선택이 아니라 절차다. 값이 붙어야 "여기서 그만둔다"가
 * 저울에 올라간다. 완전히 놓쳤을 때의 escapeAlert 는 그대로 따로 붙는다.
 */
export const ATTEMPT_ALERT: number[] = [0, 5, 10];

/** attempt 번째(0부터) 시도를 걸 때 붙는 소란 */
export function attemptAlert(attempt: number): number {
  return ATTEMPT_ALERT[Math.min(Math.max(0, attempt), ATTEMPT_ALERT.length - 1)];
}

/** 시도를 n 번 걸었을 때까지 쌓인 소란 */
export function attemptAlertTotal(attempts: number): number {
  let sum = 0;
  for (let i = 0; i < attempts; i++) sum += attemptAlert(i);
  return sum;
}
