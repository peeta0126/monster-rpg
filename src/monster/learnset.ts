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
 *   아쿠비  물 + 얼음      : 냉수 도롱뇽 → 얼음 접목
 *   아쿠사  물 + 얼음/노말 : 진화체, 물리 겸용
 *   버블릿  물 + 독        : 물 벌레, 독침
 *   리피    풀 + 얼음/독   : 잎등짝 곰, 서리 맺힌 잎 + 포자
 *   모시    전기 + 노말    : 야생 늑대, 육탄
 *   모치    전기 + 노말    : 진화체
 *   모왕    전기 + 노말    : 전기의 왕, 최고 피니셔
 *   크리샤  얼음 + 물      : 수정에 맺힌 물
 *   프리로  얼음 + 물/노말 : 둔중한 방벽형
 *   노비    노말 + 만능    : 정체성이 옅은 대신 여러 타입을 얕게 (대boss 서브)
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
  aquabe: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: bubbleCannon },
    { level: 10, move: waterPulse },
    { level: 15, move: frostBreath },      // 교차: 얼음(냉수)
    { level: 20, move: acidSpray },        // 교차: 독(피부 점액)
    { level: 25, move: aquaWhirl },
    { level: 31, move: surf },
    { level: 37, move: icePunch },         // 교차: 얼음
    { level: 44, move: hydroPump },
  ],

  // ═══ 아쿠사 (물 도마뱀) — 물 + 얼음/노말. 물리 겸용 진화체 ════════════════
  aquavern: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  4, move: aquaTail },
    { level:  8, move: waterPulse },
    { level: 13, move: aquaWhirl },
    { level: 18, move: icePunch },         // 교차: 얼음
    { level: 24, move: surf },
    { level: 30, move: bodySlam },         // 교차: 노말
    { level: 36, move: crystalLance },     // 교차: 얼음
    { level: 42, move: hydroPump },
    { level: 50, move: tidalCrash },
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

  // ═══ 모시 (전기 늑대·기초) — 전기 + 노말(육탄) ═══════════════════════════
  mossy: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  5, move: quickAttack },      // 교차: 노말
    { level: 10, move: discharge },
    { level: 15, move: headbutt },         // 교차: 노말
    { level: 17, move: stunNeedle },       // 확정 마비
    { level: 22, move: thunderbolt },
    { level: 28, move: bodySlam },         // 교차: 노말
    { level: 34, move: boltStrike },
    { level: 41, move: thunder },
  ],

  // ═══ 모치 (전기 늑대·1차 진화) — 전기 + 노말 ═════════════════════════════
  mossevo: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  4, move: quickAttack },
    { level:  8, move: discharge },
    { level: 13, move: thunderbolt },
    { level: 16, move: stunNeedle },       // 확정 마비
    { level: 21, move: headbutt },         // 교차: 노말
    { level: 24, move: zap },              // spark의 특수형 변형
    { level: 26, move: boltStrike },
    { level: 32, move: voltCrash },
    { level: 38, move: bodySlam },         // 교차: 노말
    { level: 45, move: thunder },
    { level: 52, move: thunderStrike },
  ],

  // ═══ 모왕 (전기 늑대·최종) — 전기 + 노말 피니셔 ══════════════════════════
  mossyfinal: [
    { level:  1, move: spark },
    { level:  1, move: thunderbolt },
    { level:  5, move: discharge },
    { level: 10, move: quickAttack },      // 교차: 노말
    { level: 15, move: boltStrike },
    { level: 20, move: voltCrash },
    { level: 26, move: bodySlam },         // 교차: 노말
    { level: 32, move: thunder },
    { level: 38, move: heavyBlow },        // 교차: 노말
    { level: 44, move: hyperBeam },        // 교차: 노말
    { level: 52, move: thunderStrike },
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
