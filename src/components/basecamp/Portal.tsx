type Props = {
  label: string;
  x: number;
  y: number;
  onClick: () => void;
};

export default function Portal({ label, x, y, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="absolute z-10 h-20 w-20 rounded-full border-4 border-cyan-300 bg-cyan-400/30 shadow-[0_0_30px_rgba(34,211,238,0.7)] backdrop-blur-sm transition hover:scale-105"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white whitespace-nowrap">
        {label}
      </span>
    </button>
  );
}