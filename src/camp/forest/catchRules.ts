import { catchRateWithAlert } from "./alert";
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
