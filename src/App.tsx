import BaseCampPage from "./pages/BaseCampPage";
import BattlePage from "./pages/BattlePage";
import { useGameStore } from "./store/gameStore";

export default function App() {
  const { scene } = useGameStore();

  if (scene === "battle") {
    return <BattlePage />;
  }

  return <BaseCampPage />;
}
