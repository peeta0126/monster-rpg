import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 전투 진행 설정.
 *
 * 로그가 한 줄마다 Q 를 기다린다. 엔딩까지 대략 8,000번이라 자동 진행이 없으면
 * 손가락이 먼저 지친다(Handoff 6장 1번). 그래서 기본이 자동이다 — 설정을 찾아
 * 켠 사람만 편한 상태로 두지 않는다. 기다리기 싫으면 아무 때나 Q 로 넘기면 되고,
 * 누르고 있으면 더 빨리 흐른다(BattleScene.registerInput).
 *
 * 이미 저장된 설정은 그대로 둔다 — persist 가 저장값을 기본값 위에 덮으므로
 * 손으로 수동을 골라 둔 사람은 계속 수동이다.
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
      autoAdvance: true,
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
