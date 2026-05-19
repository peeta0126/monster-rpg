export type RpsChoice = "rock" | "paper" | "scissors";

export const RPS_KO: Record<RpsChoice, string> = {
  rock: "바위",
  paper: "보",
  scissors: "가위",
};

// ─── 바위 (Rock) ───────────────────────────────────────────────────────────────
function RockSvg({ active }: { active?: boolean }) {
  const body  = active ? "#8a8a7a" : "#5a5a50";
  const light = active ? "#b8b8a8" : "#7a7a6a";
  const dark  = active ? "#3a3a32" : "#2a2a24";
  const crack = active ? "#2e2e28" : "#1e1e1a";
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" className="w-full h-full">
      {/* 바위 몸통 - 픽셀 덩어리 */}
      <rect x="12" y="20" width="24" height="20" fill={body}/>
      <rect x="8"  y="24" width="32" height="12" fill={body}/>
      <rect x="10" y="18" width="8"  height="4"  fill={body}/>
      <rect x="30" y="18" width="8"  height="4"  fill={body}/>
      <rect x="16" y="14" width="16" height="8"  fill={body}/>
      {/* 상단 하이라이트 */}
      <rect x="16" y="14" width="16" height="4"  fill={light}/>
      <rect x="10" y="18" width="8"  height="2"  fill={light}/>
      <rect x="30" y="18" width="8"  height="2"  fill={light}/>
      {/* 좌측 하이라이트 */}
      <rect x="8"  y="24" width="4"  height="12" fill={light} opacity="0.5"/>
      {/* 우측 그림자 */}
      <rect x="36" y="24" width="4"  height="12" fill={dark}/>
      <rect x="32" y="36" width="4"  height="4"  fill={dark}/>
      {/* 하단 그림자 */}
      <rect x="12" y="36" width="24" height="4"  fill={dark}/>
      {/* 균열 */}
      <rect x="22" y="16" width="2"  height="8"  fill={crack}/>
      <rect x="20" y="22" width="6"  height="2"  fill={crack}/>
      <rect x="30" y="28" width="4"  height="2"  fill={crack}/>
      <rect x="14" y="30" width="6"  height="2"  fill={crack}/>
    </svg>
  );
}

// ─── 보 (Paper) ──────────────────────────────────────────────────────────────
function PaperSvg({ active }: { active?: boolean }) {
  const body  = active ? "#f5e6a8" : "#c8b060";
  const light = active ? "#fff8d0" : "#e8cc80";
  const dark  = active ? "#a88c30" : "#7a6020";
  const line  = active ? "#8a7020" : "#5a4810";
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" className="w-full h-full">
      {/* 손바닥 */}
      <rect x="10" y="28" width="28" height="16" fill={body}/>
      {/* 엄지 */}
      <rect x="6"  y="30" width="8"  height="8"  fill={body}/>
      <rect x="4"  y="32" width="4"  height="6"  fill={body}/>
      {/* 검지 */}
      <rect x="10" y="6"  width="8"  height="26" fill={body}/>
      {/* 중지 */}
      <rect x="20" y="4"  width="8"  height="28" fill={body}/>
      {/* 약지 */}
      <rect x="30" y="8"  width="8"  height="24" fill={body}/>
      {/* 새끼 */}
      <rect x="38" y="14" width="6"  height="18" fill={body}/>
      {/* 손가락 상단 하이라이트 */}
      <rect x="10" y="6"  width="8"  height="4"  fill={light}/>
      <rect x="20" y="4"  width="8"  height="4"  fill={light}/>
      <rect x="30" y="8"  width="8"  height="4"  fill={light}/>
      <rect x="38" y="14" width="6"  height="4"  fill={light}/>
      {/* 손가락 사이 그림자 */}
      <rect x="18" y="28" width="2"  height="4"  fill={dark}/>
      <rect x="28" y="28" width="2"  height="4"  fill={dark}/>
      <rect x="38" y="28" width="2"  height="4"  fill={dark}/>
      {/* 손바닥 주름선 */}
      <rect x="10" y="36" width="28" height="2"  fill={line} opacity="0.4"/>
      <rect x="10" y="40" width="28" height="2"  fill={line} opacity="0.3"/>
      {/* 손가락 마디선 */}
      <rect x="10" y="20" width="8"  height="2"  fill={line} opacity="0.4"/>
      <rect x="20" y="18" width="8"  height="2"  fill={line} opacity="0.4"/>
      <rect x="30" y="22" width="8"  height="2"  fill={line} opacity="0.4"/>
    </svg>
  );
}

// ─── 가위 (Scissors) ─────────────────────────────────────────────────────────
function ScissorsSvg({ active }: { active?: boolean }) {
  const body  = active ? "#f08080" : "#c03040";
  const light = active ? "#ffc0c0" : "#e05060";
  const dark  = active ? "#802020" : "#601020";
  const line  = active ? "#601818" : "#400810";
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" className="w-full h-full">
      {/* 손바닥 */}
      <rect x="10" y="30" width="28" height="14" fill={body}/>
      {/* 엄지 */}
      <rect x="6"  y="32" width="8"  height="8"  fill={body}/>
      <rect x="4"  y="34" width="4"  height="6"  fill={body}/>
      {/* 검지 (올라감) */}
      <rect x="10" y="6"  width="8"  height="28" fill={body}/>
      {/* 중지 (올라감, 벌어짐) */}
      <rect x="22" y="4"  width="8"  height="30" fill={body}/>
      {/* 약지 (접힘) */}
      <rect x="32" y="26" width="8"  height="12" fill={body}/>
      {/* 새끼 (접힘) */}
      <rect x="40" y="30" width="6"  height="10" fill={body}/>
      {/* 손가락 상단 하이라이트 */}
      <rect x="10" y="6"  width="8"  height="4"  fill={light}/>
      <rect x="22" y="4"  width="8"  height="4"  fill={light}/>
      {/* V자 간격 강조 */}
      <rect x="18" y="28" width="4"  height="6"  fill={dark}/>
      {/* 우측 그림자 */}
      <rect x="36" y="30" width="4"  height="10" fill={dark} opacity="0.5"/>
      {/* 손바닥 주름 */}
      <rect x="10" y="38" width="28" height="2"  fill={line} opacity="0.4"/>
      {/* 마디선 */}
      <rect x="10" y="20" width="8"  height="2"  fill={line} opacity="0.4"/>
      <rect x="22" y="18" width="8"  height="2"  fill={line} opacity="0.4"/>
      {/* 손가락 측면 하이라이트 */}
      <rect x="10" y="6"  width="2"  height="24" fill={light} opacity="0.4"/>
      <rect x="22" y="4"  width="2"  height="26" fill={light} opacity="0.4"/>
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
    <div className={className} style={{ imageRendering: "pixelated" }}>
      {choice === "rock"     && <RockSvg     active={active} />}
      {choice === "paper"    && <PaperSvg    active={active} />}
      {choice === "scissors" && <ScissorsSvg active={active} />}
    </div>
  );
}
