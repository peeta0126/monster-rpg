import type { Monster } from "../shared/game";
import {
  ember, tackle, vineWhip, waterGun,
  spark, thunderbolt, voltCrash, boltStrike, thunderStrike,
  iceBeam,
  quickAttack,
  flamethrower, surf,
  aquaWhirl,
  crystalBurst,
  overheat, hydroPump, solarBeam, blizzard, venomStorm, gigaImpact,
  poisonSting, poisonJab, acidSpray, poisonFog,
} from "./moves";

export const monsters: Monster[] = [

  // ─── 불꽃 ──────────────────────────────────────────────────────────────────
  {
    id: "flameling",
    name: "플레미",
    type: "fire",
    maxHp: 120,
    attack: 30,
    defense: 20,
    speed: 25,
    moves: [tackle, ember],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 40,
  },
  {
    id: "burno",
    name: "버노",
    type: "fire",
    // 유리대포 컨셉 유지(공격/방어 그대로). 화력을 낮추지 않고 HP만 SPD에서 옮겨와
    // "한 방은 버티는" 여유를 준다. 총합은 186으로 불변.
    maxHp: 110,
    attack: 38,
    defense: 18,
    speed: 20,
    moves: [tackle, ember, flamethrower],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 48,
  },

  // ─── 물 ────────────────────────────────────────────────────────────────────
  {
    id: "aquabe",
    name: "아쿠비",
    type: "water",
    // 확정 상태이상기가 없어 능력치로 보상. 진화 전 "특수 딜러" 정체성을 살려
    // 공격/속도를 올리고 방어를 소폭 내림(민첩한 유생 도롱뇽). 총합 180→188.
    maxHp: 110,
    attack: 32,
    defense: 20,
    speed: 26,
    moves: [tackle, waterGun],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 35,
    evolutionStage: 1,
    evolutionChainId: "aqua",
    evolvesTo: "aquavern",
    evolvesAtLevel: 22,
  },
  {
    id: "aquavern",
    name: "아쿠사",
    type: "water",
    // 확정 상태이상기가 없어 능력치로 보상. 물리·특수 겸용 만능 딜러로
    // HP/공격을 상향(방어는 소폭만 조정). 총합 316→336.
    maxHp: 190,
    attack: 63,
    defense: 45,
    speed: 38,
    moves: [tackle, waterGun, surf, aquaWhirl],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 78,
    evolutionStage: 2,
    evolutionChainId: "aqua",
    evolvesFrom: "aquabe",
  },
  {
    id: "bubblet",
    name: "버블릿",
    type: "water",
    maxHp: 105,
    attack: 30,
    defense: 20,
    speed: 28,
    moves: [tackle, waterGun, surf],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 42,
  },

  // ─── 풀 ────────────────────────────────────────────────────────────────────
  {
    id: "leafy",
    name: "리피",
    type: "grass",
    maxHp: 115,
    attack: 29,
    defense: 21,
    speed: 23,
    moves: [tackle, vineWhip],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 38,
  },

  // ─── 전기 (모시 계열) ────────────────────────────────────────────────────────
  {
    id: "mossy",
    name: "모시",
    type: "electric",
    // 전기는 타입 상성표(typeChart.ts)상 약점이 전무(0개)한 최상급 방어 타입 →
    // 공격을 크게 낮추고 HP/방어를 올려 진화 라인의 "초반 탱커"로 재설계.
    // 진화 후(모치/모왕)는 반대로 화력형으로 가므로 라인 전체의 총합 곡선은 그대로 유지.
    // 총합은 195로 불변, 속도도 소폭 내려 방어형 정체성을 보강.
    maxHp: 131,
    attack: 17,
    defense: 32,
    speed: 15,
    moves: [tackle, spark],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 44,
    evolutionStage: 1,
    evolutionChainId: "mossy",
    evolvesTo: "mossevo",
    evolvesAtLevel: 20,
  },
  {
    id: "mossevo",
    name: "모치",
    type: "electric",
    maxHp: 185,
    attack: 62,
    defense: 44,
    speed: 52,
    moves: [tackle, spark, thunderbolt, voltCrash],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 88,
    evolutionStage: 2,
    evolutionChainId: "mossy",
    evolvesFrom: "mossy",
    evolvesTo: "mossyfinal",
    evolvesAtLevel: 38,
  },
  {
    id: "mossyfinal",
    name: "모왕",
    type: "electric",
    // 이미 최종 진화체로 충분히 강함. 순수 화력형 정체성 유지, 능력치 추가 상향 없음.
    maxHp: 240,
    attack: 95,
    defense: 62,
    speed: 80,
    // voltCrash는 이제 모치 전용 기술이라 최종 진화체 기본 무브셋에서 제외하고
    // boltStrike로 교체(둘 다 학습 테이블에 실존해 isAnomalyMove 오탐 없음).
    moves: [spark, thunderbolt, boltStrike, thunderStrike],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 140,
    evolutionStage: 3,
    evolutionChainId: "mossy",
    evolvesFrom: "mossevo",
  },

  // ─── 얼음 (새 2종) ───────────────────────────────────────────────────────────
  {
    id: "crystafox",
    name: "크리샤",
    type: "ice",
    maxHp: 110,
    attack: 32,
    defense: 28,
    speed: 26,
    moves: [tackle, iceBeam],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 46,
  },
  {
    id: "frostorb",
    name: "프리로",
    type: "ice",
    // 얼음은 상성표상 약점이 불 하나뿐(1개) → "불 외엔 단단한 벽" 컨셉을 강화.
    // 공격/속도를 소폭 덜어 HP로 옮김(총합 206 불변, 순수 방어형 심화).
    maxHp: 136,
    attack: 20,
    defense: 38,
    speed: 12,
    moves: [tackle, iceBeam, crystalBurst],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 50,
  },

  // ─── 독 (신규 2종) ──────────────────────────────────────────────────────────
  {
    id: "toxadon",
    name: "톡사룡",
    type: "poison",
    // 맹독을 뚝뚝 흘리는 아가리와 두꺼운 꼬리를 가진 포식자 컨셉 → 물리 어태커.
    // 독은 상성표상 약점이 전무(0개)라 공격/방어 모두 여유 있게 배분(총합 205).
    maxHp: 125,
    attack: 36,
    defense: 26,
    speed: 18,
    moves: [tackle, poisonSting, poisonJab],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 52,
  },
  {
    id: "venomcrow",
    name: "베노까",
    type: "poison",
    // 독안개를 두르고 나는 까마귀형 컨셉 → 날렵한 특수 어태커.
    // 독 무약점 보정을 속도에 실어 회피형으로(총합 187).
    maxHp: 100,
    attack: 26,
    defense: 18,
    speed: 35,
    moves: [tackle, acidSpray, poisonFog],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 40,
  },

  // ─── 노말 ────────────────────────────────────────────────────────────────────
  {
    id: "nobi",
    name: "노비",
    type: "normal",
    // 확정 상태이상기가 없고, 노말은 상성표상 약점이 전무(0개) → 이중으로 탱커
    // 보상 대상. 공격을 소폭 낮추고 HP/방어를 크게 올려 범용 탱커로. 총합 192→208.
    maxHp: 134,
    attack: 24,
    defense: 28,
    speed: 22,
    moves: [tackle, quickAttack],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 38,
  },

  // ─── 무속성 (최종 보스) ────────────────────────────────────────────────────────
  {
    id: "ormr",
    name: "오름",
    type: null,
    maxHp: 260,
    attack: 100,
    defense: 70,
    speed: 90,
    // 7개 타입 대표 최상급 기술을 전부 보유. 실제 전투에서는 이 중 4개만 무작위로 사용(floorTable 참고)
    moves: [overheat, hydroPump, thunderStrike, solarBeam, blizzard, venomStorm, gigaImpact],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 300,
  },

];
