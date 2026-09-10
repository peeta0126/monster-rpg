import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { usePlayerStore } from "./shared/playerStore";
import AuthGate from "./auth/AuthGate";
import ErrorBoundary from "./shared/ErrorBoundary";
import AppErrorBridge from "./shared/AppErrorBridge";
import SaveIndicator from "./shared/SaveIndicator";
import { SmallScreenNotice } from "./shared/ui/SmallScreenNotice";
import { SceneTransition } from "./shared/ui/SceneTransition";

// 라우트를 전부 지연 로딩한다. 정적 import 로 두면 캔버스를 안 쓰는 화면(숲·가방·
// 몬스터·공방)에서도 phaser 청크 325KB 를 같이 받는다. design/PERF.md 참고.
const BaseCampPage = lazy(() => import("./camp/BaseCampPage"));
const BattlePage   = lazy(() => import("./battle/BattlePage"));
const FarmPage     = lazy(() => import("./monster/FarmPage"));
const ForestPage   = lazy(() => import("./camp/ForestPage"));
const MonstersPage = lazy(() => import("./monster/MonstersPage"));
const WorkshopPage = lazy(() => import("./workshop/WorkshopPage"));
const EndingPage   = lazy(() => import("./shared/EndingPage"));
const AdminPage    = lazy(() => import("./admin/AdminPage"));

function BattlePageWrapper() {
  const location = useLocation();
  const partySize = usePlayerStore((s) => s.party.length);
  /**
   * 전멸한 채로 주소창으로 들어오는 걸 막는다. 패배가 HP 를 세이브에 남기게 된 뒤로
   * 0 HP 파티는 실재하는 상태다.
   *
   * ⚠️ 들어올 때 한 번만 본다. 구독으로 두면 지는 순간 세이브가 0 이 되면서 이 문이
   * 닫혀 버려 패배 화면이 뜨기도 전에 마을로 튕긴다.
   */
  const [wipedOnEntry] = useState(() => {
    const party = usePlayerStore.getState().party;
    return party.length > 0 && party.every((m) => m.currentHp <= 0);
  });
  // 첫 파티원은 이장에게서 받는다. 그 전에 주소창으로 들어오면 BattlePage 가
  // 없는 몬스터를 읽다 죽으므로 여기서 되돌린다
  if (partySize === 0) return <Navigate to="/" replace />;
  if (wipedOnEntry) return <Navigate to="/" replace />;
  // location.key가 바뀔 때마다 BattlePage를 완전히 재마운트
  // → 재도전·다음 층 이동 시 새 전투로 시작
  return <BattlePage key={location.key} />;
}

/** 청크를 받는 동안 잠깐 보인다. 화면 전환 커버와 같은 색이라 이어붙은 것처럼 보인다. */
function RouteFallback() {
  return <div className="fixed inset-0 bg-shadow-900" aria-hidden />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <SmallScreenNotice />
        <AppErrorBridge />
        <AuthGate>
          <SceneTransition />
          <SaveIndicator />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<BaseCampPage />} />
              <Route path="/battle" element={<BattlePageWrapper />} />
              <Route path="/farm" element={<FarmPage />} />
              <Route path="/forest" element={<ForestPage />} />
              <Route path="/monsters" element={<MonstersPage />} />
              <Route path="/workshop" element={<WorkshopPage />} />
              <Route path="/ending" element={<EndingPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </Suspense>
        </AuthGate>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
