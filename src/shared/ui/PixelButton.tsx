import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger" | "info" | "nature";

/**
 * 톤은 팔레트의 뜻을 그대로 따른다. ember=주 강조/위험, mist=정보, moss=자연.
 * 글자색은 전부 밝은 쪽(cream/sand/mist-300)이다. mist-500·moss-500·earth-500 을
 * 글자에 쓰면 shadow-900 위에서 2.7~3.4:1 밖에 안 나온다 (palette.ts 머리말).
 */
const VARIANT: Record<Variant, string> = {
  primary: "border-ember-500 bg-ember-600 text-cream-100 hover:brightness-110",
  ghost:   "border-earth-500/70 bg-shadow-900/70 text-sand-300 hover:border-earth-400 hover:text-sand-200",
  danger:  "border-ember-700 bg-ember-700/25 text-ember-500 hover:bg-ember-700/40",
  info:    "border-mist-500 bg-mist-500/20 text-mist-300 hover:bg-mist-500/35",
  nature:  "border-moss-500 bg-moss-500/25 text-sand-200 hover:bg-moss-500/40",
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
