import { useEffect, useState } from "react";
import PlayerSprite from "../components/basecamp/PlayerSprite";
import CampMonster from "../components/basecamp/CampMonster";
import Portal from "../components/basecamp/Portal";
import UnlockZone from "../components/basecamp/UnlockZone";
import { useGameStore } from "../store/gameStore";
import { baseCampPortals, baseCampUnlockZones } from "../data/baseCamp";
import baseCampBg from "../assets/backgrounds/basecamp-bg.png";

const MAP_WIDTH = 1280;
const MAP_HEIGHT = 720;
const PLAYER_SIZE = 56;
const SPEED = 6;

export default function BaseCampPage() {
  const { ownedMonsters, setScene } = useGameStore();

  const [playerPos, setPlayerPos] = useState({ x: 640, y: 360 });
  const [keys, setKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: true }));
    };

    const up = (e: KeyboardEvent) => {
      setKeys((prev) => ({ ...prev, [e.key.toLowerCase()]: false }));
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlayerPos((prev) => {
        let nextX = prev.x;
        let nextY = prev.y;

        if (keys["arrowup"] || keys["w"]) nextY -= SPEED;
        if (keys["arrowdown"] || keys["s"]) nextY += SPEED;
        if (keys["arrowleft"] || keys["a"]) nextX -= SPEED;
        if (keys["arrowright"] || keys["d"]) nextX += SPEED;

        nextX = Math.max(
          PLAYER_SIZE / 2,
          Math.min(MAP_WIDTH - PLAYER_SIZE / 2, nextX),
        );
        nextY = Math.max(
          PLAYER_SIZE / 2,
          Math.min(MAP_HEIGHT - PLAYER_SIZE / 2, nextY),
        );

        return { x: nextX, y: nextY };
      });
    }, 16);

    return () => clearInterval(interval);
  }, [keys]);

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <div className="mx-auto mb-4 flex max-w-[1280px] items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monster Base Camp</h1>
          <p className="text-sm text-white/70">WASD 또는 방향키로 이동</p>
        </div>

        <div className="rounded-xl bg-white/10 px-4 py-2 text-sm backdrop-blur">
          보유 몬스터: {ownedMonsters.length}마리
        </div>
      </div>

      <div
        className="relative mx-auto overflow-hidden rounded-[28px] border border-white/10 shadow-2xl"
        style={{
          width: MAP_WIDTH,
          height: MAP_HEIGHT,
          backgroundColor: "#0f172a",
        }}
      >
        {/* 배경 이미지 */}
        <img
          src={baseCampBg}
          alt="base camp background"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {/* 살짝 어둡게 오버레이 */}
        <div className="pointer-events-none absolute inset-0 bg-black/10" />

        {/* 잠금 지역 */}
        {baseCampUnlockZones.map((zone) => (
          <UnlockZone
            key={zone.id}
            name={zone.name}
            x={zone.position.x}
            y={zone.position.y}
            width={zone.width}
            height={zone.height}
            unlocked={zone.unlocked}
          />
        ))}

        {/* 포탈 */}
        {baseCampPortals.map((portal) => (
          <Portal
            key={portal.id}
            label={portal.label}
            x={portal.position.x}
            y={portal.position.y}
            onClick={() => {
              if (portal.target === "battle") {
                setScene("battle");
              }
            }}
          />
        ))}

        {/* 캠프 몬스터 */}
        {ownedMonsters.map((monster) => (
          <CampMonster
            key={monster.id}
            name={monster.name}
            image={monster.image}
            x={monster.position.x}
            y={monster.position.y}
          />
        ))}

        {/* 플레이어 */}
        <PlayerSprite x={playerPos.x} y={playerPos.y} />
      </div>
    </div>
  );
}
