/**
 * Cloud cannons, Cloudreach's set piece: a cannon catches a racer, holds it, then fires it along its
 * aim for a set time (`LevelDef.cannons`). Rides live in `World.cannonRides`.
 */
import { TICK_DT } from '@arcade/core';
import { errorAt, requireTile } from '../level/level-error.ts';
import { isOpenCell, tileCentre, tileOf } from '../level/query.ts';
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
  type Vec,
  type World,
} from '../types.ts';

/**
 * Hold and reload durations in ticks. `parseCannons` enforces `minSpeed` and `maxSpeed` in px/s
 * and `maxFlightTicks` in ticks.
 */
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
  return defs.map((def, index) => {
    const { col, row, dir, speed, flightTicks } = def;
    const name = `Cannon ${index}`;
    const cell = requireTile(cells, `${name} tile`, row, col);
    if (!isOpenCell(cell)) throw errorAt(`${name} tile: expected an open tile, got ${cell}`, row, col);
    if (
      !Array.isArray(dir) ||
      dir.length !== 2 ||
      ![-1, 0, 1].includes(dir[0]) ||
      ![-1, 0, 1].includes(dir[1]) ||
      (dir[0] === 0 && dir[1] === 0)
    ) {
      throw errorAt(
        `${name} direction: expected two components from -1, 0 or 1 with at least one nonzero, got ${JSON.stringify(dir)}`,
        row,
        col,
      );
    }
    if (!(speed >= CANNON.minSpeed && speed <= CANNON.maxSpeed)) {
      throw errorAt(`${name} speed: expected ${CANNON.minSpeed}–${CANNON.maxSpeed} px/s, got ${speed}`, row, col);
    }
    if (!Number.isInteger(flightTicks) || flightTicks < 1 || flightTicks > CANNON.maxFlightTicks) {
      throw errorAt(
        `${name} flightTicks: expected an integer in 1–${CANNON.maxFlightTicks}, got ${flightTicks}`,
        row,
        col,
      );
    }
    const tile = row * (cells[0]?.length ?? 0) + col;
    if (occupied.has(tile)) {
      throw errorAt(`${name} tile: expected an unclaimed tile, got a tile already claimed by a cannon`, row, col);
    }
    occupied.add(tile);
    return { col, row, dir: [dir[0], dir[1]], speed, flightTicks };
  });
}

/**
 * Moves `racer` for this tick if a cannon holds it or has fired it, in place of the medium's
 * movement (`moveRacer` in `world.ts` skips gravity, flaps, dashes and drifts for it).
 *
 * @returns Contacts for the medium's `afterMove`, or null when the medium owns the movement.
 */
export function rideCannon(world: World, racer: Racer, dt: number): MoveContacts | null {
  const ride = activeCannonRide(world, racer.id);
  if (!ride) return null;
  const cannon = world.level.cannons[ride.cannon];
  if (!cannon) return null;
  if (ride.held > 0) {
    snapToCannon(racer, cannon);
    ride.held--;
    if (ride.held > 0) return HELD_CONTACTS;
    ride.flight = cannon.flightTicks;
    world.events.emit({ type: 'cannon.fired', racer: racer.id, cannon: ride.cannon });
  }

  const contacts = moveCannonShot(racer.body, cannon, world.level, world.broken, dt, moveRulesFor(world));
  if (cannon.dir[0] !== 0) racer.facing = cannon.dir[0];
  ride.flight = contacts.lost.x !== 0 || contacts.lost.y !== 0 ? 0 : ride.flight - 1;
  return contacts;
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

/**
 * Trace a shot through the current terrain with a racer-sized body and no other racers.
 *
 * @param canCatch Whether the barrel is ready after the given number of flight ticks.
 * @returns The exit tile and ticks flown when the shot runs out, hits a solid, reaches another
 *   barrel, crosses the finish column or falls below the level, with the index of any receiving barrel.
 */
export function traceCannonShot(
  cannon: CannonDef,
  level: Level,
  broken: ReadonlySet<number>,
  rules: MoveRules,
  canCatch: (cannon: number, ticks: number) => boolean = () => true,
): { exit: Vec; ticks: number; receiver: number | null } {
  const centre = tileCentre({ x: cannon.col, y: cannon.row });
  const { width: w, height: h } = RACER_SIZE;
  const body = { x: centre.x - w / 2, y: centre.y - h / 2, w, h, vx: 0, vy: 0 };
  let exit = { x: cannon.col, y: cannon.row };
  let ticks = 0;
  while (ticks < cannon.flightTicks) {
    ticks++;
    const { lost } = moveCannonShot(body, cannon, level, broken, TICK_DT, rules);
    exit = tileOf({ x: body.x + w / 2, y: body.y + h / 2 });
    if (exit.x >= level.finishX || body.y >= level.height * TILE) break;
    if (exit.x !== cannon.col || exit.y !== cannon.row) {
      const receiver = cannonIndexAt(level, exit);
      if (receiver !== -1 && canCatch(receiver, ticks)) return { exit, ticks, receiver };
    }
    if (lost.x !== 0 || lost.y !== 0) break;
  }
  return { exit, ticks, receiver: null };
}

/** Counts reloads down, closes out spent shots after `afterMove`, then catches racers on barrels. */
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
    if (ride && ride.held > 0 && racer.status.fallen === 0) {
      const cannon = cannons[ride.cannon];
      if (cannon) snapToCannon(racer, cannon);
      continue;
    }
    const tile = tileOf(centreOf(racer));
    // Keep the crossing position for finish order. Standings records it later this tick.
    const crossingLine = tile.x >= world.level.finishX;
    if (ride && (ride.flight === 0 || racer.status.fallen > 0 || crossingLine)) startReload(ride);
    if (crossingLine || racer.finished || racer.status.fallen > 0 || racer.status.trapped > 0) continue;
    const index = cannonIndexAt(world.level, tile);
    const cannon = cannons[index];
    if (!cannon || world.cannonRides.some((entry) => entry.racer === racer.id && entry.cannon === index)) continue;
    if (ride?.reload === 0) startReload(ride);
    snapToCannon(racer, cannon);
    world.cannonRides.push({ racer: racer.id, cannon: index, held: CANNON.holdTicks, flight: 0, reload: 0 });
    world.events.emit({ type: 'cannon.loaded', racer: racer.id, cannon: index });
  }
}

function cannonIndexAt(level: Level, { x, y }: Vec): number {
  return level.cannons.findIndex((cannon) => cannon.col === x && cannon.row === y);
}

function startReload(ride: CannonRide): void {
  ride.held = 0;
  ride.flight = 0;
  ride.reload = CANNON.reloadTicks;
}

function snapToCannon({ body }: Racer, { col, row }: CannonDef): void {
  const centre = tileCentre({ x: col, y: row });
  body.x = centre.x - body.w / 2;
  body.y = centre.y - body.h / 2;
  body.vx = 0;
  body.vy = 0;
}
