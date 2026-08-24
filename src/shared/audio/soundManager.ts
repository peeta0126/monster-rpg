import { AUDIO_FORMATS, audioUrl, type BgmKey, type SfxKey } from "./keys";
import { effectiveVolume, useAudioStore } from "./audioStore";

/**
 * 사운드 매니저.
 *
 * Phaser 씬이랑 React 화면이 같은 인터페이스를 쓰게 HTML Audio 한 겹으로 감쌌다.
 * Phaser 사운드 시스템을 안 쓰는 건, 씬이 없는 화면(로그인·가방·공방)에서도 소리가
 * 나야 해서다. 그걸 섞으면 두 시스템 볼륨을 따로 관리하게 된다.
 *
 * 규칙 하나. 에셋이 없어도 절대 안 죽는다. 파일이 없으면 경고 한 번 남기고 조용히
 * 넘어간다. BGM 여섯 곡은 들어왔지만 효과음은 아직 없고, 그 상태로도 게임이 돌아야 한다.
 */

const missing = new Set<string>();
const sfxCache = new Map<string, HTMLAudioElement>();

/** 곡을 겹쳐 넘기는 시간(ms). 앞 곡이 줄어드는 동안 뒷 곡이 같이 올라온다. */
const CROSSFADE_MS = 700;

interface Track {
  key: BgmKey;
  el: HTMLAudioElement;
  /**
   * 0~1 페이드 계수. 실제 볼륨은 설정값 × 이 값이다.
   * 볼륨을 요소에 바로 써 버리면, 페이드가 도는 동안 슬라이더를 움직였을 때
   * 다음 프레임이 그 값을 덮어써서 "다음 곡부터 적용"처럼 보인다.
   */
  gain: number;
  raf: number | null;
}

/** 지금 이 화면의 곡. 페이드아웃 중인 앞 곡은 여기 없고 live 에만 남는다. */
let current: Track | null = null;
/** 볼륨 설정이 바뀌면 페이드 중인 것까지 전부 따라와야 한다 */
const live = new Set<Track>();
/** 자동재생이 막혀 아직 못 튼 곡. 첫 상호작용에서 다시 시도한다. */
let blocked: BgmKey | null = null;

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
 * 브라우저 자동재생 정책. 사용자가 한 번 건드리기 전에는 소리가 안 난다.
 *
 * 그래서 일단 틀어 보고, 막히면 기억해 뒀다가 첫 클릭에 다시 시도한다. 처음부터
 * 잠금 플래그로 막아 두면, 이미 이 사이트에서 소리를 낸 적 있어 브라우저가 허용해
 * 주는 경우(재방문)에도 클릭할 때까지 조용하다.
 */
export function unlockAudio(): void {
  const key = blocked;
  blocked = null;
  if (key) playBgm(key);
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

/** 설정값 × 페이드 계수. 등파워 곡선이라 두 곡이 겹치는 가운데가 안 꺼진다. */
function applyVolume(t: Track) {
  const g = Math.max(0, Math.min(1, t.gain));
  t.el.volume = effectiveVolume("bgm") * Math.sqrt(g);
}

function fadeTo(t: Track, to: number, ms: number, done?: () => void) {
  if (t.raf !== null) cancelAnimationFrame(t.raf);
  const from = t.gain;
  if (ms <= 0 || from === to) {
    t.gain = to;
    applyVolume(t);
    done?.();
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / ms);
    t.gain = from + (to - from) * p;
    applyVolume(t);
    if (p < 1) t.raf = requestAnimationFrame(step);
    else { t.raf = null; done?.(); }
  };
  t.raf = requestAnimationFrame(step);
}

function retire(t: Track) {
  if (t.raf !== null) cancelAnimationFrame(t.raf);
  t.raf = null;
  t.el.pause();
  live.delete(t);
}

/**
 * 이 화면의 곡을 건다.
 *
 * 이미 그 곡이 나오고 있으면 아무것도 안 한다. 마을 ↔ 가방 ↔ 내 몬스터처럼 같은 곡을
 * 쓰는 화면을 오갈 때 매번 처음으로 되감기면 안 되니까. 곡이 바뀔 때만 앞 곡을
 * 줄이면서 뒷 곡을 올린다.
 */
export function playBgm(key: BgmKey, { fade = CROSSFADE_MS } = {}): void {
  if (current?.key === key) return;
  if (missing.has(key)) return;

  const prev = current;
  const el = makeAudio(key);
  el.loop = true;
  const next: Track = { key, el, gain: 0, raf: null };
  current = next;
  live.add(next);
  applyVolume(next);

  void el.play().then(() => {
    blocked = null;
    // 앞 곡은 뒷 곡이 실제로 나기 시작한 뒤에 줄인다. 먼저 끄면 파일이 없거나
    // 자동재생이 막혔을 때 정적만 남는다.
    //
    // 다만 막 시작한 곡은 안 겹치고 바로 접는다. 로그인 화면의 첫 클릭이 그런데,
    // 그 클릭이 자동재생 잠금을 풀어 타이틀 곡을 켜고 같은 클릭이 마을로 넘긴다.
    // 여기서 700ms 를 겹치면 두 곡이 한꺼번에 뭉개져 들린다.
    if (prev) fadeTo(prev, 0, prev.el.currentTime < 0.5 ? 120 : fade, () => retire(prev));
    fadeTo(next, 1, fade);
  }).catch((err: unknown) => {
    // 못 틀었으면 없던 일로 되돌린다. 앞 곡은 그대로 흐르고, 다음에 다시 부르면 재시도한다
    if (current === next) current = prev;
    retire(next);
    if (err instanceof DOMException && err.name === "NotAllowedError") blocked = key;
    else warnOnce(key);
  });
}

/**
 * 곡을 끈다. 화면을 떠날 때 부르지 마라. 다음 화면이 자기 곡을 걸면 알아서 넘어간다.
 * 여기서 끄면 화면 사이마다 정적이 생긴다. 소리를 아예 없애야 하는 자리
 * (엔딩 정적 연출 같은 것)에만 쓴다.
 */
export function stopBgm({ fade = CROSSFADE_MS } = {}): void {
  const cur = current;
  if (!cur) return;
  current = null;
  fadeTo(cur, 0, fade, () => retire(cur));
}

// 설정이 바뀌면 재생 중인 BGM 볼륨을 즉시 반영한다. 겹쳐 넘기는 중이면 두 곡 다.
useAudioStore.subscribe(() => {
  for (const t of live) applyVolume(t);
});
