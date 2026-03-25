import { BrowserRouter, Routes, Route } from "react-router-dom";
import BaseCampPage from "./pages/BaseCampPage";
import BattlePage from "./pages/BattlePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BaseCampPage />} />
        <Route path="/battle" element={<BattlePage />} />
      </Routes>
    </BrowserRouter>
  );
}