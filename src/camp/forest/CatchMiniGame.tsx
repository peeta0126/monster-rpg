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

/**
 * 세 버튼은 같은 판이다.
 *
 * 예전엔 가위 빨강 · 바위 회색 · 보 주황으로 갈라 뒀는데, 아이콘 셋이 같은 살색으로
 * 통일되면서 그 색이 아무것도 가리키지 않게 됐다. 무엇을 고르든 위험은 같으니
 * 색으로 구분할 것이 애초에 없다 — 구분은 호버와 결과 화면의 강조가 한다.
 */
const CARD_BORDER = rgba("shadow700", 1);

const REVEAL_MS = 900;

type Stage = "select" | "reveal" | "result";

/**
 * 이 시도의 굴림.
 *
 * 시도 번호마다 갈래가 다르되 같은 번호는 늘 같은 수를 낸다. 새로고침 뒤에 결과
 * 화면을 다시 그릴 때도 여기서 상대의 수를 되찾는다 — 그래서 저장할 것은 내가 낸
 * 수 하나뿐이다.
 */
function attemptRng(seed: number, attempt: number) {
  return makeRng((seed ^ (attempt * 0x9E3779B9)) >>> 0).rng;
}

function compHand(rng: () => number): RpsChoice {
  return (["rock", "paper", "scissors"] as RpsChoice[])[Math.floor(rng() * 3)];
}

export function CatchMiniGame({
  monster, alert, seed, attempts, pending, onReveal, onResult, onDone,
}: {
  monster: Monster;
  alert: number;
  /**
   * 이 조우의 시드. 상대의 수와 최종 굴림이 여기서 나온다.
   *
   * Math.random 을 쓰면 실패한 뒤 새로고침해서 다시 굴릴 수 있다 — 같은 시도 번호는
   * 언제나 같은 결과가 나와야 리롤이 막힌다.
   */
  seed: number;
  /**
   * 지금까지 건 시도 횟수. 런이 들고 있고 저장된다.
   *
   * 여기 안에 두면 새로고침이 시도를 되살린다 — 같은 시도 번호는 같은 수를 내므로,
   * 방금 본 상대의 수를 알고 다시 낼 수 있게 된다. 시드로 리롤을 막아 놓고 횟수를
   * 화면에 두면 그 자물쇠가 열린다.
   */
  attempts: number;
  /** 아직 안 넘긴 시도의 결과. 새로고침으로 돌아왔으면 이 화면부터 다시 그린다 */
  pending: { hand: RpsChoice; caught: boolean } | null;
  /** 상대의 수가 공개되는 순간 부른다. 결과를 보기 전에 시도를 먼저 태운다 */
  onReveal: () => void;
  /** 굴림이 끝난 순간 부른다. 플레이어가 화면을 넘기기 전에 결과를 런에 적어 둔다 */
  onResult: (r: { hand: RpsChoice; caught: boolean }) => void;
  /** caught=false 이고 시도가 남지 않았으면 놓친 것이다 */
  onDone: (result: { caught: boolean }) => void;
}) {
  // 마운트 시점의 pending 으로 결과 화면을 복원한다. 상대의 수는 시드에서 다시 나온다
  const [stage, setStage] = useState<Stage>(() => pending ? "result" : "select");
  const triesLeft = Math.max(0, CATCH_ATTEMPTS - attempts);
  const [picked, setPicked] = useState<RpsChoice | null>(() => pending?.hand ?? null);
  const [computer, setComputer] = useState<RpsChoice | null>(
    () => pending ? compHand(attemptRng(seed, Math.max(0, attempts - 1))) : null);
  const [result, setResult] = useState<RpsResult | null>(
    () => pending ? getRpsResult(pending.hand, compHand(attemptRng(seed, Math.max(0, attempts - 1)))) : null);
  const [caught, setCaught] = useState(() => pending?.caught ?? false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const penalty = alertBand(alert).catchPenalty;
  const pct = (r: RpsResult) => Math.round(catchChance(r, alert) * 100);

  const choose = (choice: RpsChoice) => {
    const rng = attemptRng(seed, attempts);
    const comp = compHand(rng);
    const res = getRpsResult(choice, comp);
    setPicked(choice); setComputer(comp); setResult(res); setStage("reveal");
    // 시도는 결과가 아니라 **공개**에 태운다. 상대의 수를 본 뒤 새로고침해도 그 수는
    // 이미 쓴 번호에 묶여 있어야 한다
    onReveal();

    timer.current = setTimeout(() => {
      timer.current = null;
      const ok = rng() < catchChance(res, alert);
      setCaught(ok);
      setStage("result");
      onResult({ hand: choice, caught: ok });
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
              style={{ background: rgba("shadow900", 0.6), border: `1.5px solid ${CARD_BORDER}` }}>
              <RpsIcon choice={c} className="h-[57px] w-[57px]"/>
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
          ? <p className="w-28 text-center text-pixel-sm text-earth-400">공개 중...</p>
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
    <div className="flex w-28 flex-col items-center gap-2">
      <p className="truncate text-pixel-sm text-sand-300">{label}</p>
      <div className="rounded-2xl p-3"
        style={{
          background: highlight ? rgba("moss500", 0.12) : rgba("cream100", 0.04),
          border: `1px solid ${highlight ? rgba("moss500", 0.4) : rgba("cream100", 0.06)}`,
        }}>
        <RpsIcon choice={choice} className="h-[76px] w-[76px]" active={highlight}/>
      </div>
      <p className="text-pixel-sm font-bold text-sand-200">{RPS_KO[choice]}</p>
    </div>
  );
}

export { CATCH_RATE };
