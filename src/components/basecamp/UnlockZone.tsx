type Props = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  unlocked: boolean;
};

export default function UnlockZone({
  name,
  x,
  y,
  width,
  height,
  unlocked,
}: Props) {
  return (
    <div
      className={`absolute rounded-2xl border-2 ${
        unlocked
          ? "border-emerald-300 bg-emerald-400/15"
          : "border-white/20 bg-black/25"
      }`}
      style={{
        left: x,
        top: y,
        width,
        height,
      }}
    >
      {!unlocked && (
        <div className="flex h-full w-full flex-col items-center justify-center text-white">
          <div className="text-2xl">🔒</div>
          <div className="mt-1 text-sm font-semibold">{name}</div>
          <div className="text-xs text-white/70">추후 해금 가능</div>
        </div>
      )}
    </div>
  );
}