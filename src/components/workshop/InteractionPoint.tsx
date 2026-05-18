interface InteractionPointProps {
  x: number;
  y: number;
  label: string;
  disabled?: boolean;
  onInteract: () => void;
}

export function InteractionPoint({ x, y, label, disabled = false, onInteract }: InteractionPointProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onInteract}
      className="group absolute -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "1px solid rgba(251,191,36,0.85)",
        background: "radial-gradient(circle, rgba(251,191,36,0.55), rgba(120,53,15,0.2) 52%, rgba(0,0,0,0))",
        boxShadow: "0 0 22px rgba(251,191,36,0.55)",
        cursor: disabled ? "default" : "pointer",
        animation: "workshopPulse 1.8s ease-in-out infinite",
      }}
      aria-label={label}
    >
      <span
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 14, height: 14, background: "#fbbf24", boxShadow: "0 0 12px #fbbf24" }}
      />
      <span
        className="pointer-events-none absolute left-1/2 top-[-34px] hidden -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold text-amber-100 group-hover:block"
        style={{ background: "rgba(15,10,5,0.92)", border: "1px solid rgba(251,191,36,0.35)" }}
      >
        {label}
      </span>
    </button>
  );
}
