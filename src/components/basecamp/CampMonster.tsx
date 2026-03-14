type Props = {
  name: string;
  image?: string;
  x: number;
  y: number;
};

export default function CampMonster({ name, image, x, y }: Props) {
  return (
    <div
      className="absolute z-10 flex flex-col items-center transition-all duration-300"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="h-14 w-14 overflow-hidden rounded-full shadow-md">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold">
            몬스터
          </div>
        )}
      </div>

      <span className="mt-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
        {name}
      </span>
    </div>
  );
}