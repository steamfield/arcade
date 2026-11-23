/**
 * Lightning: a course hazard over storm zones (`level.lightning`). Each zone runs a cycle of
 * `periodTicks` race ticks shifted by `offsetTicks`: calm, then a warning for `LIGHTNING.warnTicks`,
 * then a strike for `LIGHTNING.strikeTicks` that stuns every racer in its columns at any height, as a
 * flash does. A pure function of the race tick: no rng.
 */
import { centreOf, hitbox } from '../racers.ts';
import { type Box, type LightningZone, type Racer, TILE, type Vec, type World } from '../types.ts';
import { overlaps } from './boxes.ts';
import { applyHit } from './hits.ts';
import { LIGHTNING } from './tuning.ts';

/** Where a storm zone is in its cycle. */
export type LightningPhase = 'calm' | 'warning' | 'strike';

/** Ticks left in the cycle when the warning begins: the warning and the strike after it. */
const WARNING_TICKS_LEFT = LIGHTNING.warnTicks + LIGHTNING.strikeTicks;

/**
 * The phase of `zone` on race tick `raceTick`: 'strike' for the last `strikeTicks` of each period,
 * 'warning' for the `warnTicks` before them, 'calm' otherwise. The race starts `offsetTicks` into the
 * zone's first cycle, so a zone with offset k is where an unshifted zone will be k ticks later. The
 * same tick always gives the same phase.
 */
export function lightningPhase(zone: LightningZone, raceTick: number): LightningPhase {
  const ticksLeft = zone.periodTicks - cycleTick(zone, raceTick);
  if (ticksLeft <= LIGHTNING.strikeTicks) return 'strike';
  if (ticksLeft <= WARNING_TICKS_LEFT) return 'warning';
  return 'calm';
}

/** How far into its current cycle `zone` is on `raceTick`, from 0 to `periodTicks - 1`. */
function cycleTick(zone: LightningZone, raceTick: number): number {
  const shifted = (raceTick + zone.offsetTicks) % zone.periodTicks;
  // `%` keeps the dividend's sign; the tick before the start (-1) belongs to the cycle before.
  return shifted < 0 ? shifted + zone.periodTicks : shifted;
}

/**
 * The lightning slot of `stepRace`, beside jellies and enemies and before contacts, while racing.
 * Emits `lightning.warned {zone}` on a zone's first warning tick and `lightning.struck {zone}` on its
 * first strike tick, once per cycle, and during a strike hits every racer in `racers` whose box
 * overlaps the zone's columns through `applyHit` with cause 'lightning', so invulnerability, shields
 * and the fallen rule apply as for any hit.
 */
export function strikeLightning(world: World, racers: readonly Racer[]): void {
  if (world.race.phase !== 'racing') return;
  const raceTick = world.race.raceTick;
  world.level.lightning.forEach((zone, index) => {
    const phase = lightningPhase(zone, raceTick);
    if (phase !== lightningPhase(zone, raceTick - 1)) announcePhase(world, index, phase);
    if (phase === 'strike') strikeZone(world, zone, racers);
  });
}

/** Emits the event for zone `zone` entering `phase`; a zone turning calm has none. */
function announcePhase(world: World, zone: number, phase: LightningPhase): void {
  if (phase === 'warning') world.events.emit({ type: 'lightning.warned', zone });
  if (phase === 'strike') world.events.emit({ type: 'lightning.struck', zone });
}

/** Hits every racer whose hitbox overlaps the zone's columns. */
function strikeZone(world: World, zone: LightningZone, racers: readonly Racer[]): void {
  const column = zoneBox(world, zone);
  for (const racer of racers) {
    if (overlaps(hitbox(racer), column)) applyHit(world, racer, 'lightning', null, boltOrigin(racer, column));
  }
}

/** The zone's columns over the level's full height, in world px. */
function zoneBox(world: World, zone: LightningZone): Box {
  const [from, to] = zone.cols;
  return { x: from * TILE, y: 0, w: (to - from + 1) * TILE, h: world.level.height * TILE };
}

/** The bolt comes straight down from the top of the zone, so its knockback pushes the racer down. */
function boltOrigin(racer: Racer, column: Box): Vec {
  return { x: centreOf(racer).x, y: column.y };
}
