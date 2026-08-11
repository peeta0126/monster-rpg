import { useEffect, useRef, useState } from "react";
import { PALETTE, rgba } from "../../shared/palette";
import { MONSTER_IMAGE_MAP } from "../../monster/monsterImages";
import { RpsIcon } from "../../workshop/RpsIcon";
import { RPS_KO, type RpsChoice } from "../../workshop/rps";
import type { Monster } from "../../shared/game";
import { alertBand } from "./alert";
import { CATCH_ATTEMPTS, CATCH_RATE, catchChance, getRpsResult, type RpsResult } from "./catchRules";
import { makeRng } from "./runStore";

/**
 * 포획 미니게임.
 *
 * 숲에는 턴제 전투가 없다 — 붙이는 순간 파티 HP 를 전투 사이로 이월해야 하고,
 * 그러면 소모전이 되어 무한의 탑과 똑같아진다. 그래서 포획 수단은 가위바위보다.
 *
 * 실패의 이름은 "패배"가 아니라 **"놓쳤다"** 다. 숲에서 지는 건 못 이긴 게 아니라
 * 못 가져온 것이다. 시도를 다 쓰면 몬스터가 달아나고 런은 계속된다.
 */

const RESULT_TEXT: Record<RpsResult, { text: string; color: string }> = {
  win:  { text: "승리!",  color: PALETTE.moss500 },
  draw: { text: "무승부", color: PALETTE.ember500 },
  lose: { text: "패배...", color: PALETTE.ember500 },
};

const CARD: Record<RpsChoice, string> = {
  scissors: PALETTE.ember700,
  rock:     PALETTE.stone600,
  paper:    PALETTE.ember500,
};

const REVEAL_MS = 900;

type Stage = "select" | "reveal" | "result";

export function CatchMiniGame({ monster, alert, seed, onDone }: {
  monster: Monster;
  alert: number;
  /**
   * 이 조우의 시드. 상대의 수와 최종 굴림이 여기서 나온다.
   *
   * Math.random 을 쓰면 실패한 뒤 새로고침해서 다시 굴릴 수 있다 — 같은 시도 번호는
   * 언제나 같은 결과가 나와야 리롤이 막힌다.
   */
  seed: number;
  /** caught=false 이고 시도가 남지 않았으면 놓친 것이다 */
  onDone: (result: { caught: boolean }) => void;
}) {
  const [stage, setStage] = useState<Stage>("select");
  const [triesLeft, setTriesLeft] = useState(CATCH_ATTEMPTS);
  const [picked, setPicked] = useState<RpsChoice | null>(null);
  const [computer, setComputer] = useState<RpsChoice | null>(null);
  const [result, setResult] = useState<RpsResult | null>(null);
  const [caught, setCaught] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const penalty = alertBand(alert).catchPenalty;
  const pct = (r: RpsResult) => Math.round(catchChance(r, alert) * 100);

  const choose = (choice: RpsChoice) => {
    // 시도 번호마다 다른 갈래를 쓰되, 같은 번호는 늘 같은 결과가 나온다
    const attempt = CATCH_ATTEMPTS - triesLeft;
    const { rng } = makeRng((seed ^ (attempt * 0x9E3779B9)) >>> 0);
    const comp: RpsChoice = (["rock", "paper", "scissors"] as RpsChoice[])[Math.floor(rng() * 3)];
    const res = getRpsResult(choice, comp);
    setPicked(choice); setComputer(comp); setResult(res); setStage("reveal");

    timer.current = setTimeout(() => {
      timer.current = null;
      const ok = rng() < catchChance(res, alert);
      setCaught(ok);
      if (!ok) setTriesLeft((n) => Math.max(0, n - 1));
      setStage("result");
    }, REVEAL_MS);
  };

  const retry = () => { setPicked(null); setComputer(null); setResult(null); setStage("select"); };

  // ── 선택 ──
  if (stage === "select") {
    return (
      <Shell>
        <div className="flex items-center gap-3">
          <img src={MONSTER_IMAGE_MAP[monster.id]} alt={monster.name} className="h-12 w-12 object-contain"/>
          <div className="min-w-0">
            <p className="text-pixel-sm font-bold text-cream-100">{monster.name}</p>
            <p className="text-pixel-sm text-sand-300">남은 시도 {triesLeft}회</p>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5 text-pixel-sm text-earth-400">
            <span>이기면 <span className="font-bold text-moss-500">{pct("win")}%</span></span>
            <span>비기면 <span className="font-bold text-ember-500">{pct("draw")}%</span></span>
            <span>지면 <span className="font-bold text-ember-500">{pct("lose")}%</span></span>
            {penalty > 0 && <span className="text-ember-500">소란 때문에 -{Math.round(penalty * 100)}%p</span>}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {(["scissors", "rock", "paper"] as RpsChoice[]).map((c) => (
            <button key={c} type="button" onClick={() => choose(c)}
              data-testid={`forest-rps-${c}`}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl py-4 transition active:scale-95 hover:brightness-125"
              style={{ background: rgba("shadow900", 0.6), border: `1.5px solid ${CARD[c]}` }}>
              <RpsIcon choice={c} className="h-12 w-12"/>
              <span className="text-pixel-sm font-black text-sand-200">{RPS_KO[c]}</span>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // ── 공개 / 결과 ──
  const res = result ? RESULT_TEXT[result] : null;
  const outOfTries = triesLeft <= 0;

  return (
    <Shell>
      <div className="flex items-center justify-center gap-4">
        <Hand choice={picked!} label="나" highlight={result === "win"}/>
        <p className="text-pixel-md font-black text-earth-400">VS</p>
        {stage === "reveal"
          ? <p className="w-24 text-center text-pixel-sm text-earth-400">공개 중...</p>
          : <Hand choice={computer!} label={monster.name} highlight={result === "lose"}/>}
      </div>

      {stage === "result" && res && (
        <div className="mt-4 text-center">
          <p className="text-title-sm font-black" style={{ color: res.color }}>{res.text}</p>
          <p className="mt-1 text-pixel-sm text-sand-300">
            포획 확률 {Math.round(catchChance(result!, alert) * 100)}%
          </p>

          {caught ? (
            <p className="mt-3 text-pixel-md font-black text-moss-500">포획 성공!</p>
          ) : outOfTries ? (
            <p className="mt-3 text-pixel-md font-black text-ember-500">{monster.name}이(가) 달아났다</p>
          ) : (
            <p className="mt-3 text-pixel-sm text-sand-200">놓쳤다 — 아직 근처에 있다</p>
          )}

          <div className="mt-4 flex gap-3">
            {!caught && !outOfTries && (
              <button type="button" onClick={retry}
                data-testid="forest-rps-retry"
                className="flex-1 rounded-xl py-2.5 text-pixel-sm font-bold transition active:scale-95"
                style={{ background: rgba("moss500", 0.18), border: `1px solid ${rgba("moss500", 0.5)}`, color: PALETTE.moss500 }}>
                다시 시도 ({triesLeft})
              </button>
            )}
            <button type="button" onClick={() => onDone({ caught })}
              data-testid="forest-rps-done"
              className="flex-1 rounded-xl py-2.5 text-pixel-sm font-black transition active:scale-95"
              style={{ background: caught ? PALETTE.moss500 : rgba("shadow900", 0.6),
                       border: `1px solid ${caught ? PALETTE.moss500 : rgba("stone600", 0.9)}`,
                       color: caught ? rgba("shadow900", 1) : PALETTE.sand200 }}>
              {caught || outOfTries ? "계속 걷는다" : "포기하고 걷는다"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-xl rounded-2xl px-6 py-5 backdrop-blur"
      style={{
        background: rgba("shadow900", 0.86),
        border: `1px solid ${rgba("stone600", 0.9)}`,
        boxShadow: `0 8px 32px ${rgba("shadow900", 0.6)}`,
        animation: "slideInUp .3s ease both",
      }}>
      {children}
    </div>
  );
}

function Hand({ choice, label, highlight }: { choice: RpsChoice; label: string; highlight: boolean }) {
  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <p className="truncate text-pixel-sm text-sand-300">{label}</p>
      <div className="rounded-2xl p-3"
        style={{
          background: highlight ? rgba("moss500", 0.12) : rgba("cream100", 0.04),
          border: `1px solid ${highlight ? rgba("moss500", 0.4) : rgba("cream100", 0.06)}`,
        }}>
        <RpsIcon choice={choice} className="h-12 w-12" active={highlight}/>
      </div>
      <p className="text-pixel-sm font-bold text-sand-200">{RPS_KO[choice]}</p>
    </div>
  );
}

export { CATCH_RATE };
