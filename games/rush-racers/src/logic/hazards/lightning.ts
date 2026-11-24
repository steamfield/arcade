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
  // `%` keeps the dividend's sign, so a negative tick needs a period added to land in the cycle.
  return shifted < 0 ? shifted + zone.periodTicks : shifted;
}

/**
 * The lightning slot of `stepRace`, beside jellies and enemies and before contacts, while racing.
 * Emits `lightning.warned {zone}` on a zone's first warning tick and `lightning.struck {zone}` on its
 * first strike tick, once per cycle, and during a strike hits every racer in `racers` whose box
 * overlaps the zone's columns through `applyHit` with cause 'lightning', so invulnerability, shields
 * and the fallen rule apply as for any hit. The sky counts as calm before the start, so a zone
 * already warning or striking on race tick 0 announces it then.
 */
export function strikeLightning(world: World, racers: readonly Racer[]): void {
  const raceTick = world.race.raceTick;
  world.level.lightning.forEach((zone, index) => {
    const phase = lightningPhase(zone, raceTick);
    if (phase !== phaseBefore(zone, raceTick)) announcePhase(world, index, phase);
    if (phase === 'strike') strikeZone(world, zone, racers);
  });
}

/** The zone's phase on the tick before `raceTick`, calm before the race started. */
function phaseBefore(zone: LightningZone, raceTick: number): LightningPhase {
  return raceTick === 0 ? 'calm' : lightningPhase(zone, raceTick - 1);
}

/** Emits the event for zone `zone` entering `phase`; a zone turning calm has none. */
function announcePhase(world: World, zone: number, phase: LightningPhase): void {
  if (phase === 'warning') world.events.emit({ type: 'lightning.warned', zone });
  if (phase === 'strike') world.events.emit({ type: 'lightning.struck', zone });
}

/** Hits every racer in the zone (`racerInZone`). */
function strikeZone(world: World, zone: LightningZone, racers: readonly Racer[]): void {
  for (const racer of racers) {
    if (racerInZone(world, racer, zone)) applyHit(world, racer, 'lightning', null, boltOrigin(racer));
  }
}

/**
 * True when a strike of `zone` hits `racer`: its hitbox overlaps the zone's columns over the level's
 * full height by some positive area (touching the zone's edge doesn't count).
 */
export function racerInZone(world: World, racer: Racer, zone: LightningZone): boolean {
  return overlaps(hitbox(racer), zoneBox(world, zone));
}

/** The zone's columns over the level's full height, in world px. */
function zoneBox(world: World, zone: LightningZone): Box {
  const [from, to] = zone.cols;
  return { x: from * TILE, y: 0, w: (to - from + 1) * TILE, h: world.level.height * TILE };
}

/**
 * Where a strike knocks the racer back from: level with its centre, one tile ahead along its facing,
 * as a flash from ahead would. The knockback then pushes it back against its travel in every medium,
 * including those that only knock back horizontally.
 */
function boltOrigin(racer: Racer): Vec {
  const centre = centreOf(racer);
  return { x: centre.x + racer.facing * TILE, y: centre.y };
}
