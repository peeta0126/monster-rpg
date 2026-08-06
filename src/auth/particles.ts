export interface ParticleConfig {
  id: number;
  leftPct: number;
  sizePx: number;
  durationS: number;
  delayS: number;
  colorClass: "particle-ember" | "particle-snow" | "particle-leaf";
}

const COLOR_CLASSES: ParticleConfig["colorClass"][] = ["particle-ember", "particle-snow", "particle-leaf"];

export function generateParticles(): ParticleConfig[] {
  const count = 20 + Math.floor(Math.random() * 11); // 20~30개
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    leftPct: Math.random() * 100,
    sizePx: 2 + Math.random() * 4,
    durationS: 9 + Math.random() * 10,
    delayS: Math.random() * 14,
    colorClass: COLOR_CLASSES[Math.floor(Math.random() * COLOR_CLASSES.length)],
  }));
}
