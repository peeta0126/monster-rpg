import { useCallback, useMemo, useState } from "react";
import { rgba } from "../../shared/palette";
import { AREA_MATERIAL_POOL } from "../../shared/dropTables";
import { scaleToLevel } from "../../shared/floorTable";
import { monsters } from "../../monster/monsters";
import type { Monster } from "../../shared/game";
import { usePlayerStore } from "../../shared/playerStore";
import type { ForestArea } from "./areas";
import { alertBand, applyMaterialMultiplier, stepAlertDelta } from "./alert";
import {
  STEP_DEFS, STEP_ROLLS, RARE_MATERIALS, hasCatch, isGuaranteed, scoutStep,
  type ForestStepKind,
} from "./steps";
import {
  makeRng, resolveStep, judgeAlert, bagTotal, runIsOver, chooseFork,
  type ForestRun, type RunBagEntry, type SettleReason,
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

/** 걸음 안에서의 진행 단계 */
type StepPhase = "event" | "nest" | "catch" | "resolved";

/** 한 걸음의 판정 결과를 모아 두는 자리 */
interface StepDraft {
  gained: RunBagEntry[];
  monster: Monster | null;
  /** 둥지에서 고를 수 있는 후보 */
  choices: Monster[];
  caught: boolean;
  escaped: boolean;
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

/** 이 사건이 내놓는 재료. 배수는 소란이 오르기 전 값으로 계산한다 */
function rollRewards(area: ForestArea, kind: ForestStepKind, alert: number, rng: () => number): RunBagEntry[] {
  const rolls = STEP_ROLLS[kind];
  if (rolls === 0) return [];

  const areaPool = AREA_MATERIAL_POOL[area.id] ?? AREA_MATERIAL_POOL.shallow;
  // 이변은 희귀 표에서만 뽑는다 — 구역 풀 그대로면 흔적과 다를 게 없다
  const rarePool = areaPool.filter((id) => RARE_MATERIALS.includes(id));
  const pool = kind === "anomaly" && rarePool.length > 0 ? rarePool : areaPool;

  const out: RunBagEntry[] = [];
  for (let i = 0; i < rolls; i++) {
    const hit = rng() <= area.materialRate || (isGuaranteed(kind) && out.length === 0 && i === rolls - 1);
    if (!hit) continue;
    const id = pool[Math.floor(rng() * pool.length)];
    const base = 1 + area.materialBonus + (rng() < 0.3 ? 1 : 0);
    const count = applyMaterialMultiplier(base, alert);
    const at = out.findIndex((o) => o.id === id);
    if (at === -1) out.push({ id, count });
    else out[at] = { ...out[at], count: out[at].count + count };
  }
  return out;
}

export function ForestRunView({ area, run, setRun, onSettle }: {
  area: ForestArea;
  run: ForestRun;
  setRun: (run: ForestRun) => void;
  onSettle: (reason: SettleReason, bag: RunBagEntry[], caught: number, alertPeak: number) => void;
}) {
  const addCapturedMonster = usePlayerStore((s) => s.addCapturedMonster);
  const addToDexSeen = usePlayerStore((s) => s.addToDexSeen);
  const addToDexCaught = usePlayerStore((s) => s.addToDexCaught);

  const [phase, setPhase] = useState<StepPhase>("event");
  const [draft, setDraft] = useState<StepDraft | null>(null);

  const kind = run.current;
  const def = STEP_DEFS[kind];
  const band = alertBand(run.alert);
  // 이 걸음의 수확·포획은 소란이 오르기 전 값으로 굴린다 (주인만 깨우는 순간 먼저 오른다)
  const alertForJudge = judgeAlert(run);

  /**
   * 사건을 실제로 굴린다.
   *
   * 시드 RNG 라 같은 런 상태에서는 언제나 같은 결과가 나온다 — 새로고침으로 다시
   * 굴리는 리롤이 불가능하다.
   */
  const enterStep = useCallback(() => {
    const { rng } = makeRng(run.seed ^ (run.depth + 1));
    const gained = rollRewards(area, kind, alertForJudge, rng);

    if (kind === "nest") {
      const count = 2 + (rng() < 0.5 ? 1 : 0);
      const choices = Array.from({ length: count }, () => pickMonsterFor(area, kind, rng));
      choices.forEach((m) => addToDexSeen(m.id));
      setDraft({ gained, monster: null, choices, caught: false, escaped: false });
      setPhase("nest");
      return;
    }

    if (hasCatch(kind)) {
      const monster = pickMonsterFor(area, kind, rng);
      addToDexSeen(monster.id);
      setDraft({ gained, monster, choices: [], caught: false, escaped: false });
      setPhase("catch");
      return;
    }

    setDraft({ gained, monster: null, choices: [], caught: false, escaped: false });
    setPhase("resolved");
  }, [area, kind, alertForJudge, run.seed, run.depth, addToDexSeen]);

  /** 판정이 끝난 걸음을 런에 반영하고 다음 걸음으로 */
  const commitStep = useCallback((d: StepDraft) => {
    const next = resolveStep(run, { gained: d.gained, caught: d.caught, escaped: d.escaped });
    setDraft(null);
    setPhase("event");

    // 주인은 만나면 거기서 끝난다
    if (kind === "warden") { onSettle("warden", next.bag, next.caught, next.alertPeak); return; }
    if (runIsOver(next)) { onSettle("forced", next.bag, next.caught, next.alertPeak); return; }
    setRun(next);
  }, [run, kind, onSettle, setRun]);

  const onCatchDone = useCallback((result: { caught: boolean }, monster: Monster) => {
    if (!draft) return;
    if (result.caught) {
      // 몬스터는 즉시 확정이다. 정산 대상이 아니라서 퇴각해도 잃지 않는다
      addToDexCaught(monster.id);
      addCapturedMonster(monster);
    }
    setDraft({ ...draft, monster, caught: result.caught, escaped: !result.caught });
    setPhase("resolved");
  }, [draft, addToDexCaught, addCapturedMonster]);

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
          <p className="text-pixel-sm text-sand-300">깊이 {run.depth}</p>
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
            onAction={enterStep}
          />
        )}

        {phase === "nest" && draft && (
          <NestPanel monsters={draft.choices} onPick={(m) => {
            setDraft({ ...draft, monster: m, choices: [] });
            setPhase("catch");
          }}/>
        )}

        {phase === "catch" && draft?.monster && (
          <CatchMiniGame
            monster={draft.monster}
            alert={alertForJudge}
            seed={(run.seed ^ (run.depth + 1)) >>> 0}
            onDone={(r) => onCatchDone(r, draft.monster!)}
          />
        )}

        {phase === "resolved" && draft && (
          <StepEventPanel
            kind={kind}
            monster={draft.monster}
            gained={draft.gained}
            alertAfter={kind === "hideout" ? Math.max(0, run.alert + delta) : undefined}
            catchRate={draft.monster && !draft.caught && !draft.escaped
              ? catchChance("draw", alertForJudge) : undefined}
            actionLabel="계속 걷는다"
            onAction={() => commitStep(draft)}
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
