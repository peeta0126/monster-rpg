import type { ForestAreaId } from "./areas";

export type Point = { x: number; y: number };
export type ForestSceneLayout = {
  image: string;
  entrance: Point;
  paths: Array<{ id: string; exit: Point; waypoints: Point[]; marker: Point; tooltip: Point }>;
};

const coords: Record<2 | 3 | 4, ForestSceneLayout["paths"]> = {
  2: [
    { id: "left", exit: { x: 24, y: 12 }, waypoints: [{ x: 49, y: 75 }, { x: 42, y: 57 }, { x: 31, y: 38 }, { x: 24, y: 17 }], marker: { x: 25, y: 25 }, tooltip: { x: 25, y: 17 } },
    { id: "right", exit: { x: 76, y: 12 }, waypoints: [{ x: 51, y: 75 }, { x: 58, y: 57 }, { x: 69, y: 38 }, { x: 76, y: 17 }], marker: { x: 75, y: 25 }, tooltip: { x: 75, y: 17 } },
  ],
  3: [
    { id: "left", exit: { x: 20, y: 10 }, waypoints: [{ x: 48, y: 76 }, { x: 42, y: 59 }, { x: 29, y: 40 }, { x: 20, y: 15 }], marker: { x: 22, y: 25 }, tooltip: { x: 22, y: 17 } },
    { id: "center", exit: { x: 50, y: 8 }, waypoints: [{ x: 50, y: 74 }, { x: 50, y: 55 }, { x: 50, y: 34 }, { x: 50, y: 13 }], marker: { x: 50, y: 23 }, tooltip: { x: 50, y: 15 } },
    { id: "right", exit: { x: 80, y: 10 }, waypoints: [{ x: 52, y: 76 }, { x: 58, y: 59 }, { x: 71, y: 40 }, { x: 80, y: 15 }], marker: { x: 78, y: 25 }, tooltip: { x: 78, y: 17 } },
  ],
  4: [
    { id: "far-left", exit: { x: 12, y: 12 }, waypoints: [{ x: 48, y: 76 }, { x: 39, y: 60 }, { x: 23, y: 42 }, { x: 12, y: 17 }], marker: { x: 14, y: 25 }, tooltip: { x: 16, y: 17 } },
    { id: "left", exit: { x: 38, y: 9 }, waypoints: [{ x: 49, y: 75 }, { x: 45, y: 57 }, { x: 40, y: 36 }, { x: 38, y: 14 }], marker: { x: 38, y: 24 }, tooltip: { x: 38, y: 16 } },
    { id: "right", exit: { x: 62, y: 9 }, waypoints: [{ x: 51, y: 75 }, { x: 55, y: 57 }, { x: 60, y: 36 }, { x: 62, y: 14 }], marker: { x: 62, y: 24 }, tooltip: { x: 62, y: 16 } },
    { id: "far-right", exit: { x: 88, y: 12 }, waypoints: [{ x: 52, y: 76 }, { x: 61, y: 60 }, { x: 77, y: 42 }, { x: 88, y: 17 }], marker: { x: 86, y: 25 }, tooltip: { x: 84, y: 17 } },
  ],
};

export function getForestSceneLayout(area: ForestAreaId, ways: 2 | 3 | 4): ForestSceneLayout {
  return { image: `/assets/forest/forest-${area}-${ways}way.webp`, entrance: { x: 50, y: 88 }, paths: coords[ways] };
}

export type ForestDepthMood = { brightness: number; saturation: number; vignette: number; fogOpacity: number; overlayColor: string; particleAmount: number };
const MOODS: Record<ForestAreaId, [ForestDepthMood, ForestDepthMood, ForestDepthMood]> = {
  // palette-ok: area-specific atmospheric overlays intentionally extend the UI palette
  shallow: [
    { brightness: 1, saturation: 1.04, vignette: .08, fogOpacity: .02, overlayColor: "#173d2a", particleAmount: .5 },
    { brightness: .9, saturation: .98, vignette: .22, fogOpacity: .1, overlayColor: "#14392f", particleAmount: 1 },
    { brightness: .8, saturation: .9, vignette: .38, fogOpacity: .18, overlayColor: "#0d3330", particleAmount: 1.4 },
  ],
  deep: [
    { brightness: .9, saturation: .95, vignette: .18, fogOpacity: .1, overlayColor: "#0d3740", particleAmount: 1 },
    { brightness: .78, saturation: .9, vignette: .35, fogOpacity: .2, overlayColor: "#0a3444", particleAmount: 1.5 },
    { brightness: .68, saturation: .84, vignette: .5, fogOpacity: .3, overlayColor: "#082c43", particleAmount: 2 },
  ],
  ancient: [
    { brightness: .86, saturation: 1.08, vignette: .2, fogOpacity: .08, overlayColor: "#342050", particleAmount: 1.2 },
    { brightness: .75, saturation: 1.12, vignette: .38, fogOpacity: .16, overlayColor: "#2d1850", particleAmount: 1.8 },
    { brightness: .66, saturation: 1.18, vignette: .52, fogOpacity: .24, overlayColor: "#201245", particleAmount: 2.4 },
  ],
};
export function depthMood(area: ForestAreaId, depth: number): ForestDepthMood { return MOODS[area][depth < 5 ? 0 : depth < 11 ? 1 : 2] }
