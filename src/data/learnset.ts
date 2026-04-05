/**
 * 몬스터 레벨업 스킬 테이블 (레벨셋)
 * { monsterId: [ [레벨, Move], ... ] }
 * 레벨에 도달하면 해당 스킬을 배울 수 있음.
 * 좋은 스킬일수록 높은 레벨에 배치.
 * 생물 특성을 반영한 타입 유연성 포함.
 */

import {
  tackle, ember, waterGun, vineWhip, spark, iceBeam,
  quickAttack, bodySlam, flamethrower, surf, solarBeam,
  thunderbolt, blizzard, toxic, iceLeaf,
  firePunch, headbutt, poisonPowder, waterPulse, seedBomb,
  icePunch, thunderPunch, hyperBeam, overheat, hydropump,
  poisonJab, thunder, sheerCold, giga_impact,
} from "./moves";
import type { Move } from "../types/game";

export interface LearnEntry {
  level: number;
  move: Move;
}

export const LEARNSET: Record<string, LearnEntry[]> = {

  // ─── 플레미 (불꽃 말) ── 초원을 달리는 불꽃 야생마 ───────────────────────────
  flameling: [
    { level:  1, move: tackle },
    { level:  3, move: ember },
    { level:  7, move: quickAttack },     // 초원 달리기 = 빠른 기동
    { level: 12, move: headbutt },        // 말의 박치기
    { level: 18, move: firePunch },       // 불꽃 발굽
    { level: 25, move: flamethrower },    // 화염방사
    { level: 33, move: bodySlam },        // 전신으로 돌진
    { level: 42, move: overheat },        // 최강 불꽃
  ],

  // ─── 버노 (불꽃 황소) ── 화산 근처 거친 황소 ────────────────────────────────
  burno: [
    { level:  1, move: tackle },
    { level:  3, move: ember },
    { level:  8, move: bodySlam },        // 황소 돌진
    { level: 14, move: firePunch },
    { level: 20, move: headbutt },
    { level: 27, move: flamethrower },
    { level: 35, move: thunderPunch },    // 황소의 전격 뿔
    { level: 44, move: overheat },
  ],

  // ─── 아쿠비 (물 도롱뇽) ── 맑은 물 속 미끄러운 도롱뇽 ───────────────────────
  aquabe: [
    { level:  1, move: tackle },
    { level:  3, move: waterGun },
    { level:  7, move: waterPulse },      // 물 소용돌이
    { level: 13, move: iceBeam },         // 도롱뇽 한기
    { level: 19, move: poisonPowder },    // 피부 독소 (도롱뇽 특성)
    { level: 26, move: surf },
    { level: 34, move: icePunch },        // 얼음 발톱
    { level: 43, move: hydropump },
  ],

  // ─── 버블릿 (물+벌레) ── 거품 뿜는 물 벌레 ──────────────────────────────────
  bubblet: [
    { level:  1, move: tackle },
    { level:  3, move: waterGun },
    { level:  6, move: poisonPowder },    // 벌레의 독 가루
    { level: 11, move: vineWhip },        // 벌레 더듬이/풀 이미지
    { level: 17, move: waterPulse },
    { level: 23, move: seedBomb },        // 풀-벌레 연계
    { level: 30, move: surf },
    { level: 38, move: poisonJab },       // 벌레 독침
    { level: 47, move: hydropump },
  ],

  // ─── 리피 (풀 새싹) ── 숲 속 새싹 요정 ──────────────────────────────────────
  leafy: [
    { level:  1, move: tackle },
    { level:  3, move: vineWhip },
    { level:  7, move: quickAttack },     // 새싹의 민첩함
    { level: 12, move: iceLeaf },         // 얼음잎새 (풀+얼음 복합)
    { level: 18, move: seedBomb },
    { level: 24, move: poisonJab },       // 독성 가시
    { level: 31, move: solarBeam },
    { level: 40, move: hyperBeam },       // 빛 에너지 집중
  ],

  // ─── 모시 (풀 이끼 골렘) ── 이끼 덮인 돌 골렘 ───────────────────────────────
  mossy: [
    { level:  1, move: tackle },
    { level:  3, move: vineWhip },
    { level:  8, move: headbutt },        // 돌 머리 박치기
    { level: 14, move: iceLeaf },
    { level: 20, move: bodySlam },        // 무거운 몸통
    { level: 27, move: seedBomb },
    { level: 35, move: toxic },           // 이끼 독소
    { level: 44, move: solarBeam },
  ],

  // ─── 볼티 (전기 쥐) ── 볼에 전기 저장, 빠른 쥐 ─────────────────────────────
  voltiny: [
    { level:  1, move: tackle },
    { level:  3, move: spark },
    { level:  6, move: quickAttack },     // 쥐의 빠른 발
    { level: 11, move: thunderPunch },    // 전기 발
    { level: 17, move: thunderbolt },
    { level: 23, move: headbutt },
    { level: 30, move: bodySlam },        // 전기 방전 돌진
    { level: 39, move: thunder },
  ],

  // ─── 잽베어 (전기 곰) ── 전기 몸통의 어두운 곰 ─────────────────────────────
  zapbear: [
    { level:  1, move: tackle },
    { level:  3, move: spark },
    { level:  8, move: bodySlam },        // 곰의 강한 몸통
    { level: 14, move: thunderPunch },
    { level: 20, move: thunderbolt },
    { level: 27, move: headbutt },
    { level: 35, move: ember },           // 곰 분노 = 불꽃 기운 (속성 유연)
    { level: 44, move: thunder },
  ],

  // ─── 프로스틀릿 (얼음 수정 생물) ── 크리스탈 팔, 눈꽃 ──────────────────────
  frostlet: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  7, move: quickAttack },     // 크리스탈 순간이동 느낌
    { level: 12, move: icePunch },
    { level: 18, move: waterPulse },      // 얼음 녹은 물
    { level: 25, move: blizzard },
    { level: 33, move: bodySlam },        // 수정 충돌
    { level: 42, move: sheerCold },
  ],

  // ─── 블리자울프 (얼음 늑대) ── 4족 보행, 맹렬한 얼음 이빨 ──────────────────
  blizzwolf: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  7, move: quickAttack },     // 늑대 질주
    { level: 13, move: icePunch },
    { level: 19, move: bodySlam },        // 늑대 돌진
    { level: 26, move: blizzard },
    { level: 34, move: headbutt },
    { level: 43, move: sheerCold },
  ],

  // ─── 플러핀 (노말 솜털) ── 분홍 솜사탕 같은 노말 ───────────────────────────
  fluffin: [
    { level:  1, move: tackle },
    { level:  3, move: quickAttack },
    { level:  7, move: headbutt },
    { level: 12, move: bodySlam },
    { level: 18, move: waterPulse },      // 솜털 수분 흡수 (유연)
    { level: 25, move: poisonPowder },    // 달콤한 독가루
    { level: 33, move: hyperBeam },
    { level: 42, move: giga_impact },
  ],

  // ─── 스톤퍼프 (바위+노말 강아지) ── 돌처럼 단단한 강아지 ───────────────────
  stonepup: [
    { level:  1, move: tackle },
    { level:  3, move: bodySlam },
    { level:  7, move: headbutt },        // 돌 머리 박치기
    { level: 12, move: quickAttack },
    { level: 18, move: iceLeaf },         // 바위 속 차가운 기운 (유연)
    { level: 25, move: thunderPunch },    // 돌 + 전격 (유연)
    { level: 33, move: hyperBeam },
    { level: 42, move: giga_impact },
  ],
};

/** 레벨에서 새로 배울 수 있는 스킬 목록 반환 */
export function getLearnableAtLevel(monsterId: string, level: number): Move[] {
  return (LEARNSET[monsterId] ?? [])
    .filter(e => e.level === level)
    .map(e => e.move);
}

/** 특정 레벨까지 배울 수 있는 모든 스킬 반환 */
export function getAllLearnableUpToLevel(monsterId: string, maxLevel: number): LearnEntry[] {
  return (LEARNSET[monsterId] ?? []).filter(e => e.level <= maxLevel);
}
