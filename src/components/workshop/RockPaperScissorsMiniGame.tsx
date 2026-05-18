import { useState } from "react";
import { RpsIcon } from "../rps/RpsIcon";
import type { RpsChoice } from "../rps/RpsIcon";
import type { RpsResult } from "../../utils/crafting";

// ─── 중세 공방 팔레트 (CraftingModal과 통일) ──────────────────────────────────
const C = {
  bg:          "#160c04",
  card:        "#2a1508",
  cardHover:   "#3d2208",
  border:      "rgba(180,120,30,0.45)",
  borderGold:  "rgba(212,160,23,0.8)",
  textPrimary: "#f5e6c8",
  textMuted:   "#c4a46b",
  textFaint:   "#8b6014",
  gold:        "#d4a017",
  goldDim:     "#b47828",
};

// ─── RPS 로직 ─────────────────────────────────────────────────────────────────

const RPS_CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

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
  win:  "#4ade80",
  draw: "#facc15",
  lose: "#f87171",
};

const RESULT_BG: Record<RpsResult, string> = {
  win:  "rgba(20,83,45,0.2)",
  draw: "rgba(113,63,18,0.25)",
  lose: "rgba(127,29,29,0.2)",
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
    const comp = RPS_CHOICES[Math.floor(Math.random() * 3)];
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
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: C.goldDim }}
        >
          ✦ 시험의 시간 ✦
        </p>
        <p className="mt-1 text-sm font-bold" style={{ color: C.textPrimary }}>
          <span style={{ color: C.gold }}>{craftingItemName}</span> 제작 품질 결정
        </p>
        <p className="mt-1 text-xs" style={{ color: C.textFaint }}>
          가위바위보 결과에 따라 아이템 품질이 결정됩니다.
        </p>
      </div>

      {/* ── 선택 전 ─────────────────────────────────────────────────────────── */}
      {result === null ? (
        <>
          <p
            className="mb-3 text-center text-sm font-bold"
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
                  className="text-xs font-bold"
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
              <p className="text-xs font-bold" style={{ color: C.textFaint }}>
                내 선택
              </p>
              <RpsIcon choice={playerChoice!} active className="h-16 w-16" />
              <p className="text-sm font-black" style={{ color: C.textPrimary }}>
                {RPS_LABEL[playerChoice!]}
              </p>
            </div>

            <div
              className="flex flex-col items-center gap-2 rounded-xl p-3"
              style={{ background: C.card, border: `1px solid ${C.border}` }}
            >
              <p className="text-xs font-bold" style={{ color: C.textFaint }}>
                상대 선택
              </p>
              <RpsIcon choice={computerChoice!} className="h-16 w-16" />
              <p className="text-sm font-black" style={{ color: C.textPrimary }}>
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
              className="text-xl font-black tracking-wide"
              style={{ color: RESULT_COLOR[result] }}
            >
              {RESULT_LABEL[result]}
            </p>
            <p className="mt-1 text-xs" style={{ color: C.textFaint }}>
              {QUALITY_HINT[result]}
            </p>
          </div>

          {/* 제작 완료 버튼 */}
          <button
            type="button"
            onClick={() => onFinish(result)}
            className="w-full rounded-lg py-3 text-sm font-black transition hover:brightness-125"
            style={{
              background: "rgba(180,120,30,0.22)",
              border: `1px solid rgba(212,160,23,0.6)`,
              color: C.textPrimary,
              boxShadow: "0 0 16px rgba(180,120,30,0.18)",
            }}
          >
            ⚒  제작 완료
          </button>
        </>
      )}
    </div>
  );
}
