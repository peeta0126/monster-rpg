import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BaseCampPage from "./camp/BaseCampPage";
import BattlePage from "./battle/BattlePage";
import FarmPage from "./monster/FarmPage";
import ForestPage from "./camp/ForestPage";
import MonstersPage from "./monster/MonstersPage";
import WorkshopPage from "./workshop/WorkshopPage";
import EndingPage from "./shared/EndingPage";
import AuthGate from "./auth/AuthGate";
import AdminPage from "./admin/AdminPage";
import ErrorBoundary from "./shared/ErrorBoundary";
import AppErrorBridge from "./shared/AppErrorBridge";

function BattlePageWrapper() {
  const location = useLocation();
  // location.key가 바뀔 때마다 BattlePage를 완전히 재마운트
  // → 재도전·다음 층 이동 시 새 전투로 시작
  return <BattlePage key={location.key} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppErrorBridge />
        <AuthGate>
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
        </AuthGate>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
