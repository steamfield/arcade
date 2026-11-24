/**
 * Storm zones: whether a flight rival whose next tiles enter a lightning zone's columns can clear
 * them before the next strike, and where it waits short of them when it can't. It reads the zone's
 * cycle through `lightningPhase`, as the course shows it. Its speed estimate is optimistic by its
 * profile's wobble, so a loose flyer misjudges the crossing more often.
 */
import { TICK_HZ } from '@arcade/core';
import { lightningPhase, racerInZone } from '../../hazards/lightning.ts';
import { hitbox } from '../../racers.ts';
import { type LightningZone, type Racer, TILE, type Vec, type World } from '../../types.ts';
import type { FlightPilotNumbers } from './stick.ts';
import { flightWayAhead } from './way.ts';
import type { FlightRoute, StormHold } from './way-data.ts';

/** Tiles of the way ahead read for a storm zone: room to brake from a dash's speed before it. */
const STORM_LOOK_TILES = 10;
/** Px between the flyer's leading edge and the zone's columns while it waits. */
const WAIT_GAP_PX = 6;
/** Ticks of slack a crossing must leave before the strike. */
const MARGIN_TICKS = 6;
/** Share of cruise it counts on when it is flying slower than that (setting off from a wait). */
const SLOW_SPEED_SHARE = 0.7;
/** How much a wobble of 1 overrates its own speed: 0.5 counts on half as much again. */
const MISJUDGE_PER_WOBBLE = 0.5;

/**
 * Where `racer`, at `tile`, should hold its centre short of a storm zone its next tiles on `route`
 * enter, and the way it will cross; null to fly on: no zone ahead, it is already in one (it flies on
 * out), the race isn't on, or at its estimated speed it clears the zone's columns before the next strike.
 *
 * @throws {Error} When the world's nav isn't flight's.
 */
export function stormWait(
  world: World,
  racer: Racer,
  route: FlightRoute,
  tile: Vec,
  numbers: FlightPilotNumbers,
): StormHold | null {
  if (world.race.phase !== 'racing') return null;
  const ahead = zoneAhead(world, tile, route);
  if (!ahead || racerInZone(world, racer, ahead.zone)) return null;
  const strikeIn = ticksUntilStrike(ahead.zone, world.race.raceTick);
  if (ticksToClear(racer, ahead.zone, ahead.travel, numbers) < strikeIn) return null;
  return { x: waitX(racer, ahead.zone, ahead.travel), travel: ahead.travel };
}

/** The first zone the way from `tile` on `route` enters, and the way it crosses (-1 left, 1 right); null when none. */
function zoneAhead(world: World, tile: Vec, route: FlightRoute): { zone: LightningZone; travel: -1 | 1 } | null {
  for (const step of flightWayAhead(world, tile, STORM_LOOK_TILES, route)) {
    const zone = world.level.lightning.find(({ cols }) => step.x >= cols[0] && step.x <= cols[1]);
    if (zone) return { zone, travel: step.x > tile.x ? 1 : -1 };
  }
  return null;
}

/** Ticks from `raceTick` until the zone next strikes: 0 while it is striking. */
function ticksUntilStrike(zone: LightningZone, raceTick: number): number {
  for (let ahead = 0; ahead < zone.periodTicks; ahead++) {
    if (lightningPhase(zone, raceTick + ahead) === 'strike') return ahead;
  }
  throw new Error(
    `Storm zone over cols ${zone.cols[0]}-${zone.cols[1]} never strikes in its ${zone.periodTicks}-tick period`,
  );
}

/**
 * Ticks the racer's hitbox takes to leave the zone's far side flying `travel`, plus MARGIN_TICKS, at
 * its speed along `travel` (at least SLOW_SPEED_SHARE of cruise) overrated by its wobble.
 */
function ticksToClear(racer: Racer, zone: LightningZone, travel: -1 | 1, numbers: FlightPilotNumbers): number {
  const box = hitbox(racer);
  const farEdge = travel > 0 ? (zone.cols[1] + 1) * TILE : zone.cols[0] * TILE;
  const distance = travel > 0 ? farEdge - box.x : box.x + box.w - farEdge;
  const speed = Math.max(racer.body.vx * travel, numbers.cruise * SLOW_SPEED_SHARE);
  const believed = speed * (1 + racer.profile.wobble * MISJUDGE_PER_WOBBLE);
  return (distance / believed) * TICK_HZ + MARGIN_TICKS;
}

/** The centre x at which the racer's leading edge waits WAIT_GAP_PX short of the zone's near side. */
function waitX(racer: Racer, zone: LightningZone, travel: -1 | 1): number {
  const halfWidth = hitbox(racer).w / 2;
  if (travel > 0) return zone.cols[0] * TILE - WAIT_GAP_PX - halfWidth;
  return (zone.cols[1] + 1) * TILE + WAIT_GAP_PX + halfWidth;
}
