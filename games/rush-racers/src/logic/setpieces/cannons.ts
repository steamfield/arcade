/**
 * Cloud cannons, Cloudreach's set piece: a cannon catches a racer, holds it, then fires it along its
 * aim for a set time (`LevelDef.cannons`). Rides live in `World.cannonRides`.
 */
import { TICK_DT } from '@arcade/core';
import { tileCentre, tileOf } from '../ai/steer.ts';
import { errorAt } from '../level/level-error.ts';
import { isRockLike } from '../level/query.ts';
import { mediumOf } from '../media/index.ts';
import { length } from '../num.ts';
import { moveBody, moveRulesFor } from '../race/move.ts';
import { centreOf } from '../racers.ts';
import {
  type Body,
  type CannonDef,
  type CannonRide,
  type Cell,
  type Level,
  type MoveContacts,
  type MoveRules,
  RACER_SIZE,
  type Racer,
  type RacerId,
  TILE,
  type World,
} from '../types.ts';

/** Hold and reload in ticks, launch speed in px/s. */
export const CANNON = {
  holdTicks: 18,
  reloadTicks: 60,
  minSpeed: 60,
  maxSpeed: 1200,
  maxFlightTicks: 120,
} as const;

const HELD_CONTACTS: MoveContacts = {
  floor: false,
  ceiling: false,
  wallLeft: false,
  wallRight: false,
  ceilingTiles: [],
  lost: { x: 0, y: 0 },
};

/**
 * Checks a level's cloud cannons against its cells and returns them in the order written.
 *
 * @throws {LevelError} For a cannon off the map or not on an open tile, a dir of (0, 0) or outside
 *   -1..1, a speed or flightTicks out of range, or two cannons on one tile.
 */
export function parseCannons(defs: readonly CannonDef[], cells: readonly (readonly Cell[])[]): CannonDef[] {
  const occupied = new Set<number>();
  return defs.map((def) => {
    const { col, row, dir, speed, flightTicks } = def;
    const cell = cells[row]?.[col];
    if (!cell) throw errorAt('A cloud cannon is off the map', row, col);
    if (isRockLike(cell) || cell === 'coral' || cell === 'ledge') {
      throw errorAt('A cloud cannon needs an open tile', row, col);
    }
    if (
      !Array.isArray(dir) ||
      dir.length !== 2 ||
      ![-1, 0, 1].includes(dir[0]) ||
      ![-1, 0, 1].includes(dir[1]) ||
      (dir[0] === 0 && dir[1] === 0)
    ) {
      throw errorAt('A cloud cannon direction needs two steps from -1 to 1 and cannot be zero', row, col);
    }
    if (!(speed >= CANNON.minSpeed && speed <= CANNON.maxSpeed)) {
      throw errorAt(`A cloud cannon speed must be ${CANNON.minSpeed}–${CANNON.maxSpeed} px/s`, row, col);
    }
    if (!Number.isInteger(flightTicks) || flightTicks < 1 || flightTicks > CANNON.maxFlightTicks) {
      throw errorAt(`A cloud cannon flightTicks must be a whole number from 1 to ${CANNON.maxFlightTicks}`, row, col);
    }
    const tile = row * (cells[0]?.length ?? 0) + col;
    if (occupied.has(tile)) throw errorAt('Two cloud cannons share the same tile', row, col);
    occupied.add(tile);
    return { col, row, dir: [dir[0], dir[1]], speed, flightTicks };
  });
}

/**
 * Moves `racer` for this tick if a cannon holds it or has fired it, in place of the medium's
 * movement (`moveRacer` in `world.ts` skips gravity, flaps, dashes and drifts for it).
 *
 * @returns true when the racer is riding and has been moved; false to move it the usual way.
 */
export function rideCannon(world: World, racer: Racer, dt: number): boolean {
  const ride = activeCannonRide(world, racer.id);
  if (!ride) return false;
  const cannon = world.level.cannons[ride.cannon];
  if (!cannon) return false;
  if (ride.held > 0) {
    snapToCannon(racer, cannon);
    ride.held--;
    if (ride.held > 0) {
      trackPitFall(world, racer, HELD_CONTACTS);
      return true;
    }
    ride.flight = cannon.flightTicks;
    world.events.emit({ type: 'cannon.fired', racer: racer.id, cannon: ride.cannon });
  }

  const contacts = moveCannonShot(racer.body, cannon, world.level, world.broken, dt, moveRulesFor(world));
  if (cannon.dir[0] !== 0) racer.facing = cannon.dir[0];
  trackPitFall(world, racer, contacts);
  ride.flight--;
  if (ride.flight === 0 || contacts.lost.x !== 0 || contacts.lost.y !== 0 || racer.status.fallen > 0) {
    ride.flight = 0;
    // fireCannons counts this down later in the same tick.
    ride.reload = CANNON.reloadTicks + 1;
  }
  return true;
}

/** A rider over a pit still records safe positions and can fall out of the level. */
function trackPitFall(world: World, racer: Racer, contacts: MoveContacts): void {
  const medium = mediumOf(world);
  if (medium.effects.pitBelow) medium.afterMove(world, racer, contacts, world.events);
}

/** The ride that still owns a racer's movement, if any. Reloads belong to individual cannons. */
export function activeCannonRide(world: World, racer: RacerId): CannonRide | undefined {
  return world.cannonRides.find((ride) => ride.racer === racer && ride.reload === 0);
}

/** A tick of the shot, shared by the real ride and the trajectory estimate. */
function moveCannonShot(
  body: Body,
  cannon: CannonDef,
  level: Level,
  broken: ReadonlySet<number>,
  dt: number,
  rules: MoveRules,
): MoveContacts {
  const [dx, dy] = cannon.dir;
  const speed = cannon.speed / length(dx, dy);
  body.vx = dx * speed;
  body.vy = dy * speed;
  return moveBody(body, level, broken, dt, rules);
}

/** Trace a shot through the current terrain with a racer-sized body and no other racers. */
export function traceCannonShot(
  cannon: CannonDef,
  level: Level,
  broken: ReadonlySet<number>,
  rules: MoveRules,
  maxTicks = cannon.flightTicks,
) {
  const centre = tileCentre({ x: cannon.col, y: cannon.row });
  const { width: w, height: h } = RACER_SIZE;
  const body = { x: centre.x - w / 2, y: centre.y - h / 2, w, h, vx: 0, vy: 0 };
  let ticks = 0;
  const limit = Math.min(cannon.flightTicks, maxTicks);
  while (ticks < limit) {
    ticks++;
    const { lost } = moveCannonShot(body, cannon, level, broken, TICK_DT, rules);
    if (lost.x !== 0 || lost.y !== 0 || body.x + w / 2 >= level.finishX * TILE || body.y >= level.height * TILE) break;
  }
  return { exit: tileOf({ x: body.x + w / 2, y: body.y + h / 2 }), ticks };
}

/** Counts reloads down, centers held riders after bumps, then catches racers who enter a cannon. */
export function fireCannons(world: World, racing: readonly Racer[]): void {
  const cannons = world.level.cannons;
  if (cannons.length === 0) return;
  world.cannonRides = world.cannonRides.filter((ride) => {
    if (world.racers.some((racer) => racer.id === ride.racer && racer.finished)) return false;
    if (ride.reload === 0) return true;
    return --ride.reload > 0;
  });
  for (const racer of racing) {
    const ride = activeCannonRide(world, racer.id);
    if (ride) {
      const cannon = cannons[ride.cannon];
      if (ride.held > 0 && cannon) snapToCannon(racer, cannon);
      continue;
    }
    if (racer.finished || racer.status.fallen > 0 || racer.status.trapped > 0) continue;
    const tile = tileOf(centreOf(racer));
    const index = cannons.findIndex((cannon) => cannon.col === tile.x && cannon.row === tile.y);
    const cannon = cannons[index];
    if (!cannon || world.cannonRides.some((entry) => entry.racer === racer.id && entry.cannon === index)) continue;
    snapToCannon(racer, cannon);
    world.cannonRides.push({ racer: racer.id, cannon: index, held: CANNON.holdTicks, flight: 0, reload: 0 });
    world.events.emit({ type: 'cannon.loaded', racer: racer.id, cannon: index });
  }
}

function snapToCannon({ body }: Racer, { col, row }: CannonDef): void {
  const centre = tileCentre({ x: col, y: row });
  body.x = centre.x - body.w / 2;
  body.y = centre.y - body.h / 2;
  body.vx = 0;
  body.vy = 0;
}
