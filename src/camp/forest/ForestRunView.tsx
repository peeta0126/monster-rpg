import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { scaleToLevel } from "../../shared/floorTable";
import { monsters } from "../../monster/monsters";
import { usePlayerStore } from "../../shared/playerStore";
import type { ForestArea } from "./areas";
import { alertBand } from "./alert";
import { hasCatch, rollStepRewards } from "./steps";
import { bagTotal, choosePath, judgeAlert, makeRng, resolveStep, runIsOver, type ForestRun, type RunBagEntry, type SettleReason } from "./runStore";
import { depthMood, getForestSceneLayout, type Point } from "./sceneLayouts";
import { saveForestRun } from "./runStorage";
import { CatchMiniGame } from "./CatchMiniGame";

const ICONS: Record<string, string> = { trace: "🍃", encounter: "🐾", nest: "🪺", hideout: "⛺", anomaly: "🌀", champion: "✦", warden: "𐂂" };
const RISK = { low: "낮음", medium: "보통", high: "높음", unknown: "???" };

export function ForestRunView({ area, run, setRun, onSettle }: {
  area: ForestArea; run: ForestRun; setRun: Dispatch<SetStateAction<ForestRun | null>>;
  onSettle: (reason: SettleReason, bag: RunBagEntry[], caught: number, alertPeak: number) => void;
}) {
  const addCapturedMonster = usePlayerStore((s) => s.addCapturedMonster);
  const addToDexSeen = usePlayerStore((s) => s.addToDexSeen);
  const addToDexCaught = usePlayerStore((s) => s.addToDexCaught);
  const [selected, setSelected] = useState(0);
  const [player, setPlayer] = useState<Point>(() => getForestSceneLayout(area.id, run.paths.length as 2 | 3 | 4).entrance);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number[]>([]);
  const layout = getForestSceneLayout(area.id, run.paths.length as 2 | 3 | 4);
  const mood = depthMood(area.id, run.depth);
  const scout = alertBand(run.alert).scout;

  useEffect(() => () => timer.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (run.phase.type === "transition") {
      const id = window.setTimeout(() => { setPlayer(layout.entrance); setSelected(0); setRun((r) => r ? { ...r, phase: { type: "choosing" } } : r); }, 360);
      timer.current.push(id);
    }
  }, [run.phase.type, layout.entrance, setRun]);

  const pickMonster = useCallback(() => {
    const { rng } = makeRng(run.seed ^ (run.depth + 1));
    const strong = run.current === "champion" || run.current === "warden";
    const pool = strong ? area.monsterPool.slice(-2) : area.monsterPool;
    const base = monsters.find((m) => m.id === pool[Math.floor(rng() * pool.length)]) ?? monsters[0];
    const min = strong ? Math.floor((area.levelRange[0] + area.levelRange[1]) / 2) : area.levelRange[0];
    return scaleToLevel(base, min + Math.floor(rng() * (area.levelRange[1] - min + 1)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, run.current, run.depth, run.seed]);

  const beginEvent = useCallback((eventId: string) => {
    if (run.completedEventIds.includes(eventId)) return;
    if (hasCatch(run.current)) {
      const monster = pickMonster();
      addToDexSeen(monster.id);
      const next = { ...run, phase: { type: "capture", eventId, monsterId: monster.id } as const,
        step: { ...run.step, entered: true }, encounter: { eventId, monsterId: monster.id, level: monster.level, resolved: false } };
      saveForestRun(next);
      setRun(next);
      return;
    }
    const { rng } = makeRng(run.seed ^ (run.depth + 1));
    const gained = rollStepRewards(area, run.current, judgeAlert(run), rng);
    const next = resolveStep({ ...run, phase: { type: "event", eventId } }, { gained });
    setNotice(run.current === "hideout" ? "잠시 쉬어 위험도가 낮아졌습니다." : gained.length ? `재료 ${gained.reduce((s, x) => s + x.count, 0)}개를 획득했습니다.` : "길을 살펴보았습니다.");
    setRun(next);
    window.setTimeout(() => setNotice(null), 1500);
    if (run.current === "warden") onSettle("warden", next.bag, next.caught, next.alertPeak);
    else if (runIsOver(next)) onSettle("forced", next.bag, next.caught, next.alertPeak);
  }, [addToDexSeen, area, onSettle, pickMonster, run, setRun]);

  const captureMonster = useMemo(() => {
    if (run.phase.type !== "capture" || !run.encounter) return null;
    const base = monsters.find((m) => m.id === run.encounter!.monsterId);
    return base ? scaleToLevel(base, run.encounter.level) : null;
  }, [run.encounter, run.phase.type]);

  const finishCapture = useCallback((caught: boolean) => {
    if (run.phase.type !== "capture" || !run.encounter || run.encounter.resolved || !captureMonster) return;
    const marked = { ...run, phase: { type: "result", eventId: run.phase.eventId } as const, encounter: { ...run.encounter, resolved: true } };
    saveForestRun(marked);
    if (caught) { addToDexCaught(captureMonster.id); addCapturedMonster(captureMonster); }
    const next = resolveStep({ ...marked, phase: { type: "event", eventId: run.phase.eventId } }, { caught, escaped: !caught });
    setRun(next);
  }, [addCapturedMonster, addToDexCaught, captureMonster, run, setRun]);

  const move = useCallback((index: number) => {
    if (run.phase.type !== "choosing") return;
    const option = run.paths[index]; const path = layout.paths[index];
    if (!option || !path) return;
    setRun(choosePath(run, option.id));
    const points = [...path.waypoints, path.exit];
    points.forEach((point, i) => timer.current.push(window.setTimeout(() => setPlayer(point), i * 230)));
    timer.current.push(window.setTimeout(() => beginEvent(option.id), points.length * 230 + 80));
  }, [beginEvent, layout.paths, run, setRun]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (run.phase.type !== "choosing") return;
      if (["ArrowLeft", "a", "A"].includes(e.key)) { e.preventDefault(); setSelected((v) => (v - 1 + run.paths.length) % run.paths.length); }
      else if (["ArrowRight", "d", "D"].includes(e.key)) { e.preventDefault(); setSelected((v) => (v + 1) % run.paths.length); }
      else if (["Enter", "e", "E"].includes(e.key)) { e.preventDefault(); move(selected); }
      else if (e.key === "Escape") setSelected(0);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [move, run.paths.length, run.phase.type, selected]);

  const revealed = (index: number) => scout === "detail" || scout === "type" || index === selected;
  const sprite = useMemo(() => player.x < 48 ? "player-left" : player.x > 52 ? "player-right" : "player-up", [player.x]);
  return <div data-testid="forest-scene" className="forest-world relative z-10 h-full w-full overflow-hidden" data-phase={run.phase.type}>
    <img className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" src={layout.image} alt="" onError={(e) => { e.currentTarget.src = area.backgroundImage; }}/>
    <div className="forest-color absolute inset-0 pointer-events-none" style={{ background: mood.overlayColor, opacity: .12, mixBlendMode: "multiply" }}/>
    <div className="forest-vignette absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 22vw rgba(3,10,18,${mood.vignette})` }}/>{/* palette-ok: forest depth overlay */}
    <div className="forest-fog absolute inset-0 pointer-events-none" style={{ opacity: mood.fogOpacity }}/>
    <div className="absolute inset-0 pointer-events-none" style={{ backdropFilter: `brightness(${mood.brightness}) saturate(${mood.saturation})` }}/>

    {run.paths.map((option, i) => { const path = layout.paths[i]; const pos = path.marker; const active = selected === i; return <div key={option.id}>
      <button data-testid={`forest-path-${i}`} aria-label={`${option.title}, ${option.preview}`} onFocus={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onClick={() => move(i)}
        disabled={run.phase.type !== "choosing"} className="forest-hit-area absolute z-20"
        style={{ left: `${path.hitArea.x}%`, top: `${path.hitArea.y}%`, width: `${path.hitArea.width}%`, height: `${path.hitArea.height}%` }}/>
      <div className={`forest-path-marker pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 ${active ? "is-selected" : ""}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
        <span className="forest-event-icon">{ICONS[option.eventKind]}</span>
        {active && <span className="forest-tooltip"><strong>{revealed(i) ? option.title : "???"}</strong><small>{revealed(i) ? option.preview : "알 수 없는 길"} · 위험 {revealed(i) ? RISK[option.risk] : "???"}</small></span>}
      </div>
    </div>; })}

    <img src={`/assets/player/${sprite}.png`} alt="플레이어" className="forest-player absolute z-10 [image-rendering:pixelated]" style={{ left: `${player.x}%`, top: `${player.y}%` }}/>
    <header className="forest-hud forest-title"><strong>{area.name} · 깊이 <span data-testid="forest-depth" data-depth={run.depth}>{run.depth}</span></strong></header>
    <aside className="forest-hud forest-stats"><span data-testid="forest-alert" data-alert={run.alert}>위험도 {run.alert}</span><span>획득 재료 {bagTotal(run.bag)}개</span></aside>
    <div className="forest-hud forest-help">WASD / 방향키 경로 선택 · E 이동</div>
    <button data-testid="forest-go-home" className="forest-hud forest-home" onClick={() => onSettle("voluntary", run.bag, run.caught, run.alertPeak)}>돌아가기 · 수확 100% 회수</button>
    <div className="forest-hud forest-menu">메뉴 (Tab)</div>
    {notice && <div className="forest-notice">{notice}</div>}
    {run.phase.type === "capture" && captureMonster && <div className="forest-capture-layer">
      <CatchMiniGame monster={captureMonster} alert={judgeAlert(run)} seed={(run.seed ^ (run.depth + 1)) >>> 0}
        attempts={run.step.attempts} pending={run.step.pending}
        onReveal={() => setRun((r) => r ? { ...r, step: { ...r.step, attempts: r.step.attempts + 1, pending: null } } : r)}
        onResult={(pending) => setRun((r) => r ? { ...r, step: { ...r.step, pending } } : r)}
        onDone={({ caught }) => finishCapture(caught)}/>
      <button data-testid="forest-capture-skip" className="forest-capture-skip" onClick={() => finishCapture(false)}>포획을 포기하고 지나간다</button>
    </div>}
    {run.phase.type === "transition" && <div className="forest-transition"/>}
  </div>;
}
