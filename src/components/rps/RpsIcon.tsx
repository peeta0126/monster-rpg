export type RpsChoice = "rock" | "paper" | "scissors";

export const RPS_KO: Record<RpsChoice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

// ─── 바위 (Rock) ───────────────────────────────────────────────────────────────
function RockSvg({ active }: { active?: boolean }) {
  const base = active ? "#6B7280" : "#4B5563";
  const light = active ? "#9CA3AF" : "#6B7280";
  const dark = active ? "#374151" : "#1F2937";
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Wrist / palm base */}
      <rect x="22" y="55" width="54" height="34" rx="10" fill={base} />
      {/* Thumb (side) */}
      <rect x="11" y="56" width="16" height="14" rx="7" fill={base} />
      {/* Knuckle row — 3 fingers curled */}
      <rect x="23" y="36" width="14" height="25" rx="7" fill={base} />
      <rect x="40" y="32" width="14" height="28" rx="7" fill={base} />
      <rect x="57" y="35" width="14" height="26" rx="7" fill={base} />
      {/* Highlight on top of fist */}
      <ellipse cx="50" cy="36" rx="24" ry="8" fill={light} opacity="0.35" />
      {/* Crease lines */}
      <line x1="37" y1="55" x2="37" y2="72" stroke={dark} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="55" x2="54" y2="72" stroke={dark} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── 보 (Paper / Open hand) ───────────────────────────────────────────────────
function PaperSvg({ active }: { active?: boolean }) {
  const base = active ? "#FCD34D" : "#D97706";
  const light = active ? "#FDE68A" : "#F59E0B";
  const dark = active ? "#92400E" : "#78350F";
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Palm base */}
      <rect x="22" y="50" width="56" height="38" rx="10" fill={base} />
      {/* Thumb */}
      <rect x="9" y="52" width="18" height="13" rx="7" fill={base} />
      {/* 4 fingers extended */}
      <rect x="24" y="12" width="12" height="42" rx="6" fill={base} />
      <rect x="38" y="8" width="12" height="46" rx="6" fill={base} />
      <rect x="52" y="10" width="12" height="44" rx="6" fill={base} />
      <rect x="65" y="16" width="11" height="38" rx="5" fill={base} />
      {/* Finger crease highlights */}
      <ellipse cx="30" cy="48" rx="5" ry="2" fill={light} opacity="0.5" />
      <ellipse cx="44" cy="48" rx="5" ry="2" fill={light} opacity="0.5" />
      <ellipse cx="58" cy="48" rx="5" ry="2" fill={light} opacity="0.5" />
      <ellipse cx="70" cy="48" rx="4" ry="2" fill={light} opacity="0.5" />
      {/* Palm highlight */}
      <ellipse cx="48" cy="62" rx="20" ry="10" fill={light} opacity="0.25" />
      {/* Palm crease */}
      <path d="M28 70 Q50 78 72 70" stroke={dark} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4" />
    </svg>
  );
}

// ─── 가위 (Scissors / Victory sign) ──────────────────────────────────────────
function ScissorsSvg({ active }: { active?: boolean }) {
  const base = active ? "#F87171" : "#B91C1C";
  const light = active ? "#FECACA" : "#EF4444";
  const dark = active ? "#7F1D1D" : "#450A0A";
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Palm base */}
      <rect x="18" y="54" width="60" height="34" rx="10" fill={base} />
      {/* Thumb */}
      <rect x="8" y="56" width="16" height="13" rx="7" fill={base} />
      {/* Index finger (up) */}
      <rect x="22" y="10" width="13" height="48" rx="6" fill={base} />
      {/* Middle finger (up, slightly taller) */}
      <rect x="38" y="8" width="13" height="50" rx="6" fill={base} />
      {/* Ring finger (folded) */}
      <rect x="54" y="38" width="12" height="24" rx="6" fill={base} />
      {/* Pinky (folded) */}
      <rect x="67" y="42" width="10" height="20" rx="5" fill={base} />
      {/* Gap / crease between two raised fingers */}
      <path d="M35 14 Q35.5 38 35.5 54" stroke={dark} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.35" />
      {/* Highlights on raised fingers */}
      <ellipse cx="28" cy="18" rx="4" ry="6" fill={light} opacity="0.3" />
      <ellipse cx="44" cy="16" rx="4" ry="6" fill={light} opacity="0.3" />
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

interface RpsIconProps {
  choice: RpsChoice;
  active?: boolean;
  className?: string;
}

export function RpsIcon({ choice, active, className = "w-16 h-16" }: RpsIconProps) {
  return (
    <div className={className}>
      {choice === "rock"     && <RockSvg     active={active} />}
      {choice === "paper"    && <PaperSvg    active={active} />}
      {choice === "scissors" && <ScissorsSvg active={active} />}
    </div>
  );
}
