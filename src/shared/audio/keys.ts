/**
 * 사운드 키. assetPaths.ts 와 같은 방식으로 경로를 한 곳에 모은다.
 *
 * 에셋은 아직 없다. 파일이 없으면 조용히 무시되므로(soundManager 참고)
 * 이 목록만 먼저 확정해 두고 호출부를 붙여 둔다.
 */

export const SFX = {
  // UI
  click:   "ui/click",
  hover:   "ui/hover",
  confirm: "ui/confirm",
  cancel:  "ui/cancel",
  error:   "ui/error",
  // 전투
  hit:             "battle/hit",
  critical:        "battle/critical",
  miss:            "battle/miss",
  faint:           "battle/faint",
  levelup:         "battle/levelup",
  capture_success: "battle/capture_success",
  capture_fail:    "battle/capture_fail",
  // 필드
  footstep:      "field/footstep",
  door:          "field/door",
  craft_success: "field/craft_success",
  craft_fail:    "field/craft_fail",
  item_get:      "field/item_get",
} as const;

export const BGM = {
  title:     "bgm/title",
  basecamp:  "bgm/basecamp",
  forest:    "bgm/forest",
  battle:    "bgm/battle",
  boss:      "bgm/boss",
  workshop:  "bgm/workshop",
} as const;

export type SfxKey = (typeof SFX)[keyof typeof SFX];
export type BgmKey = (typeof BGM)[keyof typeof BGM];

/**
 * 브라우저마다 지원 포맷이 갈린다. .ogg 를 먼저 시도하고 안 되면 .m4a 로 떨어진다.
 * (ogg: Chrome/Firefox, m4a: Safari)
 */
export const AUDIO_FORMATS = ["ogg", "m4a"] as const;

export function audioUrl(key: string, format: string): string {
  return `/assets/audio/${key}.${format}`;
}
