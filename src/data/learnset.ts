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
  thunderbolt, blizzard, iceLeaf,
  firePunch, headbutt, poisonPowder, waterPulse, seedBomb,
  icePunch, thunderPunch, hyperBeam, overheat, hydropump,
  poisonJab, thunder, sheerCold, giga_impact,
  voltCrash, thunderStrike, aquaWhirl, tidalCrash, crystalBurst,
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
    { level:  7, move: quickAttack },
    { level: 12, move: headbutt },
    { level: 18, move: firePunch },
    { level: 25, move: flamethrower },
    { level: 33, move: bodySlam },
    { level: 42, move: overheat },
  ],

  // ─── 버노 (불꽃 황소) ── 화산 근처 거친 황소 ────────────────────────────────
  burno: [
    { level:  1, move: tackle },
    { level:  3, move: ember },
    { level:  8, move: bodySlam },
    { level: 14, move: firePunch },
    { level: 20, move: headbutt },
    { level: 27, move: flamethrower },
    { level: 35, move: thunderPunch },
    { level: 44, move: overheat },
  ],

  // ─── 아쿠비 (물 도롱뇽) ── 맑은 물 속 도롱뇽 ───────────────────────────────
  aquabe: [
    { level:  1, move: tackle },
    { level:  3, move: waterGun },
    { level:  7, move: waterPulse },
    { level: 13, move: iceBeam },
    { level: 19, move: poisonPowder },    // 피부 독소
    { level: 26, move: surf },
    { level: 34, move: icePunch },
    { level: 43, move: hydropump },
  ],

  // ─── 아쿠사 (물 도마뱀) ── 아쿠비 진화체, 강력한 물 파충류 ────────────────────
  aquavern: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: waterPulse },
    { level: 10, move: aquaWhirl },
    { level: 16, move: icePunch },
    { level: 23, move: surf },
    { level: 30, move: bodySlam },
    { level: 38, move: hydropump },
    { level: 48, move: tidalCrash },
  ],

  // ─── 버블릿 (물+벌레) ── 거품 뿜는 물 벌레 ──────────────────────────────────
  bubblet: [
    { level:  1, move: tackle },
    { level:  3, move: waterGun },
    { level:  6, move: poisonPowder },
    { level: 11, move: vineWhip },
    { level: 17, move: waterPulse },
    { level: 23, move: seedBomb },
    { level: 30, move: surf },
    { level: 38, move: poisonJab },
    { level: 47, move: hydropump },
  ],

  // ─── 리피 (풀 곰) ── 숲 속 잎사귀 등짝을 가진 풀 곰 ────────────────────────
  leafy: [
    { level:  1, move: tackle },
    { level:  3, move: vineWhip },
    { level:  7, move: quickAttack },
    { level: 12, move: iceLeaf },
    { level: 18, move: seedBomb },
    { level: 24, move: poisonJab },
    { level: 31, move: solarBeam },
    { level: 40, move: hyperBeam },
  ],

  // ─── 모시 (전기 늑대 기초) ── 전기 기운을 품은 야생 늑대 ────────────────────
  mossy: [
    { level:  1, move: tackle },
    { level:  3, move: spark },
    { level:  8, move: quickAttack },
    { level: 14, move: headbutt },
    { level: 20, move: thunderbolt },
    { level: 28, move: bodySlam },
    { level: 36, move: thunder },
  ],

  // ─── 모치 (전기 늑대 1차 진화) ── 날카로운 전기 갈기 ────────────────────────
  mossevo: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  5, move: quickAttack },
    { level: 10, move: thunderbolt },
    { level: 16, move: headbutt },
    { level: 22, move: voltCrash },
    { level: 30, move: bodySlam },
    { level: 40, move: thunder },
    { level: 50, move: thunderStrike },
  ],

  // ─── 모왕 (전기 늑대 최종 진화) ── 전기의 왕 ──────────────────────────────
  mossyfinal: [
    { level:  1, move: spark },
    { level:  1, move: thunderbolt },
    { level:  5, move: voltCrash },
    { level: 10, move: quickAttack },
    { level: 18, move: thunder },
    { level: 25, move: bodySlam },
    { level: 35, move: hyperBeam },
    { level: 45, move: thunderStrike },
  ],

  // ─── 크리샤 (얼음 수정 여우) ── 이마의 다이아몬드, 수정 날개 ────────────────
  crystafox: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  7, move: quickAttack },
    { level: 12, move: icePunch },
    { level: 18, move: crystalBurst },
    { level: 25, move: waterPulse },
    { level: 33, move: blizzard },
    { level: 42, move: sheerCold },
  ],

  // ─── 프리로 (얼음 디스크 생물) ── 파란 수정 원반을 달고 다니는 둔한 생물 ──────
  frostorb: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  6, move: waterPulse },
    { level: 11, move: crystalBurst },
    { level: 17, move: icePunch },
    { level: 24, move: bodySlam },
    { level: 32, move: blizzard },
    { level: 41, move: sheerCold },
  ],

  // ─── 더미 몬스터들 (미구현) ──────────────────────────────────────────────────
  voltiny: [
    { level:  1, move: tackle },
    { level:  3, move: spark },
    { level:  6, move: quickAttack },
    { level: 11, move: thunderPunch },
    { level: 17, move: thunderbolt },
    { level: 23, move: headbutt },
    { level: 30, move: bodySlam },
    { level: 39, move: thunder },
  ],
  zapbear: [
    { level:  1, move: tackle },
    { level:  3, move: spark },
    { level:  8, move: bodySlam },
    { level: 14, move: thunderPunch },
    { level: 20, move: thunderbolt },
    { level: 27, move: headbutt },
    { level: 35, move: ember },
    { level: 44, move: thunder },
  ],
  frostlet: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  7, move: quickAttack },
    { level: 12, move: icePunch },
    { level: 18, move: waterPulse },
    { level: 25, move: blizzard },
    { level: 33, move: bodySlam },
    { level: 42, move: sheerCold },
  ],
  blizzwolf: [
    { level:  1, move: tackle },
    { level:  3, move: iceBeam },
    { level:  7, move: quickAttack },
    { level: 13, move: icePunch },
    { level: 19, move: bodySlam },
    { level: 26, move: blizzard },
    { level: 34, move: headbutt },
    { level: 43, move: sheerCold },
  ],
  fluffin: [
    { level:  1, move: tackle },
    { level:  3, move: quickAttack },
    { level:  7, move: headbutt },
    { level: 12, move: bodySlam },
    { level: 18, move: waterPulse },
    { level: 25, move: poisonPowder },
    { level: 33, move: hyperBeam },
    { level: 42, move: giga_impact },
  ],
  stonepup: [
    { level:  1, move: tackle },
    { level:  3, move: bodySlam },
    { level:  7, move: headbutt },
    { level: 12, move: quickAttack },
    { level: 18, move: iceLeaf },
    { level: 25, move: thunderPunch },
    { level: 33, move: hyperBeam },
    { level: 42, move: giga_impact },
  ],

  // ─── 노비 (노말 타입) ──────────────────────────────────────────────────────────
  nobi: [
    { level:  1, move: tackle },
    { level:  4, move: quickAttack },
    { level: 10, move: headbutt },
    { level: 18, move: bodySlam },
    { level: 28, move: hyperBeam },
    { level: 38, move: giga_impact },
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
