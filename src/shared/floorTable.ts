import type { Monster, Move } from "./game";
import { monsters } from "../monster/monsters";
import { expToNext } from "../battle/battleUtils";
import {
  ember, tackle, vineWhip, waterGun, thunderbolt, toxic, iceLeaf, spark,
  iceBeam, blizzard, bodySlam, flamethrower, surf,
  voltCrash, crystalBurst, aquaWhirl,
  quickAttack, icePunch, tidalCrash, solarBeam, overheat, thunderStrike,
  hydroPump, venomStorm, gigaImpact,
  // 26~49층 고정 구성이 쓰는 것들. 전부 그 종 학습표에 실제로 있는 기술이어야 한다.
  // 없는 걸 주면 isAnomalyMove 가 "쓸 수 있는 기술이 아니다"를 띄우는데,
  // 그건 n0층 보스한테만 허락된 연출이다.
  twister, headbutt, heavyBlow, hyperBeam,
  firePunch, cinderToss, flameSlash,
  waterPulse,
  zap, boltStrike, thunder,
  leafBlade, sporeCloud, seedBomb, rootSpear,
  frostMist, crystalLance, sheerCold,
  poisonSting, acidSpray, poisonFog, poisonJab, venomFang,
} from "../monster/moves";

// ─── 오름(Ormr) 전용 기술 풀 ──────────────────────────────────────────────────────

/** 오름이 보유한 7개 타입 대표 최상급 기술 (매 전투 이 중 4개만 사용) */
const ORMR_MOVE_POOL: Move[] = [
  overheat, hydroPump, thunderStrike, solarBeam, blizzard, venomStorm, gigaImpact,
];

/** 7개 중 4개를 무작위 추출 (7C4 = 35가지 조합 전체가 나올 수 있도록 균등 셔플 후 4개 슬라이스) */
function pickOrmrMoves(): Move[] {
  const pool = [...ORMR_MOVE_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 4);
}

// ─── 층별 고정 구성 (n0층 보스와 50층 제외한 전 층) ────────────────────────────────

interface FloorFixedConfig {
  monsterId: string;
  moves: Move[];
  skillOrder: string[];
}

const FLOOR_FIXED: Record<number, FloorFixedConfig> = {
  1: {
    monsterId: "aquabe",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "tackle", "water-gun"],
  },
  2: {
    monsterId: "leafy",
    moves: [tackle, vineWhip],
    skillOrder: ["vine-whip", "tackle", "vine-whip", "vine-whip"],
  },
  3: {
    monsterId: "bubblet",
    moves: [tackle, waterGun],
    skillOrder: ["tackle", "water-gun", "water-gun", "tackle"],
  },
  4: {
    monsterId: "mossy",
    moves: [tackle, spark],
    skillOrder: ["spark", "tackle", "spark", "spark"],
  },
  5: {
    monsterId: "burno",
    moves: [tackle, ember],
    skillOrder: ["tackle", "ember", "ember", "tackle"],
  },
  // 원래 독가시(toxic)를 들고 있었는데 아쿠비는 그 기술을 어느 레벨에도 안 배운다.
  // 그러면 도감에 아쿠비가 있는 사람한테 6층에서 "쓸 수 있는 기술이 아니다"가 뜬다.
  // n0층 보스가 탑의 비밀을 흘리는 연출이 평범한 층에서 새는 셈이다.
  // 산성분사는 아쿠비의 정식 교차 기술이고 위력도 물총과 같아서, 독을 흘린다는
  // 성격만 남고 숫자는 거의 안 움직인다. 확정 독은 두 층 뒤 버블릿이 맡는다.
  6: {
    monsterId: "aquabe",
    moves: [tackle, waterGun, acidSpray],
    skillOrder: ["water-gun", "water-gun", "acid-spray", "water-gun"],
  },
  7: {
    monsterId: "leafy",
    moves: [tackle, vineWhip, iceLeaf],
    skillOrder: ["vine-whip", "ice-leaf", "vine-whip", "tackle"],
  },
  8: {
    monsterId: "bubblet",
    moves: [tackle, waterGun, toxic],
    skillOrder: ["water-gun", "toxic", "water-gun", "water-gun"],
  },
  9: {
    // 전격탄도 같은 이유로 뺐다(버노는 전기를 spark·boltStrike 로만 배운다).
    // 화염권은 Lv11 정식 기술이고 자속이라, 위력 55 로도 옛 전격탄 60 만큼 들어간다.
    monsterId: "burno",
    moves: [tackle, ember, firePunch],
    skillOrder: ["ember", "ember", "fire-punch", "ember"],
  },
  // 10층은 보스: getFloorEnemy에서 처리
  11: {
    monsterId: "mossy",
    moves: [tackle, spark, thunderbolt],
    skillOrder: ["spark", "tackle", "thunderbolt", "spark"],
  },
  // ── 11~25층에 노비(노말)와 독 두 종을 들였다 ──────────────────────────────
  // 이 구간에 서던 종이 아홉뿐이라 물·풀·전기·불·얼음만 돌았다. 노비는 어느 티어
  // 풀에도 없어서 탑 전체에서 한 번도 안 나왔고, 베노까·톡사룡도 이 구간이 전부
  // 고정 구성이라 닿지 못했다. 이 구간의 노말·독 방이 통째로 잠들어 있었던 거고,
  // 새로 넣은 상성(독 → 노말 2배)도 쓸 자리가 없는 규칙이었다.
  //
  // 1~10층은 안 건드린다. 첫 보스까지의 곡선은 이미 재 놓은 값이라, 거기에 탱커랑
  // 지속 피해를 넣으면 시작 30분 체감이 바로 느려진다. z01 의 노말·독 방 두 개는
  // 안 쓰는 채로 남겨 둔다. 파일은 그대로 있으니 나중에 열면 된다.
  12: {
    monsterId: "nobi",
    moves: [tackle, twister, headbutt],
    skillOrder: ["headbutt", "twister", "headbutt", "tackle"],
  },
  13: {
    monsterId: "leafy",
    moves: [tackle, vineWhip, iceLeaf],
    skillOrder: ["tackle", "vine-whip", "ice-leaf", "vine-whip"],
  },
  14: {
    // 원래 아쿠사(22레벨 진화체)가 서 있던 자리다. 플레이어는 아직 진화 전인데 상대만
    // 최종 진화체라 14층만 난이도가 튀었다. 옛 시뮬에서도 이 층 패배율이 45% 로
    // 20층 보스랑 비슷했고. 미진화체로 내렸고 지금은 여기가 이 구간의 불이다
    // (11~20 에 불이 한 층도 없어서 z11 의 불 방이 잠겨 있었다).
    monsterId: "burno",
    moves: [tackle, ember, firePunch],
    skillOrder: ["fire-punch", "ember", "fire-punch", "tackle"],
  },
  15: {
    monsterId: "frostorb",
    moves: [tackle, iceBeam, blizzard],
    skillOrder: ["ice-beam", "blizzard", "ice-beam", "tackle"],
  },
  // 11·16·19 가 전부 전기였다. 넷 중 둘을 덜어내면 이 구간에서 전기는 11층과
  // 20층 보스 둘로 줄고, 20층 보스의 전기가 다시 특별해진다.
  16: {
    monsterId: "nobi",
    moves: [tackle, headbutt, twister, poisonSting],
    skillOrder: ["headbutt", "poison-sting", "twister", "headbutt"],
  },
  // 확정 독(독가시)을 든 첫 층. 10층 보스의 답이 해독제였는데 그 뒤로 쓸 자리가
  // 없었다. 여기서 한 번 더 필요해진다.
  17: {
    monsterId: "venomcrow",
    moves: [acidSpray, poisonSting, toxic, quickAttack],
    skillOrder: ["acid-spray", "toxic", "acid-spray", "poison-sting"],
  },
  18: {
    monsterId: "aquavern",
    moves: [tackle, aquaWhirl, surf],
    skillOrder: ["surf", "aqua-whirl", "surf", "tackle"],
  },
  // ⚠️ 여기는 진화체 자리다. 한 번 버노로 내렸더니 맨몸 등반이 20층 보스를 넘어
  // 30층까지 갔다(e2e/balanceRun). 이 구간 난이도는 진화체가 몇 층에 서 있는가로
  // 정해진다. 18(아쿠사)·19(모치)·23(아쿠사) 셋이고, 하나만 내려도 벽이 무너진다.
  19: {
    monsterId: "mossevo",
    moves: [tackle, spark, thunderbolt],
    skillOrder: ["thunderbolt", "spark", "thunderbolt", "tackle"],
  },
  // 20층은 보스: getFloorEnemy에서 처리
  21: {
    monsterId: "burno",
    moves: [tackle, ember, flamethrower],
    skillOrder: ["flamethrower", "ember", "flamethrower", "tackle"],
  },
  22: {
    monsterId: "nobi",
    moves: [tackle, headbutt, bodySlam, twister],
    skillOrder: ["headbutt", "body-slam", "twister", "headbutt"],
  },
  // 23·25 가 둘 다 모치였다. 25층 관문이 「관문의 모치」인데 바로 앞 층에 같은 종을
  // 세우면 관문이 그냥 좀 더 센 23층이 된다. 종만 바꾸고 진화체인 건 유지한다.
  // 아쿠사는 총합이 모치랑 거의 같아서(336 대 343) 이 자리의 무게가 안 바뀐다.
  23: {
    monsterId: "aquavern",
    moves: [tackle, aquaWhirl, surf, icePunch],
    skillOrder: ["surf", "aqua-whirl", "ice-punch", "surf"],
  },
  24: {
    monsterId: "toxadon",
    moves: [poisonJab, headbutt, toxic, poisonSting],
    skillOrder: ["poison-jab", "headbutt", "toxic", "poison-jab"],
  },
  25: {
    monsterId: "mossevo",
    moves: [tackle, thunderbolt, voltCrash],
    skillOrder: ["volt-crash", "thunderbolt", "tackle", "volt-crash"],
  },

  // ─── 26~49층 ───────────────────────────────────────────────────────────────
  // 여기부터는 원래 티어 풀 랜덤이었다. 31~39층은 네 종이 아홉 층을 돌았고, 45층
  // 관문은 뽑기에 따라 「관문의 플레미」가 되기도 했다.
  //
  // 배정 규칙 셋:
  //  ① 구간마다 7속성을 한 번씩 채운다. 배경이 towerBattleBg(구간, 적 속성)이라
  //     층의 속성을 정하는 게 곧 방을 고르는 것이다. 랜덤일 때는 어떤 방이 거의
  //     안 나왔다.
  //  ② 기술은 그 종 학습표에서, 그 층 레벨까지 배우는 것만. 층 레벨 = 층수라
  //     "그 레벨의 야생 개체"로 읽힌다. 학습표 밖 기술은 이상 기술 연출을 켜 버린다.
  //  ③ skillOrder 의 id 는 moves 에 전부 있어야 한다. 하나라도 빠지면
  //     getFloorEnemySkill 이 통째로 null 을 주고 AI 로 넘어간다(19층 사고와 같은 길).
  //
  // 관문 35·45층에도 구성을 둔다. getFloorEnemy 가 「관문의 {그 층 적}」 을 만드니까
  // 이름이 고정된다. 「관문의 톡사룡」·「관문의 아쿠사」.

  // ── z21 구간(21~30)의 나머지. 21 불 · 22 물 · 23 노말 · 24 독 · 25 전기 뒤라
  //    여기서 풀이랑 얼음을 채우면 이 구간 방 일곱이 다 열린다.
  26: {
    monsterId: "leafy",
    moves: [vineWhip, leafBlade, seedBomb, sporeCloud],
    skillOrder: ["seed-bomb", "leaf-blade", "spore-cloud", "seed-bomb"],
  },
  27: {
    monsterId: "crystafox",
    moves: [icePunch, iceBeam, crystalBurst, frostMist],
    skillOrder: ["crystal-burst", "ice-beam", "frost-mist", "ice-punch"],
  },
  28: {
    monsterId: "venomcrow",
    moves: [acidSpray, twister, poisonFog, toxic],
    skillOrder: ["poison-fog", "twister", "acid-spray", "poison-fog"],
  },
  // 30층 보스(고대의 프리로) 직전. 때리는 힘보다 버티는 힘이 앞서는 층이라,
  // 물약을 얼마나 남기고 들어갈지를 여기서 정하게 된다.
  29: {
    monsterId: "nobi",
    moves: [headbutt, bodySlam, leafBlade, twister],
    skillOrder: ["body-slam", "leaf-blade", "body-slam", "headbutt"],
  },

  // ── z31 구간(31~40). 31 불 · 32 물 · 33 노말 · 34 얼음 · 35 독 · 36 전기 · 39 풀
  31: {
    monsterId: "burno",
    moves: [firePunch, flameSlash, spark, cinderToss],
    skillOrder: ["flame-slash", "fire-punch", "spark", "flame-slash"],
  },
  32: {
    monsterId: "aquavern",
    moves: [surf, aquaWhirl, icePunch, waterPulse],
    skillOrder: ["surf", "aqua-whirl", "ice-punch", "surf"],
  },
  33: {
    monsterId: "nobi",
    moves: [heavyBlow, bodySlam, leafBlade, headbutt],
    skillOrder: ["heavy-blow", "body-slam", "leaf-blade", "heavy-blow"],
  },
  34: {
    monsterId: "frostorb",
    moves: [crystalBurst, iceBeam, bodySlam, frostMist],
    skillOrder: ["crystal-burst", "body-slam", "ice-beam", "frost-mist"],
  },
  // 관문의 톡사룡. 확정 독(toxic)을 들고 있어 해독제 없이 오래 끌면 그대로 녹는다
  35: {
    monsterId: "toxadon",
    moves: [venomFang, poisonJab, bodySlam, toxic],
    skillOrder: ["venom-fang", "body-slam", "poison-jab", "toxic"],
  },
  36: {
    monsterId: "mossevo",
    moves: [voltCrash, thunderbolt, zap, headbutt],
    skillOrder: ["volt-crash", "thunderbolt", "zap", "volt-crash"],
  },
  37: {
    monsterId: "crystafox",
    moves: [crystalLance, crystalBurst, waterPulse, iceBeam],
    skillOrder: ["crystal-lance", "crystal-burst", "water-pulse", "crystal-lance"],
  },
  38: {
    monsterId: "venomcrow",
    moves: [venomFang, poisonJab, poisonFog, twister],
    skillOrder: ["venom-fang", "poison-fog", "poison-jab", "venom-fang"],
  },
  // 40층 보스는 전설의 모왕(전기)이다. 그 앞 층을 풀로 둔 건 일부러 그런 건데,
  // 풀이 전기를 2배로 찌른다는 걸 보스 만나기 전에 한 번 보게 된다.
  39: {
    monsterId: "leafy",
    moves: [rootSpear, seedBomb, poisonJab, iceLeaf],
    skillOrder: ["root-spear", "seed-bomb", "ice-leaf", "root-spear"],
  },

  // ── z41 구간(41~49). 41 불 · 42 노말 · 43 풀 · 44 얼음 · 45 물 · 46 독 · 47 전기
  41: {
    monsterId: "burno",
    moves: [flamethrower, flameSlash, boltStrike, firePunch],
    skillOrder: ["flamethrower", "flame-slash", "bolt-strike", "flamethrower"],
  },
  42: {
    monsterId: "nobi",
    moves: [hyperBeam, heavyBlow, icePunch, bodySlam],
    skillOrder: ["heavy-blow", "ice-punch", "hyper-beam", "body-slam"],
  },
  43: {
    monsterId: "leafy",
    moves: [solarBeam, rootSpear, poisonJab, seedBomb],
    skillOrder: ["solar-beam", "root-spear", "poison-jab", "solar-beam"],
  },
  44: {
    monsterId: "crystafox",
    moves: [blizzard, crystalLance, crystalBurst, waterPulse],
    skillOrder: ["blizzard", "crystal-lance", "water-pulse", "blizzard"],
  },
  // 관문의 아쿠사. 물리·특수를 겸하는 만능 진화체라 한쪽만 막아서는 안 넘어간다
  45: {
    monsterId: "aquavern",
    moves: [crystalLance, surf, bodySlam, aquaWhirl],
    skillOrder: ["crystal-lance", "surf", "body-slam", "aqua-whirl"],
  },
  46: {
    monsterId: "toxadon",
    moves: [venomFang, poisonFog, bodySlam, poisonJab],
    skillOrder: ["venom-fang", "poison-fog", "body-slam", "venom-fang"],
  },
  47: {
    monsterId: "mossevo",
    moves: [thunder, voltCrash, bodySlam, thunderbolt],
    skillOrder: ["volt-crash", "thunder", "body-slam", "volt-crash"],
  },
  48: {
    monsterId: "venomcrow",
    moves: [venomStorm, venomFang, poisonFog, toxic],
    skillOrder: ["venom-storm", "venom-fang", "poison-fog", "venom-storm"],
  },
  // 정상 바로 아래는 벽이다. 프리로는 이 게임에서 제일 단단한 종이고 Lv49 에
  // 절대영도를 배운다. 이 층에서만 나오는 기술이다.
  //
  // 여기 모왕을 세웠다가 물렸다. 후반 파티는 거의 항상 모왕을 선봉에 세우는데,
  // getFloorEnemy 는 거울 싸움을 피하려고 같은 종이면 풀에서 다시 뽑는다. 그래서
  // 실제로는 이 층 구성이 거의 안 나왔다. 플레이어가 흔히 데려가는 종은 고정
  // 구성에 두지 마라.
  49: {
    monsterId: "frostorb",
    moves: [sheerCold, blizzard, crystalLance, bodySlam],
    skillOrder: ["sheer-cold", "blizzard", "crystal-lance", "body-slam"],
  },
};

// ─── 층 티어별 랜덤 풀 ──────────────────────────────────────────────────────────────

const POOL_TIER_1  = ["flameling", "aquabe", "leafy", "venomcrow"];
const POOL_TIER_2  = ["burno", "bubblet", "mossy", "crystafox", "toxadon"];
const POOL_TIER_3  = ["mossevo", "frostorb", "aquavern"];
const POOL_TIER_4  = ["mossyfinal", "mossevo", "frostorb", "aquavern"];
const POOL_ALL     = [...POOL_TIER_1, ...POOL_TIER_2, ...POOL_TIER_3, ...POOL_TIER_4];

function getPool(floor: number): string[] {
  if (floor <= 13) return POOL_TIER_1;
  if (floor <= 19) return POOL_TIER_2;
  if (floor <= 29) return [...POOL_TIER_2, ...POOL_TIER_3];
  if (floor <= 39) return [...POOL_TIER_3, ...POOL_TIER_4];
  return POOL_ALL;
}

// ─── 스탯 레벨 스케일 ────────────────────────────────────────────────────────────

export function scaleToLevel(base: Monster, targetLevel: number): Monster {
  if (targetLevel <= 1) return { ...base };
  const n = targetLevel - 1;
  return {
    ...base,
    level: targetLevel,
    maxHp: base.maxHp + n * 10,
    attack: base.attack + n * 3,
    defense: base.defense + n * 2,
    speed: base.speed + n * 2,
    // 계수 0.30 → 0.15. 0.30 은 레벨차 컷오프가 없던 시절 값이다. 그땐 층이 올라도
    // 레벨이 안 따라와서 보상을 키워야 했는데, 지금은 반대로 한 판이 10레벨을 준다
    // (40층 모왕 보상 1778 vs Lv50 요구 683). 컷오프가 갈이를 막으니 보상은 층을
    // 따라 붙기만 하면 된다.
    rewardExp: Math.floor(base.rewardExp * (1 + n * 0.15)),
    // 요구 경험치는 레벨 하나로 정해진다(battleUtils.expToNext). 여기서 따로 굴리면
    // 잡은 몬스터만 다른 곡선을 탄다. 실제로 Lv40 짜리가 122,480 을 요구했었다.
    expToNextLevel: expToNext(targetLevel),
    exp: 0,
  };
}

// ─── 층의 성격 ───────────────────────────────────────────────────────────────────

/**
 * 이름 있는 보스가 서는 층. 10층마다 하나씩이고 이야기가 붙어 있다
 * (분노한 모시 · 격노한 모치 · 고대의 프리로 · 전설의 모왕 · 오름).
 *
 * ⚠️ 이 플래그는 난이도만 뜻하는 게 아니다. 도망 금지, 보스 드랍, 배경 연출이 전부
 * 여기 물려 있다. 중간 관문을 여기 끼우면 도망까지 막히니까 그건 따로 둔다.
 */
export function isBossFloor(floor: number): boolean {
  return floor % 10 === 0;
}

/**
 * 중간 관문. 5층마다 걸리는데 n0층은 보스가 맡으니 그 사이(15·25·35·45)만 관문이다.
 *
 * 보스가 "장비 없으면 못 넘는 벽"이면 관문은 "장비 없으면 아픈 검문"이다. 5층마다
 * 벽돌담을 세우면 진행이 여덟 번 끊긴다. 대부분은 물약이랑 정비로 넘고, 제작대까지
 * 돌아가야 하는 건 n0층뿐이어야 한다.
 *
 * 도망은 열어 둔다(isBossFloor 가 아니다). 드랍은 보스급으로 준다(dropTables).
 */
export const GATE_FLOORS = [15, 25, 35, 45] as const;

export function isGateFloor(floor: number): boolean {
  return (GATE_FLOORS as readonly number[]).includes(floor);
}

/**
 * 관문 배수. 층마다 다르다.
 *
 * 하나로 통일해 봤더니 층마다 체감이 딴판이었다. 파티 화력 곡선이 균일하지 않아서다.
 * 45층 파티(모왕 Lv45, 위력 95)는 25층 파티(모치)보다 훨씬 세게 때린다. 같은 배수를
 * 걸면 25층도 맨몸 100%, 45층도 맨몸 100% 인데 무너지는 이유가 서로 다르다.
 * 배수는 파티가 그 층에서 실제로 내는 화력에 맞춰야 한다.
 *
 * 값은 scripts/sim/gateCheck.ts 로 맞췄다(2026-09-02 · 맨몸 ≤60% · 실측 60~88% ·
 * 한 발 앞선 ≥85% · 완비 ≥95%). 그 도구가 실제 판을 표본으로 쓰므로, 여기를
 * 만졌으면 반드시 다시 돌려야 한다 — 한 층을 올리면 그 앞에서 더 파밍하게 되어
 * 뒷층의 입력이 통째로 바뀐다.
 */
const GATE_MULT_BY_FLOOR: Record<number, { hp: number; attack: number; defense: number }> = {
  15: { hp: 1.34, attack: 1.10, defense: 1.36 },
  25: { hp: 3.10, attack: 2.30, defense: 3.10 },
  35: { hp: 1.98, attack: 1.48, defense: 2.00 },
  45: { hp: 2.20, attack: 1.72, defense: 2.20 },
};

export function gateMultiplier(floor: number) {
  return GATE_MULT_BY_FLOOR[floor] ?? { hp: 1.5, attack: 1.25, defense: 1.65 };
}

/**
 * 26층부터 일반 층에 붙는 배수.
 *
 * 원래 26층 위가 랜덤 풀뿐이라 무장비에 자연 레벨로도 승률 100% / 6턴이었다.
 * 지금은 층마다 구성이 있지만 이 배수는 그대로 둔다. 구성이 정해 주는 건 "무엇과
 * 싸우는가"고, 층이 오를수록 무거워지는 건 여전히 여기서만 나오니까.
 * 1.4 는 넘기지 마라. 그 위는 소모가 아니라 벽이다(43층 실측: ×1.5 에서 무장비 승률 85%).
 *
 * ⚠️ 적용은 `applyCorridor` 한 곳에서만. 고정 구성 갈래랑 랜덤 갈래 둘 다 그걸
 * 부른다. 한쪽만 부르면 그 갈래 층들이 소리 없이 약해진다.
 */
export function corridorMultiplier(floor: number): number {
  if (floor >= 41) return 1.40;
  if (floor >= 31) return 1.28;
  if (floor >= 26) return 1.15;
  return 1;
}

/** 보스든 관문이든 "각오하고 들어가는 층". 물약을 아끼지 않는 자리다 */
export function isHardFloor(floor: number): boolean {
  return isBossFloor(floor) || isGateFloor(floor);
}

// ─── 탑 최상층 ───────────────────────────────────────────────────────────────────

/** 무한의 탑 최상층. 50층 오름(Ormr)이 끝이고 51층 위는 없다 */
export const MAX_TOWER_FLOOR = 50;

// ─── 층 → 배경 구간 ──────────────────────────────────────────────────────────────

/**
 * 전투 배경이 바뀌는 구간. 파일 이름의 접두사이기도 하다.
 * z50 만 한 층짜리인데, 탑 정상은 올라가는 길의 연장이 아니라 도착한 자리라서다.
 */
export type TowerZone = "z01" | "z11" | "z21" | "z31" | "z41" | "z50";

/**
 * 10층마다 방이 바뀌고 50층만 자기 방을 따로 쓴다. 매핑은 여기 한 곳뿐이니
 * 씬이나 경로 헬퍼에 다시 적지 마라.
 * 범위 밖(0 이하·51 이상)은 양 끝으로 접는다. 층이 라우트 state 로 들어와서
 * 이론상 아무 숫자나 올 수 있는데, 배경이 없느니 첫 방이 나오는 게 낫다.
 */
export function getTowerZone(floor: number): TowerZone {
  if (floor <= 10) return "z01";
  if (floor <= 20) return "z11";
  if (floor <= 30) return "z21";
  if (floor <= 40) return "z31";
  if (floor < MAX_TOWER_FLOOR) return "z41";
  return "z50";
}

// ─── 탑의 비밀: 스토리 보스 전용 이상 기술 연출 ───────────────────────────────────
/**
 * 10/20/30/40층 보스(분노한 모시·격노한 모치·고대의 프리로·전설의 모왕)는
 * 자기 종족 학습표에 없는 기술을 한둘 섞어 쓴다. 정식으로 배운 게 아니라 탑 정상에
 * 잠든 존재(오름)의 기운을 받아 억지로 쓰는 거라는 설정이다.
 * 그 기술을 전투 중에 처음 쓰는 순간, 층이 오를수록 탑의 비밀에 가까워지는 대사를
 * 띄운다. moveIds 는 그 종족 LEARNSET 에 없어야 한다. 있으면 "이상 기술"이 아니라
 * 이 연출 자체가 성립하지 않는다.
 */
export interface TowerSecretReveal {
  moveIds: string[];
  lines: string[];
}

export const TOWER_SECRET_REVEALS: Record<number, TowerSecretReveal> = {
  10: {
    moveIds: ["ice-punch"],
    lines: [
      "…어? 방금 그건 모시가 원래 쓸 수 없는 기술이었는데.",
      "기분 탓일까. 왠지 이 탑에서 뭔가 이상한 일이 벌어지고 있는 것 같다.",
    ],
  },
  20: {
    moveIds: ["flamethrower"],
    lines: [
      "이번엔 불꽃이라니… 모치는 분명 전기 늑대일 텐데.",
      "층을 오를수록 몬스터들이 원래 없던 힘을 쓰고 있다. 단순한 우연은 아닌 것 같다.",
    ],
  },
  30: {
    moveIds: ["tidal-crash", "solar-beam"],
    lines: [
      "물의 힘이든 태양의 힘이든, 원래 프리로의 것이 아니다.",
      "탑 깊은 곳에서 흘러나오는 기운이 몬스터들에게 낯선 힘을 나눠주고 있는 것 같다.",
    ],
  },
  40: {
    moveIds: ["overheat", "blizzard"],
    lines: [
      "이 압도적인 힘… 모왕 혼자만의 것이라고는 믿기지 않는다.",
      "탑의 정상에 잠들어 있는 무언가. 그 기운이 탑 전체의 몬스터들에게까지 미치고 있는 것이다.",
    ],
  },
};

/** 해당 층·기술 조합이 탑의 비밀 연출 대상이면 그 대사 묶음을 반환 */
export function getTowerSecretReveal(floor: number, moveId: string): TowerSecretReveal | null {
  const reveal = TOWER_SECRET_REVEALS[floor];
  if (!reveal || !reveal.moveIds.includes(moveId)) return null;
  return reveal;
}

// ─── 층별 적 생성 ────────────────────────────────────────────────────────────────

export function getFloorEnemy(floor: number, excludeId?: string): Monster {
  const enemy = buildFloorEnemy(floor, excludeId);
  // 관문은 그 층이 원래 내놓는 적을 그대로 두고 무겁게만 만든다. 15·25층은 손으로 짠
  // 구성이 있는 층이라(프리로·모치) 여기서 종족을 갈아치우면 그 설계가 날아간다.
  if (!isGateFloor(floor)) return enemy;
  // ⚠️ scaleToLevel 을 다시 부르면 안 된다. 이미 층 레벨로 부푼 값을 종족 기본값으로 알고
  //    한 번 더 올린다. 35층 관문 HP 가 1505 로 40층 보스(1007)를 넘었던 게 그 실수였다.
  const lifted = liftLevels(enemy, 2);
  const mult = gateMultiplier(floor);
  return {
    ...lifted,
    name: `관문의 ${enemy.name}`,
    maxHp: Math.floor(lifted.maxHp * mult.hp),
    attack: Math.floor(lifted.attack * mult.attack),
    defense: Math.floor(lifted.defense * mult.defense),
    rewardExp: Math.floor(lifted.rewardExp * 2),
  };
}

/** 이미 만들어진 적에게 레벨 n 만큼의 성장분만 더한다 (레벨당 HP+10/공+3/방+2/속+2) */
function liftLevels(m: Monster, n: number): Monster {
  return {
    ...m,
    level: m.level + n,
    maxHp: m.maxHp + n * 10,
    attack: m.attack + n * 3,
    defense: m.defense + n * 2,
    speed: m.speed + n * 2,
    expToNextLevel: expToNext(m.level + n),
  };
}

/**
 * 26층부터 일반 층에 붙는 구간 배수를 먹인다.
 *
 * ⚠️ 고정 구성 갈래랑 랜덤 갈래 양쪽에서 불러야 한다. buildFloorEnemy 는 고정 구성이
 * 있으면 거기서 바로 돌려주는데, 원래 이 배수가 랜덤 갈래에만 붙어 있었다. 그 상태로
 * 26~49층에 고정 구성을 채우면 스물두 층이 한꺼번에 15~40% 약해진다. 에러도 안 나고
 * 시뮬을 돌려야만 보인다.
 *
 * 올라가는 건 패배율이 아니라 소모율이다. 층이 길어져서 물약이랑 HP 가 닳는다.
 */
function applyCorridor(m: Monster, floor: number): Monster {
  const zone = corridorMultiplier(floor);
  if (zone <= 1) return m;
  return {
    ...m,
    maxHp: Math.floor(m.maxHp * zone),
    // 방어는 조금 더, 공격은 조금만. 공격을 같이 올리면 소모가 아니라 사고가 된다
    defense: Math.floor(m.defense * (1 + (zone - 1) * 1.15)),
    attack: Math.floor(m.attack * (1 + (zone - 1) * 0.4)),
  };
}

/**
 * 이름 있는 보스의 능력치 배수. 여기 한 벌뿐이다.
 *
 * 원래는 다섯 덩이가 `buildFloorEnemy` 안에 흩어져 있어서, 승률을 맞추려면 함수 본문
 * 다섯 군데를 뒤져야 했고 뭐가 뭐에 대응하는지도 안 보였다. 관문 배수
 * (`GATE_MULT_BY_FLOOR`)와 같은 모양으로 맞춰 뒀다.
 *
 * 배수가 층마다 다른 건 관문과 같은 이유다. 기반 종족 성향이랑 그 시점 파티의 화력
 * 곡선이 둘 다 균일하지 않다. 만질 때는 종족 기본 스탯이랑 `scripts/sim/gateCheck.ts`
 * 를 같이 봐라.
 *
 * `exp` 는 보상 경험치 배수. 벽 뒤에 보상이 없으면 벽이 아니라 통행세가 된다.
 */
const BOSS_MULT_BY_FLOOR: Record<number, { hp: number; attack: number; defense: number; exp: number }> = {
  10: { hp: 1.70, attack: 1.36, defense: 1.24, exp: 2.4 },
  20: { hp: 1.26, attack: 0.95, defense: 1.00, exp: 2.4 },
  30: { hp: 2.32, attack: 2.02, defense: 2.12, exp: 2.4 },
  40: { hp: 1.70, attack: 1.35, defense: 1.90, exp: 2.8 },
  50: { hp: 2.05, attack: 1.30, defense: 1.65, exp: 3.5 },
};

/** 그 층의 보스 배수를 스케일된 능력치에 얹는다 */
function applyBoss(scaled: Monster, floor: number): Pick<Monster, "maxHp" | "attack" | "defense" | "rewardExp"> {
  const m = BOSS_MULT_BY_FLOOR[floor];
  return {
    maxHp: Math.floor(scaled.maxHp * m.hp),
    attack: Math.floor(scaled.attack * m.attack),
    defense: Math.floor(scaled.defense * m.defense),
    rewardExp: Math.floor(scaled.rewardExp * m.exp),
  };
}

function buildFloorEnemy(floor: number, excludeId?: string): Monster {
  // ── 고정 구성 층 (n0층 보스와 50층을 뺀 전 층) ──
  // 조건이 `floor <= 9` 였던 적이 있어서 11~25층 구성 15개가 통째로 죽어 있었다.
  // 그 층들은 랜덤 풀에서 뽑혔는데 getFloorEnemySkill 쪽엔 같은 제한이 없어서,
  // 있지도 않은 몬스터의 스킬 순서를 뒤졌다. 그러다 이름이 겹치는 몸통박치기를
  // 찾아내 적이 자기 최약체 기술만 반복하는 층이 생겼다. 19층이 405전투 1패였던
  // 이유고, 그렇게 공짜로 올라와서 20층 보스 앞에서 처음 제대로 맞았다.
  if (FLOOR_FIXED[floor]) {
    const cfg = FLOOR_FIXED[floor];
    if (cfg.monsterId !== excludeId) {
      const base = monsters.find((m) => m.id === cfg.monsterId);
      if (base) {
        return applyCorridor({ ...scaleToLevel(base, floor), moves: cfg.moves }, floor);
      }
    }
  }

  // ── 보스층 ──
  if (floor === 10) {
    const base = monsters.find((m) => m.id === "mossy")!;
    const scaled = scaleToLevel(base, 12);
    return {
      ...scaled,
      name: "분노한 모시",
      // 이 층의 전기불꽃만 마비를 크게 건다. 첫 관문의 답을 해독제로 잡으려는 거다.
      // 10층 시점에 만들 수 있는 게 소모품뿐이라(아티팩트 재료는 깊은 숲부터) 답도 거기 있어야 한다.
      moves: [{ ...spark, statusEffect: "paralysis", statusChance: 35 }, thunderbolt, quickAttack, icePunch],
      ...applyBoss(scaled, 10),
    };
  }
  if (floor === 20) {
    const base = monsters.find((m) => m.id === "mossevo")!;
    const scaled = scaleToLevel(base, 22);
    return {
      ...scaled,
      name: "격노한 모치",
      moves: [voltCrash, thunderbolt, bodySlam, flamethrower],
      ...applyBoss(scaled, 20),
    };
  }
  if (floor === 30) {
    const base = monsters.find((m) => m.id === "frostorb")!;
    const scaled = scaleToLevel(base, 32);
    return {
      ...scaled,
      name: "고대의 프리로",
      // 설풍에 빙결을 크게 실었다. 빙결은 한 턴을 확실히 먹으므로 해독제나 방어가 답이 된다
      moves: [{ ...blizzard, statusEffect: "freeze", statusChance: 30 }, crystalBurst, tidalCrash, solarBeam],
      ...applyBoss(scaled, 30),
    };
  }
  if (floor === 40) {
    const base = monsters.find((m) => m.id === "mossyfinal")!;
    const scaled = scaleToLevel(base, 42);
    return {
      ...scaled,
      name: "전설의 모왕",
      moves: [thunderStrike, voltCrash, overheat, blizzard],
      ...applyBoss(scaled, 40),
    };
  }
  if (floor === 50) {
    const base = monsters.find((m) => m.id === "ormr")!;
    const scaled = scaleToLevel(base, 52);
    return {
      ...scaled,
      name: "오름",
      moves: pickOrmrMoves(),
      ...applyBoss(scaled, 50),
    };
  }

  // ── 11층+: 랜덤 ──
  const boss = isBossFloor(floor);
  const poolIds = boss ? POOL_ALL : getPool(floor);
  const pool = poolIds
    .map((id) => monsters.find((m) => m.id === id)!)
    .filter((m) => !!m && m.id !== excludeId);
  const base = pool[Math.floor(Math.random() * pool.length)];
  const level = boss ? floor + 2 : floor;
  const scaled = scaleToLevel(base, level);

  if (boss) {
    return {
      ...scaled,
      name: `강화된 ${scaled.name}`,
      maxHp: Math.floor(scaled.maxHp * 1.5),
      attack: Math.floor(scaled.attack * 1.3),
      defense: Math.floor(scaled.defense * 1.3),
      rewardExp: Math.floor(scaled.rewardExp * 2),
    };
  }

  // 고정 구성이 excludeId 에 걸려 랜덤으로 내려온 층. 구간 배수는 똑같이 붙는다
  return applyCorridor(scaled, floor);
}

// ─── 층별 고정 스킬 조회 ──────────────────────────────────────────────────────────

/**
 * 오름이 몇 턴에 한 번 겨냥하는가. 그 턴만 AI 가 상성을 계산하고, 나머지 턴은
 * 가진 기술을 마구잡이로 던진다(직전에 쓴 건 빼고).
 *
 * 오름은 7속성 최상급 기술을 전부 들고 있는 유일한 몬스터다. 모든 속성에 약점이
 * 생긴 지금(typeChart 참고) 매 턴 상성을 계산하게 두면 어떤 파티를 데려가도 2배를
 * 맞는다. 시뮬(scripts/sim/floorProbe.ts, Lv55 파티 120판) 승률이 이렇게 갈렸다:
 *
 *      예전(1→2→3→4 순환) | 매 턴 겨냥 | 3턴에 한 번 겨냥
 *   섞은 파티      100%   |     57%    |      79%
 *   전기 편중       99%   |     44%    |      69%
 *
 * 매 턴 겨냥이면 최종보스가 아니라 정답이 하나뿐인 문제가 된다. 그렇다고 순환만
 * 하면 두 바퀴에 다 읽힌다. 그래서 평소엔 못 읽게 두고 세 턴에 한 번만 약점을
 * 정확히 찌른다. 그 한 방이 온다는 걸 아니까 교체랑 물약 타이밍이 생긴다.
 */
export const ORMR_AIM_INTERVAL = 3;

// ─── 보스 전용 기믹 ──────────────────────────────────────────────────────────────

/**
 * 40층 전설의 모왕은 HP 가 절반 아래로 떨어질 때 딱 한 번 몸을 추스른다.
 *
 * 숫자만 키운 보스는 "몇 대 더 때리면 되는" 문제라 장비가 있든 없든 결론이 같다.
 * 회복이 한 번 끼면 "정해진 턴 안에 그만큼을 더 넣을 수 있나"가 되고, 그건 화력,
 * 그러니까 장비를 갖췄냐로만 답할 수 있는 질문이다.
 *
 * 회복 기술이 아니라 보스 전용 훅인 건, moves.ts 에 회복기가 하나도 없어서다.
 * 하나 만들면 그 기술을 배우는 몬스터 밸런스가 죄다 같이 움직인다.
 */
export const BOSS_REGEN: Record<number, { atHpRatio: number; healRatio: number; line: string }> = {
  40: {
    atHpRatio: 0.5,
    healRatio: 0.25,
    line: "전설의 모왕이 숨을 고른다 — 상처가 아물고 있다!",
  },
};

export function getBossRegen(floor: number) {
  return BOSS_REGEN[floor] ?? null;
}

/**
 * 지금 이 보스가 몸을 추스르는가. 회복량을 돌려주고, 아니면 0.
 * "한 번뿐"은 호출부가 기억한다(전투 상태라 여기서 들고 있을 수 없다).
 */
export function bossRegenAmount(floor: number, currentHp: number, maxHp: number): number {
  const regen = getBossRegen(floor);
  if (!regen || currentHp <= 0) return 0;
  if (currentHp > maxHp * regen.atHpRatio) return 0;
  return Math.min(maxHp - currentHp, Math.floor(maxHp * regen.healRatio));
}

export function getFloorEnemySkill(
  floor: number,
  turnIndex: number,
  enemyMoves: Move[],
  lastMoveId?: string,
): Move | null {
  if (floor === 10) {
    const order = ["spark", "thunderbolt", "quick-attack", "spark", "ice-punch"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 20) {
    const order = ["thunderbolt", "volt-crash", "body-slam", "thunderbolt", "flamethrower"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 30) {
    const order = ["blizzard", "crystal-burst", "blizzard", "tidal-crash", "solar-beam"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (floor === 40) {
    const order = ["thunder-strike", "volt-crash", "thunder-strike", "overheat", "blizzard"];
    const id = order[turnIndex % order.length];
    return enemyMoves.find((m) => m.id === id) ?? enemyMoves[0];
  }
  if (isGateFloor(floor)) {
    // 관문은 무작위 풀에서 나오니 기술 id 를 못 박는다. 대신 가진 기술을 센 것부터
    // 순서대로 돌린다. 읽히긴 해도 아프다. 보스처럼 이야기가 붙은 패턴은 아니고.
    const ordered = [...enemyMoves].sort((a, b) => b.power - a.power);
    if (ordered.length === 0) return null;
    const cycle = [ordered[0], ordered[ordered.length - 1], ordered[0], ...ordered.slice(1)];
    return cycle[turnIndex % cycle.length];
  }
  if (floor === 50) {
    // 겨냥하는 턴은 null 을 돌려 AI(상성 계산)에 맡긴다
    if (turnIndex % ORMR_AIM_INTERVAL === ORMR_AIM_INTERVAL - 1) return null;
    // 나머지 턴은 마구잡이. 직전 기술만 빼서 같은 걸 두 번 연달아 보지 않게 한다
    const pool = enemyMoves.filter((m) => m.id !== lastMoveId);
    const from = pool.length > 0 ? pool : enemyMoves;
    return from[Math.floor(Math.random() * from.length)] ?? null;
  }

  const cfg = FLOOR_FIXED[floor];
  if (!cfg) return null;

  // 지정 순서에 나오는 기술을 적이 전부 갖고 있을 때만 이 표를 따른다.
  // 일부만 겹치면 그 층의 적이 아니라는 뜻이고, 겹치는 것만 골라 쓰면 대개
  // 몸통박치기 같은 최약체 기술만 반복하게 된다. 그럴 땐 null 을 주고 AI 에 맡긴다.
  const ids = new Set(enemyMoves.map((m) => m.id));
  if (!cfg.skillOrder.every((id) => ids.has(id))) return null;

  const skillId = cfg.skillOrder[turnIndex % cfg.skillOrder.length];
  return enemyMoves.find((m) => m.id === skillId) ?? null;
}
