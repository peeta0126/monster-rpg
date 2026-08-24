import { monsters } from "../../monster/monsters";
import { PALETTE, type PaletteName } from "../../shared/palette";
import { chainKeyOf } from "../../monster/imprint";
import { scaleToLevel } from "../../shared/floorTable";
import type { Monster } from "../../shared/game";
import type { ForestArea } from "./areas";
import type { Rng } from "./steps";
import { encounterLevelRange } from "./catchLevel";

/**
 * 둥지 후보 뽑기.
 *
 * 원래는 같은 함수를 N 번 따로 불렀다. 같은 종이 두세 번 나오면 레벨만 다른 카드가
 * 늘어서고, 레벨은 높은 게 무조건 좋으니 고를 게 없어진다. 그래서 둘을 건다.
 *   1) 같은 종은 한 번만 나온다.
 *   2) 가능하면 보유한 계열 하나 + 미보유 계열 하나가 섞이게 한다.
 *      그래야 "각인 재료냐 새 식구냐"는 저울이 매 둥지마다 선다.
 *
 * 구역 풀이 좁아서 2번이 안 되면 그냥 중복만 거른다. 억지로 맞추지 않는다.
 *
 * ⚠ 순수 함수다. `ownedChains` 는 걸음에 들어선 시점의 스냅샷을 받는다(run 에 저장된다).
 * 지금 보유 상태를 그대로 읽으면 런 도중에 한 마리 잡는 순간 이미 굴린 후보가 바뀐다.
 * 그건 새로고침으로 후보를 리롤할 수 있다는 뜻이다.
 */
export function rollNestChoices(
  area: ForestArea,
  count: number,
  ownedChains: readonly string[],
  rng: Rng,
  capLevel: number,
): Monster[] {
  const range = encounterLevelRange(area, capLevel);
  if (range === null) return [];   // 이 파티에게 내줄 게 없는 구역
  const pool = [...new Set(area.monsterPool)]
    .map((id) => monsters.find((m) => m.id === id))
    .filter((m): m is Monster => m !== undefined);
  if (pool.length === 0) return [];

  const owned = new Set(ownedChains);
  const isOwned = (m: Monster) => owned.has(chainKeyOf(m));

  // ── 1) 서로 다른 종으로 count 마리 ──
  const rest = [...pool];
  const picked: Monster[] = [];
  for (let i = 0; i < count && rest.length > 0; i++) {
    picked.push(...rest.splice(Math.floor(rng() * rest.length), 1));
  }

  // ── 2) 대비 만들기. 한쪽으로 쏠렸으면 마지막 한 장만 반대쪽으로 바꾼다 ──
  if (picked.length >= 2 && owned.size > 0) {
    const wantOwned = picked.every((m) => !isOwned(m));
    const wantNew   = picked.every((m) => isOwned(m));
    if (wantOwned || wantNew) {
      const alt = rest.filter((m) => (wantOwned ? isOwned(m) : !isOwned(m)));
      if (alt.length > 0) {
        picked[picked.length - 1] = alt[Math.floor(rng() * alt.length)];
      }
    }
  }

  // ── 3) 레벨 ── (조우와 같은 규칙: 구역 레벨대에서 균등, 파티 최고 레벨이 천장)
  const [lvMin, lvMax] = range;
  return picked.map((base) => scaleToLevel(base, lvMin + Math.floor(rng() * (lvMax - lvMin + 1))));
}

export type NestBadgeTone = "new" | "progress" | "done";

export interface NestBadge {
  text: string;
  tone: NestBadgeTone;
}

/**
 * 배지 색. 12px 글자에 강조색을 그대로 쓰면 대비가 4.2:1 까지 떨어지므로,
 * 색은 배경·테두리로만 쓰고 글자는 sand 계열로 둔다(속성 칩과 같은 규칙).
 *
 * 둥지 카드와 포획 화면이 같은 배지를 쓰므로 표는 여기 한 벌만 둔다.
 */
export const BADGE_TONE: Record<NestBadgeTone, { border: PaletteName; text: string }> = {
  new:      { border: "mist300",  text: PALETTE.sand200 },
  progress: { border: "ember500", text: PALETTE.sand200 },
  done:     { border: "stone600", text: PALETTE.earth400 },
};

/**
 * 카드에 붙는 판단 근거. 굴림 밖에서 지금 보유 상태로 만든다.
 * 배지는 최신 정보를 보여야 하고, 굴림은 굴린 그대로 남아야 한다.
 */
export function nestBadge(
  m: Monster,
  ownedChains: ReadonlySet<string>,
  tier: number,
  maxTier: number,
): NestBadge {
  if (!ownedChains.has(chainKeyOf(m))) return { text: "새로운 계열", tone: "new" };
  if (tier >= maxTier) return { text: "각인 완료", tone: "done" };
  return { text: `각인 ${tier}/${maxTier}`, tone: "progress" };
}
