import type { PortalData, UnlockZoneData } from "../types/game";

export const baseCampPortals: PortalData[] = [
  {
    id: "battle-gate",
    label: "배틀 포탈",
    position: { x: 980, y: 260 },
    target: "battle",
  },
];

export const baseCampUnlockZones: UnlockZoneData[] = [
  {
    id: "forest-zone",
    name: "숲 지역",
    position: { x: 60, y: 60 },
    width: 220,
    height: 160,
    unlocked: false,
  },
  {
    id: "volcano-zone",
    name: "화산 지역",
    position: { x: 980, y: 60 },
    width: 220,
    height: 160,
    unlocked: false,
  },
];