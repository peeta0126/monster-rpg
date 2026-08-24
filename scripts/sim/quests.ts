/**
 * 시뮬레이터에 퀘스트를 물린다.
 *
 * 지금까지 시뮬은 퀘스트를 아예 몰랐다(SimState 에 완료 칸 둘이 선언만 되어 있고 읽는
 * 곳이 없었다). 그래서 "보상을 받았을 때와 안 받았을 때 진행이 얼마나 달라지는가"를 잴
 * 수단이 없었고, 보상 수량을 감으로 정할 수밖에 없었다.
 *
 * 여기는 게임의 판정을 그대로 부른다. 조건도 목표도 보상 표도 게임 쪽 한 벌을 읽는다.
 * 사본을 두면 시뮬이 게임이 아니라 사본을 재게 된다.
 */
import { ALL_QUESTS, questUnlocked } from "../../src/camp/campDialogues";
import type { QuestDef } from "../../src/camp/campDialogues";
import { evaluateObjective, objectiveCost } from "../../src/camp/questObjectives";
import { monsterReward, grantedMonsterLevel } from "../../src/camp/questRewards";
import { applyArtifactQualityStats, rollBonusStats } from "../../src/shared/craftingUtils";
import { ARTIFACT_RECIPES } from "../../src/workshop/craftingRecipes";
import { scaleToLevel } from "../../src/shared/floorTable";
import { applyLevelGrowth } from "../../src/monster/growth";
import { monsters } from "../../src/monster/monsters";
import type { ArtifactInstance } from "../../src/shared/crafting";
import type { SimState, OwnedMon } from "./gameModel";

const PARTY_MAX = 3;
const STORAGE_MAX = 30;

export interface QuestLogEntry {
  questId: string;
  /** 받았을 때의 최고 도달 층. 보상이 언제 들어오는지가 밸런스의 절반이다 */
  atFloor: number;
}

function snapshotOf(s: SimState, storage: OwnedMon[]) {
  return {
    materials: s.materials,
    potions: s.potions,
    bestFloor: s.bestFloor,
    dexCaught: s.dexCaught,
    equippedArtifacts: s.equipped,
    craftedArtifacts: s.artifacts,
    partyCount: s.party.length,
    storageCount: storage.length,
  };
}

/** 보상 하나를 상태에 반영한다. 게임의 지급 지점과 같은 칸을 건드린다 */
async function grant(
  s: SimState,
  storage: OwnedMon[],
  quest: QuestDef,
  uid: () => string,
): Promise<void> {
  for (const r of quest.rewards) {
    if (r.kind === "material") {
      s.materials[r.itemId] = (s.materials[r.itemId] ?? 0) + r.amount;
    } else if (r.kind === "potion") {
      s.potions[r.potionId] = (s.potions[r.potionId] ?? 0) + r.amount;
    } else if (r.kind === "artifact") {
      const recipe = ARTIFACT_RECIPES.find((x) => x.resultItemId === r.itemId);
      if (!recipe) continue;
      const inst: ArtifactInstance = {
        instanceId: uid(),
        itemId: recipe.resultItemId,
        name: recipe.resultItemName,
        quality: r.quality,
        description: recipe.description,
        statBonuses: applyArtifactQualityStats(recipe.baseStats ?? [], r.quality),
        createdAt: 0,
        level: r.level,
        enhancement: r.enhancement,
        source: "quest",
        bonusStats: rollBonusStats(recipe.resultItemId, 1, r.level, []),
      };
      // 가방에 넣는다. 장착·강화는 본 루프의 제작·모루 단계가 알아서 한다
      s.artifacts.push(inst);
    } else if (r.kind === "monster") {
      const base = monsters.find((m) => m.id === r.monsterId);
      if (!base) continue;
      const top = s.party.reduce((max, m) => Math.max(max, m.level), 0);
      const scaled = scaleToLevel(base, grantedMonsterLevel(r, top));
      let mon: OwnedMon = { ...scaled, uid: uid(), currentHp: scaled.maxHp };
      mon = (await applyLevelGrowth(mon, 1)).monster as OwnedMon;
      mon.currentHp = mon.maxHp;
      if (s.party.length < PARTY_MAX) s.party.push(mon);
      else storage.push(mon);
      if (!s.dexCaught.includes(mon.id)) s.dexCaught.push(mon.id);
    }
  }
}

/**
 * 지금 받을 수 있는 퀘스트를 받고, 조건이 찬 것을 완료한다.
 *
 * 사람과 같은 순서로 돈다. 한 사람이 한 번에 하나만 내놓으므로, 한 번 훑을 때 사람당
 * 최대 한 개가 수락되고 최대 한 개가 완료된다. 그래서 여러 번 부른다.
 */
export async function collectQuests(
  s: SimState,
  storage: OwnedMon[],
  uid: () => string,
  log: QuestLogEntry[],
): Promise<void> {
  for (let pass = 0; pass < ALL_QUESTS.length * 2; pass++) {
    let changed = false;
    for (const npcId of ["baros", "orion"] as const) {
      const quest = ALL_QUESTS.find(
        (q) => q.npcId === npcId
          && (s.questStatus[q.id] ?? "not_accepted") !== "completed"
          && questUnlocked(q, s.storyFlags, s.bestFloor, s.questStatus),
      );
      if (!quest) continue;

      if ((s.questStatus[quest.id] ?? "not_accepted") === "not_accepted") {
        s.questStatus[quest.id] = "in_progress";
        changed = true;
      }
      if (!evaluateObjective(quest.objective, snapshotOf(s, storage)).done) continue;
      // 자리가 없으면 완료를 미룬다. 게임과 같다
      if (monsterReward(quest.rewards)
        && s.party.length >= PARTY_MAX && storage.length >= STORAGE_MAX) continue;

      const cost = objectiveCost(quest.objective);
      if (cost) s.materials[cost.itemId] = (s.materials[cost.itemId] ?? 0) - cost.amount;
      await grant(s, storage, quest, uid);
      s.questStatus[quest.id] = "completed";
      if (quest.setsFlag) s.storyFlags[quest.setsFlag] = true;
      log.push({ questId: quest.id, atFloor: s.bestFloor });
      changed = true;
    }
    if (!changed) break;
  }
}
