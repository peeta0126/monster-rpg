import type React from "react";
import flamelingImg  from "../assets/monsters/flameling.png";
import aquabeImg     from "../assets/monsters/aquabe.png";
import burnoImg      from "../assets/monsters/burno.png";
import bubbletImg    from "../assets/monsters/bubblet.png";
import mossyImg      from "../assets/monsters/mossy.png";
import voltinyImg    from "../assets/monsters/voltiny.svg";
import zapbearImg    from "../assets/monsters/zapbear.svg";
import frostletImg   from "../assets/monsters/frostlet.svg";
import blizzwolfImg  from "../assets/monsters/blizzwolf.svg";
import fluffinImg    from "../assets/monsters/fluffin.svg";
import stonepupImg   from "../assets/monsters/stonepup.svg";
// 신규 몬스터 - 유저 제공 fakemon 이미지 사용
import leafyImg      from "../assets/monsters/fakemon6.png";
import mossevoImg    from "../assets/monsters/fakemon1.png";
import mossyfinalImg from "../assets/monsters/fakemon4.png";
import crystafoxImg  from "../assets/monsters/fakemon2.png";
import frostorbImg   from "../assets/monsters/fakemon3.png";
import aquavernImg   from "../assets/monsters/fakemon5.png";

export const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling:  flamelingImg,
  aquabe:     aquabeImg,
  burno:      burnoImg,
  bubblet:    bubbletImg,
  mossy:      mossyImg,
  voltiny:    voltinyImg,
  zapbear:    zapbearImg,
  frostlet:   frostletImg,
  blizzwolf:  blizzwolfImg,
  fluffin:    fluffinImg,
  stonepup:   stonepupImg,
  leafy:      leafyImg,
  mossevo:    mossevoImg,
  mossyfinal: mossyfinalImg,
  crystafox:  crystafoxImg,
  frostorb:   frostorbImg,
  aquavern:   aquavernImg,
};

/** 흰 배경 PNG 몬스터 - mix-blend-mode: multiply 로 배경 제거 */
export const MONSTER_BLEND_MULTIPLY = new Set<string>([
  "flameling", "aquabe", "burno", "bubblet", "mossy",
  "leafy", "mossevo", "mossyfinal", "crystafox", "frostorb", "aquavern",
]);

/** img 태그에 적용할 style 반환 헬퍼 */
export function monsterImgStyle(id: string): React.CSSProperties {
  const base: React.CSSProperties = { imageRendering: "pixelated" };
  if (MONSTER_BLEND_MULTIPLY.has(id)) {
    return { ...base, mixBlendMode: "multiply" as const };
  }
  return base;
}
