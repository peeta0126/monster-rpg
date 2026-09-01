export const MONSTER_IMAGE_MAP: Record<string, string> = {
  flameling:  "/assets/monsters/flameling.webp",
  aquabe:     "/assets/monsters/aquabe.webp",
  burno:      "/assets/monsters/burno.webp",
  bubblet:    "/assets/monsters/bubblet.webp",
  mossy:      "/assets/monsters/mossy.webp",
  leafy:      "/assets/monsters/leafy.webp",
  mossevo:    "/assets/monsters/mossevo.webp",
  mossyfinal: "/assets/monsters/mossyfinal.webp",
  crystafox:  "/assets/monsters/crystafox.webp",
  frostorb:   "/assets/monsters/frostorb.webp",
  aquavern:   "/assets/monsters/aquavern.webp",
  nobi:       "/assets/monsters/nobi.webp",
  ormr:       "/assets/monsters/dragon.webp",
  toxadon:    "/assets/monsters/toxadon.webp",
  venomcrow:  "/assets/monsters/venomcrow.webp",
};

/**
 * 원화가 원래 보고 있는 쪽.
 *
 * 전투에서 뒤집을지 말지는 이 값과 선 자리로 정해진다(`battleLayout.shouldFlipX`).
 * "원화는 전부 왼쪽을 본다"고 믿고 왼쪽에 선 쪽만 뒤집던 시절엔, 오른쪽을 보는
 * 두 장(아쿠번·모치final)이 걸리는 순간 둘이 같은 쪽을 봤다. 그림이 늘 때마다
 * 여기 한 줄을 더하면 되고, 빠뜨리면 예전과 같은 "left" 로 떨어진다.
 *
 * front 는 정면을 본 그림이라 뒤집어도 정면이다. 뒤집으면 빛 방향만 어긋나므로 두지 않는다.
 */
export type ArtFacing = "left" | "right" | "front";

export const MONSTER_ART_FACING: Record<string, ArtFacing> = {
  flameling:  "left",
  aquabe:     "left",
  burno:      "left",
  bubblet:    "left",
  mossy:      "left",
  leafy:      "front",
  mossevo:    "left",
  mossyfinal: "right",
  crystafox:  "front",
  frostorb:   "front",
  aquavern:   "right",
  nobi:       "left",
  ormr:       "front",
  toxadon:    "left",
  venomcrow:  "left",
};

/**
 * 이미지 URL 로 원화 방향을 찾는다. 전투 씬은 몬스터 id 가 아니라 URL 만 들고 있고
 * (`battleInitStore`), 방향은 종이 아니라 그림 파일의 성질이라 파일 이름으로 잇는다.
 */
export function artFacingOfImage(url: string | undefined): ArtFacing {
  if (!url) return "left";
  const file = url.split("/").pop()?.replace(/\.\w+$/, "");
  if (!file) return "left";
  for (const [id, path] of Object.entries(MONSTER_IMAGE_MAP)) {
    if (path.endsWith(`/${file}.webp`)) return MONSTER_ART_FACING[id] ?? "left";
  }
  return "left";
}
