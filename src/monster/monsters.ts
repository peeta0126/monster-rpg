import type { Monster } from "../shared/game";
import {
  ember, tackle, vineWhip, waterGun,
  spark, thunderbolt, voltCrash, boltStrike, thunderStrike,
  iceBeam,
  quickAttack, headbutt,
  flamethrower, surf, firePunch,
  aquaWhirl, aquaTail, bubbleCannon, tidalCrash,
  crystalBurst, frostBreath, iceShard, icePunch, crystalLance,
  overheat, hydroPump, solarBeam, blizzard, venomStorm, gigaImpact,
  poisonSting, poisonJab, acidSpray, poisonFog, venomFang,
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
    evolutionStage: 1,
    evolutionChainId: "burno",
    evolvesTo: "burnox",
    // 유리대포는 늦게 여문다. 아쿠비(22)·모시(20)보다 뒤인 24 로 둬서, 진화 전까지는
    // "한 방은 세지만 한 방에 죽는" 구간을 그대로 통과하게 한다.
    evolvesAtLevel: 24,
  },
  {
    id: "burnox",
    name: "버녹스",
    type: "fire",
    // 버노의 유리대포 정체성을 그대로 확대한다. 같은 2단계인 아쿠사(190/63/45/38)·
    // 모치(185/62/44/52)보다 공격이 17 높고 방어가 6 낮다 — 총합 336 은 아쿠사와 같다.
    // 진화해도 "먼저 때려야 이긴다"가 안 바뀌는 라인이라야 24까지 참은 값을 한다.
    maxHp: 170,
    attack: 80,
    defense: 38,
    speed: 48,
    moves: [tackle, ember, firePunch, flamethrower],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 92,
    evolutionStage: 2,
    evolutionChainId: "burno",
    evolvesFrom: "burno",
  },
  {
    id: "hwarong",
    name: "화롱",
    type: "fire",
    // 불꽃은 플레미(속도)·버노(화력) 둘뿐이라 맞고 버티는 불이 없었다. 화로를 짊어진
    // 둔한 몸집이라 HP/방어 쪽이지만, 속도를 16 까지 버리면 안 된다(총합 202 는 그대로).
    // ⚠️ 처음에 16 으로 뒀다가 시뮬 40판 중 실패 다섯 판의 셋에 이 종이 껴 있었다.
    // 전투가 속도 게이지라 느린 쪽은 턴 자체를 덜 받는데, 공격까지 낮으면 아무것도
    // 못 하고 맞기만 한다. 방어형이라도 상대를 깎을 수는 있어야 자리값을 한다.
    maxHp: 118,
    attack: 30,
    defense: 30,
    speed: 24,
    moves: [tackle, ember, headbutt],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 42,
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
    evolvesTo: "aquagon",
    evolvesAtLevel: 40,
  },
  {
    id: "aquagon",
    name: "아쿠곤",
    type: "water",
    // 3단계 총합은 모왕과 같은 477 로 맞추되 배분을 반대로 준다. 모왕이 속도 80 의
    // 화력형이라면 아쿠곤은 HP/방어를 짊어진 완력형이다 — 최종체가 셋으로 늘어나는
    // 만큼 "어느 최종체를 키울까"가 실제 선택이 되려면 숫자가 서로 달라야 한다.
    maxHp: 255,
    attack: 88,
    defense: 74,
    speed: 60,
    moves: [waterGun, aquaTail, surf, tidalCrash],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 138,
    evolutionStage: 3,
    evolutionChainId: "aqua",
    evolvesFrom: "aquavern",
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
    evolutionStage: 1,
    evolutionChainId: "bubblet",
    evolvesTo: "bublock",
    // ⚠️ 16 이었다. 그런데 깊은 숲의 레벨 상한이 18 이라, 잡자마자 2단계인 버블록이
    // 손에 들어왔다 — 다른 2단계(모치 20·아쿠사 22)는 전부 그 상한 위에 있는데
    // 이 라인만 아래에 있었던 것이다. 시뮬 40판에서 파티가 버블록 셋으로 굳었고,
    // 25층이 볼트크래시를 든 전기 관문이라(전기 → 물 2배) 그 층 패배율이 97% 가 됐다.
    // 상한 위로 올려 다른 라인과 같은 줄에 세운다.
    evolvesAtLevel: 22,
  },
  {
    id: "bublock",
    name: "버블록",
    // ⚠️ 이 라인은 진화하면서 속성이 물 → 독으로 바뀐다. 게임에서 유일하다.
    //
    // 원화가 그렇다. 버블릿은 거품 벌레지만 버블록·버블돈은 모래에 파묻힌 바위
    // 갑주 벌레고, 학습표도 1단계부터 독이 절반이다(독가시·독안개·독찌르기·맹독니).
    // 도감 설명도 "땅속 광물을 갉아 먹어 독성이 독해졌다" 로 그 변화를 적고 있었다.
    //
    // 숫자로도 여기가 맞다. 물로 두면 25층 전기 관문(볼트크래시)에서 2배로 맞는데,
    // 이 라인이 파티에 잘 들어오는 값이라 40판 중 실패가 전부 그 층에 몰렸다.
    // 독은 얼음에만 2배로 맞으므로 관문 앞에서 혼자 무너지지 않는다.
    type: "poison",
    // 껍질에 바위 판이 돋은 모습 그대로 방어로 간다. 총합 332 는 같은 2단계 중
    // 제일 낮은데, 대신 확정 독(독가시)을 Lv14 에 이미 들고 온다. 이 라인의 값은
    // 능력치가 아니라 상대를 계속 깎는 쪽에 있다.
    maxHp: 195,
    attack: 55,
    defense: 52,
    speed: 30,
    moves: [tackle, poisonSting, bubbleCannon, poisonJab],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 82,
    evolutionStage: 2,
    evolutionChainId: "bubblet",
    evolvesFrom: "bubblet",
    evolvesTo: "bubldon",
    evolvesAtLevel: 38,
  },
  {
    id: "bubldon",
    name: "버블돈",
    type: "poison",   // 버블록에서 이어진다. 위 주석 참고
    // 세 최종체 중 유일한 요새형. 방어 88 은 게임 전체에서 제일 높고(오름 70 보다도
    // 위다) 속도 55 는 제일 낮다. 총합은 셋 다 477 로 같아서, 차이는 전부 배분에 있다.
    maxHp: 250,
    attack: 84,
    defense: 88,
    speed: 55,
    moves: [waterGun, poisonJab, venomFang, surf],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 142,
    evolutionStage: 3,
    evolutionChainId: "bubblet",
    evolvesFrom: "bublock",
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
  {
    id: "gemto",
    name: "젬토",
    type: "ice",
    // 수정 띠를 두른 새끼 거북. 3단계까지 가는 라인이라 시작은 낮게 잡는다(총합 193 —
    // 버블릿 183 다음으로 낮다). 프리로(206)와 같은 방벽형이지만 저쪽은 완성형이고
    // 이쪽은 자라는 중이라, 같은 얼음이어도 지금 쓸 것과 키울 것으로 갈린다.
    maxHp: 112,
    attack: 26,
    defense: 33,
    speed: 22,
    moves: [tackle, frostBreath, iceShard],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 44,
    evolutionStage: 1,
    evolutionChainId: "gem",
    evolvesTo: "gemguard",
    // 2단계는 전부 깊은 숲의 레벨 상한(18) 위에 선다 — 모시 20 · 아쿠비 22 ·
    // 버블릿 22 · 버노 24 · 젬토 20. 상한 아래로 내려오면 그 라인만 "잡자마자
    // 2단계"가 되어 파티를 혼자 채운다(버블릿 16 이 그랬다).
    evolvesAtLevel: 20,
  },
  {
    id: "gemguard",
    name: "젬가드",
    type: "ice",
    // 등껍질이 수정 가시로 솟은 단계. 방어 64 는 2단계 넷 중 가장 높다(아쿠사 45,
    // 모치 44, 버블록 52). 총합 335 는 나머지와 같으므로 그만큼 속도를 버렸다.
    maxHp: 195,
    attack: 54,
    defense: 64,
    speed: 22,
    moves: [tackle, frostBreath, icePunch, iceBeam],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 86,
    evolutionStage: 2,
    evolutionChainId: "gem",
    evolvesFrom: "gemto",
    evolvesTo: "gemlord",
    evolvesAtLevel: 38,
  },
  {
    id: "gemlord",
    name: "젬로드",
    type: "ice",
    // 네 번째 최종체. 방어 96·속도 33 으로 버블돈보다 한 걸음 더 요새 쪽이고,
    // 얼음은 약점이 불 하나뿐이라 불 파티가 아니면 뚫는 데 시간이 걸린다.
    // 대신 속도가 제일 낮아 선공을 거의 못 잡는다 — 벽은 벽까지만 한다.
    maxHp: 270,
    attack: 78,
    defense: 96,
    speed: 33,
    moves: [frostBreath, iceBeam, crystalLance, blizzard],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 145,
    evolutionStage: 3,
    evolutionChainId: "gem",
    evolvesFrom: "gemguard",
  },
  {
    id: "bingrok",
    name: "빙록",
    type: "ice",
    // 얼음 셋이 전부 느렸다(크리샤 26·프리로 12·젬토 14). 수정 뿔 사슴은 이 속성에서
    // 유일하게 먼저 움직이는 쪽으로 둔다 — 속도 34 는 공격과 같은 값이다(총합 200).
    maxHp: 108,
    attack: 34,
    defense: 24,
    speed: 34,
    moves: [quickAttack, frostBreath, iceBeam],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 47,
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
  {
    id: "sporemus",
    name: "포자무스",
    // ⚠️ 풀이다. 독이 아니다.
    //
    // 이 게임의 풀은 리피 한 종뿐이었고 그게 전체에서 제일 약했다(power 105).
    // 그런데 상성표에서 풀은 전기와 물을 둘 다 2배로 때리는 유일한 속성이고,
    // 25층 관문이 전기(모치)·45층 관문이 물(아쿠사)이다. 답이 한 종밖에 없는데
    // 그 한 종이 파티에 못 드는 상태였다.
    //
    // 여기에 신규 11종을 넣으면서 풀만 하나도 안 늘리자 그 구멍이 그대로 벌어졌다 —
    // 40판에서 25층 패배율이 90%(기준선) → 97% 로, 45층이 62% → 93% 로 올랐다.
    // 버섯·포자는 이 장르에서 원래 풀이고 학습표도 이미 잎바람·포자구름·씨앗폭탄을
    // 들고 있었다. 속성만 제자리로 돌린다.
    //
    // 풀은 약점이 셋(불·얼음·독)이라 제일 무른 속성이다. 그래서 총합 206 을 리피(188)
    // 보다 높게 주고 방어에 실었다 — 맞고도 한 번은 서 있어야 관문에서 쓸 수 있다.
    type: "grass",
    maxHp: 124,
    attack: 28,
    defense: 30,
    speed: 24,
    moves: [tackle, poisonSting, poisonFog],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 50,
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
  {
    id: "bunggom",
    name: "붕곰",
    type: "normal",
    // 노말이 노비 하나뿐이라 이 속성엔 고를 것이 없었다. 노비가 여러 속성을 얕게 쓰는
    // 만능형이라면 붕곰은 정면으로 치고받는 쪽이다 — 총합 208 로 같고 공격이 8 높다.
    // 노말은 독에 2배로 맞으므로(typeChart) 방어를 올려도 독 앞에서는 여전히 약하다.
    maxHp: 120,
    attack: 34,
    defense: 32,
    speed: 22,
    moves: [tackle, quickAttack, headbutt],
    level: 1, exp: 0, expToNextLevel: 100,
    rewardExp: 45,
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

// ─── 도감 ────────────────────────────────────────────────────────────────────────
//
// 오름(최종 보스)은 포획 대상이 아니라 도감의 분모에서도 분자에서도 뺀다. 그 규칙이
// 화면마다 흩어져 있으면 같은 세이브를 보고 「내 몬스터」는 14/14, 관리 화면은 14/15 라고
// 적는다 — 실제로 그랬다. 세는 곳은 여기 하나다.

/** 도감에 안 오르는 몬스터. 잡을 수 없는 것들이다 */
export const NOT_IN_DEX: readonly string[] = ["ormr"];

/** 도감 분모 */
export const DEX_TOTAL = monsters.filter((m) => !NOT_IN_DEX.includes(m.id)).length;

/** 세이브의 dexSeen·dexCaught 를 도감 기준으로 센다 */
export function dexCount(ids: readonly string[]): number {
  return ids.filter((id) => !NOT_IN_DEX.includes(id)).length;
}
