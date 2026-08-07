/**
 * 가위바위보 공용 타입/상수.
 *
 * RpsIcon.tsx에 함께 두면 "컴포넌트 파일이 컴포넌트 외의 것도 export"하게 되어
 * Vite Fast Refresh가 해당 파일 전체를 갱신 대상에서 제외한다(react-refresh 규칙).
 */
export type RpsChoice = "rock" | "paper" | "scissors";

export const RPS_KO: Record<RpsChoice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};
