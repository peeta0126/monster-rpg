import { AUDIO_FORMATS, audioUrl, type BgmKey, type SfxKey } from "./keys";
import { effectiveVolume, useAudioStore } from "./audioStore";

/**
 * 사운드 매니저.
 *
 * Phaser 씬과 React 화면이 같은 인터페이스를 쓰도록 HTML Audio 한 겹으로 감쌌다.
 * Phaser 자체 사운드 시스템을 쓰지 않는 이유: 씬이 없는 화면(로그인·가방·공방)에서도
 * 소리가 나야 하는데, 그러면 두 시스템의 볼륨을 따로 관리해야 한다.
 *
 * 규칙 하나 — **에셋이 없어도 절대 죽지 않는다.** 파일이 없으면 경고 한 번만 남기고
 * 조용히 넘어간다. 지금 저장소에는 오디오 파일이 하나도 없고, 그 상태로 게임이
 * 정상 동작해야 한다.
 */

const missing = new Set<string>();
let unlocked = false;
let currentBgm: { key: BgmKey; el: HTMLAudioElement } | null = null;
/** 잠금 해제 전에 요청된 BGM. 첫 클릭 때 재생한다. */
let pendingBgm: { key: BgmKey; loop: boolean; fadeIn: number } | null = null;

const sfxCache = new Map<string, HTMLAudioElement>();

function pickFormat(): string {
  const probe = document.createElement("audio");
  for (const f of AUDIO_FORMATS) {
    const mime = f === "ogg" ? "audio/ogg" : "audio/mp4";
    if (probe.canPlayType(mime)) return f;
  }
  return AUDIO_FORMATS[0];
}

let format: string | null = null;
function urlFor(key: string): string {
  format ??= pickFormat();
  return audioUrl(key, format);
}

function warnOnce(key: string) {
  if (missing.has(key)) return;
  missing.add(key);
  console.warn(`[audio] 파일 없음: ${urlFor(key)} — 소리 없이 계속합니다`);
}

function makeAudio(key: string): HTMLAudioElement {
  const el = new Audio(urlFor(key));
  el.addEventListener("error", () => warnOnce(key), { once: true });
  return el;
}

/**
 * 브라우저 자동재생 정책: 사용자가 한 번 상호작용하기 전에는 소리가 안 난다.
 * 첫 클릭/키입력에서 호출해 잠금을 푼다. 로그인 화면의 "게스트로 시작" 버튼이 좋은 지점.
 */
export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  if (pendingBgm) {
    const p = pendingBgm;
    pendingBgm = null;
    playBgm(p.key, { loop: p.loop, fadeIn: p.fadeIn });
  }
}

/** 첫 상호작용에서 자동으로 잠금을 푼다. main.tsx 에서 한 번 호출. */
export function installAudioUnlock(): void {
  const once = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", once);
    window.removeEventListener("keydown", once);
  };
  window.addEventListener("pointerdown", once);
  window.addEventListener("keydown", once);
}

export function playSfx(key: SfxKey): void {
  const volume = effectiveVolume("sfx");
  if (volume === 0 || missing.has(key)) return;

  // 같은 효과음이 연달아 날 수 있으니 매번 복제해서 재생한다
  let base = sfxCache.get(key);
  if (!base) {
    base = makeAudio(key);
    sfxCache.set(key, base);
  }
  const el = base.cloneNode() as HTMLAudioElement;
  el.volume = volume;
  void el.play().catch(() => warnOnce(key));
}

export function playBgm(key: BgmKey, { loop = true, fadeIn = 400 } = {}): void {
  if (!unlocked) { pendingBgm = { key, loop, fadeIn }; return; }
  if (currentBgm?.key === key) return;
  if (missing.has(key)) return;

  stopBgm({ fadeOut: 250 });

  const el = makeAudio(key);
  el.loop = loop;
  const target = effectiveVolume("bgm");
  el.volume = fadeIn > 0 ? 0 : target;
  currentBgm = { key, el };

  void el.play()
    .then(() => { if (fadeIn > 0) fade(el, target, fadeIn); })
    .catch(() => warnOnce(key));
}

export function stopBgm({ fadeOut = 400 } = {}): void {
  const cur = currentBgm;
  if (!cur) return;
  currentBgm = null;
  if (fadeOut <= 0) { cur.el.pause(); return; }
  fade(cur.el, 0, fadeOut, () => cur.el.pause());
}

function fade(el: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    el.volume = from + (to - from) * t;
    if (t < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

// 설정이 바뀌면 재생 중인 BGM 볼륨을 즉시 반영한다
useAudioStore.subscribe(() => {
  if (currentBgm) currentBgm.el.volume = effectiveVolume("bgm");
});
