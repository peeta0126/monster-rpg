/**
 * 조사 붙이기.
 *
 * 전투 로그는 이 게임에서 제일 자주 읽는 글이라 "○○은(는)" 이 그대로 나가면
 * 매 턴 괄호를 읽게 된다. 이름은 몬스터·기술 표에서 오는 고정 문자열이고
 * 숫자는 경험치·레벨뿐이라, 받침 판정 하나면 전부 덮인다.
 */

/** 마지막 글자의 받침 — 'ㄹ' 은 (으)로 가 따로 갈리므로 구분한다 */
type Final = "none" | "rieul" | "other";

/** 한 자리 숫자를 소리 나는 대로 읽었을 때의 받침 (영·일·이·삼·사·오·육·칠·팔·구) */
const DIGIT_FINAL: Record<string, Final> = {
  "0": "other", "1": "rieul", "2": "none",  "3": "other", "4": "none",
  "5": "none",  "6": "other", "7": "rieul", "8": "rieul", "9": "none",
};

function finalOf(word: string): Final {
  const ch = word.trimEnd().slice(-1);
  if (!ch) return "none";

  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return "none";
    return jong === 8 ? "rieul" : "other";   // 8 = ㄹ
  }
  return DIGIT_FINAL[ch] ?? "none";
}

/** [받침 없을 때, 있을 때] */
const PAIRS = {
  은는: ["는", "은"],
  이가: ["가", "이"],
  을를: ["를", "을"],
  과와: ["와", "과"],
  아야: ["야", "아"],
} as const;

export type JosaPair = keyof typeof PAIRS | "로";

/** 조사만 돌려준다. 대개는 `withJosa` 쪽이 읽기 편하다. */
export function josa(word: string | number, pair: JosaPair): string {
  const f = finalOf(String(word));
  if (pair === "로") return f === "other" ? "으로" : "로";
  return PAIRS[pair][f === "none" ? 0 : 1];
}

/** 말과 조사를 붙여 돌려준다 — `${withJosa(name, "은는")} 쓰러졌다` */
export function withJosa(word: string | number, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}
