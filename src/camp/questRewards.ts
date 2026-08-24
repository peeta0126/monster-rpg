import type { ItemQuality } from "../shared/crafting";
import type { IconName } from "../shared/ui/icons";
import { getMaterial } from "../shared/items";
import { ARTIFACT_RECIPES } from "../workshop/craftingRecipes";
import { monsters } from "../monster/monsters";

/**
 * 퀘스트 보상.
 *
 * 재료 수량만 줄 수 있었다. 그래서 뭘 받아도 밋밋했다. 약초 다섯은 숲 한 번이라
 * 값어치가 안 느껴진다.
 *
 * 보상을 고르는 기준은 하나다. 그 시점에 스스로 구하려면 몇 번을 다녀와야 하는지 세어
 * 보고, 그 수가 크지 않으면 보상으로 안 쓴다. 5층에 주는 강화석이 그렇다. 11층 위
 * 전투랑 고대 숲에만 있어서 그 시점엔 구할 길이 아예 없다.
 */
export type QuestReward =
  /** 재료. 강화석도 재료라 여기 들어간다 */
  | { kind: "material"; itemId: string; amount: number }
  /** 물약 완성품. 등급까지 정해서 준다 */
  | { kind: "potion"; potionId: string; name: string; icon: IconName; quality: ItemQuality; amount: number }
  /** 장비 완성품. 레벨과 강화까지 올린 상태로 준다 */
  | { kind: "artifact"; itemId: string; quality: ItemQuality; level: number; enhancement: number }
  /**
   * 몬스터. 시작할 때 플레미를 받는 것과 같은 자리다.
   *
   * 레벨은 받는 시점 파티 최고 레벨에서 이만큼 뺀 값이다. 고정 레벨로 주면 일찍 온
   * 사람에겐 과하고 늦게 온 사람에겐 짐이 된다.
   */
  | { kind: "monster"; monsterId: string; levelBelowParty: number; minLevel: number };

/** 화면에 그릴 보상 한 줄. 로그의 미리보기와 받은 뒤의 목록이 같은 것을 쓴다 */
export interface RewardDisplay {
  icon?: IconName;
  /** 몬스터일 때만. 아이콘 대신 일러스트를 그린다 */
  monsterId?: string;
  name: string;
  amount?: number;
  quality?: ItemQuality;
  /** "레벨 10" 처럼 덧붙는 한 줄 */
  detail?: string;
}

const artifactRecipe = (itemId: string) =>
  ARTIFACT_RECIPES.find((r) => r.resultItemId === itemId);

/**
 * 보상 한 줄을 화면 표기로.
 *
 * `hideMonster` 는 아직 안 받은 걸 미리 보여줄 때 쓴다. 뭘 받을지 미리 알면 10층
 * 완료 대사가 죽는다.
 */
export function rewardDisplay(r: QuestReward, hideMonster = false): RewardDisplay {
  switch (r.kind) {
    case "material": {
      const m = getMaterial(r.itemId);
      return { icon: m?.icon, name: m?.name ?? r.itemId, amount: r.amount };
    }
    case "potion":
      return { icon: r.icon, name: r.name, amount: r.amount, quality: r.quality };
    case "artifact": {
      const recipe = artifactRecipe(r.itemId);
      return {
        icon: recipe?.resultItemId as IconName | undefined,
        name: recipe?.resultItemName ?? r.itemId,
        quality: r.quality,
        detail: `레벨 ${r.level}${r.enhancement > 0 ? ` +${r.enhancement}` : ""}`,
      };
    }
    case "monster": {
      if (hideMonster) return { name: "?", detail: "만나서 들을 것" };
      const base = monsters.find((m) => m.id === r.monsterId);
      return { monsterId: r.monsterId, name: base?.name ?? r.monsterId };
    }
  }
}

/** 이 보상에 몬스터가 들어 있으면 그 하나. 자리가 있는지 미리 봐야 해서 따로 뽑는다 */
export function monsterReward(rewards: QuestReward[]) {
  return rewards.find((r): r is Extract<QuestReward, { kind: "monster" }> => r.kind === "monster");
}

/** 파티 최고 레벨에서 정해지는 실제 지급 레벨 */
export function grantedMonsterLevel(
  r: Extract<QuestReward, { kind: "monster" }>,
  partyTopLevel: number,
): number {
  return Math.max(r.minLevel, partyTopLevel - r.levelBelowParty);
}
