import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "border-ember-500 bg-ember-600 text-cream-100 hover:brightness-110",
  ghost:   "border-earth-500/70 bg-shadow-900/70 text-sand-300 hover:border-earth-400 hover:text-sand-200",
  danger:  "border-ember-700 bg-ember-700/25 text-ember-500 hover:bg-ember-700/40",
};

/** 게임 안의 모든 버튼. 화면마다 테두리·패딩을 새로 정하면 같은 버튼이 다르게 생긴다. */
export function PixelButton({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-lg border-2 px-3 py-1.5 text-pixel-sm font-bold transition
        active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40
        ${VARIANT[variant]} ${className}`}
    />
  );
}
