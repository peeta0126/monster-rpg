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

/**
 * 곡을 넘기는 시간(ms). 앞 곡을 다 내린 **뒤에** 뒷 곡을 올린다 — 둘이 같이 나는
 * 구간이 없다. 예전에는 겹쳐 넘겼는데, 곡마다 조성도 박자도 달라서 겹치는 1초 남짓이
 * 두 곡이 싸우는 소리로 들렸다. 이어지는 느낌은 겹침이 아니라 짧은 페이드가 만든다.
 */
const FADE_OUT_MS = 450;
const FADE_IN_MS = 450;

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
  /** 지금 소리를 내고 있나. 다음 곡은 이게 전부 false 가 된 뒤에야 시작한다. */
  playing: boolean;
  /**
   * 소리 없이 한 번 틀어 봐서 "이건 실제로 난다"까지 확인됐나. 자동재생 잠금 해제가
   * 이걸 본다 — 확인된 곡을 잠금 해제라고 다시 걸면 멀쩡한 전환을 끊어 먹는다.
   */
  confirmed: boolean;
  /** 시험 재생의 답을 아직 기다리는 중인가. 기다리는 것을 건드리면 그게 곧 AbortError 다 */
  attempting: boolean;
}

/** 지금 이 화면의 곡. 페이드아웃 중인 앞 곡은 여기 없고 live 에만 남는다. */
let current: Track | null = null;
/** 볼륨 설정이 바뀌면 페이드 중인 것까지 전부 따라와야 한다 */
const live = new Set<Track>();
/**
 * 화면이 마지막으로 요청한 곡. 자동재생 잠금이 풀렸을 때 무엇을 다시 걸지가 이것이다.
 *
 * "막혔다"는 사실만 따로 들고 있으면 안 된다. play() 의 거절은 비동기라, 그 사실이
 * 기록되기 전에 사용자가 화면을 한 번 건드릴 수 있다. 그러면 잠금 해제가 빈손으로
 * 돌아가고 거절은 그 뒤에 도착한다 — 아무도 안 보는 곳에.
 */
let desired: BgmKey | null = null;
/**
 * 앞 곡이 사라지기를 기다리는 다음 곡. 하나만 둔다 — 기다리는 사이에 화면이 또
 * 바뀌면 기다리던 것은 버리고 마지막 것만 켠다.
 */
let pending: (() => void) | null = null;
/** 전환 세대. 늦게 도착한 콜백이 이미 지나간 곡을 켜는 걸 막는다. */
let generation = 0;

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

/**
 * 파일이 없는 것과 "지금은 못 튼다"는 다르다.
 *
 * NotAllowedError 는 자동재생 잠금이고, AbortError 는 재생이 시작되기 전에 우리가
 * pause() 를 부른 것이다(곡을 갈아탈 때 늘 생긴다). 둘 다 warnOnce 로 보내면 그 곡이
 * missing 에 들어가 **영구히** 재생 대상에서 빠진다 — 잠금이 풀려도 다시 못 튼다.
 * 실제로 그랬다: 보스 곡으로 넘어가다 만 전투곡이 missing 에 들어가서, 그 뒤로 전투
 * 화면이 통째로 보스 곡을 달고 있었다.
 */
function isAutoplayBlock(err: unknown): boolean {
  return err instanceof DOMException && err.name === "NotAllowedError";
}

function isTransientPlayError(err: unknown): boolean {
  return isAutoplayBlock(err) || (err instanceof DOMException && err.name === "AbortError");
}

function makeAudio(key: string): HTMLAudioElement {
  const el = new Audio(urlFor(key));
  el.addEventListener("error", () => warnOnce(key), { once: true });
  return el;
}

/**
 * 브라우저 자동재생 정책. 사용자가 한 번 건드리기 전에는 소리가 안 난다.
 *
 * 그래서 일단 틀어 보고, 안 났으면 사용자가 건드릴 때마다 다시 시도한다. 처음부터
 * 잠금 플래그로 막아 두면, 이미 이 사이트에서 소리를 낸 적 있어 브라우저가 허용해
 * 주는 경우(재방문)에도 클릭할 때까지 조용하다.
 */
export function unlockAudio(): void {
  const key = desired;
  if (!key) return;
  if (anyPlaying() || pending) return;   // 이미 나거나, 곧 난다
  // 시험 재생의 답을 기다리는 중이면 그냥 둔다. 여기서 끊으면 그 play() 가 AbortError 로
  // 떨어지고, 그 거절이 또 잠금 해제를 부르는 쳇바퀴가 된다 — 곡은 영영 시작을 못 한다.
  if (current?.attempting) return;
  if (current?.key === key && current.confirmed) return;   // 앞 곡 페이드를 기다리는 중

  // 막혀서 남은 흔적을 치우고 처음부터 다시 건다. 안 치우면 playBgm 의 "같은 곡이면
  // 아무것도 안 한다" 가 걸려서, 소리가 안 나는 채로 영영 그 곡을 트는 중이 된다.
  if (current) { const dead = current; current = null; retire(dead); }
  playBgm(key);
}

/**
 * 사용자가 화면을 건드릴 때마다 잠금 해제를 시도한다. main.tsx 에서 한 번 호출.
 *
 * ⚠️ 예전에는 **첫** 상호작용 한 번만 듣고 리스너를 뗐다. 그런데 자동재생 거절은
 * 비동기라, 페이지가 뜨자마자 아무 데나 한 번 누르면 그 클릭이 잠금 해제를 빈손으로
 * 태워 버린다 — 거절은 그 다음에 도착하고, 다시 시도할 사람은 이미 없다. 그러면
 * 그 뒤로 무슨 짓을 해도 게임이 끝까지 조용하다. 크롬에서 실제로 그랬다.
 *
 * 그래서 리스너는 그냥 살려 둔다. 소리가 나고 있으면 unlockAudio 가 즉시 돌아가므로
 * 클릭마다 붙는 비용은 없는 것이나 같다.
 */
export function installAudioUnlock(): void {
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
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

/**
 * 설정값 × 페이드 계수. 겹치는 구간이 없으니 등파워 보정(√)은 안 쓴다 — 그건 두 곡을
 * 겹칠 때 가운데가 꺼지지 말라고 넣는 것이고, 혼자 사라지는 곡에 쓰면 끝까지 크게
 * 버티다 뚝 떨어지는 것처럼 들린다.
 */
function applyVolume(t: Track) {
  const g = Math.max(0, Math.min(1, t.gain));
  t.el.volume = effectiveVolume("bgm") * g;
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
  t.playing = false;
  t.el.pause();
  live.delete(t);
  startPending();
}

/** 아직 소리를 내고 있는 곡이 하나라도 있나 */
function anyPlaying(): boolean {
  for (const t of live) if (t.playing) return true;
  return false;
}

/** 앞 곡이 전부 사라졌으면 기다리던 곡을 켠다 */
function startPending() {
  if (!pending || anyPlaying()) return;
  const go = pending;
  pending = null;
  go();
}

/**
 * 이 화면의 곡을 건다.
 *
 * 이미 그 곡이 나오고 있으면 아무것도 안 한다. 마을 ↔ 가방 ↔ 내 몬스터처럼 같은 곡을
 * 쓰는 화면을 오갈 때 매번 처음으로 되감기면 안 되니까.
 *
 * 곡이 바뀔 때는 **앞 곡 → 정적 → 뒷 곡** 순서로 간다. 겹치지 않는다.
 */
export function playBgm(
  key: BgmKey,
  { fadeOut = FADE_OUT_MS, fadeIn = FADE_IN_MS } = {},
): void {
  if (missing.has(key)) return;
  desired = key;
  if (current?.key === key) return;

  const gen = ++generation;
  const prev = current;
  const el = makeAudio(key);
  el.loop = true;
  const next: Track = { key, el, gain: 0, raf: null, playing: false, confirmed: false, attempting: true };
  current = next;
  live.add(next);
  applyVolume(next);   // 0 — 아직 안 들린다

  // 소리 없이 한 번 틀어 본다. 여기까지 와야 "이 곡은 실제로 난다"가 확인된다.
  // 확인만 하고 바로 멈춘 뒤, 앞 곡이 사라지면 처음부터 다시 켠다. 확인 전에 앞 곡을
  // 내리면 파일이 없거나 자동재생이 막혔을 때 정적만 남는다.
  void el.play().then(() => {
    next.attempting = false;
    next.confirmed = true;
    el.pause();
    el.currentTime = 0;
    if (gen !== generation) { retire(next); return; }

    pending = () => {
      if (gen !== generation) { retire(next); return; }
      next.playing = true;
      // 페이드는 기다리지 않고 지금 시작한다. play() 가 풀리기를 기다리면 그 사이가
      // 그대로 정적이 된다 — 이미 재생 가능한 걸 확인한 요소라 바로 이어진다.
      void el.play().catch((err: unknown) => {
        if (!isTransientPlayError(err)) warnOnce(key);
        retire(next);
      });
      fadeTo(next, 1, fadeIn);
    };

    // 막 시작한 앞 곡은 짧게 접는다. 로그인 화면의 첫 클릭이 그런데, 그 클릭이
    // 자동재생 잠금을 풀어 타이틀 곡을 켜고 같은 클릭이 마을로 넘긴다. 두 음이
    // 한 소절도 안 나고 사라질 거면 페이드가 길 이유가 없다.
    if (prev && live.has(prev)) {
      fadeTo(prev, 0, prev.el.currentTime < 0.5 ? 120 : fadeOut, () => retire(prev));
    }
    startPending();
  }).catch((err: unknown) => {
    next.attempting = false;
    // 못 틀었으면 없던 일로 되돌린다. 앞 곡은 그대로 흐르고, 다음에 다시 부르면 재시도한다
    if (current === next) current = prev;
    retire(next);
    if (!isTransientPlayError(err)) { warnOnce(key); return; }
    if (!isAutoplayBlock(err)) return;   // 갈아타다 끊긴 것. 다음 곡이 이미 오는 중이다
    // 자동재생 잠금이었다면, 거절이 굴러오는 사이에 이미 사용자가 화면을 건드렸을 수
    // 있다. 그 상호작용은 풀 것이 없어 빈손으로 지나갔으니 여기서 한 번 더 두드린다.
    if (navigator.userActivation?.hasBeenActive) queueMicrotask(unlockAudio);
  });
}

/**
 * 곡을 끈다. 화면을 떠날 때 부르지 마라. 다음 화면이 자기 곡을 걸면 알아서 넘어간다.
 * 여기서 끄면 화면 사이마다 정적이 생긴다. 소리를 아예 없애야 하는 자리
 * (엔딩 정적 연출 같은 것)에만 쓴다.
 */
export function stopBgm({ fade = FADE_OUT_MS } = {}): void {
  generation++;   // 기다리던 다음 곡이 있으면 버린다
  pending = null;
  desired = null; // 여기서 껐는데 다음 클릭이 되살리면 안 된다
  const cur = current;
  if (!cur) return;
  current = null;
  fadeTo(cur, 0, fade, () => retire(cur));
}

// 설정이 바뀌면 재생 중인 BGM 볼륨을 즉시 반영한다. 넘어가는 중이면 사라지는 곡까지.
useAudioStore.subscribe(() => {
  for (const t of live) applyVolume(t);
});
