import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { rgba } from "../shared/palette";
import { usePlayerStore } from "../shared/playerStore";
import { FOREST_AREAS, highestUnlockedArea, type ForestArea, type ForestAreaId } from "./forest/areas";
import { ForestBackdrop } from "./forest/ForestBackdrop";
import { ForestTierCard } from "./forest/ForestTierCard";
import { Particles } from "./forest/Particles";
import { FOREST_STYLES } from "./forest/styles";
import { alertBand } from "./forest/alert";
import { ForestRunView } from "./forest/ForestRunView";
import { SettleScreen } from "./forest/SettleScreen";
import { useBgm, BGM } from "../shared/audio";
import { startRun, type ForestRun, type RunBagEntry, type SettleReason } from "./forest/runStore";
import { canCatchIn, partyCapLevel } from "./forest/catchLevel";
import {
  loadForest, saveForestRun, saveForestSettlement, clearForest, type LoadedForest,
} from "./forest/runStorage";

/**
 * 숲 화면.
 *
 * 여기가 하는 일은 셋뿐이다. 구역을 고르고, 원정을 열고, 정산을 띄운다.
 * 탐험 중의 규칙은 forest/runStore.ts 에, 화면은 forest/ForestRunView.tsx 에 있다.
 *
 * 원래 이 파일 하나가 1,500줄이었다. 노드 맵 SVG·좌표 계산·사건별 화면이 전부
 * 여기 있었기 때문인데, 지도를 걷어내면서 같이 흩어 놓았다.
 *
 * 걷다 만 원정은 저장돼 있다. 들어오면 묻지 않고 그 자리로 되돌린다. 이어할지
 * 고르게 하면 그 선택 자체가 리롤이 된다(마음에 안 드는 사건을 버릴 수 있으니까).
 */

/** 원정이 끝난 뒤 정산 화면에 넘길 것 */
interface Settlement {
  reason: SettleReason;
  bag: RunBagEntry[];
  caught: number;
  alertPeak: number;
}

/** 저장된 구역. 못 알아보면 얕은 숲으로 둔다. 정산 화면에 이름 한 줄이 필요할 뿐이다 */
function areaOf(loaded: LoadedForest): ForestArea | null {
  const id = loaded.kind === "run" ? loaded.run.areaId
    : loaded.kind === "settle" ? loaded.settlement.areaId
    : null;
  if (id === null) return null;
  return FOREST_AREAS.find((a) => a.id === id) ?? FOREST_AREAS[0];
}

export default function ForestPage() {
  useBgm(BGM.forest);

  const navigate = useNavigate();
  const bestFloor = usePlayerStore((s) => s.bestFloor);
  const addMaterial = usePlayerStore((s) => s.addMaterial);
  const party = usePlayerStore((s) => s.party);

  // 숲이 내주는 레벨의 천장. 런에 스냅샷으로 들어가므로 여기서 한 번만 읽는다
  const capLevel = partyCapLevel(party);

  // 화면을 그리기 전에 한 번만 읽는다. 나중에 읽으면 구역 선택 화면이 한 프레임 스친다
  const [restored] = useState(loadForest);
  const restoredArea = areaOf(restored);

  const [selectedTier, setSelectedTier] = useState<ForestAreaId>(
    () => restoredArea?.id ?? highestUnlockedArea(bestFloor).id);
  const [area, setArea] = useState<ForestArea | null>(restoredArea);
  const [run, setRun] = useState<ForestRun | null>(
    () => restored.kind === "run" ? restored.run : null);
  const [settlement, setSettlement] = useState<Settlement | null>(
    () => restored.kind === "settle" ? restored.settlement : null);

  /**
   * 저장은 상태가 바뀔 때마다 한다.
   *
   * 걸음 끝마다가 아니라 걸음 안의 한 칸마다여야 한다. 시도 횟수가 안 남으면
   * 새로고침이 곧 리롤이다(runStore 의 StepProgress 참조).
   */
  useEffect(() => {
    if (run) saveForestRun(run);
    else if (settlement && area) saveForestSettlement({ areaId: area.id, ...settlement });
    else clearForest();
  }, [run, settlement, area]);

  const enterArea = (a: ForestArea) => {
    if (party.length === 0) return;
    setArea(a);
    setRun(startRun(a.id, a.startingAlert, { capLevel, canCatch: canCatchIn(a, capLevel) }));
    setSettlement(null);
  };

  const onSettle = useCallback((reason: SettleReason, bag: RunBagEntry[], caught: number, alertPeak: number) => {
    setRun(null);
    setSettlement({ reason, bag, caught, alertPeak });
  }, [setRun, setSettlement]);

  /** 정산 확인. 여기서 처음으로 재료가 창고에 들어간다. 런 중에는 가방에만 있었다 */
  const confirmSettlement = (kept: RunBagEntry[]) => {
    for (const k of kept) addMaterial(k.id, k.count);
    setSettlement(null);
    setArea(null);
  };

  const inRun = run !== null || settlement !== null;
  const tint = run ? alertBand(run.alert).tint : undefined;
  const density = run ? alertBand(run.alert).particleMul : 1;

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden text-cream-100">
      <style>{FOREST_STYLES}</style>

      {/* 배경이 무대다. 탐험 중에는 한 겹 눌러 UI 를 읽히게 하고, 선택 화면은 원화 그대로 */}
      <ForestBackdrop
        tier={area?.id ?? selectedTier}
        dim={inRun}
        walking={run !== null}
        tint={tint}
        depth={run?.depth ?? 0}
      />
      {area && <Particles area={area} density={density}/>}

      {/* ── 구역 선택 ──
          justify-center 를 빼면 카드 묶음이 위로 붙는다. 비주얼 스냅샷이 통째로 어긋난다 */}
      {!inRun && (
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto px-gutter pb-6 pt-16">
          <div className="absolute left-gutter top-gutter">
            <button onClick={() => navigate("/")}
              className="rounded-xl border border-stone-600/60 bg-shadow-900/85 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur transition hover:bg-shadow-900 hover:text-sand-200">
              ← 베이스캠프
            </button>
          </div>

          <div className="flex w-full max-w-stage flex-col items-center">
            {/* 배경 원화의 밝은 안개 위에 놓이는 자리라 글자마다 그림자를 깐다 */}
            <div className="mb-2 text-center" style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
              <p className="mb-1 text-pixel-sm uppercase tracking-[.25em] text-sand-300">EXPEDITION</p>
              <h1 className="text-title-md font-black text-cream-100">숲 탐험</h1>
              <p className="mt-1 text-pixel-sm text-sand-200">
                {party.length === 0
                  ? "함께 갈 몬스터가 없다 — 마을 안쪽의 이장에게 먼저 들르자"
                  : "탐험할 구역을 선택하세요"}
              </p>
            </div>
            {/* gap 을 안 둔다. 물러난 카드가 scale(.75) 로 줄면서 자리에 여백을 스스로 남긴다 */}
            {FOREST_AREAS.map((a) => (
              <ForestTierCard
                key={a.id}
                area={a}
                selected={a.id === selectedTier}
                locked={bestFloor < a.unlockFloor || party.length === 0}
                lockReason={party.length === 0 ? "no-party" : "floor"}
                bestFloor={bestFloor}
                capLevel={capLevel}
                onSelect={() => setSelectedTier(a.id)}
                onEnter={() => enterArea(a)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 탐험 ── */}
      {area && run && (
        <ForestRunView area={area} run={run} setRun={setRun} onSettle={onSettle}/>
      )}

      {/* ── 정산 ── */}
      {area && settlement && (
        <div className="relative z-10 flex flex-1 items-center justify-center px-gutter">
          <SettleScreen
            area={area}
            reason={settlement.reason}
            bag={settlement.bag}
            caught={settlement.caught}
            alertPeak={settlement.alertPeak}
            onConfirm={confirmSettlement}
          />
        </div>
      )}
    </div>
  );
}
