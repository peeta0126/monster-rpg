import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 전투 진행 설정.
 *
 * 로그가 한 줄마다 Q 를 기다린다. 엔딩까지 대략 8,000번이라 자동 진행이 없으면
 * 손가락이 먼저 지친다(Handoff 6장 1번).
 */

export const LOG_SPEEDS = [
  { id: "slow",   label: "느림", ms: 1400 },
  { id: "normal", label: "보통", ms: 900 },
  { id: "fast",   label: "빠름", ms: 450 },
] as const;

export type LogSpeedId = (typeof LOG_SPEEDS)[number]["id"];

interface BattleSettings {
  autoAdvance: boolean;
  logSpeed: LogSpeedId;
  toggleAuto: () => void;
  cycleSpeed: () => void;
}

export const useBattleSettings = create<BattleSettings>()(
  persist(
    (set, get) => ({
      autoAdvance: false,
      logSpeed: "normal",
      toggleAuto: () => set({ autoAdvance: !get().autoAdvance }),
      cycleSpeed: () => {
        const i = LOG_SPEEDS.findIndex((s) => s.id === get().logSpeed);
        set({ logSpeed: LOG_SPEEDS[(i + 1) % LOG_SPEEDS.length].id });
      },
    }),
    { name: "monster-rpg-battle-settings" },
  ),
);

export function logSpeedMs(id: LogSpeedId): number {
  return LOG_SPEEDS.find((s) => s.id === id)?.ms ?? 900;
}
