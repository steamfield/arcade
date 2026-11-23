/**
 * What the run course's How to Play pages share: the floor the racer stands on, where a racer
 * sprite sits on it, and the arc of a jump.
 */
import type { PageKit } from './kit.ts';

/** The floor line's top. */
export const FLOOR_Y = 86;
/** Half the height of a racer sprite at 2x. */
export const RACER_HALF_HEIGHT = 12;
const FLOOR = { centreX: 168, width: 120, thickness: 3, colour: 0x6b4423 } as const;

/** A jump: when it starts, how long Up is held, how long it lasts and how high it peaks (px). */
export interface Jump {
  startTick: number;
  holdTicks: number;
  airTicks: number;
  peakPx: number;
}

/** How far above the floor a racer is `tick` ticks into `jump`: a parabola, 0 before and after. */
export function liftAt(jump: Jump, tick: number): number {
  const along = (tick - jump.startTick) / jump.airTicks;
  if (along <= 0 || along >= 1) return 0;
  return jump.peakPx * 4 * along * (1 - along);
}

/** Draws the floor strip the racer stands on, shown and hidden with the page. */
export function addFloor(kit: PageKit): void {
  kit.bar(FLOOR.centreX, FLOOR_Y + FLOOR.thickness / 2, FLOOR.width, FLOOR.thickness, FLOOR.colour);
}

/** The y that centres a racer sprite standing on the floor, `lift` px in the air. */
export function racerCentreY(lift: number): number {
  return FLOOR_Y - RACER_HALF_HEIGHT - Math.round(lift);
}
