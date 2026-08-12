/**
 * 마스터 팔레트 — docs/ART_DIRECTION.md 1-2 표의 TypeScript 사본.
 *
 * 왜 있나: Phaser 는 CSS 변수를 읽지 못한다. 씬 코드(`BattleScene`, `BaseCampScene`)는
 * `0xRRGGBB` 숫자나 `"#RRGGBB"` 문자열을 직접 요구하므로, index.css 의 @theme 토큰을
 * 그대로 쓸 수가 없다. 그렇다고 씬마다 hex 를 손으로 적으면 화면마다 톤이 갈린다.
 * → 값은 여기 한 곳에만 두고, 씬은 이름으로만 참조한다.
 *
 * ⚠️ index.css 의 @theme 블록과 값이 항상 같아야 한다. 색을 바꿀 때는
 *    ART_DIRECTION 1-2 표 → index.css → 이 파일 순서로 셋 다 고칠 것.
 */

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
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Phaser 도형/틴트용 숫자 형태 (0xRRGGBB) */
export const HEX = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, Number.parseInt(v.slice(1), 16)]),
) as Record<PaletteName, number>;

/**
 * 속성 7종 → 팔레트 토큰.
 *
 * 원래 각 속성이 Tailwind 기본 램프(red/blue/green/yellow/cyan/zinc/purple)를 하나씩
 * 쓰고 있었다. 마스터 팔레트는 색상환을 다 덮지 않아서 "빨강→ember, 파랑→mist" 식으로
 * 기계적으로 접으면 불/전기가 같은 색, 물/얼음이 같은 색이 되어 속성 구분이 사라진다.
 *
 * 그래서 색상만이 아니라 명도까지 써서 7개를 전부 다르게 배치했다. 이 표가 숲·전투·
 * 몬스터 화면의 단일 출처다 — 화면마다 따로 정하지 말 것.
 */
export const ELEMENT_COLOR = {
  fire:     "ember600",  // 짙은 화염
  electric: "ember500",  // 밝은 화염 — fire 보다 한 단계 밝게 해서 구분
  water:    "mist500",   // 짙은 청록
  ice:      "mist300",   // 밝은 청록 — water 보다 밝게
  grass:    "moss500",
  poison:   "earth500",  // 팔레트에 보라가 없다. 탁한 흙빛으로 대체 (ART_DIRECTION 1-2 표에 보라 추가 시 교체)
  normal:   "sand300",
} as const satisfies Record<string, PaletteName>;

/** 속성 7종의 한글 이름. 칩·툴팁이 같은 이름을 쓰게 여기 한 벌만 둔다. */
export const ELEMENT_KO: Record<keyof typeof ELEMENT_COLOR, string> = {
  fire: "불꽃", water: "물", grass: "풀", electric: "전기",
  ice: "얼음", poison: "독", normal: "노말",
};

/**
 * 속성 칩(작은 태그) 의 Tailwind 클래스. 배경·테두리가 속성을 구분하고,
 * 글자색은 어두운 패널 위에서 4.5:1 을 넘기는 토큰만 쓴다 — ember-600/mist-500/
 * moss-500/earth-500 은 본문 글자로 쓰기엔 너무 어두워서(2.7~3.4:1) sand-200 으로 뺐다.
 * 색을 못 보는 사람에게도 테두리 밝기 차이로 구분이 남는다.
 */
/**
 * 속성 칩의 글자색 토큰. 바로 위 ELEMENT_CHIP_CLASS 의 text-* 와 같은 값이어야 한다 —
 * Phaser 는 Tailwind 클래스를 못 읽어서(palette.ts 머리말 참고) 씬이 이 표를 쓴다.
 */
export const ELEMENT_CHIP_INK: Record<keyof typeof ELEMENT_COLOR, PaletteName> = {
  fire: "sand200", electric: "ember500", water: "sand200", ice: "mist300",
  grass: "sand200", poison: "sand200", normal: "sand300",
};

export const ELEMENT_CHIP_CLASS: Record<keyof typeof ELEMENT_COLOR, string> = {
  fire:     "bg-ember-600/25 text-sand-200 border-ember-600",
  electric: "bg-ember-500/20 text-ember-500 border-ember-500",
  water:    "bg-mist-500/25  text-sand-200 border-mist-500",
  ice:      "bg-mist-300/20  text-mist-300 border-mist-300",
  grass:    "bg-moss-500/25  text-sand-200 border-moss-500",
  poison:   "bg-earth-500/30 text-sand-200 border-earth-500",
  normal:   "bg-shadow-700/80 text-sand-300 border-stone-600",
};

/**
 * 위험 구간의 경계(%). 색만이 아니라 맥박 연출도 이 값 하나를 본다 — 바는 빨간데
 * 몬스터는 멀쩡하거나, 그 반대인 상태를 만들지 않으려면 경계가 한 벌이어야 한다.
 * 20 이었는데 25 로 올렸다: 20% 면 대개 한 대 더 맞으면 죽는 시점이라, 경고를 보고
 * 손쓸 여지가 없었다.
 */
export const HP_DANGER_PCT = 25;

/**
 * 속성 칩 한 개의 재료(이름·바탕색·글자색).
 *
 * `null` 은 무속성(오름)이다. 약점도 저항도 없다는 뜻이라 속성 이름을 지어내면 안 되고,
 * 자리를 비워도 안 된다 — 비우면 "아직 안 불러왔나"로 읽힌다. 그래서 "?" 로 적는다.
 */
export function elementChip(type: keyof typeof ELEMENT_COLOR | null): {
  label: string; color: PaletteName; ink: PaletteName;
} {
  if (!type) return { label: "?", color: "sand300", ink: "sand300" };
  return { label: ELEMENT_KO[type], color: ELEMENT_COLOR[type], ink: ELEMENT_CHIP_INK[type] };
}

/**
 * HP 잔량(%) → 색 토큰. ART_DIRECTION 3-2 규칙: 100~50% moss / 50~25% ember-500 /
 * 25% 이하 ember-700. 전투 캔버스·전투 UI·몬스터 화면이 전부 이 함수를 쓴다 —
 * 세 곳이 각자 경계값을 들고 있으면 같은 HP 인데 화면마다 색이 달라진다.
 */
export function hpToken(pct: number): PaletteName {
  if (pct > 50) return "moss500";
  if (pct > HP_DANGER_PCT) return "ember500";
  return "ember700";
}

/** 위험 구간인가. 0 이하(기절)는 경고할 대상이 아니다. */
export function isHpDanger(pct: number): boolean {
  return pct > 0 && pct <= HP_DANGER_PCT;
}

/** `rgba(r, g, b, a)` 문자열. 그림자·오버레이는 검정 대신 shadow-800/900 을 쓴다. */
export function rgba(name: PaletteName, alpha: number): string {
  const n = HEX[name];
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Phaser 텍스트의 `backgroundColor` 처럼 8자리 hex 를 받는 곳에 쓴다. */
export function withAlpha(name: PaletteName, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return PALETTE[name] + a.toString(16).padStart(2, "0");
}
