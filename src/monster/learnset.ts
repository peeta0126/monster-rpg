/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  몬스터 레벨업 학습 테이블
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 각 몬스터는 자기 타입 스킬트리를 기본 축으로 오르되,
 * 디자인 컨셉에 맞는 "교차 타입 기술" 1~2개를 정식으로 배운다.
 * 이건 이상 기술이 아니라 그 종의 정상 능력이다.
 * (이상 기술 = 이 테이블 어디에도 없는 기술. isAnomalyMove로 판정)
 *
 * 교차 타입 배정 근거 (디자인 반영):
 *   플레미  불 + 노말      : 초원을 달리는 야생마 → 몸통 계열
 *   버노    불 + 전기      : 화산 황소, 정전기 쌓인 뿔 → thunderPunch 대체 boltStrike
 *   아쿠비  물 + 얼음/독   : 냉수 도롱뇽 → 얼음 접목 + 피부 점액, 미진화 특수 딜러
 *   아쿠사  물 + 얼음/노말 : 진화체, 물리·특수 겸용 만능 딜러
 *   버블릿  물 + 독        : 물 벌레, 독침
 *   리피    풀 + 얼음/독   : 잎등짝 곰, 서리 맺힌 잎 + 포자
 *   모시    전기 + 노말    : 야생 늑대. 전기는 상성표상 약점 0개라 진화 라인의 탱커
 *   모치    전기 + 노말    : 진화체, 화력형으로 전환되는 과도기
 *   모왕    전기 + 노말    : 전기의 왕, 순수 화력형 최종체
 *   크리샤  얼음 + 물      : 수정에 맺힌 물
 *   프리로  얼음 + 물/노말 : 둔중한 방벽형(약점이 불 하나뿐이라 방어 특화)
 *   노비    노말 + 만능    : 정체성이 옅은 대신 여러 타입을 얕게 (대boss 서브).
 *                            상태이상기 없음 + 노말 약점 0개라 범용 탱커로 보상
 *
 * 진화 계통 전용 기술 (⭐이번 재설계의 핵심):
 *   아쿠비 전용(아쿠사는 못 배움) : frostBreath, acidSpray
 *   아쿠사 전용(진화 후에만)      : bodySlam, crystalLance, tidalCrash
 *   모시 전용(모치·모왕은 못 배움): stunNeedle — 확정 마비, 포획 보조가 필요하면
 *                                   진화 전에 반드시 챙겨야 하는 라인 최고의 선택지
 *   모치 전용(모왕은 못 배움)     : voltCrash
 *   모왕 전용(최종체만)           : hyperBeam, thunderStrike, gigaImpact
 *
 * "위력이 낮아 상위 호환에 밀려 보이는" 기술의 역할 재정의(삭제 없이 배치로 해결):
 *   tackle       : 최저 안정 딜러. 대부분의 초반종이 Lv1부터 보유해 첫 전투부터
 *                  명중 100%로 사고 없이 턴을 소모할 수 있는 만능 기본기
 *   quickAttack  : 수치상 tackle과 동일하나(위력40·명중100·물리), "질풍"이라는
 *                  이름값대로 속도형 종에게 우선 배정해 정체성을 부여하는 기술
 *   surf         : hydroPump보다 약하지만 명중 100% — 고위력·저명중 피니셔 대신
 *                  안정적으로 승부를 볼 때 쓰는 신뢰도 축 딜러
 *   discharge    : thunderbolt보다 먼저 배우는 초반 실전기. 진화 전/저레벨 구간의
 *                  주력기로 쓰다가 나중에 thunderbolt로 자연스럽게 대체되는 역할
 *   zap          : spark의 특수형 변형. 물리/특수 구분이 대미지 계산에 반영되진
 *                  않지만(battleUtils는 defense 단일 스탯만 사용), 전격을 세련되게
 *                  다루기 시작한 모치의 상징 기술로 배치해 정체성을 살림
 */

import {
  // normal
  tackle, quickAttack, twister, headbutt, bodySlam, heavyBlow, gigaImpact, hyperBeam,
  // fire
  ember, fireScratch, cinderToss, firePunch, heatWave, flameSlash, flamethrower, overheat,
  // water
  waterGun, aquaTail, bubbleCannon, waterPulse, aquaWhirl, surf, tidalCrash, hydroPump,
  // electric
  spark, zap, stunNeedle, discharge, thunderbolt, boltStrike, voltCrash, thunder, thunderStrike,
  // grass
  vineWhip, leafGust, sporeCloud, leafBlade, iceLeaf, seedBomb, rootSpear, solarBeam,
  // ice
  frostBreath, iceShard, frostMist, icePunch, iceBeam, crystalLance, crystalBurst, blizzard, sheerCold,
  // poison
  poisonSting, acidSpray, toxic, poisonFog, poisonJab, venomFang, venomStorm,
} from "./moves";
import type { Move } from "../shared/game";

export interface LearnEntry {
  level: number;
  move: Move;
}

export const LEARNSET: Record<string, LearnEntry[]> = {

  // ═══ 플레미 (불꽃 말) — 불 + 노말(육탄). 속도형 ═══════════════════════════
  flameling: [
    { level:  1, move: tackle },
    { level:  1, move: ember },
    { level:  5, move: quickAttack },      // 교차: 노말
    { level:  9, move: fireScratch },
    { level: 14, move: cinderToss },       // 확정 화상
    { level: 18, move: headbutt },         // 교차: 노말
    { level: 23, move: heatWave },
    { level: 28, move: flameSlash },
    { level: 34, move: flamethrower },
    { level: 40, move: heavyBlow },        // 교차: 노말
    { level: 46, move: overheat },
  ],

  // ═══ 버노 (불꽃 황소) — 불 + 전기(정전기 뿔). 완력형 ═══════════════════════
  burno: [
    { level:  1, move: tackle },
    { level:  1, move: ember },
    { level:  6, move: headbutt },
    { level: 11, move: firePunch },
    { level: 16, move: cinderToss },       // 확정 화상
    { level: 21, move: spark },            // 교차: 전기(정전기)
    { level: 26, move: flameSlash },
    { level: 32, move: boltStrike },       // 교차: 전기
    { level: 38, move: flamethrower },
    { level: 44, move: gigaImpact },       // 교차: 노말
    { level: 50, move: overheat },
  ],

  // ═══ 아쿠비 (물 도롱뇽) — 물 + 얼음(냉수). 특수형 ════════════════════════
  // 진화 라인 재설계: frostBreath·acidSpray는 "아쿠비 전용" — 아쿠사는 못 배운다.
  // 어린 도롱뇽 특유의 냉수 분사·점액 독이라는 설정이라, 진화하면 잃는다.
  // 이 둘을 챙기려면 진화(Lv22 권장)를 미루고 Lv20까지는 아쿠비로 다녀야 함.
  // hydroPump(특수 최상급)도 아쿠비만의 종착점으로 남김 — 진화체는 대신 물리
  // 최상급 tidalCrash를 갖게 되므로, "안 진화하고 특수 피니셔 vs 진화해서 물리
  // 피니셔" 구도가 라인 전체의 선택지가 된다.
  aquabe: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: bubbleCannon },
    { level: 10, move: waterPulse },
    { level: 15, move: frostBreath },      // ★아쿠비 전용 — 교차: 얼음(냉수)
    { level: 20, move: acidSpray },        // ★아쿠비 전용 — 교차: 독(피부 점액)
    { level: 26, move: aquaWhirl },
    { level: 33, move: icePunch },         // 교차: 얼음
    { level: 40, move: hydroPump },        // 아쿠비만의 특수 최종기
  ],

  // ═══ 아쿠사 (물 도마뱀) — 물 + 얼음/노말. 물리 겸용 진화체 ════════════════
  // bodySlam·crystalLance·tidalCrash는 "아쿠사 전용" — 덩치가 커져야 다룰 수 있는
  // 물리 기술이라 아쿠비 단계에선 배울 수 없다. tidalCrash(Lv50)는 진화체만의
  // 물리 최종 피니셔로, 아쿠비 쪽 hydroPump(특수 피니셔)와 대비되는 종착점.
  aquavern: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  6, move: aquaTail },
    { level: 11, move: waterPulse },
    { level: 16, move: aquaWhirl },
    { level: 21, move: icePunch },         // 교차: 얼음
    { level: 27, move: surf },
    { level: 33, move: bodySlam },         // ★아쿠사 전용 — 교차: 노말
    { level: 40, move: crystalLance },     // ★아쿠사 전용 — 교차: 얼음
    { level: 47, move: tidalCrash },       // ★아쿠사 전용 — 진화체 물리 최종기
  ],

  // ═══ 버블릿 (물 벌레) — 물 + 독(독침). 상태이상 전문 ══════════════════════
  bubblet: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: poisonSting },      // 교차: 독
    { level:  9, move: bubbleCannon },
    { level: 14, move: toxic },            // 확정 독
    { level: 19, move: poisonFog },        // 교차: 독
    { level: 24, move: poisonJab },        // 교차: 독
    { level: 30, move: surf },
    { level: 36, move: venomFang },        // 교차: 독
    { level: 43, move: venomStorm },       // 교차: 독
    { level: 50, move: hydroPump },
  ],

  // ═══ 리피 (풀 곰) — 풀 + 얼음/독(서리잎·포자). 상태이상형 ═════════════════
  leafy: [
    { level:  1, move: tackle },
    { level:  1, move: vineWhip },
    { level:  5, move: leafGust },
    { level: 10, move: leafBlade },
    { level: 15, move: sporeCloud },       // 확정 독
    { level: 20, move: iceLeaf },          // 교차: 얼음(서리 맺힌 잎)
    { level: 25, move: seedBomb },
    { level: 31, move: poisonJab },        // 교차: 독
    { level: 37, move: rootSpear },
    { level: 43, move: solarBeam },
    { level: 50, move: hyperBeam },        // 교차: 노말
  ],

  // ═══ 모시 (전기 늑대·기초) — 전기 + 노말(육탄). 진화 라인의 탱커 ═══════════
  // stunNeedle(Lv17, 확정 마비)은 "모시 전용" — 모치/모왕은 배울 수 없다.
  // 포획 보조용 확정 마비기가 필요하면 모시 단계에서 반드시 Lv17을 찍고
  // 진화시켜야 하는, 이 라인에서 가장 중요한 선택지.
  // discharge는 thunderbolt보다 먼저 배우는 초반 실전기 — 저레벨 구간의
  // 주력기로 쓰다가 나중에 thunderbolt로 자연스럽게 대체되는 역할.
  mossy: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  5, move: quickAttack },      // 교차: 노말 — 속도형 견제기
    { level: 10, move: discharge },        // thunderbolt 전 단계 주력기
    { level: 17, move: stunNeedle },       // ★모시 전용 — 확정 마비
    { level: 23, move: headbutt },         // 교차: 노말
    { level: 29, move: thunderbolt },
    { level: 36, move: bodySlam },         // 교차: 노말
    { level: 43, move: boltStrike },
    { level: 50, move: thunder },
  ],

  // ═══ 모치 (전기 늑대·1차 진화) — 전기 + 노말. 화력형으로 전환 ═════════════
  // voltCrash(Lv32)는 "모치 전용" — 모왕은 배울 수 없다(모왕은 thunderStrike로
  // 대체). zap은 spark의 특수형 변형 — 물리/특수 구분이 실전 대미지에 반영되진
  // 않지만, "전격을 세련되게 다루기 시작한" 모치의 상징 기술로 배치.
  mossevo: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  5, move: quickAttack },      // 교차: 노말
    { level: 10, move: discharge },
    { level: 15, move: thunderbolt },
    { level: 21, move: headbutt },         // 교차: 노말
    { level: 27, move: zap },              // spark의 특수형 변형
    { level: 32, move: voltCrash },        // ★모치 전용
    { level: 39, move: bodySlam },         // 교차: 노말
    { level: 46, move: thunder },
  ],

  // ═══ 모왕 (전기 늑대·최종) — 전기 + 노말 피니셔. 순수 화력형 ═════════════
  // hyperBeam(Lv44)·thunderStrike(Lv52)·gigaImpact(Lv58)는 전부 "모왕 전용" —
  // 최종 진화체만이 다룰 수 있는 궁극기 3종. tackle 없이 spark부터 시작하는
  // 것도 의도(더 이상 몸통박치기 따위로 힘을 낭비하지 않는 완성형이라는 설정).
  mossyfinal: [
    { level:  1, move: spark },
    { level:  1, move: thunderbolt },
    { level:  5, move: discharge },
    { level: 10, move: quickAttack },      // 교차: 노말
    { level: 15, move: boltStrike },
    { level: 21, move: bodySlam },         // 교차: 노말
    { level: 28, move: thunder },
    { level: 35, move: heavyBlow },        // 교차: 노말
    { level: 44, move: hyperBeam },        // ★모왕 전용 — 교차: 노말
    { level: 52, move: thunderStrike },    // ★모왕 전용
    { level: 58, move: gigaImpact },       // ★모왕 전용 — 교차: 노말
  ],

  // ═══ 크리샤 (얼음 수정 여우) — 얼음 + 물(수정 물방울). 특수 딜러 ══════════
  crystafox: [
    { level:  1, move: tackle },
    { level:  1, move: frostBreath },
    { level:  5, move: quickAttack },      // 교차: 노말
    { level: 10, move: icePunch },
    { level: 14, move: frostMist },        // 확정 빙결
    { level: 19, move: iceBeam },
    { level: 25, move: crystalBurst },
    { level: 31, move: waterPulse },       // 교차: 물(수정에 맺힌 물)
    { level: 37, move: crystalLance },
    { level: 43, move: blizzard },
    { level: 50, move: sheerCold },
  ],

  // ═══ 프리로 (얼음 원반) — 얼음 + 물/노말. 방벽형 ═════════════════════════
  frostorb: [
    { level:  1, move: tackle },
    { level:  1, move: frostBreath },
    { level:  6, move: waterPulse },       // 교차: 물
    { level: 11, move: iceShard },
    { level: 15, move: frostMist },        // 확정 빙결
    { level: 20, move: iceBeam },
    { level: 25, move: crystalBurst },
    { level: 30, move: bodySlam },         // 교차: 노말
    { level: 36, move: crystalLance },
    { level: 42, move: blizzard },
    { level: 49, move: sheerCold },
  ],

  // ═══ 톡사룡 (독 도마뱀) — 독 + 노말(육탄 포식자). 물리 어태커 ═════════════
  toxadon: [
    { level:  1, move: tackle },
    { level:  1, move: poisonSting },
    { level:  6, move: quickAttack },      // 교차: 노말
    { level: 11, move: poisonJab },
    { level: 16, move: toxic },            // 확정 독
    { level: 22, move: headbutt },         // 교차: 노말
    { level: 28, move: venomFang },
    { level: 35, move: bodySlam },         // 교차: 노말
    { level: 42, move: poisonFog },
    { level: 50, move: venomStorm },
  ],

  // ═══ 베노까 (독 까마귀) — 독 + 노말(비행 질풍). 특수 어태커 ═══════════════
  venomcrow: [
    { level:  1, move: tackle },
    { level:  1, move: acidSpray },
    { level:  5, move: quickAttack },      // 교차: 노말
    { level:  9, move: poisonSting },
    { level: 14, move: toxic },            // 확정 독
    { level: 19, move: twister },          // 교차: 노말(날갯바람)
    { level: 25, move: poisonFog },
    { level: 31, move: poisonJab },
    { level: 38, move: venomFang },
    { level: 45, move: venomStorm },
  ],

  // ═══ 노비 (노말) — 만능형. 여러 타입을 얕게. 대boss 서브 요원 ═════════════
  nobi: [
    { level:  1, move: tackle },
    { level:  1, move: quickAttack },
    { level:  6, move: twister },
    { level: 11, move: headbutt },
    { level: 16, move: poisonSting },      // 교차: 독
    { level: 21, move: bodySlam },
    { level: 26, move: leafBlade },        // 교차: 풀
    { level: 31, move: heavyBlow },
    { level: 36, move: icePunch },         // 교차: 얼음
    { level: 42, move: hyperBeam },
    { level: 48, move: gigaImpact },
  ],
};

// ═══ 조회 유틸 ════════════════════════════════════════════════════════════

/** 해당 레벨에 새로 배우는 기술 */
export function getLearnableAtLevel(monsterId: string, level: number): Move[] {
  return (LEARNSET[monsterId] ?? []).filter((e) => e.level === level).map((e) => e.move);
}

/** 특정 레벨까지 배울 수 있는 모든 기술 */
export function getAllLearnableUpToLevel(monsterId: string, maxLevel: number): LearnEntry[] {
  return (LEARNSET[monsterId] ?? []).filter((e) => e.level <= maxLevel);
}

/** 도감 표시용 — 레벨 순 정렬된 전체 학습 목록 */
export function getFullLearnset(monsterId: string): LearnEntry[] {
  return [...(LEARNSET[monsterId] ?? [])].sort((a, b) => a.level - b.level);
}

/**
 * 이상 기술 판정 ⭐
 * 해당 종의 학습 테이블에 어떤 레벨로도 없는 기술이면 true.
 * 타입이 아니라 기술 id 단위로 판정한다.
 */
export function isAnomalyMove(monsterId: string, moveId: string): boolean {
  const set = LEARNSET[monsterId];
  if (!set) return false;
  return !set.some((e) => e.move.id === moveId);
}
