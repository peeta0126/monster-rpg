import type { ElementType } from "../types/game";

export const typeChart: Record<ElementType, Partial<Record<ElementType, number>>> = {
  fire: {
    grass: 2,
    water: 0.5,
    fire: 0.5,
  },
  water: {
    fire: 2,
    grass: 0.5,
    water: 0.5,
  },
  grass: {
    water: 2,
    fire: 0.5,
    grass: 0.5,
  },
  normal: {},
};