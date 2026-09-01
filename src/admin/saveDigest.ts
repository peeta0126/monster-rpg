/**
 * 세이브 한 벌을 사람이 읽는 모양으로 푼다.
 *
 * 이름을 붙이는 일은 여기서만 한다. 서버는 세이브를 그대로 넘기고 숫자만 세어 주는데
 * (`server/src/saveSummary.ts`), 몬스터·재료·물약·퀘스트 이름표가 전부 게임 쪽에 있기
 * 때문이다. 서버로 표를 복사해 오면 게임에서 이름을 고친 날 관리 화면만 옛 이름을 보여준다.
 *
 * 세이브는 브라우저가 만든 문자열이라 모양을 믿지 않는다. 옛 판·깨진 판이 섞여 들어와도
 * 화면이 죽으면 안 된다 — 못 읽은 자리는 비워 두고 나머지를 보여준다.
 */

import { monsters, DEX_TOTAL, dexCount } from "../monster/monsters";
import { MATERIALS, POTIONS } from "../shared/items";
import { ALL_QUESTS } from "../camp/campDialogues";
import { QUALITY_LABEL } from "../shared/craftingUtils";
import type { ItemQuality } from "../shared/crafting";
import type { QuestStatus } from "../shared/storyFlags";

export interface MonsterLine {
  key: string;
  name: string;
  level: number;
  hp: string;
  /** 장착한 아티팩트 이름. 파티에서만 채워진다 */
  gear: string[];
}

export interface CountLine {
  key: string;
  name: string;
  count: number;
}

export interface ArtifactLine {
  key: string;
  name: string;
  quality: string;
  /** "Lv.4 +2" 처럼. 레벨·강화가 없는 옛 세이브는 빈 문자열 */
  grade: string;
  /** 끼고 있는 몬스터 이름. 가방에 있는 것은 undefined */
  equippedTo?: string;
}

export interface QuestLine {
  id: string;
  title: string;
  status: QuestStatus;
}

export interface FlagLine {
  key: string;
  label: string;
  done: boolean;
}

export interface SaveDigest {
  bestFloor: number;
  towerCleared: boolean;
  party: MonsterLine[];
  storage: MonsterLine[];
  dexCaught: number;
  dexSeen: number;
  dexTotal: number;
  materials: CountLine[];
  potions: CountLine[];
  /** 장착한 것과 가방에 있는 것을 합친 전부. 장착분은 equippedTo 가 채워져 있다 */
  artifacts: ArtifactLine[];
  equippedCount: number;
  quests: QuestLine[];
  flags: FlagLine[];
}

/**
 * 스토리 플래그의 한글 이름.
 *
 * 게임 화면에는 이 이름이 없다 — 플래그는 대사 조건으로만 쓰이는 내부 값이라 어디에도
 * 글자로 나오지 않는다. 그래서 여기 적는 것은 표를 두 벌 만드는 게 아니라 없던 이름을
 * 처음 붙이는 일이다. 플래그를 더하면 여기도 같이 더한다.
 */
const FLAG_LABEL: Record<string, string> = {
  met_orion: "이장 오리온과 만남",
  met_baros: "사냥꾼 바로스와 만남",
  first_capture: "첫 포획",
  quest_baros_done: "바로스 첫 의뢰 완료",
  quest_orion_done: "오리온 첫 의뢰 완료",
  tower_cleared: "탑 완주 · 엔딩",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : [];
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** 아티팩트 한 줄. 파티 몬스터의 장착 목록과 창고 목록이 같은 모양이라 같이 쓴다 */
function artifactLine(raw: Record<string, unknown>, index: number, equippedTo?: string): ArtifactLine {
  const level = num(raw.level, 1);
  const enhancement = num(raw.enhancement, 0);
  const quality = str(raw.quality) as ItemQuality | null;

  return {
    key: (str(raw.instanceId) ?? `artifact-${index}`) + (equippedTo ? "-eq" : ""),
    equippedTo,
    name: str(raw.name) ?? str(raw.itemId) ?? "이름 없는 장비",
    quality: quality && quality in QUALITY_LABEL ? QUALITY_LABEL[quality] : "",
    grade: [level > 1 ? `Lv.${level}` : "", enhancement > 0 ? `+${enhancement}` : ""]
      .filter(Boolean)
      .join(" "),
  };
}

function monsterLine(
  raw: Record<string, unknown>,
  index: number,
  gear: Record<string, unknown>,
): MonsterLine {
  const uid = str(raw.uid) ?? `monster-${index}`;
  // 이름은 세이브에 그대로 들어 있다. 표를 뒤지는 건 옛 세이브가 이름 없이 id 만 들고
  // 있을 때의 폴백이다.
  const fromTable = monsters.find((m) => m.id === str(raw.id));

  return {
    key: uid,
    name: str(raw.nickname) ?? str(raw.name) ?? fromTable?.name ?? str(raw.id) ?? "?",
    level: num(raw.level),
    hp: `${num(raw.currentHp)} / ${num(raw.maxHp, fromTable?.maxHp ?? 0)}`,
    gear: asArray(gear[uid]).map((a, i) => artifactLine(a, i).name),
  };
}

/** { id: 개수 } 를 이름 붙인 줄로. 표에 없는 id 는 id 를 그대로 쓴다 — 지어내지 않는다 */
function countLines(raw: unknown, table: { id: string; name: string }[]): CountLine[] {
  return Object.entries(asRecord(raw))
    .map(([id, value]) => ({
      key: id,
      name: table.find((t) => t.id === id)?.name ?? id,
      count: num(value),
    }))
    .filter((line) => line.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function digestSave(raw: string | null): SaveDigest | null {
  if (!raw) return null;

  let state: Record<string, unknown>;
  try {
    state = asRecord(JSON.parse(raw));
  } catch {
    return null;
  }

  const flags = asRecord(state.storyFlags);
  const questStatus = asRecord(state.questStatus);
  const gear = asRecord(state.equippedArtifacts);

  const party   = asArray(state.party).map((m, i) => monsterLine(m, i, gear));
  const storage = asArray(state.storage).map((m, i) => monsterLine(m, i, {}));

  /**
   * 장비는 두 군데에 나뉘어 산다 — 가방(`craftedArtifacts`)과 몬스터가 낀 것
   * (`equippedArtifacts`). 가방만 세면 "장비 0개" 라고 적으면서 바로 위 파티 줄에는
   * 장비 이름 세 개가 보인다. 실제로 그렇게 나왔다.
   */
  const nameOfUid = new Map([...party, ...storage].map((m) => [m.key, m.name]));
  const equipped: ArtifactLine[] = Object.entries(gear).flatMap(([uid, list]) =>
    asArray(list).map((a, i) => artifactLine(a, i, nameOfUid.get(uid) ?? uid)),
  );

  const dexSeenIds   = Array.isArray(state.dexSeen) ? (state.dexSeen as string[]) : [];
  const dexCaughtIds = Array.isArray(state.dexCaught) ? (state.dexCaught as string[]) : [];

  return {
    bestFloor: num(state.bestFloor),
    towerCleared: flags.tower_cleared === true,
    party,
    storage,
    // 도감 계산은 monsters.ts 한 벌(DEX_TOTAL·dexCount). 여기서 세면 「내 몬스터」 화면과 갈린다
    dexCaught: dexCount(dexCaughtIds),
    dexSeen:   dexCount(dexSeenIds),
    dexTotal:  DEX_TOTAL,
    materials: countLines(state.materials, MATERIALS),
    potions:   countLines(state.potions, POTIONS),
    artifacts: [...equipped, ...asArray(state.craftedArtifacts).map((a, i) => artifactLine(a, i))],
    equippedCount: equipped.length,
    quests: ALL_QUESTS.map((q) => ({
      id: q.id,
      title: q.title,
      status: (str(questStatus[q.id]) ?? "not_accepted") as QuestStatus,
    })),
    flags: Object.entries(FLAG_LABEL).map(([key, label]) => ({
      key,
      label,
      done: flags[key] === true,
    })),
  };
}
