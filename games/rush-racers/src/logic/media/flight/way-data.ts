/**
 * Flight's navigation and rival pilot shapes, extending the opaque bases in `media/types.ts` with
 * `kind: 'flight'`, and their accessors. The nav is two distance fields to the finish over 8
 * neighbours (one with puff clouds closed, one with them open at a price) and the level's bounce
 * pads; the pilot remembers the point on the way it flies toward, which field it follows, whether
 * it held Up last tick (so every flap is a real press), and the set-piece plans it is flying: a
 * bounce off a cloud, a ring line, a wait at a storm zone and a pass around a racer ahead.
 */
import type { GridSize, RacerId, Vec } from '../../types.ts';
import type { MediumNav, PilotMemory } from '../types.ts';
import { wrongKind } from './data.ts';

/**
 * Flight's navigation: distances to the finish from each tile, indexed `y * width + x`, in tiles.
 * Both fields are Infinity where the finish can't be reached or the tile is closed.
 */
export interface FlightNav extends MediumNav, GridSize {
  readonly kind: 'flight';
  /** The way every flyer follows: rock and unbroken puff clouds closed. */
  steer: Float32Array;
  /** The way for a flyer with a dash ready: unbroken puff clouds open at a price, since a dash pops them. */
  ram: Float32Array;
  /** Every bounce cloud tile with open sky right above it, in reading order: where a flyer can land and spring up. */
  bouncePads: Vec[];
}

/** Which of the nav's fields a rival follows: `steer`, or `ram` while it means to dash through a puff cloud. */
export type FlightRoute = 'steer' | 'ram';

/** A flight rival's memory between ticks. */
export interface FlightPilot extends PilotMemory {
  readonly kind: 'flight';
  /** Up was pressed last tick, so the next flap has to let go of it first. */
  upHeld: boolean;
  /** The tile on the way it is flying toward, without wobble; null until it first plans. */
  waypoint: Vec | null;
  /** The point (world px) it is flying toward: `waypoint`'s centre with its wobble; set when it replans. */
  target: Vec;
  /** Unit aim from the flyer toward `target`, as of the last tick. */
  aim: Vec;
  /** Ticks until it reads the way again (`reactionTicks` apart); 0 replans this tick. */
  replanIn: number;
  /**
   * The side `target` lay on when it last read the way (-1 left, 1 right), or 0 when it lay above or
   * below. With `through`, reaching or passing that target's column has it read the way again at once.
   */
  heading: -1 | 0 | 1;
  /**
   * The way carries on toward `heading` past its target (no set piece or storm wait there), so it
   * flies through the target at full speed rather than easing to a stop on it.
   */
  through: boolean;
  /** Ticks left of a stuck recovery; 0 when not recovering. */
  recoverTicks: number;
  /** The way it backs off during a recovery. */
  recoverDir: -1 | 1;
  /** The field it follows, chosen when it replans. */
  route: FlightRoute;
  /** Ticks before it may choose the ram field again, so a dash that didn't pop a cloud isn't retried at once. */
  ramRestTicks: number;
  /** The puff cloud it dashed at and the ticks left of that dash's window; null when not dashing at one. */
  puffDash: { tile: Vec; ticksLeft: number } | null;
  /** The bounce pad it is dropping onto and the ticks it still gives that plan; null when not bouncing. */
  bounce: { pad: Vec; ticksLeft: number } | null;
  /** Ticks before it may plan another bounce, so it never bounces again in place. */
  bounceRestTicks: number;
  /** Index into `level.rings` of the ring it is flying through; null when none. */
  ring: number | null;
  /** Its skill roll for the last ring it considered, so a ring is judged once rather than on every replan. */
  ringRoll: { ring: number; takes: boolean } | null;
  /** Where it waits short of a storm zone until it can cross; null when flying on. */
  stormHold: StormHold | null;
  /** Its attempt to get past a racer ahead; null when not passing. */
  pass: Pass | null;
  /** A racer it gave up passing, and the world tick until which it follows that racer rather than try again; null when none. */
  passRest: { id: RacerId; until: number } | null;
}

/** A wait short of a storm zone. */
export interface StormHold {
  /** The x (world px) its centre waits at. */
  x: number;
  /** The way it will cross the zone (-1 left, 1 right), so it reads the racers on that side while it waits. */
  travel: -1 | 1;
}

/** An attempt to get past a racer ahead. */
export interface Pass {
  /** The racer it is passing. */
  id: RacerId;
  /** The side it is passing on: -1 over, 1 under; null while neither is open and it follows instead. */
  side: -1 | 1 | null;
  /** Ticks it still gives the attempt. */
  ticksLeft: number;
  /** The least px it has been behind that racer, centre to centre, during the attempt. */
  closest: number;
  /** Ticks since `closest` last shrank: an attempt that stops gaining is between two flyers at one speed. */
  stalledTicks: number;
}

/**
 * The world's nav as flight's.
 *
 * @throws {Error} When the nav was built by another medium.
 */
export function flightNav(nav: MediumNav): FlightNav {
  if (nav.kind !== 'flight') throw wrongKind('nav', nav.kind);
  return nav as FlightNav;
}

/**
 * A rival's pilot memory as flight's.
 *
 * @throws {Error} When the memory was created by another medium.
 */
export function flightPilot(memory: PilotMemory): FlightPilot {
  if (memory.kind !== 'flight') throw wrongKind('pilot memory', memory.kind);
  return memory as FlightPilot;
}
