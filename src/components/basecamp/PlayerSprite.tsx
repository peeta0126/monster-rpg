import playerImage from "../../assets/characters/player.png";

type Props = {
  x: number;
  y: number;
};

export default function PlayerSprite({ x, y }: Props) {
  return (
    <div
      className="absolute z-20 h-16 w-16 overflow-hidden rounded-full shadow-lg transition-all duration-75"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <img
        src={playerImage}
        alt="player"
        className="h-full w-full object-contain"
        draggable={false}
      />
    </div>
  );
}