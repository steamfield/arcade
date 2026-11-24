/**
 * Screen shake as a trauma model, counted in ticks: events add trauma (0..1), it drains a
 * little every tick, and the offset is the cap times trauma squared times noise, so small
 * knocks stay subtle and big impacts kick hard. The noise is a hash of the tick, so the same
 * tick always shakes the same way and captures repeat. No Phaser in here.
 */

/** Trauma state for one camera. */
export interface Shake {
  /** Adds trauma, capped at 1. */
  add(trauma: number): void;
  /** Drains one tick's worth of trauma. */
  step(): void;
  /** Horizontal offset at `tick`, in whole px. */
  offsetX(tick: number): number;
  /** Vertical offset at `tick`, in whole px. */
  offsetY(tick: number): number;
}

/** Largest offset at full trauma, in px. A few px reads as a jolt on a 320x180 screen. */
export const SHAKE_MAX_PX = 4;
/** Trauma drained per tick: full trauma is gone in 20 ticks (a third of a second). */
const SHAKE_DECAY_PER_TICK = 0.05;

/** Creates a shake with no trauma. */
export function createShake(): Shake {
  let trauma = 0;
  const offset = (tick: number, salt: number) =>
    trauma === 0 ? 0 : Math.round(SHAKE_MAX_PX * trauma * trauma * noise(tick, salt));

  return {
    add(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    step() {
      trauma = Math.max(0, trauma - SHAKE_DECAY_PER_TICK);
    },
    offsetX: (tick) => offset(tick, 1),
    offsetY: (tick) => offset(tick, 2),
  };
}

/** A repeatable value in [-1, 1) for this tick and axis. */
function noise(tick: number, salt: number): number {
  const value = Math.sin(tick * 12.9898 + salt * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}
