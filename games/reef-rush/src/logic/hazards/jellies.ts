/**
 * Jellyfish: bob straight up and down around their home tile on a fixed cycle,
 * and do nothing while stunned. Deterministic: no randomness, position is a pure
 * function of the jelly.
 */
import { type Jelly, TILE, type Vec, type World } from '../types.ts';
import { JELLY } from './tuning.ts';

/**
 * The jellies slot of `stepWorld`. Each call, a stunned jelly counts `stunned` down by one and stays
 * put; any other advances `phase` by one tick (wrapping at JELLY.cycleTicks).
 */
export function moveJellies(world: World): void {
  for (const jelly of world.jellies) {
    if (jelly.stunned > 0) jelly.stunned -= 1;
    else jelly.phase = (jelly.phase + 1) % JELLY.cycleTicks;
  }
}

/**
 * A jelly's centre in world px: its home tile centre, raised by
 * `JELLY.bobAmplitude * sin(2π * phase / JELLY.cycleTicks)` (up first, then down).
 */
export function jellyCentre(jelly: Jelly): Vec {
  const lift = JELLY.bobAmplitude * Math.sin((2 * Math.PI * jelly.phase) / JELLY.cycleTicks);
  return { x: (jelly.home.x + 0.5) * TILE, y: (jelly.home.y + 0.5) * TILE - lift };
}
