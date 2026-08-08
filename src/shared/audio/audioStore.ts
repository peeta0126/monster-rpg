import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AudioSettings {
  bgmVolume: number;   // 0 ~ 1
  sfxVolume: number;
  muted: boolean;
  setBgmVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
}

export const useAudioStore = create<AudioSettings>()(
  persist(
    (set) => ({
      bgmVolume: 0.5,
      sfxVolume: 0.7,
      muted: false,
      setBgmVolume: (v) => set({ bgmVolume: clamp01(v) }),
      setSfxVolume: (v) => set({ sfxVolume: clamp01(v) }),
      setMuted: (muted) => set({ muted }),
    }),
    { name: "monster-rpg-audio" },
  ),
);

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** 실제로 적용될 볼륨 (음소거면 0) */
export function effectiveVolume(kind: "bgm" | "sfx"): number {
  const s = useAudioStore.getState();
  if (s.muted) return 0;
  return kind === "bgm" ? s.bgmVolume : s.sfxVolume;
}
