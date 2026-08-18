import type { ElementType } from "../shared/game";
import { ELEMENT_KO } from "../shared/game";
import { monsters } from "../monster/monsters";
import { getMaterial } from "../shared/items";
import { withJosa } from "../shared/josa";

/**
 * 퀘스트 목표.
 *
 * 재료 하나를 N개 모으는 형태뿐이었다. 그것만으로 퀘스트를 여덟 개 만들면 전부 심부름이
 * 되므로 넷으로 넓혔는데, **새 계수기는 하나도 만들지 않는다**는 조건을 걸었다. 아래 넷은
 * 전부 이미 세이브에 있는 값을 읽는다.
 *
 * "몬스터를 몇 마리 잡았나" 같은 누적 계수기를 만들었다면 옛 세이브에서 그 값이 0이라
 * 이미 다 한 일을 처음부터 다시 세야 했을 것이다.
 */
export type QuestObjective =
  /** 재료 N개. **완료할 때 차감되는 유일한 목표다** */
  | { kind: "material"; itemId: string; amount: number }
  /** 그 층까지 오르기. 보스를 넘으라는 뜻으로 쓴다 */
  | { kind: "floor"; floor: number }
  /** 그 속성 몬스터를 잡아 도감에 올리기. 지금 데리고 있지 않아도 된다 */
  | { kind: "catchType"; elementType: ElementType }
  /** 아티팩트를 하나라도 장착하기 */
  | { kind: "equipped" }
  /** 장비 하나를 그 레벨 이상으로 올리기 */
  | { kind: "artifactLevel"; level: number }
  /** 그 완성품을 손에 넣기 */
  | { kind: "potion"; potionId: string; name: string };

/** 목표를 판정하는 데 필요한 것만 추린 지금 상태 */
export interface QuestSnapshot {
  materials: Record<string, number>;
  potions: Record<string, number>;
  bestFloor: number;
  dexCaught: string[];
  equippedArtifacts: Record<string, { level?: number }[]>;
  craftedArtifacts: { level?: number }[];
  /** 몬스터를 건네줄 자리가 있는지 보려고 같이 든다. 목표 판정에는 안 쓰인다 */
  partyCount: number;
  storageCount: number;
}

export interface QuestProgress {
  done: boolean;
  /** 진행도를 숫자로 그릴 수 있을 때만. 아니면 없다 */
  have?: number;
  need?: number;
  /** 화면에 적는 목표 한 줄 */
  label: string;
}

/** 그 속성으로 잡아 둔 종이 있는가 */
function caughtOfType(dexCaught: string[], elementType: ElementType): boolean {
  return dexCaught.some((id) => monsters.find((m) => m.id === id)?.type === elementType);
}

export function evaluateObjective(o: QuestObjective, s: QuestSnapshot): QuestProgress {
  switch (o.kind) {
    case "material": {
      const have = s.materials[o.itemId] ?? 0;
      const name = getMaterial(o.itemId)?.name ?? o.itemId;
      return {
        done: have >= o.amount,
        have: Math.min(have, o.amount),
        need: o.amount,
        label: `${name} ${o.amount}개 모으기`,
      };
    }
    case "floor":
      return {
        done: s.bestFloor >= o.floor,
        have: Math.min(s.bestFloor, o.floor),
        need: o.floor,
        label: `무한의 탑 ${o.floor}층 넘기`,
      };
    case "catchType": {
      const ko = ELEMENT_KO[o.elementType];
      return {
        done: caughtOfType(s.dexCaught, o.elementType),
        label: `${withJosa(ko, "을를")} 쓰는 몬스터 포획하기`,
      };
    }
    case "equipped":
      return {
        done: Object.values(s.equippedArtifacts).some((list) => list.length > 0),
        label: "아티팩트를 만들어 장착하기",
      };
    case "artifactLevel": {
      // 가방에 있든 끼고 있든 올린 건 올린 거다. 둘 다 본다
      const all = [...s.craftedArtifacts, ...Object.values(s.equippedArtifacts).flat()];
      const best = all.reduce((max, a) => Math.max(max, a.level ?? 1), 0);
      return {
        done: best >= o.level,
        have: Math.min(best, o.level),
        need: o.level,
        label: `장비 하나를 레벨 ${o.level}까지 올리기`,
      };
    }
    case "potion":
      return {
        done: (s.potions[o.potionId] ?? 0) > 0,
        label: `${withJosa(o.name, "을를")} 만들어 가져가기`,
      };
  }
}

/** 그 목표를 채우려면 어디로 가야 하는가. "지금 할 일" 한 줄이 이걸 쓴다 */
export function objectiveWhere(o: QuestObjective): string {
  switch (o.kind) {
    case "material":      return "숲";
    case "floor":         return "탑";
    case "catchType":     return "숲";
    case "equipped":      return "집";
    case "artifactLevel": return "집";
    case "potion":        return "집";
  }
}

/**
 * 완료할 때 가져가는 것. **재료 목표만 차감한다.**
 *
 * 나머지 셋은 "이미 한 일"을 확인할 뿐이라 뺏을 게 없다. 층을 도로 내리거나 잡은 몬스터를
 * 도감에서 지울 수는 없다.
 */
export function objectiveCost(o: QuestObjective): { itemId: string; amount: number } | null {
  return o.kind === "material" ? { itemId: o.itemId, amount: o.amount } : null;
}
