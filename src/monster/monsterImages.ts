export const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling:  "/assets/monsters/flameling.png",
  aquabe:     "/assets/monsters/aquabe.png",
  burno:      "/assets/monsters/burno.png",
  bubblet:    "/assets/monsters/bubblet.png",
  mossy:      "/assets/monsters/mossy.png",
  leafy:      "/assets/monsters/leafy.png",
  mossevo:    "/assets/monsters/mossevo.png",
  mossyfinal: "/assets/monsters/mossyfinal.png",
  crystafox:  "/assets/monsters/crystafox.png",
  frostorb:   "/assets/monsters/frostorb.png",
  aquavern:   "/assets/monsters/aquavern.png",
  nobi:       "/assets/monsters/nobi.png",
};

/** img 태그에 적용할 style 반환 헬퍼 */
export function monsterImgStyle(_id: string): { imageRendering: "pixelated" } {
  return { imageRendering: "pixelated" };
}
