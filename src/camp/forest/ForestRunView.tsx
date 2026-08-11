import { useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import { rgba } from "../../shared/palette";
import { scaleToLevel } from "../../shared/floorTable";
import { monsters } from "../../monster/monsters";
import type { Monster } from "../../shared/game";
import { usePlayerStore } from "../../shared/playerStore";
import type { ForestArea } from "./areas";
import { alertBand, stepAlertDelta } from "./alert";
import {
  STEP_DEFS, hasCatch, scoutStep, rollStepRewards, type ForestStepKind,
} from "./steps";
import {
  makeRng, resolveStep, judgeAlert, bagTotal, runIsOver, chooseFork, advanceStep,
  type ForestRun, type RunBagEntry, type SettleReason, type StepProgress,
} from "./runStore";
import { AlertGauge, AlertBandSummary } from "./AlertGauge";
import { StepEventPanel, NestPanel } from "./StepEventPanel";
import { CatchMiniGame } from "./CatchMiniGame";
import { ForkChoice } from "./ForkChoice";
import { catchChance } from "./catchRules";

/**
 * 탐험 화면.
 *
 * 배경 원화가 무대고, 그 위에 상단 바 · 사건 패널 · 하단 바만 얹힌다. 노드 맵을
 * 걷어낸 이유가 여기 있다 — 지도는 여러 걸음 앞을 계획하게 하려고 그리는 UI 인데
 * 우리는 한 걸음씩만 고른다. 볼 것은 지금 눈앞의 사건 하나뿐이다.
 */

/** 걸음 안에서의 진행 단계. run.step 에서 파생된다 — 따로 들고 있지 않는다 */
type StepPhase = "event" | "nest" | "catch" | "resolved";

/** 이번 걸음의 굴림. 시드에서 다시 나오므로 저장하지 않는다 */
interface StepDraft {
  gained: RunBagEntry[];
  monster: Monster | null;
  /** 둥지에서 고를 수 있는 후보 */
  choices: Monster[];
}

function pickMonsterFor(area: ForestArea, kind: ForestStepKind, rng: () => number): Monster {
  // 강한 사건일수록 풀 후반부에서, 레벨 하한도 위로
  const strong = kind === "champion" || kind === "warden" || kind === "anomaly";
  const pool = strong ? area.monsterPool.slice(-2) : area.monsterPool;
  // id 를 먼저 뽑아 둔다 — find 안에서 rng() 를 부르면 술어가 원소마다 실행되면서
  // 매번 다른 id 와 비교하게 되어 대개 아무것도 못 찾는다
  const id = pool[Math.floor(rng() * pool.length)];
  const base = monsters.find((m) => m.id === id)!;
  const lvMin = strong ? Math.floor((area.levelRange[0] + area.levelRange[1]) / 2) : area.levelRange[0];
  const level = lvMin + Math.floor(rng() * (area.levelRange[1] - lvMin + 1));
  return scaleToLevel(base, level);
}

export function ForestRunView({ area, run, setRun, onSettle }: {
  area: ForestArea;
  run: ForestRun;
  /**
   * 런 갱신. 함수형도 받는다 — 포획 결과는 900ms 뒤에 도착해서, 그때 닫아 둔 런으로
   * 덮어쓰면 그 사이에 태운 시도가 되살아난다(그게 곧 리롤이다).
   */
  setRun: Dispatch<SetStateAction<ForestRun | null>>;
  onSettle: (reason: SettleReason, bag: RunBagEntry[], caught: number, alertPeak: number) => void;
}) {
  const addCapturedMonster = usePlayerStore((s) => s.addCapturedMonster);
  const addToDexSeen = usePlayerStore((s) => s.addToDexSeen);
  const addToDexCaught = usePlayerStore((s) => s.addToDexCaught);

  const kind = run.current;
  const def = STEP_DEFS[kind];
  const band = alertBand(run.alert);
  // 이 걸음의 수확·포획은 소란이 오르기 전 값으로 굴린다 (주인만 깨우는 순간 먼저 오른다)
  const alertForJudge = judgeAlert(run);
  const step = run.step;

  /**
   * 이번 걸음의 굴림.
   *
   * 시드가 (seed, depth) 로 고정돼 있어 몇 번을 다시 계산해도 같은 결과가 나온다.
   * 그래서 수확 목록도 상대 몬스터도 저장하지 않는다 — 새로고침하면 여기서 그대로
   * 다시 나온다. 저장하는 건 "어디까지 했는가"(run.step) 뿐이다.
   */
  const draft = useMemo<StepDraft | null>(() => {
    if (!step.entered) return null;
    const { rng } = makeRng(run.seed ^ (run.depth + 1));
    const gained = rollStepRewards(area, kind, alertForJudge, rng);

    if (kind === "nest") {
      const count = 2 + (rng() < 0.5 ? 1 : 0);
      const choices = Array.from({ length: count }, () => pickMonsterFor(area, kind, rng));
      return { gained, choices, monster: step.pick === null ? null : choices[step.pick] ?? null };
    }
    if (hasCatch(kind)) {
      return { gained, choices: [], monster: pickMonsterFor(area, kind, rng) };
    }
    return { gained, choices: [], monster: null };
  }, [area, kind, alertForJudge, run.seed, run.depth, step.entered, step.pick]);

  // 본 것은 도감에 남는다. 굴림이 순수해야 복원이 성립하므로 기록은 굴림 밖에서 한다
  useEffect(() => {
    if (!draft) return;
    for (const m of draft.choices) addToDexSeen(m.id);
    if (draft.monster) addToDexSeen(draft.monster.id);
  }, [draft, addToDexSeen]);

  /** 걸음 안에서 한 칸 나아간다. 이 갱신 하나하나가 그대로 저장된다 */
  const patchStep = useCallback((patch: Partial<StepProgress>) => {
    setRun((prev) => prev ? advanceStep(prev, patch) : prev);
  }, [setRun]);

  const phase: StepPhase =
    !step.entered ? "event"
    : step.done ? "resolved"
    : kind === "nest" && step.pick === null ? "nest"
    : hasCatch(kind) ? "catch"
    : "resolved";

  /** 판정이 끝난 걸음을 런에 반영하고 다음 걸음으로 */
  const commitStep = useCallback(() => {
    if (!draft) return;
    const next = resolveStep(run, {
      gained: draft.gained,
      caught: step.done?.caught,
      escaped: step.done?.escaped,
    });

    // 주인은 만나면 거기서 끝난다
    if (kind === "warden") { onSettle("warden", next.bag, next.caught, next.alertPeak); return; }
    if (runIsOver(next)) { onSettle("forced", next.bag, next.caught, next.alertPeak); return; }
    setRun(next);
  }, [draft, run, step.done, kind, onSettle, setRun]);

  const onCatchDone = useCallback((result: { caught: boolean }, monster: Monster) => {
    if (result.caught) {
      // 몬스터는 즉시 확정이다. 정산 대상이 아니라서 퇴각해도 잃지 않는다
      addToDexCaught(monster.id);
      addCapturedMonster(monster);
    }
    patchStep({ pending: null, done: { caught: result.caught, escaped: !result.caught } });
  }, [patchStep, addToDexCaught, addCapturedMonster]);

  /** 지금 돌아가면 확정될 것 */
  const banked = useMemo(() => {
    const mats = bagTotal(run.bag);
    const parts: string[] = [];
    if (mats > 0) parts.push(`재료 ${mats}개`);
    if (run.caught > 0) parts.push(`몬스터 ${run.caught}마리`);
    return parts.length > 0 ? parts.join(" · ") : "아직 빈손이다";
  }, [run.bag, run.caught]);

  const goHome = () => onSettle("voluntary", run.bag, run.caught, run.alertPeak);

  // 정찰은 "다음 걸음"이 아니라 지금 눈앞의 사건에 대해 말한다 — 아직 안 들어갔으니 예고다
  const scout = scoutStep(kind, run.depth, band.scout);
  const delta = stepAlertDelta(kind, run.depth);

  return (
    <div className="relative z-10 flex h-full w-full flex-col">
      {/* ── 상단 바 — 판 없이 원화 위에 바로 놓이므로 글자마다 그림자를 깐다 ── */}
      <div className="flex items-start justify-between px-6 pt-4"
        style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
        <div>
          <h1 className="text-title-sm font-black text-cream-100">{area.name}</h1>
          <p className="text-pixel-sm text-sand-300" data-testid="forest-depth" data-depth={run.depth}>
            깊이 {run.depth}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AlertGauge value={run.alert}/>
          {/* 채집망은 STEP 3 에서 상한이 붙는다. 지금은 자리와 개수만 */}
          <div className="rounded-lg px-2.5 py-1 text-center"
            style={{ border: `1px solid ${rgba("stone600", 0.9)}`, background: rgba("shadow900", 0.75) }}>
            <p className="text-pixel-sm text-earth-400">채집망</p>
            <p className="font-mono text-pixel-sm font-bold text-sand-200">{bagTotal(run.bag)}</p>
          </div>
        </div>
      </div>

      {/* ── 중앙 — 갈림길이면 두 갈래, 아니면 사건 하나 ── */}
      <div className="flex flex-1 items-center justify-center px-6">
        {phase === "event" && run.fork && (
          <ForkChoice
            kinds={run.fork.kinds}
            names={run.fork.names}
            depth={run.depth}
            scout={band.scout}
            onChoose={(k) => setRun(chooseFork(run, k))}
          />
        )}

        {phase === "event" && !run.fork && (
          <StepEventPanel
            kind={kind}
            actionLabel={
              kind === "hideout" ? "몸을 숨긴다"
              : hasCatch(kind)   ? "조우한다"
              : "살펴본다"
            }
            onAction={() => patchStep({ entered: true })}
          />
        )}

        {phase === "nest" && draft && (
          <NestPanel monsters={draft.choices} onPick={(i) => patchStep({ pick: i })}/>
        )}

        {phase === "catch" && draft?.monster && (
          <CatchMiniGame
            monster={draft.monster}
            alert={alertForJudge}
            seed={(run.seed ^ (run.depth + 1)) >>> 0}
            attempts={step.attempts}
            pending={step.pending}
            onReveal={() => patchStep({ attempts: step.attempts + 1, pending: null })}
            onResult={(r) => patchStep({ pending: r })}
            onDone={(r) => onCatchDone(r, draft.monster!)}
          />
        )}

        {phase === "resolved" && draft && (
          <StepEventPanel
            kind={kind}
            monster={draft.monster}
            gained={draft.gained}
            alertAfter={kind === "hideout" ? Math.max(0, run.alert + delta) : undefined}
            catchRate={draft.monster && !step.done
              ? catchChance("draw", alertForJudge) : undefined}
            actionLabel="계속 걷는다"
            onAction={commitStep}
          />
        )}
      </div>

      {/* ── 하단 바 ── */}
      <div className="px-6 pb-5 pt-3"
        style={{ background: `linear-gradient(to top, ${rgba("shadow900", 0.92)}, transparent)` }}>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="text-pixel-sm text-sand-300" data-testid="forest-scout">
            <span className="text-earth-400">정찰 · </span>
            {run.fork
              ? "두 갈래가 보인다 — 어느 쪽이든 지나면 되돌아올 수 없다"
              : `${scout.title}${scout.detail !== "???" ? ` — ${scout.detail}` : ""}`}
          </p>
          <AlertBandSummary value={run.alert}/>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={goHome}
            data-testid="forest-go-home"
            className="rounded-xl px-5 py-2.5 text-left text-pixel-sm font-bold transition active:scale-95"
            style={{ background: rgba("shadow900", 0.85), border: `1px solid ${rgba("stone600", 0.9)}`, color: "var(--color-sand-200)" }}>
            돌아간다
            <span className="ml-2 text-pixel-sm text-earth-400">수확 100% 회수</span>
          </button>

          {/* 뱅킹 결정에 정보가 있어야 한다 — 지금 확정될 것을 늘 적어 둔다 */}
          <p className="text-pixel-sm text-sand-300" data-testid="forest-banked">
            지금 돌아가면 <span className="font-bold text-cream-100">{banked}</span> 확정으로 가져간다
          </p>

          <p className="ml-auto text-pixel-sm text-earth-400">
            {run.fork ? "고른 쪽의 소란이 붙는다"
              : def.tier === "warden" ? "여기서 원정이 끝난다"
              : `이번 걸음 ${scout.alertText}`}
          </p>
        </div>
      </div>
    </div>
  );
}
