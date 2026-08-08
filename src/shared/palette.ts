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
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Phaser 도형/틴트용 숫자 형태 (0xRRGGBB) */
export const HEX = Object.fromEntries(
  Object.entries(PALETTE).map(([k, v]) => [k, Number.parseInt(v.slice(1), 16)]),
) as Record<PaletteName, number>;

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
