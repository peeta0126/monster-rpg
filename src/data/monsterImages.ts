import type React from "react";
import flamelingImg from "../assets/monsters/flameling.png";
import aquabeImg    from "../assets/monsters/aquabe.png";
import leafyImg     from "../assets/monsters/leafy.png";
import burnoImg     from "../assets/monsters/burno.png";
import bubbletImg   from "../assets/monsters/bubblet.png";
import mossyImg     from "../assets/monsters/mossy.png";
import voltinyImg   from "../assets/monsters/voltiny.svg";
import zapbearImg   from "../assets/monsters/zapbear.svg";
import frostletImg  from "../assets/monsters/frostlet.svg";
import blizzwolfImg from "../assets/monsters/blizzwolf.svg";
import fluffinImg   from "../assets/monsters/fluffin.svg";
import stonepupImg  from "../assets/monsters/stonepup.svg";

export const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling: flamelingImg,
  aquabe:    aquabeImg,
  leafy:     leafyImg,
  burno:     burnoImg,
  bubblet:   bubbletImg,
  mossy:     mossyImg,
  voltiny:   voltinyImg,
  zapbear:   zapbearImg,
  frostlet:  frostletImg,
  blizzwolf: blizzwolfImg,
  fluffin:   fluffinImg,
  stonepup:  stonepupImg,
};

/**
 * leafy PNG 이미지는 배경이 불투명하므로 어두운 UI에서
 * mix-blend-mode: multiply 를 적용해 배경을 시각적으로 제거한다.
 */
export const MONSTER_BLEND_MULTIPLY = new Set<string>(["leafy"]);

/** img 태그에 적용할 style 반환 헬퍼 */
export function monsterImgStyle(id: string): React.CSSProperties {
  const base: React.CSSProperties = { imageRendering: "pixelated" };
  if (MONSTER_BLEND_MULTIPLY.has(id)) {
    return { ...base, mixBlendMode: "multiply" as const };
  }
  return base;
}
