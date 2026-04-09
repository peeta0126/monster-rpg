import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import BaseCampPage from "./pages/BaseCampPage";
import BattlePage from "./pages/BattlePage";
import FarmPage from "./pages/FarmPage";
import ForestPage from "./pages/ForestPage";
import HousingPage from "./pages/HousingPage";

function BattlePageWrapper() {
  const location = useLocation();
  // location.key가 바뀔 때마다 BattlePage를 완전히 재마운트
  // → 재도전·다음 층 이동 시 새 전투로 시작
  return <BattlePage key={location.key} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BaseCampPage />} />
        <Route path="/battle" element={<BattlePageWrapper />} />
        <Route path="/farm" element={<FarmPage />} />
        <Route path="/forest" element={<ForestPage />} />
        <Route path="/housing" element={<HousingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
