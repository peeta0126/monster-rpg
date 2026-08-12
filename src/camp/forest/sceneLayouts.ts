import type { ForestAreaId } from "./areas";
// palette-ok: file-level forest atmosphere

export type Point = { x: number; y: number };
export type ForestSceneLayout = {
  image: string;
  entrance: Point;
  paths: Array<{ id: string; exit: Point; waypoints: Point[]; marker: Point; tooltip: Point; hitArea: Point & { width: number; height: number } }>;
};

const coords: Record<2 | 3 | 4, ForestSceneLayout["paths"]> = {
  2: [
    { id: "left", exit: { x: 30, y: 14 }, waypoints: [{ x: 49, y: 66 }, { x: 44, y: 54 }, { x: 36, y: 40 }, { x: 30, y: 23 }], marker: { x: 31, y: 30 }, tooltip: { x: 31, y: 22 }, hitArea: { x: 17, y: 14, width: 28, height: 35 } },
    { id: "right", exit: { x: 70, y: 14 }, waypoints: [{ x: 51, y: 66 }, { x: 56, y: 54 }, { x: 64, y: 40 }, { x: 70, y: 23 }], marker: { x: 69, y: 30 }, tooltip: { x: 69, y: 22 }, hitArea: { x: 55, y: 14, width: 28, height: 35 } },
  ],
  3: [
    { id: "left", exit: { x: 25, y: 13 }, waypoints: [{ x: 49, y: 66 }, { x: 43, y: 53 }, { x: 32, y: 39 }, { x: 25, y: 22 }], marker: { x: 27, y: 29 }, tooltip: { x: 27, y: 21 }, hitArea: { x: 13, y: 13, width: 25, height: 35 } },
    { id: "center", exit: { x: 50, y: 10 }, waypoints: [{ x: 50, y: 65 }, { x: 50, y: 51 }, { x: 50, y: 35 }, { x: 50, y: 20 }], marker: { x: 50, y: 27 }, tooltip: { x: 50, y: 19 }, hitArea: { x: 39, y: 10, width: 22, height: 36 } },
    { id: "right", exit: { x: 75, y: 13 }, waypoints: [{ x: 51, y: 66 }, { x: 57, y: 53 }, { x: 68, y: 39 }, { x: 75, y: 22 }], marker: { x: 73, y: 29 }, tooltip: { x: 73, y: 21 }, hitArea: { x: 62, y: 13, width: 25, height: 35 } },
  ],
  4: [
    { id: "far-left", exit: { x: 17, y: 14 }, waypoints: [{ x: 48, y: 66 }, { x: 40, y: 54 }, { x: 27, y: 40 }, { x: 17, y: 23 }], marker: { x: 19, y: 29 }, tooltip: { x: 20, y: 21 }, hitArea: { x: 7, y: 13, width: 22, height: 35 } },
    { id: "left", exit: { x: 39, y: 11 }, waypoints: [{ x: 49, y: 65 }, { x: 46, y: 51 }, { x: 42, y: 35 }, { x: 39, y: 20 }], marker: { x: 39, y: 27 }, tooltip: { x: 39, y: 19 }, hitArea: { x: 29, y: 10, width: 20, height: 35 } },
    { id: "right", exit: { x: 61, y: 11 }, waypoints: [{ x: 51, y: 65 }, { x: 54, y: 51 }, { x: 58, y: 35 }, { x: 61, y: 20 }], marker: { x: 61, y: 27 }, tooltip: { x: 61, y: 19 }, hitArea: { x: 51, y: 10, width: 20, height: 35 } },
    { id: "far-right", exit: { x: 83, y: 14 }, waypoints: [{ x: 52, y: 66 }, { x: 60, y: 54 }, { x: 73, y: 40 }, { x: 83, y: 23 }], marker: { x: 81, y: 29 }, tooltip: { x: 80, y: 21 }, hitArea: { x: 71, y: 13, width: 22, height: 35 } },
  ],
};

export function getForestSceneLayout(area: ForestAreaId, ways: 2 | 3 | 4): ForestSceneLayout {
  return { image: `/assets/forest/forest-${area}-${ways}way.webp`, entrance: { x: 50, y: 71 }, paths: coords[ways] };
}

export type ForestDepthMood = { brightness: number; saturation: number; vignette: number; fogOpacity: number; overlayColor: string; particleAmount: number };
const MOODS: Record<ForestAreaId, [ForestDepthMood, ForestDepthMood, ForestDepthMood]> = {
  // palette-ok: area-specific atmospheric overlays intentionally extend the UI palette.
  shallow: [
    { brightness: 1, saturation: 1.04, vignette: .08, fogOpacity: .02, overlayColor: "#39412A", particleAmount: .5 },
    { brightness: .9, saturation: .98, vignette: .22, fogOpacity: .1, overlayColor: "#39412A", particleAmount: 1 },
    { brightness: .8, saturation: .9, vignette: .38, fogOpacity: .18, overlayColor: "#183B4F", particleAmount: 1.4 },
  ],
  deep: [
    { brightness: .9, saturation: .95, vignette: .18, fogOpacity: .1, overlayColor: "#183B4F", particleAmount: 1 },
    { brightness: .78, saturation: .9, vignette: .35, fogOpacity: .2, overlayColor: "#1E354A", particleAmount: 1.5 },
    { brightness: .68, saturation: .84, vignette: .5, fogOpacity: .3, overlayColor: "#0D1223", particleAmount: 2 },
  ],
  ancient: [
    { brightness: .86, saturation: 1.08, vignette: .2, fogOpacity: .08, overlayColor: "#423D46", particleAmount: 1.2 },
    { brightness: .75, saturation: 1.12, vignette: .38, fogOpacity: .16, overlayColor: "#1E354A", particleAmount: 1.8 },
    { brightness: .66, saturation: 1.18, vignette: .52, fogOpacity: .24, overlayColor: "#0D1223", particleAmount: 2.4 },
  ],
};
export function depthMood(area: ForestAreaId, depth: number): ForestDepthMood { return MOODS[area][depth < 5 ? 0 : depth < 11 ? 1 : 2] }
