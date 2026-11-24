/**
 * UI motion as pure functions of the logic tick, so a capture at tick N always
 * shows the same frame and reduced motion is one flag. `UI.md` lists the
 * rhythms; the kit's own pieces read them from here.
 */

/** The cursor fin holds each of its two positions this many ticks. */
const CURSOR_STEP_TICKS = 16;

/** How far right the cursor fin sits at `tick`: 0 or 1 px, always 0 under reduced motion. */
export function cursorNudge(tick: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return Math.floor(tick / CURSOR_STEP_TICKS) % 2;
}
