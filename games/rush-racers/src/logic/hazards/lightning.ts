/**
 * Lightning: a course hazard over storm zones (`level.lightning`). Each zone runs a cycle of
 * `periodTicks` race ticks shifted by `offsetTicks`: calm, then a warning for `LIGHTNING.warnTicks`,
 * then a strike for `LIGHTNING.strikeTicks` that stuns every racer in its columns at any height, as a
 * flash does. A pure function of the race tick: no rng.
 *
 * Scaffold stub: cloudreach phase 2 lane b fills it in. Until then the sky is always calm.
 */
import type { LightningZone, Racer, World } from '../types.ts';

/** Where a storm zone is in its cycle. */
export type LightningPhase = 'calm' | 'warning' | 'strike';

/**
 * The phase of `zone` on race tick `raceTick`: 'strike' for the last `strikeTicks` of each period,
 * 'warning' for the `warnTicks` before them, 'calm' otherwise, with the period shifted by the zone's
 * `offsetTicks`. The same tick always gives the same phase.
 */
export function lightningPhase(_zone: LightningZone, _raceTick: number): LightningPhase {
  return 'calm';
}

/**
 * The lightning slot of `stepRace`, beside jellies and enemies and before contacts, while racing.
 * Emits `lightning.warned {zone}` on a zone's first warning tick and `lightning.struck {zone}` on its
 * first strike tick, once per cycle, and during a strike hits every racer in `racers` whose box
 * overlaps the zone's columns through `applyHit` with cause 'lightning', so invulnerability, shields
 * and the fallen rule apply as for any hit.
 */
export function strikeLightning(_world: World, _racers: readonly Racer[]): void {}
