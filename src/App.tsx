import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import AuthGate from "./auth/AuthGate";
import ErrorBoundary from "./shared/ErrorBoundary";
import AppErrorBridge from "./shared/AppErrorBridge";
import SaveIndicator from "./shared/SaveIndicator";
import { SmallScreenNotice } from "./shared/ui/SmallScreenNotice";
import { SceneTransition } from "./shared/ui/SceneTransition";

// 라우트를 전부 지연 로딩한다. 정적 import 로 두면 캔버스를 안 쓰는 화면(숲·가방·
// 몬스터·공방)에서도 phaser 청크 325KB 를 같이 받는다 — design/PERF.md 참고.
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
