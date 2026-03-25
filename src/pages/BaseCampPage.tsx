import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createBaseCampGame } from "../game/phaser/phaserConfig";
import { gameEvents, GAME_EVENT } from "../game/phaser/events";

export default function BaseCampPage() {
  const gameRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameRef.current) return;

    const game = createBaseCampGame(gameRef.current);

    const handleEnterBattle = (payload?: {
      from?: string;
      portalId?: string;
    }) => {
      navigate("/battle", {
        state: {
          from: payload?.from ?? "basecamp",
          portalId: payload?.portalId ?? "none",
        },
      });
    };

    gameEvents.on(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);

    return () => {
      gameEvents.off(GAME_EVENT.ENTER_BATTLE, handleEnterBattle);
      game.destroy(true);
    };
  }, [navigate]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#111",
      }}
    >
      <div
        ref={gameRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}