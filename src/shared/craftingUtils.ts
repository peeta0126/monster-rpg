import type {
  ArtifactStatBonus,
  ArtifactStatType,
  ArtifactBonusStat,
  ArtifactBonusStatType,
  ArtifactInstance,
  ItemQuality,
} from "./crafting";
import { elementDamageKey } from "./crafting";
import { ELEMENT_KO, type ElementType } from "./game";
import { PALETTE, rgba, type PaletteName } from "./palette";

/** 여덟 속성. 표를 도는 순서도 여기 한 벌이다 */
const ELEMENTS = Object.keys(ELEMENT_KO) as ElementType[];

export type RpsResult = "win" | "draw" | "lose";

export function rollItemQuality(result: RpsResult): ItemQuality {
  const random = Math.random();

  if (result === "win") {
    if (random < 0.2) return "elite";
    if (random < 0.75) return "rare";
    return "normal";
  }

  if (result === "draw") {
    if (random < 0.05) return "elite";
    if (random < 0.4) return "rare";
    return "normal";
  }

  // lose
  if (random < 0.15) return "rare";
  return "normal";
}

export const QUALITY_LABEL: Record<ItemQuality, string> = {
  normal: "일반 제작품",
  rare:   "희귀 제작품",
  elite:  "최고급 제작품",
};

// 등급 3색은 마스터 팔레트에서 서로 제일 멀리 떨어진 세 갈래로 골랐다
// (중립 sand / 마법 mist / 화염 ember). 색약이어도 명도와 색상이 둘 다 다르다.
export const QUALITY_TOKEN: Record<ItemQuality, PaletteName> = {
  normal: "sand300",
  rare:   "mist300",
  elite:  "ember500",
};

// 원래 `var(--color-*)` 였다. 화면 네 곳이 `${QUALITY_COLOR[q]}44` 로 흐린 테두리를
// 만드는데 `var(...)44` 는 CSS 가 통째로 버리는 값이라 테두리가 아예 안 그려졌다.
// 팔레트 값을 그대로 내주면 8자리 hex 가 돼서 의도대로 나온다.
export const QUALITY_COLOR: Record<ItemQuality, string> = {
  normal: PALETTE[QUALITY_TOKEN.normal],
  rare:   PALETTE[QUALITY_TOKEN.rare],
  elite:  PALETTE[QUALITY_TOKEN.elite],
};

/** 등급색 + 알파. 판이나 테두리 채움에 쓴다 */
export function qualityTint(quality: ItemQuality, alpha: number): string {
  return rgba(QUALITY_TOKEN[quality], alpha);
}

export const QUALITY_GLOW: Record<ItemQuality, string> = {
  normal: "rgba(205,178,126,0.3)",
  rare:   "rgba(174,226,213,0.4)",
  elite:  "rgba(233,148,65,0.5)",
};

export const QUALITY_MULTIPLIER: Record<ItemQuality, number> = {
  normal: 1.0,
  rare:   1.35,
  elite:  1.8,
};

export const ARTIFACT_STAT_LABEL: Record<ArtifactStatType, string> = {
  attack:       "공격력",
  defense:      "방어력",
  hp:           "HP",
  speed:        "속도",
  critRate:     "치명타 확률",
  elementPower: "속성 능력",
};

// ─── 레벨·강화 스케일링 ───────────────────────────────────────────────────────────

/**
 * 레벨 배율: 레벨 1당 3% 증가
 * Lv.1 → ×1.00 · Lv.10 → ×1.27 · Lv.30 → ×1.87 · Lv.50 → ×2.47
 */
export function getLevelMultiplier(level: number): number {
  return 1 + (level - 1) * 0.03;
}

/**
 * 강화 배율: +1당 10% 증가
 * +0 → ×1.0 · +3 → ×1.3 · +5 → ×1.5
 */
export function getEnhancementMultiplier(enhancement: number): number {
  return 1 + enhancement * 0.10;
}

/** 단일 능력치에 레벨·강화 배율 적용 */
export function getEffectiveStat(base: number, level: number, enhancement: number): number {
  return Math.round(base * getLevelMultiplier(level) * getEnhancementMultiplier(enhancement));
}

/** 능력치 배열 전체에 레벨·강화 배율 적용 */
export function getEffectiveStats(
  statBonuses: ArtifactStatBonus[],
  level: number,
  enhancement: number,
): ArtifactStatBonus[] {
  return statBonuses.map((b) => ({
    ...b,
    value: getEffectiveStat(b.value, level, enhancement),
  }));
}

/** 장착된 아티팩트 전체의 레벨·강화 적용 능력치 합계 (부가 능력치 중 최대 HP만 hp에 합산) */
export function sumEquippedStatBonuses(
  equipped: ArtifactInstance[],
): Record<ArtifactStatType, number> {
  const totals: Record<ArtifactStatType, number> = {
    attack: 0, defense: 0, hp: 0, speed: 0, critRate: 0, elementPower: 0,
  };
  for (const a of equipped) {
    for (const b of getEffectiveStats(a.statBonuses, a.level ?? 1, a.enhancement ?? 0)) {
      totals[b.stat] += b.value;
    }
    for (const bonus of a.bonusStats ?? []) {
      if (bonus.type === "maxHpFlat") totals.hp += bonus.value;
    }
  }
  return totals;
}

/**
 * 같은 속성이 여럿 붙었을 때 한 속성이 받을 수 있는 최대치(%).
 *
 * **더한다.** 불꽃 +12% 가 둘이면 24% 이고, 곱하지 않는다(1.12² = 25.4%). 이유는
 * 계산이 아니라 읽기다 — 카드마다 "+12%" 가 적혀 있으니 사람은 그걸 더해서 읽는다.
 * 곱으로 처리하면 화면의 숫자를 더한 값과 실제가 어긋나고, 그 차이(1.4%p)는 어차피
 * 아무도 눈으로 못 잡는다. 더하기 쪽이 맞고, 설명할 수 있다.
 *
 * 상한을 두는 이유는 데미지 식이 나눗셈이라서다. 속성 데미지는 자속 보정
 * (elementPower)·상성 2배와 **연달아 곱해지므로**, 한 속성에 몰아주면 그 속성 기술
 * 하나가 판을 정한다. 지금 표에서 한 속성이 실제로 얻을 수 있는 최대는 24%(장비 두
 * 곳에서 하나씩)라 이 값은 안 걸린다 — 걸리지 않는 게 정상이고, 나중에 표를 넓혔을 때
 * 조용히 넘어가지 말라고 둔 난간이다.
 */
export const ELEMENT_DAMAGE_CAP = 30;

export interface EquippedBonusTotals {
  /** 기술 속성별 데미지 증가(%). 여덟 속성이 전부 들어 있고 없는 것은 0 이다 */
  elementDamage: Record<ElementType, number>;
  critDamage: number;
}

/**
 * 장착한 아티팩트 전체의 부가 능력치(레벨 10마다 랜덤 해제) 합계.
 * maxHpFlat 은 sumEquippedStatBonuses 의 hp 에 이미 들어가 있어서 여기서는 뺀다.
 * 레벨·강화 배율은 안 먹인다. 부가 능력치는 해제된 값 그대로 고정이다.
 *
 * 속성 데미지를 여기서 **표 한 벌로 내보내는** 이유가 있다. 예전에는 전투 화면과
 * 시뮬레이터가 각자 `if (bonus.fireDamage) map.fire = ...` 를 손으로 적었고, 그래서
 * 살아 있는 속성이 둘(불꽃·물)뿐이라는 사실이 호출부 두 곳에 숨어 있었다.
 */
export function sumEquippedBonusStats(equipped: ArtifactInstance[]): EquippedBonusTotals {
  const elementDamage = Object.fromEntries(ELEMENTS.map((e) => [e, 0])) as Record<ElementType, number>;
  let critDamage = 0;

  for (const a of equipped) {
    for (const b of a.bonusStats ?? []) {
      if (b.type === "maxHpFlat") continue;
      if (b.type === "critDamage") { critDamage += b.value; continue; }
      const element = ELEMENTS.find((e) => elementDamageKey(e) === b.type);
      if (element) elementDamage[element] += b.value;
      // 표에 없는 이름(옛 세이브의 windDamage 같은 것)은 조용히 흘린다.
      // 마이그레이션이 살아 있는 것으로 갈아 주지만, 그 사이의 로드도 안 죽어야 한다.
    }
  }

  for (const e of ELEMENTS) elementDamage[e] = Math.min(ELEMENT_DAMAGE_CAP, elementDamage[e]);
  return { elementDamage, critDamage };
}

/**
 * 장비 하나가 실제로 주는 값. 화면에 찍는 숫자는 전부 여기서 나온다.
 *
 * 원래는 화면마다 `statBonuses` 를 그대로 찍었는데, 그건 제작 시점 원본이라
 * 레벨·강화가 안 들어간 값이다. 전투는 `sumEquipped*` 로 배율 먹인 값을 쓰고.
 * Lv.50 +5 정예 목걸이가 화면엔 공격 +14, 전투엔 +52 로 들어가 있었다.
 *
 * 부가 능력치(레벨 10마다 해제)도 능력치니까 같이 내보낸다. 최대 HP 계열만
 * 기본 HP 줄에 합쳐 한 번만 센다. 전투도 그렇게 더한다(sumEquippedStatBonuses).
 */
export interface ArtifactDisplayStat {
  key:     string;
  label:   string;
  value:   number;
  /** % 로 읽는 값인가 */
  percent: boolean;
  /** 레벨 10마다 해제되는 부가 능력치인가 */
  bonus:   boolean;
}

export interface ArtifactStatSource {
  statBonuses:  ArtifactStatBonus[];
  level?:       number;
  enhancement?: number;
  bonusStats?:  ArtifactBonusStat[];
}

export function getArtifactDisplayStats(a: ArtifactStatSource): ArtifactDisplayStat[] {
  const hpFlat = (a.bonusStats ?? [])
    .filter((b) => b.type === "maxHpFlat")
    .reduce((sum, b) => sum + b.value, 0);

  const lines: ArtifactDisplayStat[] = [];
  let hasHpLine = false;

  for (const b of getEffectiveStats(a.statBonuses, a.level ?? 1, a.enhancement ?? 0)) {
    if (b.stat === "hp") hasHpLine = true;
    lines.push({
      key:     `base:${b.stat}`,
      label:   ARTIFACT_STAT_LABEL[b.stat],
      value:   b.stat === "hp" ? b.value + hpFlat : b.value,
      percent: b.stat === "critRate",
      bonus:   false,
    });
  }
  // 힘의 목걸이처럼 기본 HP 가 없는 장비도 최대 HP 부가 능력치를 뽑을 수 있다.
  if (!hasHpLine && hpFlat > 0) {
    lines.push({ key: "base:hp", label: ARTIFACT_STAT_LABEL.hp, value: hpFlat, percent: false, bonus: false });
  }

  for (const b of a.bonusStats ?? []) {
    if (b.type === "maxHpFlat") continue;
    lines.push({
      key:     `bonus:${b.type}`,
      label:   ARTIFACT_BONUS_STAT_LABEL[b.type],
      value:   b.value,
      percent: true,
      bonus:   true,
    });
  }

  return lines;
}
// ─── 부가 능력치 풀 ────────────────────────────────────────────────────────────────

export interface ArtifactBonusStatDef {
  type:  ArtifactBonusStatType;
  value: number;
  label: string;
}

/** 속성 데미지 한 줄의 값(%). 굴림마다 다르게 하지 않는다 — 같은 속성이 장비에 따라
 *  다른 값으로 붙으면 "무엇을 모아야 하나"를 읽을 수 없다 */
const ELEMENT_DAMAGE_VALUE = 12;

/** 속성 데미지 후보 한 줄 만들기. 이름은 ELEMENT_KO 한 벌에서 온다 */
function elementDamage(type: ElementType, value = ELEMENT_DAMAGE_VALUE): ArtifactBonusStatDef {
  return {
    type: elementDamageKey(type),
    value,
    label: `${ELEMENT_KO[type]} 데미지 +${value}%`,
  };
}

/**
 * 아티팩트 itemId별 부가 능력치 후보 풀.
 * 레벨 10 달성마다 미해제 항목 중 1개를 랜덤 획득한다(`rollBonusStats`).
 *
 * ── 표를 다시 짠 이유 ──────────────────────────────────────────────────────
 * 옛 표에는 죽은 굴림이 세 종류 있었다.
 *   · `windDamage` · `earthDamage` — 이 게임에 없는 속성. 카드에는 값이 적히는데
 *     어떤 기술도 그 타입이 아니라 데미지가 1 도 안 올랐다.
 *   · 같은 `type` 을 두 줄 적어 둔 것 — 해제는 **타입 단위로 중복을 걸러서**
 *     (`rollBonusStats`) 뒤에 적은 줄이 영영 안 나온다. 수호의 팔찌와 정령의 부적이
 *     그래서 실질 후보가 넷뿐이었고, 만렙 정예(해제 다섯 번)의 마지막 한 번이 빈손이었다.
 *   · `expBonus` — 레벨차 컷오프(`expLevelGapMultiplier`)가 들어간 뒤로는 곱해도
 *     컷오프를 못 넘는다. 지금은 타입에서 아예 뺐다.
 * 그 셋을 걷어내면 여덟 속성 중 실제로 데미지가 붙는 건 불꽃·물 둘뿐이었다.
 *
 * ── 지금 규칙 ─────────────────────────────────────────────────────────────
 * 장비마다 성격이 있다. 목걸이는 치고 들어가는 속성, 팔찌는 버티는 속성, 부적은
 * **여덟 속성 전부**다(기본 능력치가 속성 능력 + 속도인 물건이라 여기가 제자리다).
 * 후보를 해제 횟수보다 하나 이상 많게 둬서, 같은 장비 두 개가 같은 값으로 안 자란다.
 */
export const ARTIFACT_BONUS_POOL: Record<string, ArtifactBonusStatDef[]> = {
  // 힘의 목걸이 — 공격·치명타. 먼저 때리는 쪽 속성을 모아 둔다
  power_necklace: [
    elementDamage("fire"),
    elementDamage("electric"),
    elementDamage("poison"),
    elementDamage("normal"),
    { type: "critDamage", value: 12, label: "치명타 데미지 +12%" },
    { type: "maxHpFlat",  value: 50, label: "최대 HP +50" },
  ],
  // 수호의 팔찌 — HP·방어. 버티는 쪽 속성
  guard_bracelet: [
    { type: "maxHpFlat",  value: 80, label: "최대 HP +80" },
    elementDamage("water"),
    elementDamage("grass"),
    elementDamage("ice"),
    elementDamage("crystal"),
    { type: "critDamage", value: 10, label: "치명타 데미지 +10%" },
  ],
  // 정령의 부적 — 속성 그 자체. 여덟 속성이 다 후보고, 만렙 정예가 그중 다섯을 갖는다
  spirit_amulet: ELEMENTS.map((e) => elementDamage(e)),
};

export const ARTIFACT_BONUS_STAT_LABEL: Record<ArtifactBonusStatType, string> = {
  ...Object.fromEntries(ELEMENTS.map((e) => [elementDamageKey(e), `${ELEMENT_KO[e]} 데미지`])),
  critDamage: "치명타 데미지",
  maxHpFlat:  "최대 HP",
} as Record<ArtifactBonusStatType, string>;

/**
 * 레벨 업 뒤에 부가 능력치를 해제할지, 해제한다면 뭘 줄지.
 * 옛 레벨~새 레벨 사이에 낀 10의 배수마다 한 번씩 해제한다.
 */
export function rollBonusStats(
  itemId:    string,
  prevLevel: number,
  newLevel:  number,
  existing:  ArtifactBonusStat[],
): ArtifactBonusStat[] {
  const pool = ARTIFACT_BONUS_POOL[itemId] ?? [];
  const unlockedTypes = new Set(existing.map((b) => b.type));
  const result = [...existing];

  for (let threshold = 10; threshold <= newLevel; threshold += 10) {
    if (prevLevel < threshold) {
      const available = pool.filter((p) => !unlockedTypes.has(p.type));
      if (available.length === 0) break;
      const pick = available[Math.floor(Math.random() * available.length)];
      result.push({ type: pick.type, value: pick.value, label: pick.label });
      unlockedTypes.add(pick.type);
    }
  }

  return result;
}

/**
 * 세이브에 든 부가 능력치를 지금 표에 맞춘다. 로드마다 지난다(playerStore.normalizeState).
 *
 * 하는 일이 셋이다.
 *   1) 표에 없는 이름을 버린다 — 옛 세이브의 `windDamage` · `earthDamage` · `expBonus`.
 *      전부 아무 일도 안 하면서 카드에는 값이 적혀 있던 줄이다.
 *   2) 남은 줄의 값·이름을 표에서 다시 읽는다. 안 그러면 같은 "불꽃 데미지" 가 옛
 *      세이브에서는 5%, 새 장비에서는 12% 로 붙는다 — 화면만 보고는 알 수 없다.
 *   3) 레벨이 주는 만큼(10마다 하나) 모자라면 채운다. 버린 자리를 살아 있는 것으로
 *      갈아 주는 것이고, 덤으로 옛 중복 버그(같은 type 두 줄을 적어 둬서 만렙 정예의
 *      마지막 해제가 빈손이던 것)도 여기서 메워진다.
 *
 * 굴림이 들어가지만 한 번만 돈다 — 개수가 맞으면 그대로 돌려주므로 로드마다 안 바뀐다.
 */
export function repairBonusStats(
  itemId: string,
  level: number,
  existing: ArtifactBonusStat[] | undefined,
): ArtifactBonusStat[] {
  const pool = ARTIFACT_BONUS_POOL[itemId] ?? [];
  if (pool.length === 0) return [];

  const held = new Set<ArtifactBonusStatType>();
  const kept: ArtifactBonusStat[] = [];
  for (const b of existing ?? []) {
    const def = pool.find((p) => p.type === b.type);
    if (!def || held.has(def.type)) continue;
    held.add(def.type);
    kept.push({ type: def.type, value: def.value, label: def.label });
  }

  const want = Math.min(Math.floor(level / 10), pool.length);
  while (kept.length < want) {
    const available = pool.filter((p) => !held.has(p.type));
    if (available.length === 0) break;
    const pick = available[Math.floor(Math.random() * available.length)];
    held.add(pick.type);
    kept.push({ type: pick.type, value: pick.value, label: pick.label });
  }
  return kept;
}

export function applyArtifactQualityStats(
  baseStats: ArtifactStatBonus[],
  quality: ItemQuality,
): ArtifactStatBonus[] {
  const multiplier = QUALITY_MULTIPLIER[quality];
  return baseStats.map((b) => ({
    ...b,
    value: Math.round(b.value * multiplier),
  }));
}

// ─── 장비 성장 시스템 ──────────────────────────────────────────────────────────────

/** 등급별 최대 레벨 */
export const EQUIPMENT_MAX_LEVEL: Record<ItemQuality, number> = {
  normal: 30,
  rare:   40,
  elite:  50,
};

/** 최대 강화 수치 (+5) */
export const MAX_EQUIPMENT_ENHANCEMENT = 5;

/**
 * 강화 성공 확률. +0→+1 은 확정이고 올라갈수록 낮아진다.
 * 실패해도 수치가 내려가진 않고 재료만 날아간다. 되돌릴 수 없는 손실은 안 만든다.
 * (index = 지금 강화 수치)
 */
export const ENHANCEMENT_SUCCESS_RATE = [1.0, 0.9, 0.75, 0.6, 0.45] as const;

export function getEnhancementSuccessRate(enhancement: number): number {
  return ENHANCEMENT_SUCCESS_RATE[enhancement] ?? 0;
}

export function getEquipmentMaxLevel(quality: ItemQuality): number {
  return EQUIPMENT_MAX_LEVEL[quality];
}

/**
 * 레벨업에 필요한 강화석 수량
 * Normal×1 / Rare×2 / Elite×3 배율, 레벨이 높을수록 더 필요
 */
export function getEquipmentLevelUpCost(quality: ItemQuality, currentLevel: number): number {
  const mult = ({ normal: 1, rare: 1, elite: 2 } as const)[quality];
  // 계수를 6 → 12, 등급 배율을 {1,2,3} → {1,1,2} 로 낮췄다.
  //
  // 관문을 장비 없이 못 넘게 되면서 장비가 필수가 됐는데, 옛 비용은 그대로 벽이었다.
  // 파티 3마리 × 슬롯 3개를 레어 30레벨까지 올리는 데 강화석 1,530개, 고대 숲으로 치면
  // 백 번이 넘는다. 지금은 459개, 숲 대여섯 번이면 닿는다.
  return Math.ceil(currentLevel / 12) * mult;
}

/**
 * 분해 시 획득하는 강화석 수량
 * 등급 기본값 + 레벨 보너스 + 강화 보너스
 */
export function getDisassembleStones(
  quality: ItemQuality,
  level: number,
  enhancement: number,
): number {
  const base = ({ normal: 5, rare: 12, elite: 25 } as const)[quality];
  const levelBonus       = Math.floor(level / 5);
  const enhancementBonus = enhancement * 2;
  return base + levelBonus + enhancementBonus;
}

/** 다음 등급 반환 (elite이면 null) */
export function getNextQuality(quality: ItemQuality): ItemQuality | null {
  if (quality === "normal") return "rare";
  if (quality === "rare")   return "elite";
  return null;
}

/** 두 아티팩트의 합성 가능 여부 */
export function canSynthesizeArtifacts(
  a: { quality: ItemQuality; level?: number; enhancement?: number; instanceId: string },
  b: { quality: ItemQuality; level?: number; enhancement?: number; instanceId: string },
): boolean {
  if (a.instanceId === b.instanceId) return false;
  if (a.quality !== b.quality)       return false;
  if (a.quality === "elite")         return false;
  // 양쪽 다 만렙+최대강화를 요구하면 투자를 두 번 해야 해서 상위 등급에 못 닿았다.
  // 성장시킨 쪽(a)만 조건을 채우면 되고, 재료로 녹을 b 는 같은 등급이기만 하면 된다.
  const maxLv = EQUIPMENT_MAX_LEVEL[a.quality];
  return (
    (a.level ?? 1) >= maxLv &&
    (a.enhancement ?? 0) >= MAX_EQUIPMENT_ENHANCEMENT
  );
}

// ─── 방향키 QTE 품질 결정 ──────────────────────────────────────────────────────────

export type ArrowQteRating = "perfect" | "great" | "good" | "bad";

/**
 * 아티팩트 QTE 시험 결과(rating)를 기반으로 아이템 품질을 확률적으로 결정한다.
 *
 * perfect (5/5): Elite 40% · Rare 50% · Normal 10%
 * great   (4/5): Elite 20% · Rare 55% · Normal 25%
 * good    (3/5): Elite  5% · Rare 40% · Normal 55%
 * bad   (0-2/5): Elite  0% · Rare 15% · Normal 85%
 */
export function rollArtifactQualityFromArrowResult(rating: ArrowQteRating): ItemQuality {
  const r = Math.random();

  if (rating === "perfect") {
    if (r < 0.40) return "elite";
    if (r < 0.90) return "rare";
    return "normal";
  }
  if (rating === "great") {
    if (r < 0.20) return "elite";
    if (r < 0.75) return "rare";
    return "normal";
  }
  if (rating === "good") {
    if (r < 0.05) return "elite";
    if (r < 0.45) return "rare";
    return "normal";
  }
  // bad
  if (r < 0.15) return "rare";
  return "normal";
}

// ─── 아티팩트 슬롯 ────────────────────────────────────────────────────────────────
export const ARTIFACT_SLOT_MAP: Record<string, string> = {
  power_necklace: "necklace",
  guard_bracelet: "bracelet",
  spirit_amulet:  "amulet",
};

export const ARTIFACT_SLOT_LABEL: Record<string, string> = {
  necklace: "목걸이",
  bracelet: "팔찌",
  amulet:   "부적",
};

export const ALL_ARTIFACT_SLOTS = ["necklace", "bracelet", "amulet"] as const;

/** 재료로 이 레시피를 몇 개까지 만들 수 있는지. 비용이 0인 항목은 제한이 아니다. */
export function maxCraftable(
  costs: { itemId: string; amount: number }[],
  materials: Record<string, number>,
): number {
  const limits = costs.filter((c) => c.amount > 0);
  if (limits.length === 0) return 0;
  return Math.max(0, Math.min(...limits.map((c) => Math.floor((materials[c.itemId] ?? 0) / c.amount))));
}
