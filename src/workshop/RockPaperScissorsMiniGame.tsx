import { useState } from "react";
import { RpsIcon } from "./RpsIcon";
import type { RpsChoice } from "./rps";
import type { RpsResult } from "../shared/craftingUtils";
import { PALETTE } from "../shared/palette";

// ─── 중세 공방 팔레트 (CraftingModal과 통일) ──────────────────────────────────
const C = {
  bg:          PALETTE.shadow900,
  card:        PALETTE.stone600,
  cardHover:   PALETTE.earth500,
  border:      "rgba(132, 75, 63, 1)",
  borderGold:  "rgba(233, 148, 65, .807)",
  textPrimary: PALETTE.cream100,
  textMuted:   PALETTE.sand300,
  textFaint:   PALETTE.earth500,
  gold:        PALETTE.ember500,
  goldDim:     PALETTE.earth500,
};

// ─── RPS 로직 ─────────────────────────────────────────────────────────────────

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

/** 컴퓨터의 수를 뽑는다. 난수는 컴포넌트 밖에 두어 렌더 순수성 검사에 걸리지 않게 한다. */
function pickComputerChoice(): RpsChoice {
  return RPS_CHOICES[Math.floor(Math.random() * RPS_CHOICES.length)];
}

const RPS_LABEL: Record<RpsChoice, string> = {
  rock:     "바위",
  paper:    "보",
  scissors: "가위",
};

function getResult(player: RpsChoice, computer: RpsChoice): RpsResult {
  if (player === computer) return "draw";
  if (
    (player === "rock"     && computer === "scissors") ||
    (player === "paper"    && computer === "rock")     ||
    (player === "scissors" && computer === "paper")
  ) {
    return "win";
  }
  return "lose";
}

const RESULT_LABEL: Record<RpsResult, string> = {
  win:  "승리 ✦",
  draw: "무승부",
  lose: "패배",
};

const RESULT_COLOR: Record<RpsResult, string> = {
  win:  PALETTE.moss500,
  draw: PALETTE.ember500,
  lose: PALETTE.ember500,
};

const RESULT_BG: Record<RpsResult, string> = {
  win:  "rgba(122, 132, 85, .057)",
  draw: "rgba(132, 75, 63, .167)",
  lose: "rgba(168, 61, 31, .087)",
};

const QUALITY_HINT: Record<RpsResult, string> = {
  win:  "Elite 20% · Rare 55% · Normal 25%",
  draw: "Elite 5%  · Rare 35% · Normal 60%",
  lose: "Rare 15%  · Normal 85%",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  craftingItemName: string;
  onFinish: (result: RpsResult) => void;
}

export function RockPaperScissorsMiniGame({ craftingItemName, onFinish }: Props) {
  const [playerChoice,   setPlayerChoice]   = useState<RpsChoice | null>(null);
  const [computerChoice, setComputerChoice] = useState<RpsChoice | null>(null);
  const [result,         setResult]         = useState<RpsResult | null>(null);

  const handleChoose = (choice: RpsChoice) => {
    if (result !== null) return;
    const comp = pickComputerChoice();
    setPlayerChoice(choice);
    setComputerChoice(comp);
    setResult(getResult(choice, comp));
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
      }}
    >
      {/* 헤더 */}
      <div className="mb-4">
        <p
          className="text-pixel-sm font-bold uppercase tracking-widest"
          style={{ color: C.goldDim }}
        >
          ✦ 시험의 시간 ✦
        </p>
        <p className="mt-1 text-pixel-sm font-bold" style={{ color: C.textPrimary }}>
          <span style={{ color: C.gold }}>{craftingItemName}</span> 제작 품질 결정
        </p>
        <p className="mt-1 text-pixel-sm" style={{ color: C.textFaint }}>
          가위바위보 결과에 따라 아이템 품질이 결정됩니다.
        </p>
      </div>

      {/* ── 선택 전 ─────────────────────────────────────────────────────────── */}
      {result === null ? (
        <>
          <p
            className="mb-3 text-center text-pixel-sm font-bold"
            style={{ color: C.textMuted }}
          >
            — 선택하세요 —
          </p>
          <div className="flex justify-center gap-3">
            {RPS_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => handleChoose(choice)}
                className="flex flex-col items-center gap-2 rounded-xl px-3 py-3 transition hover:brightness-125"
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  minWidth: 80,
                }}
              >
                <RpsIcon choice={choice} className="h-14 w-14" />
                <span
                  className="text-pixel-sm font-bold"
                  style={{ color: C.textMuted }}
                >
                  {RPS_LABEL[choice]}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* ── 결과 ───────────────────────────────────────────────────────────── */
        <>
          {/* 선택 비교 */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div
              className="flex flex-col items-center gap-2 rounded-xl p-3"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <p className="text-pixel-sm font-bold" style={{ color: C.textFaint }}>
                내 선택
              </p>
              <RpsIcon choice={playerChoice!} active className="h-16 w-16" />
              <p className="text-pixel-sm font-black" style={{ color: C.textPrimary }}>
                {RPS_LABEL[playerChoice!]}
              </p>
            </div>

            <div
              className="flex flex-col items-center gap-2 rounded-xl p-3"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <p className="text-pixel-sm font-bold" style={{ color: C.textFaint }}>
                상대 선택
              </p>
              <RpsIcon choice={computerChoice!} className="h-16 w-16" />
              <p className="text-pixel-sm font-black" style={{ color: C.textPrimary }}>
                {RPS_LABEL[computerChoice!]}
              </p>
            </div>
          </div>

          {/* 승패 표시 */}
          <div
            className="mb-4 rounded-lg p-3 text-center"
            style={{
              background: RESULT_BG[result],
              border: `1px solid ${RESULT_COLOR[result]}44`,
              boxShadow: `0 0 20px ${RESULT_COLOR[result]}22`,
            }}
          >
            <p
              className="text-pixel-md font-black tracking-wide"
              style={{ color: RESULT_COLOR[result] }}
            >
              {RESULT_LABEL[result]}
            </p>
            <p className="mt-1 text-pixel-sm" style={{ color: C.textFaint }}>
              {QUALITY_HINT[result]}
            </p>
          </div>

          {/* 제작 완료 버튼 */}
          <button
            type="button"
            onClick={() => onFinish(result)}
            className="w-full rounded-lg py-3 text-pixel-sm font-black transition hover:brightness-125"
            style={{
              background: "rgba(132, 75, 63, .515)",
              border: `1px solid rgba(233, 148, 65, .605)`,
              color: C.textPrimary,
              boxShadow: "0 0 16px rgba(132, 75, 63, .421)",
            }}
          >
            ⚒  제작 완료
          </button>
        </>
      )}
    </div>
  );
}
