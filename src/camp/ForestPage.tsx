import { useCallback, useState } from "react";
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
import { startRun, type ForestRun, type RunBagEntry, type SettleReason } from "./forest/runStore";

/**
 * 숲 화면.
 *
 * 여기가 하는 일은 셋뿐이다 — 구역을 고르고, 원정을 열고, 정산을 띄운다.
 * 탐험 중의 규칙은 forest/runStore.ts 에, 화면은 forest/ForestRunView.tsx 에 있다.
 *
 * 예전에는 이 파일 하나가 1,500줄이었다. 노드 맵 SVG·좌표 계산·사건별 화면이 전부
 * 여기 있었기 때문인데, 지도를 걷어내면서 같이 흩어 놓았다.
 */

/** 원정이 끝난 뒤 정산 화면에 넘길 것 */
interface Settlement {
  reason: SettleReason;
  bag: RunBagEntry[];
  caught: number;
  alertPeak: number;
}

export default function ForestPage() {
  const navigate = useNavigate();
  const bestFloor = usePlayerStore((s) => s.bestFloor);
  const addMaterial = usePlayerStore((s) => s.addMaterial);

  const [selectedTier, setSelectedTier] = useState<ForestAreaId>(() => highestUnlockedArea(bestFloor).id);
  const [area, setArea] = useState<ForestArea | null>(null);
  const [run, setRun] = useState<ForestRun | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);

  const enterArea = (a: ForestArea) => {
    setArea(a);
    setRun(startRun(a.id, a.startingAlert));
    setSettlement(null);
  };

  const onSettle = useCallback((reason: SettleReason, bag: RunBagEntry[], caught: number, alertPeak: number) => {
    setRun(null);
    setSettlement({ reason, bag, caught, alertPeak });
  }, []);

  /** 정산 확인 — 여기서 처음으로 재료가 창고에 들어간다. 런 중에는 가방에만 있었다 */
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
          justify-center 를 빼면 카드 묶음이 위로 붙는다 — 비주얼 스냅샷이 통째로 어긋난다 */}
      {!inRun && (
        <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-6 pt-16">
          <div className="absolute left-4 top-4">
            <button onClick={() => navigate("/")}
              className="rounded-xl border border-stone-600/60 bg-shadow-900/85 px-3 py-1.5 text-pixel-sm text-sand-300 backdrop-blur transition hover:bg-shadow-900 hover:text-sand-200">
              ← 베이스캠프
            </button>
          </div>

          <div className="flex w-full max-w-lg flex-col items-center">
            {/* 배경 원화의 밝은 안개 위에 놓이는 자리라 글자마다 그림자를 깐다 */}
            <div className="mb-2 text-center" style={{ textShadow: `0 2px 6px ${rgba("shadow900", 0.9)}` }}>
              <p className="mb-1 text-pixel-sm uppercase tracking-[.25em] text-sand-300">EXPEDITION</p>
              <h1 className="text-title-md font-black text-cream-100">숲 탐험</h1>
              <p className="mt-1 text-pixel-sm text-sand-200">탐험할 구역을 선택하세요</p>
            </div>
            {/* gap 을 두지 않는다 — 물러난 카드가 scale(.75) 로 줄면서 자리에 여백을 스스로 남긴다 */}
            {FOREST_AREAS.map((a) => (
              <ForestTierCard
                key={a.id}
                area={a}
                selected={a.id === selectedTier}
                locked={bestFloor < a.unlockFloor}
                bestFloor={bestFloor}
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
        <div className="relative z-10 flex flex-1 items-center justify-center px-4">
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
