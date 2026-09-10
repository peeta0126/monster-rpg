/**
 * 마스터 팔레트. docs/ART_DIRECTION.md 1-2 표의 TypeScript 사본이다.
 *
 * 왜 있냐면, Phaser 가 CSS 변수를 못 읽는다. 씬 코드(`BattleScene`, `BaseCampScene`)는
 * `0xRRGGBB` 숫자나 `"#RRGGBB"` 문자열을 달라고 하니까 index.css 의 @theme 토큰을
 * 그대로 못 쓴다. 그렇다고 씬마다 hex 를 손으로 적으면 화면마다 톤이 갈린다.
 * 그래서 값은 여기만 두고 씬은 이름으로만 갖다 쓴다.
 *
 * ⚠️ index.css 의 @theme 블록이랑 값이 늘 같아야 한다. 색을 바꿀 때는
 *    ART_DIRECTION 1-2 표 → index.css → 이 파일 순서로 셋 다 고쳐라.
 */
import { ELEMENT_KO, elementIdsOf, type ElementType } from "./game";

/** CSS/Phaser 텍스트 스타일용 문자열 형태 */
export const PALETTE = {
  shadow900: "#0D1223",
  shadow800: "#183B4F",
  shadow700: "#1E354A",
  stone600:  "#423D46",
  earth500:  "#844B3F",
  earth400:  "#AC7B62",
  sand300:   "#CDB27E",
  sand200:   "#E0C69B",
  cream100:  "#F3E5B9",
  ember500:  "#E99441",
  ember600:  "#C25828",
  ember700:  "#A83D1F",
  mist300:   "#AEE2D5",
  mist500:   "#5C9396",
  moss500:   "#7A8455",
  moss700:   "#39412A",
  violet500: "#6D4E85",
  rose300:   "#D9A0B0",
  spark400:  "#E8CE72",
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Phaser 도형/틴트용 숫자 형태 (0xRRGGBB) */
export const HEX = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, Number.parseInt(v.slice(1), 16)]),
) as Record<PaletteName, number>;

/**
 * 속성 8종 → 팔레트 토큰.
 *
 * 원래 속성마다 Tailwind 기본 램프(red/blue/green/yellow/cyan/zinc/purple)를 하나씩
 * 쓰고 있었다. 마스터 팔레트는 색상환을 다 안 덮어서 "빨강→ember, 파랑→mist" 식으로
 * 기계적으로 접으면 불/전기가 같은 색, 물/얼음이 같은 색이 돼서 구분이 사라진다.
 *
 * 한동안 그 부족한 자리를 **명도**로 메웠다 — 불 ember-600 / 전기 ember-500,
 * 독은 보라가 없어서 흙빛 earth-500. 12px 칩 하나에서는 그 차이가 안 보인다.
 * 실제로 "불꽃이랑 전기가 같은 색, 독이랑 얼음이 같은 색"이라는 말을 들었다.
 * 그래서 색상환 자리 셋을 팔레트에 추가하고(ART_DIRECTION 1-2) 여덟을 **색상**으로
 * 갈랐다. 지금 남은 명도 짝은 물/얼음(mist-500 · mist-300) 하나뿐이고, 그건
 * "같은 물질의 언 것과 안 언 것"이라 오히려 같은 계열인 편이 읽힌다.
 *
 * 숲·전투·몬스터 화면이 전부 이 표를 보니까 화면마다 따로 정하지 마라.
 */
export const ELEMENT_COLOR = {
  fire:     "ember600",  // 짙은 화염
  electric: "spark400",  // 번개의 금빛. 예전엔 ember-500 이라 불꽃과 한 단계 차이였다
  water:    "mist500",   // 짙은 청록
  ice:      "mist300",   // 밝은 청록. water 보다 밝게
  grass:    "moss500",
  poison:   "violet500", // 늪의 자줏빛. 예전엔 팔레트에 보라가 없어 earth-500 이었다
  crystal:  "rose300",   // 수정이 굴절시킨 빛. 여덟 중 유일한 분홍 자리다
  normal:   "sand300",
} as const satisfies Record<string, PaletteName>;

/**
 * 속성 8종의 한글 이름.
 *
 * 표 자체는 game.ts 에 있다. 여기에도 똑같은 게 한 벌 더 있었는데, 두 벌이면 한쪽만
 * 고쳐도 티가 안 난다. 이름 바꾸는 날 화면 절반만 따라온다는 뜻이다. 부르는 쪽이
 * 팔레트에서 같이 가져다 쓰라고 이름만 다시 내보낸다.
 */
export { ELEMENT_KO };

/**
 * 속성 칩(작은 태그)의 Tailwind 클래스. 배경·테두리가 속성을 구분하고,
 * 글자색은 어두운 패널 위에서 4.5:1 을 넘기는 토큰만 쓴다. ember-600/mist-500/
 * moss-500/earth-500 은 본문 글자로 쓰기엔 너무 어두워서(2.7~3.4:1) sand-200 으로 뺐다.
 * 색을 못 보는 사람한테도 테두리 밝기 차이로 구분은 남는다.
 */
/**
 * 속성 칩의 글자색 토큰. 바로 위 ELEMENT_CHIP_CLASS 의 text-* 와 같은 값이어야 한다.
 * Phaser 가 Tailwind 클래스를 못 읽어서(맨 위 머리말 참고) 씬은 이 표를 쓴다.
 */
export const ELEMENT_CHIP_INK: Record<keyof typeof ELEMENT_COLOR, PaletteName> = {
  fire: "sand200", electric: "spark400", water: "sand200", ice: "mist300",
  grass: "sand200", poison: "sand200", crystal: "rose300", normal: "sand300",
};

export const ELEMENT_CHIP_CLASS: Record<keyof typeof ELEMENT_COLOR, string> = {
  fire:     "bg-ember-600/25  text-sand-200 border-ember-600",
  electric: "bg-spark-400/20  text-spark-400 border-spark-400",
  water:    "bg-mist-500/25   text-sand-200 border-mist-500",
  ice:      "bg-mist-300/20   text-mist-300 border-mist-300",
  grass:    "bg-moss-500/25   text-sand-200 border-moss-500",
  poison:   "bg-violet-500/35 text-sand-200 border-violet-500",
  crystal:  "bg-rose-300/20   text-rose-300 border-rose-300",
  normal:   "bg-shadow-700/80 text-sand-300 border-stone-600",
};

/**
 * 위험 구간 경계(%). 색만이 아니라 맥박 연출도 이 값 하나를 본다. 바는 빨간데
 * 몬스터는 멀쩡하거나 그 반대인 꼴을 안 보려면 경계가 한 벌이어야 한다.
 * 20 이었는데 25 로 올렸다. 20% 면 대개 한 대 더 맞으면 죽는 시점이라 경고를
 * 봐도 손쓸 여지가 없었다.
 */
export const HP_DANGER_PCT = 25;

/**
 * 속성 칩 한 개의 재료(이름·바탕색·글자색).
 *
 * `null` 은 무속성(오름)이다. 약점도 저항도 없다는 뜻이라 속성 이름을 지어내면 안 된다.
 * 그렇다고 비워 두면 "아직 안 불러왔나"로 읽히니까 "?" 로 적는다.
 */
export function elementChip(type: keyof typeof ELEMENT_COLOR | null): {
  label: string; color: PaletteName; ink: PaletteName;
} {
  if (!type) return { label: "?", color: "sand300", ink: "sand300" };
  return { label: ELEMENT_KO[type], color: ELEMENT_COLOR[type], ink: ELEMENT_CHIP_INK[type] };
}

/**
 * HP 잔량(%) → 색 토큰. ART_DIRECTION 3-2 규칙: 100~50% moss / 50~25% ember-500 /
 * 25% 이하 ember-700. 전투 캔버스·전투 UI·몬스터 화면이 전부 이 함수를 쓴다.
 * 세 곳이 각자 경계값을 들고 있으면 같은 HP 인데 화면마다 색이 달라지니까.
 */
export function hpToken(pct: number): PaletteName {
  if (pct > 50) return "moss500";
  if (pct > HP_DANGER_PCT) return "ember500";
  return "ember700";
}

/** 위험 구간인가. 0 이하(기절)는 경고할 대상이 아님 */
export function isHpDanger(pct: number): boolean {
  return pct > 0 && pct <= HP_DANGER_PCT;
}

/** `rgba(r, g, b, a)` 문자열. 그림자·오버레이는 검정 대신 shadow-800/900 을 쓴다 */
export function rgba(name: PaletteName, alpha: number): string {
  const n = HEX[name];
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Phaser 텍스트의 `backgroundColor` 처럼 8자리 hex 를 받는 곳에 쓴다 */
export function withAlpha(name: PaletteName, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return PALETTE[name] + a.toString(16).padStart(2, "0");
}

/**
 * 이중 속성까지 포함한 칩 목록. 주속성이 먼저고, 부속성이 있으면 뒤에 하나 더 붙는다.
 *
 * 화면마다 `m.type2 && ...` 를 손으로 쓰면 어느 화면은 부속성을 빠뜨린다 — 실제로
 * 「내 몬스터」만 한 칸, 전투는 두 칸이 되면 같은 몬스터가 화면마다 다른 속성으로 보인다.
 * 순서도 여기서 정한다(주속성이 먼저다. Monster.type2 주석 참고).
 */
export function elementChips(m: { type: ElementType | null; type2?: ElementType }): Array<{
  label: string; color: PaletteName; ink: PaletteName;
}> {
  const ids = elementIdsOf(m);
  return ids.length === 0 ? [elementChip(null)] : ids.map((t) => elementChip(t));
}

/** 속성 칩 한 줄을 글자로. 로그·툴팁처럼 칩을 못 그리는 자리에서 쓴다 ("얼음 · 크리스탈") */
export function elementLabel(m: { type: ElementType | null; type2?: ElementType }): string {
  return elementChips(m).map((c) => c.label).join(" · ");
}
