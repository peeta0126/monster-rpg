import herbSvg             from "../../assets/materials/herb.svg";
import berrySvg            from "../../assets/materials/berry.svg";
import rootSvg             from "../../assets/materials/root.svg";
import crystalSvg          from "../../assets/materials/crystal.svg";
import woodPlankSvg        from "../../assets/materials/wood_plank.svg";
import ironFragmentSvg     from "../../assets/materials/iron_fragment.svg";
import leatherSvg          from "../../assets/materials/leather.svg";
import monsterEssenceSvg   from "../../assets/materials/monster_essence.svg";
import slimeExtractSvg     from "../../assets/materials/slime_extract.svg";
import magicDustSvg        from "../../assets/materials/magic_dust.svg";
import enhancementStoneSvg from "../../assets/materials/enhancement_stone.svg";
import ormrEssenceSvg      from "../../assets/materials/ormr_essence.svg";

import potionSvg           from "../../assets/potions/potion.svg";
import superPotionSvg      from "../../assets/potions/super_potion.svg";
import maxPotionSvg        from "../../assets/potions/max_potion.svg";
import antidoteSvg         from "../../assets/potions/antidote.svg";
import attackBuffSvg       from "../../assets/potions/attack_buff.svg";
import strongAttackSvg     from "../../assets/potions/strong_attack_buff.svg";

import powerNecklaceSvg    from "../../assets/artifacts/power_necklace.svg";
import guardBraceletSvg    from "../../assets/artifacts/guard_bracelet.svg";
import spiritAmuletSvg     from "../../assets/artifacts/spirit_amulet.svg";

import towerSvg            from "../../assets/ui/tower.svg";
import questSvg            from "../../assets/ui/quest.svg";
import monstersSvg         from "../../assets/ui/monsters.svg";
import bagSvg              from "../../assets/ui/bag.svg";
import dexSvg              from "../../assets/ui/dex.svg";
import soundSvg            from "../../assets/ui/sound.svg";
import muteSvg             from "../../assets/ui/mute.svg";
import doorSvg             from "../../assets/ui/door.svg";
import trophySvg           from "../../assets/ui/trophy.svg";
import compassSvg          from "../../assets/ui/compass.svg";
import anvilSvg            from "../../assets/ui/anvil.svg";
import alchemySvg          from "../../assets/ui/alchemy.svg";
import artifactSvg         from "../../assets/ui/artifact.svg";
import levelupSvg          from "../../assets/ui/levelup.svg";
import enhanceSvg          from "../../assets/ui/enhance.svg";
import disassembleSvg      from "../../assets/ui/disassemble.svg";
import synthesizeSvg       from "../../assets/ui/synthesize.svg";
import storageSvg          from "../../assets/ui/storage.svg";
import partySvg            from "../../assets/ui/party.svg";
import lockSvg             from "../../assets/ui/lock.svg";
import screenSvg           from "../../assets/ui/screen.svg";
import statusBurnSvg       from "../../assets/ui/status-burn.svg";
import statusPoisonSvg     from "../../assets/ui/status-poison.svg";
import statusParalysisSvg  from "../../assets/ui/status-paralysis.svg";
import statusFreezeSvg     from "../../assets/ui/status-freeze.svg";

/**
 * 아이콘 한 벌. 이건 폴백이다.
 *
 * 재료·물약·아티팩트 21종은 이제 그림 파일(public/assets/icons/*.webp)로 나간다.
 * 여기 적힌 SVG 는 그 파일이 없을 때 대신 그려진다. 지우지 마라. 굽지 않고 클론한
 * 곳에서도 화면이 비면 안 된다.
 *
 * 상태이상·메뉴·공방 탭은 그림 파일이 없어서 계속 이 SVG 로 나간다.
 *
 * 원래는 화면마다 이모지를 박아 뒀다. 이모지는 글꼴이 그리는 그림이라 픽셀아트랑
 * 톤이 안 맞고, 같은 자리에 픽셀 SVG 와 이모지가 섞여 나왔다(가방의 약초는 픽셀아트,
 * 가죽은 갈색 사각형 이모지였다). 플랫폼마다 다르게 그려지기도 하고.
 *
 * 그래서 아이콘은 여기 적힌 것만 쓴다. 새 아이콘이 필요하면 `src/assets/ui` 나
 * `src/assets/materials` 에 32×32 픽셀 SVG 를 그려 넣고 이 표에 이름을 더해라.
 */
export const ICONS = {
  // 재료
  herb: herbSvg, berry: berrySvg, root: rootSvg, crystal: crystalSvg,
  wood_plank: woodPlankSvg, iron_fragment: ironFragmentSvg, leather: leatherSvg,
  monster_essence: monsterEssenceSvg, slime_extract: slimeExtractSvg,
  magic_dust: magicDustSvg, enhancement_stone: enhancementStoneSvg,
  ormr_essence: ormrEssenceSvg,

  // 물약
  potion: potionSvg, super_potion: superPotionSvg, max_potion: maxPotionSvg,
  antidote: antidoteSvg, attack_buff: attackBuffSvg, strong_attack_buff: strongAttackSvg,

  // 아티팩트
  power_necklace: powerNecklaceSvg, guard_bracelet: guardBraceletSvg,
  spirit_amulet: spiritAmuletSvg,

  // 메뉴·화면
  tower: towerSvg, quest: questSvg, monsters: monstersSvg, bag: bagSvg,
  dex: dexSvg, sound: soundSvg, mute: muteSvg, door: doorSvg, trophy: trophySvg,
  compass: compassSvg, storage: storageSvg, party: partySvg, lock: lockSvg,
  screen: screenSvg,

  // 공방
  anvil: anvilSvg, alchemy: alchemySvg, artifact: artifactSvg,
  levelup: levelupSvg, enhance: enhanceSvg, disassemble: disassembleSvg,
  synthesize: synthesizeSvg,

  // 상태이상
  "status-burn": statusBurnSvg, "status-poison": statusPoisonSvg,
  "status-paralysis": statusParalysisSvg, "status-freeze": statusFreezeSvg,
} as const;

export type IconName = keyof typeof ICONS;

/**
 * 아이템 id 처럼 표 밖에서 온 문자열을 아이콘 이름으로 좁힌다.
 *
 * URL 을 바로 내주는 `iconUrl` 도 있었는데 걷어냈다. 그건 위 표(=SVG 폴백)를 가리키니까
 * 그걸로 `<img>` 를 만들면 그림 파일이 있어도 옛 SVG 가 나간다. 조용히 틀린 그림이
 * 나오는 쪽이라 눈으로는 안 잡힌다. 아이콘은 PixelIcon 으로만 그린다.
 */
export function isIconName(name: string): name is IconName {
  return name in ICONS;
}
