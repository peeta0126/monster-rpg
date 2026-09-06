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
 *   버녹스  불 + 전기      : 버노의 진화체. 정전기 뿔을 그대로 물려받는다
 *   화롱    불 + 노말      : 화로를 짊어진 둔한 몸. 육탄으로 버틴다
 *   아쿠곤  물 + 얼음/노말 : 아쿠사의 진화체. 두 갈래 종착점을 한 몸에 모은다
 *   버블록  물 + 독        : 버블릿의 바위 갑주 단계. 독을 그대로 이어간다
 *   버블돈  물 + 독/노말   : 요새형 최종체. 무게로 누른다
 *   젬토    얼음 + 물/노말 : 수정 띠 새끼 거북. 방벽 라인의 시작
 *   젬가드  얼음 + 노말    : 등껍질이 수정 가시로 솟는다
 *   젬로드  얼음 + 노말    : 요새형 최종체. 게임에서 제일 단단하다
 *   빙록    얼음 + 풀/노말 : 수정 뿔이 나뭇가지를 닮았다. 얼음 유일의 속도형
 *   독무스  독 + 풀        : 꼬리의 버섯에서 포자를 뿌린다. 지속 피해형
 *   붕곰    노말 + 독/불   : 붕대와 부적. 정면으로 치고받는 노말
 *
 * 진화 계통 전용 기술 (⭐이번 재설계의 핵심):
 *   아쿠비 전용(아쿠사는 못 배움) : frostBreath, acidSpray
 *   아쿠사 전용(진화 후에만)      : bodySlam, crystalLance, tidalCrash
 *   아쿠곤 전용(최종체만)         : hydroPump 재습득. 아쿠비 쪽 특수 종착점과
 *                                   아쿠사 쪽 물리 종착점(tidalCrash)을 둘 다 갖는
 *                                   유일한 단계다 — 3단계까지 키운 값이 여기 있다
 *   모시 전용(모치·모왕은 못 배움): stunNeedle. 확정 마비, 포획 보조가 필요하면
 *                                   진화 전에 반드시 챙겨야 하는 라인 최고의 선택지
 *   모치 전용(모왕은 못 배움)     : voltCrash
 *   모왕 전용(최종체만)           : hyperBeam, thunderStrike, gigaImpact
 *   버블릿 전용(진화하면 잃는다)  : hydroPump. 버블록·버블돈은 못 배운다
 *   버블돈 전용(최종체만)         : gigaImpact
 *
 * "위력이 낮아 상위 호환에 밀려 보이는" 기술의 역할 재정의(삭제 없이 배치로 해결):
 *   tackle       : 최저 안정 딜러. 대부분의 초반종이 Lv1부터 보유해 첫 전투부터
 *                  명중 100%로 사고 없이 턴을 소모할 수 있는 만능 기본기
 *   quickAttack  : 수치상 tackle과 동일하나(위력40·명중100·물리), "질풍"이라는
 *                  이름값대로 속도형 종에게 우선 배정해 정체성을 부여하는 기술
 *   surf         : hydroPump보다 약하지만 명중 100%. 고위력·저명중 피니셔 대신
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

  // ═══ 플레미 (불꽃 말): 불 + 노말(육탄). 속도형 ════════════════════════════
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

  // ═══ 버노 (불꽃 황소): 불 + 전기(정전기 뿔). 완력형 ════════════════════════
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

  // ═══ 버녹스 (불꽃 족제비·진화체): 불 + 전기. 유리대포 심화 ════════════════
  // 버노가 Lv21·32 에 배우던 전기를 그대로 물려받되 한 단계씩 늦다. 대신 최상급
  // 화염기를 버노보다 빨리 잡는다(flamethrower 45 vs 38 은 버노 쪽이 이르지만,
  // 버노는 그 레벨까지 진화를 참아야 한다). 진화를 24 에 하면 화염권·불꽃베기를
  // 버녹스 쪽 표로 다시 주워 담으므로 손해가 없다.
  burnox: [
    { level:  1, move: tackle },
    { level:  1, move: ember },
    { level:  5, move: fireScratch },
    { level: 10, move: quickAttack },      // 교차: 노말
    { level: 15, move: cinderToss },       // 확정 화상
    { level: 20, move: firePunch },
    { level: 26, move: heatWave },
    { level: 32, move: flameSlash },
    { level: 38, move: boltStrike },       // 교차: 전기(버노 라인의 정전기)
    { level: 45, move: flamethrower },
    { level: 52, move: overheat },
  ],

  // ═══ 화롱 (불꽃 화로쥐): 불 + 노말(육탄). 불 유일의 방어형 ════════════════
  // 상태이상기(확정 화상)를 Lv17 로 늦게 준다. 느린 종이라 먼저 못 때리는데
  // 확정 화상까지 이르면 초반 숲에서 혼자만 너무 안정적이 된다.
  hwarong: [
    { level:  1, move: tackle },
    { level:  1, move: ember },
    { level:  6, move: headbutt },         // 교차: 노말
    { level: 12, move: fireScratch },
    { level: 17, move: cinderToss },       // 확정 화상
    { level: 23, move: firePunch },
    { level: 29, move: bodySlam },         // 교차: 노말
    { level: 35, move: heatWave },
    { level: 42, move: heavyBlow },        // 교차: 노말
    { level: 49, move: flamethrower },
  ],

  // ═══ 아쿠비 (물 도롱뇽): 물 + 얼음(냉수). 특수형 ═════════════════════════
  // 진화 라인 재설계: frostBreath·acidSpray는 "아쿠비 전용". 아쿠사는 못 배운다.
  // 어린 도롱뇽 특유의 냉수 분사·점액 독이라는 설정이라, 진화하면 잃는다.
  // 이 둘을 챙기려면 진화(Lv22 권장)를 미루고 Lv20까지는 아쿠비로 다녀야 함.
  // hydroPump(특수 최상급)도 아쿠비만의 종착점으로 남김. 진화체는 대신 물리
  // 최상급 tidalCrash를 갖게 되므로, "안 진화하고 특수 피니셔 vs 진화해서 물리
  // 피니셔" 구도가 라인 전체의 선택지가 된다.
  aquabe: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: bubbleCannon },
    { level: 10, move: waterPulse },
    { level: 15, move: frostBreath },      // ★아쿠비 전용. 교차: 얼음(냉수)
    { level: 20, move: acidSpray },        // ★아쿠비 전용. 교차: 독(피부 점액)
    { level: 26, move: aquaWhirl },
    { level: 33, move: icePunch },         // 교차: 얼음
    { level: 40, move: hydroPump },        // 아쿠비만의 특수 최종기
  ],

  // ═══ 아쿠사 (물 도마뱀): 물 + 얼음/노말. 물리 겸용 진화체 ═════════════════
  // bodySlam·crystalLance·tidalCrash는 "아쿠사 전용". 덩치가 커져야 다룰 수 있는
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
    { level: 33, move: bodySlam },         // ★아쿠사 전용. 교차: 노말
    { level: 40, move: crystalLance },     // ★아쿠사 전용. 교차: 얼음
    { level: 47, move: tidalCrash },       // ★아쿠사 전용. 진화체 물리 최종기
  ],

  // ═══ 아쿠곤 (물 용): 물 + 얼음/노말. 라인의 종착점 ════════════════════════
  // 아쿠비는 특수 피니셔(hydroPump)로, 아쿠사는 물리 피니셔(tidalCrash)로 갈라졌다.
  // 아쿠곤은 그 둘을 다시 합치는 유일한 단계다 — 40 에 진화해 55 까지 키우면
  // 물리·특수 최종기를 한 몸에 갖는다. 갈림길을 만들어 놓은 라인이라, 끝에서
  // 한 번은 합쳐 줘야 3단계까지 키운 이유가 생긴다.
  // tackle 이 없는 것도 의도(모왕과 같은 규칙 — 완성형은 기본기를 안 쓴다).
  aquagon: [
    { level:  1, move: waterGun },
    { level:  1, move: aquaTail },
    { level:  5, move: bubbleCannon },
    { level: 10, move: waterPulse },
    { level: 16, move: aquaWhirl },
    { level: 22, move: icePunch },         // 교차: 얼음
    { level: 28, move: surf },
    { level: 35, move: crystalLance },     // 교차: 얼음
    { level: 42, move: bodySlam },         // 교차: 노말
    { level: 48, move: tidalCrash },       // 물리 종착점(아쿠사에서 이어받는다)
    { level: 55, move: hydroPump },        // ★아쿠곤 전용. 특수 종착점까지 합류
  ],

  // ═══ 버블릿 (물 벌레): 물 + 독(독침). 상태이상 전문 ═══════════════════════
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
    { level: 50, move: hydroPump },        // ★버블릿 전용. 진화하면 잃는다
  ],

  // ═══ 버블록 (바위 갑주 벌레·1차 진화): 독 + 물. 방어형 ════════════════════
  // 버블릿의 독 계열을 레벨까지 그대로 물려받는다(16 에 진화해도 표가 어긋나지
  // 않게 맞춰 둔 것). 다른 것은 둘뿐 — 30 의 압박(바위 갑주 육탄)이 들어오고,
  // 버블릿의 종착점이던 hydroPump 가 빠진다. 특수 최종기를 원하면 진화를 미뤄야 한다.
  bublock: [
    { level:  1, move: tackle },
    { level:  1, move: waterGun },
    { level:  5, move: poisonSting },      // 교차: 독
    { level:  9, move: bubbleCannon },
    { level: 14, move: toxic },            // 확정 독
    { level: 19, move: poisonFog },        // 교차: 독
    { level: 24, move: poisonJab },        // 교차: 독
    { level: 30, move: bodySlam },         // 교차: 노말(바위 갑주)
    { level: 36, move: venomFang },        // 교차: 독
    { level: 43, move: surf },
    { level: 50, move: venomStorm },       // 교차: 독
  ],

  // ═══ 버블돈 (거대 갑충·최종): 독 + 물/노말. 요새형 ════════════════════════
  // 방어 88 로 버티면서 독을 걸어 두고 시간을 이기는 종이다. 그래서 확정 독을
  // 17 로 조금 늦추는 대신, 무게로 누르는 노말 계열을 두 개(강타·기가임팩트) 준다.
  bubldon: [
    { level:  1, move: waterGun },
    { level:  1, move: poisonSting },
    { level:  6, move: bubbleCannon },
    { level: 12, move: poisonJab },
    { level: 17, move: toxic },            // 확정 독
    { level: 23, move: poisonFog },
    { level: 30, move: heavyBlow },        // 교차: 노말
    { level: 37, move: venomFang },
    { level: 44, move: venomStorm },
    { level: 50, move: surf },
    { level: 56, move: gigaImpact },       // ★버블돈 전용. 교차: 노말
  ],

  // ═══ 리피 (풀 곰): 풀 + 얼음/독(서리잎·포자). 상태이상형 ══════════════════
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

  // ═══ 모시 (전기 늑대·기초): 전기 + 노말(육탄). 진화 라인의 탱커 ════════════
  // stunNeedle(Lv17, 확정 마비)은 "모시 전용". 모치/모왕은 배울 수 없다.
  // 포획 보조용 확정 마비기가 필요하면 모시 단계에서 반드시 Lv17을 찍고
  // 진화시켜야 하는, 이 라인에서 가장 중요한 선택지.
  // discharge는 thunderbolt보다 먼저 배우는 초반 실전기. 저레벨 구간의
  // 주력기로 쓰다가 나중에 thunderbolt로 자연스럽게 대체되는 역할.
  mossy: [
    { level:  1, move: tackle },
    { level:  1, move: spark },
    { level:  5, move: quickAttack },      // 교차: 노말. 속도형 견제기
    { level: 10, move: discharge },        // thunderbolt 전 단계 주력기
    { level: 17, move: stunNeedle },       // ★모시 전용. 확정 마비
    { level: 23, move: headbutt },         // 교차: 노말
    { level: 29, move: thunderbolt },
    { level: 36, move: bodySlam },         // 교차: 노말
    { level: 43, move: boltStrike },
    { level: 50, move: thunder },
  ],

  // ═══ 모치 (전기 늑대·1차 진화): 전기 + 노말. 화력형으로 전환 ══════════════
  // voltCrash(Lv32)는 "모치 전용". 모왕은 배울 수 없다(모왕은 thunderStrike로
  // 대체). zap은 spark의 특수형 변형. 물리/특수 구분이 실전 대미지에 반영되진
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

  // ═══ 모왕 (전기 늑대·최종): 전기 + 노말 피니셔. 순수 화력형 ══════════════
  // hyperBeam(Lv44)·thunderStrike(Lv52)·gigaImpact(Lv58)는 전부 "모왕 전용"이다.
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
    { level: 44, move: hyperBeam },        // ★모왕 전용. 교차: 노말
    { level: 52, move: thunderStrike },    // ★모왕 전용
    { level: 58, move: gigaImpact },       // ★모왕 전용. 교차: 노말
  ],

  // ═══ 크리샤 (얼음 수정 여우): 얼음 + 물(수정 물방울). 특수 딜러 ═══════════
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

  // ═══ 프리로 (얼음 원반): 얼음 + 물/노말. 방벽형 ══════════════════════════
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

  // ═══ 젬토 (수정 거북·기초): 얼음 + 물/노말. 방벽 라인의 시작 ══════════════
  // 3단계 라인이라 표를 넓게 편다(최종기 blizzard 가 50). 프리로는 같은 방벽형인데
  // 49 에 절대영도까지 가므로, 젬토를 키우는 값은 지금 세지는 것이 아니라
  // 젬로드까지 갔을 때의 방어 96 에 있다.
  gemto: [
    { level:  1, move: tackle },
    { level:  1, move: frostBreath },
    { level:  6, move: iceShard },
    { level: 11, move: waterPulse },       // 교차: 물
    { level: 16, move: frostMist },        // 확정 빙결
    { level: 22, move: icePunch },
    { level: 28, move: iceBeam },
    { level: 35, move: bodySlam },         // 교차: 노말
    { level: 42, move: crystalBurst },
    { level: 50, move: blizzard },
  ],

  // ═══ 젬가드 (수정 거북·1차 진화): 얼음 + 노말. 방벽 심화 ══════════════════
  // 18 에 진화하는 라인이라 젬토보다 표가 한 칸씩 빠르다. 물(waterPulse)이 빠지고
  // 대신 수정 계열이 둘 들어온다 — 등껍질이 굳으면서 물기를 잃는다는 설정.
  gemguard: [
    { level:  1, move: tackle },
    { level:  1, move: frostBreath },
    { level:  5, move: iceShard },
    { level: 10, move: icePunch },
    { level: 15, move: frostMist },        // 확정 빙결
    { level: 21, move: iceBeam },
    { level: 27, move: bodySlam },         // 교차: 노말
    { level: 33, move: crystalLance },
    { level: 40, move: crystalBurst },
    { level: 47, move: blizzard },
  ],

  // ═══ 젬로드 (수정 요새 거북·최종): 얼음 + 노말. 게임 최고 방어 ════════════
  // 모왕·아쿠곤과 같이 tackle 없이 시작한다. 확정 빙결(frostMist)이 없는 유일한
  // 젬 계열인 것도 의도 — 방어 96 에 확정 행동 봉쇄까지 붙으면 상대가 손을 못 쓴다.
  // 벽은 벽까지만 하고, 끝내는 것은 설풍·절대영도가 맡는다.
  gemlord: [
    { level:  1, move: frostBreath },
    { level:  1, move: iceShard },
    { level:  6, move: icePunch },
    { level: 12, move: iceBeam },
    { level: 18, move: crystalLance },
    { level: 25, move: heavyBlow },        // 교차: 노말
    { level: 32, move: crystalBurst },
    { level: 40, move: blizzard },
    { level: 48, move: gigaImpact },       // 교차: 노말
    { level: 56, move: sheerCold },
  ],

  // ═══ 빙록 (수정 뿔 사슴): 얼음 + 풀/노말. 얼음 유일의 속도형 ══════════════
  // 수정 뿔이 나뭇가지를 닮아 풀을 교차로 쓴다. 얼음은 풀에 2배로 강한데(typeChart)
  // 정작 얼음 넷이 전부 느려서 먼저 못 때렸다. 이 종만 quickAttack 을 Lv1 에 준다.
  bingrok: [
    { level:  1, move: quickAttack },      // 교차: 노말. 속도형 정체성
    { level:  1, move: frostBreath },
    { level:  6, move: iceShard },
    { level: 11, move: leafGust },         // 교차: 풀(가지를 닮은 뿔)
    { level: 15, move: frostMist },        // 확정 빙결
    { level: 20, move: iceBeam },
    // 25·44 는 탑 27·44층이 이 종을 세우는 자리다. 층의 고정 구성은 그 종이 그 레벨까지
    // 배우는 기술만 들 수 있어서(floorTable 규칙 ②), 표가 층보다 늦으면 그 층만 물러진다.
    { level: 25, move: crystalBurst },
    { level: 31, move: twister },          // 교차: 노말
    { level: 38, move: iceLeaf },          // 교차: 풀
    { level: 44, move: blizzard },
    { level: 50, move: sheerCold },
  ],

  // ═══ 톡사룡 (독 도마뱀): 독 + 노말(육탄 포식자). 물리 어태커 ══════════════
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

  // ═══ 베노까 (독 까마귀): 독 + 노말(비행 질풍). 특수 어태커 ════════════════
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

  // ═══ 포자무스 (버섯 큰사슴): 풀 + 독. 관문용 상성 요원 ════════════════════
  // 확정 독을 독가시(toxic)가 아니라 포자구름(sporeCloud)으로 준다. 둘 다 "확정 독"
  // 이지만 이쪽은 풀 기술이라, 꼬리 버섯에서 포자가 나온다는 원화가 표에 그대로 남는다.
  // 톡사룡·베노까가 둘 다 toxic 을 쓰므로 같은 기술이 셋으로 겹치지도 않는다.
  //
  // 잎바람(Lv6)을 일찍 주는 것이 이 종의 요점이다. 25층 전기 관문 전에 풀 기술이
  // 손에 있어야 하는데, 리피 말고는 그걸 들고 오는 종이 없었다.
  // ⚠️ 풀 공격기를 일찍 줄 것. 처음엔 잎바람(45) 하나로 Lv38 까지 버티게 짜 놨는데,
  // 그러면 이 종이 관문에서 아무 일도 못 한다. 25층 전기 관문에서 풀은 상성이 두 겹으로
  // 유리한 자리다 — 전기 → 풀이 0.5배라 덜 맞고, 풀 → 전기가 2배라 더 때린다.
  // 그런데 때릴 기술이 45 짜리뿐이면 그 2배가 아무것도 아니다. Lv26 실측 승률이
  // 1% 였다(같은 레벨·장비의 모치는 99%). 잎날 11 · 씨앗폭탄 22 로 리피의 곡선에 맞춘다.
  sporemus: [
    { level:  1, move: tackle },
    { level:  1, move: leafGust },
    { level:  6, move: poisonSting },      // 교차: 독(꼬리의 버섯)
    { level: 11, move: leafBlade },
    { level: 17, move: sporeCloud },       // 확정 독. 교차: 독 — 이 종의 상징
    { level: 22, move: seedBomb },
    { level: 28, move: poisonFog },        // 교차: 독
    { level: 34, move: poisonJab },        // 교차: 독
    { level: 41, move: rootSpear },
    // 광합성포는 이 종의 종착점이다. 43 은 탑 43층이 포자무스를 세우는 자리라
    // 그 층이 예전 리피와 같은 위력을 들 수 있게 맞춘 것이기도 하다.
    { level: 43, move: solarBeam },
    { level: 49, move: venomFang },
  ],

  // ═══ 노비 (노말): 만능형. 여러 타입을 얕게. 대boss 서브 요원 ══════════════
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

  // ═══ 붕곰 (붕대 곰): 노말 + 독/불(부적). 정면 완력형 ══════════════════════
  // 노비가 다섯 타입을 얕게 훑는 만능형이라, 같은 노말을 하나 더 그렇게 만들면
  // 고를 이유가 없어진다. 붕곰은 노말 계열을 끝까지 타고 교차는 둘만 둔다 —
  // 몸에 감긴 붕대의 저주(독)와 등에 붙은 부적(불).
  bunggom: [
    { level:  1, move: tackle },
    { level:  1, move: quickAttack },
    { level:  6, move: headbutt },
    { level: 12, move: poisonSting },      // 교차: 독(붕대의 저주)
    { level: 17, move: twister },
    { level: 23, move: bodySlam },
    { level: 29, move: poisonFog },        // 교차: 독
    { level: 35, move: heavyBlow },
    { level: 42, move: firePunch },        // 교차: 불(등의 부적)
    { level: 49, move: hyperBeam },
    { level: 56, move: gigaImpact },
  ],
};

// ═══ 조회 유틸 ════════════════════════════════════════════════════════════

/** 해당 레벨에 새로 배우는 기술 */
export function getLearnableAtLevel(monsterId: string, level: number): Move[] {
  return (LEARNSET[monsterId] ?? []).filter((e) => e.level === level).map((e) => e.move);
}


/** 도감 표시용. 레벨 순 정렬된 전체 학습 목록 */
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
