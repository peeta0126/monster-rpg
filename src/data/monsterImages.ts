import flamelingImg  from "../assets/monsters/flameling.png";
import aquabeImg     from "../assets/monsters/aquabe.png";
import burnoImg      from "../assets/monsters/burno.png";
import bubbletImg    from "../assets/monsters/bubblet.png";
import mossyImg      from "../assets/monsters/mossy.png";
import leafyImg      from "../assets/monsters/leafy.png";
import mossevoImg    from "../assets/monsters/mossevo.png";
import mossyfinalImg from "../assets/monsters/mossyfinal.png";
import crystafoxImg  from "../assets/monsters/crystafox.png";
import frostorbImg   from "../assets/monsters/frostorb.png";
import aquavernImg   from "../assets/monsters/aquavern.png";
import nobiImg       from "../assets/monsters/nobi.png";

export const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling:  flamelingImg,
  aquabe:     aquabeImg,
  burno:      burnoImg,
  bubblet:    bubbletImg,
  mossy:      mossyImg,
  leafy:      leafyImg,
  mossevo:    mossevoImg,
  mossyfinal: mossyfinalImg,
  crystafox:  crystafoxImg,
  frostorb:   frostorbImg,
  aquavern:   aquavernImg,
  nobi:       nobiImg,
};

/** img 태그에 적용할 style 반환 헬퍼 */
export function monsterImgStyle(_id: string): { imageRendering: "pixelated" } {
  return { imageRendering: "pixelated" };
}
