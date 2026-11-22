/**
 * Jellyfish: bob straight up and down around their home tile on a fixed cycle,
 * and do nothing while stunned. Deterministic: no randomness, position is a pure
 * function of the jelly. Lane 3/b implements it; the scaffold ships the signatures.
 */
import type { Jelly, Vec, World } from '../types.ts';

/**
 * The jellies slot of `stepWorld`. Each call, a stunned jelly counts `stunned` down by one and stays
 * put; any other advances `phase` by one tick (wrapping at JELLY.cycleTicks).
 *
 * Stub: does nothing until lane 3/b lands, so races on the current course keep running.
 */
export function moveJellies(world: World): void {
  void world;
}

/**
 * A jelly's centre in world px: its home tile centre, raised by
 * `JELLY.bobAmplitude * sin(2π * phase / JELLY.cycleTicks)` (up first, then down).
 */
export function jellyCentre(jelly: Jelly): Vec {
  void jelly;
  throw new Error('not implemented');
}
