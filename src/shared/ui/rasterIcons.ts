/**
 * 생성물. scripts/build-icons.mjs 가 art-src/icons/ 를 보고 쓴다. 손으로 고치지 마라.
 *
 * 그림 파일이 있는 아이콘만 여기 적힌다. 여기 없는 이름은 SVG 로 그려진다
 * (상태이상·메뉴·공방 탭). 이 표가 없으면 화면마다 없는 파일을 먼저 요청해서
 * 404 를 깔고 나서야 폴백으로 떨어진다.
 */
export const RASTER_ICON_IDS = new Set([
  "antidote",
  "attack_buff",
  "berry",
  "crystal",
  "enhancement_stone",
  "guard_bracelet",
  "herb",
  "iron_fragment",
  "leather",
  "magic_dust",
  "max_potion",
  "monster_essence",
  "ormr_essence",
  "potion",
  "power_necklace",
  "root",
  "slime_extract",
  "spirit_amulet",
  "strong_attack_buff",
  "super_potion",
  "wood_plank",
]);
