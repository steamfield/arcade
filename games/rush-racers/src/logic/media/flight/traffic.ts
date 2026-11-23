/**
 * Passing in the air, as local steering: the way itself never changes. A flight rival closing on a
 * racer just ahead at its own height goes over or under it where the sky is open, preferring the
 * side its target lies on, and keeps that altitude until it is clear ahead. With no room either side
 * it follows a little behind at the leader's speed instead of bumping into it, unless the leader is
 * hardly moving (stuck), when it flies on as if the way were clear, or is flying back at it, which
 * the pilot reads as the way past it being shut.
 */
import { hasClearSweep } from '../../ai/steer.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, TILE, type World } from '../../types.ts';
import type { FlightPilot } from './way-data.ts';

/** Centre-to-centre px ahead within which a racer at the flyer's height is in its way. */
const LOOK_AHEAD_PX = 3 * TILE;
/** Px of air kept between the two racers' boxes: vertically while passing, horizontally while following. */
const GAP_PX = 4;
/** Px/s the flyer must be closing at before a racer ahead is in its way. */
const CLOSING_SPEED = 15;
/** Px the passing altitude may lie from the height the flyer's target wants; further and the pass would leave the way. */
const PASS_DETOUR_PX = 2 * TILE;
/** Extra px, past touching, a follower keeps between its centre and the leader's. */
const FOLLOW_SLACK_PX = 8;
/** Px/s of speed a follower adds per px it is further back than it means to be. */
const FOLLOW_GAIN = 4;
/** Px/s a leader must be flying on at for the flyer to follow it; one slower is stuck, and following it would stall. */
const FOLLOW_MIN_SPEED = 30;
/** Ticks a pass may take before the flyer gives it up (the racer ahead may be stuck, not slow). */
const PASS_TICKS = 180;

/** What a racer ahead means for the flyer this tick. */
export type Traffic =
  | { kind: 'clear' }
  /** Fly at this centre height (world px) to go over or under the racer ahead. */
  | { kind: 'pass'; altitude: number }
  /** No room to pass: hold this horizontal speed (px/s) to stay just behind. */
  | { kind: 'follow'; speed: number }
  /** No room to pass, and the racer ahead is flying back at the flyer: the way past it is likely shut. */
  | { kind: 'oncoming' };

/**
 * What the racer ahead means for `racer` flying `travel` (-1 left, 1 right) toward a target at height
 * `wantedY`: keep up a pass it started, start one on the open side, follow, or nothing in the way.
 * Records a pass in `memory.pass`.
 */
export function readTraffic(world: World, racer: Racer, memory: FlightPilot, travel: -1 | 1, wantedY: number): Traffic {
  const kept = passStillOn(world, racer, memory, travel, wantedY);
  if (kept !== null) return { kind: 'pass', altitude: kept };
  const leader = leaderAhead(world, racer, travel);
  if (!leader) return { kind: 'clear' };
  const side = openSide(world, racer, leader, travel, wantedY);
  if (side === null) return unpassable(racer, leader, travel);
  memory.pass = { id: leader.id, side, ticksLeft: PASS_TICKS };
  return { kind: 'pass', altitude: passAltitude(racer, leader, side) };
}

/**
 * The altitude of the pass in `memory.pass` while it is still on: it has ticks left, the racer being
 * passed is still racing, not yet left behind, not far ahead, and the passing altitude is still open
 * and near `wantedY`. Ends the pass (null) otherwise.
 */
function passStillOn(world: World, racer: Racer, memory: FlightPilot, travel: -1 | 1, wantedY: number): number | null {
  const pass = memory.pass;
  if (!pass) return null;
  pass.ticksLeft--;
  const leader = world.racers.find((other) => other.id === pass.id);
  const along = leader ? (centreOf(leader).x - centreOf(racer).x) * travel : 0;
  const passedIt = along < -(racer.body.w + GAP_PX);
  const altitude = leader ? passAltitude(racer, leader, pass.side) : 0;
  const over = pass.ticksLeft <= 0 || passedIt || along > LOOK_AHEAD_PX;
  if (!leader || !racing(leader) || over || !passable(world, racer, leader, travel, altitude, wantedY)) {
    memory.pass = null;
    return null;
  }
  return altitude;
}

/**
 * The nearest racer ahead of `racer` along `travel`, within LOOK_AHEAD_PX, overlapping its height
 * (boxes closer than GAP_PX), still racing, that `racer` is closing on or is already as close to as
 * a follower keeps. Null when there is none.
 */
function leaderAhead(world: World, racer: Racer, travel: -1 | 1): Racer | null {
  const centre = centreOf(racer);
  let nearest: Racer | null = null;
  let nearestAlong = LOOK_AHEAD_PX;
  for (const other of world.racers) {
    if (other === racer || !racing(other)) continue;
    const otherCentre = centreOf(other);
    const along = (otherCentre.x - centre.x) * travel;
    const sameHeight = Math.abs(otherCentre.y - centre.y) < (racer.body.h + other.body.h) / 2 + GAP_PX;
    const closing = (racer.body.vx - other.body.vx) * travel > CLOSING_SPEED;
    const close = along <= followGap(racer, other);
    if (along <= 0 || along > nearestAlong || !sameHeight || !(closing || close)) continue;
    nearest = other;
    nearestAlong = along;
  }
  return nearest;
}

/**
 * The side (-1 over, 1 under) to pass `leader` on, the side `wantedY` lies on first, when its
 * altitude is `passable`; null when neither is.
 */
function openSide(world: World, racer: Racer, leader: Racer, travel: -1 | 1, wantedY: number): -1 | 1 | null {
  const sides: readonly (-1 | 1)[] = wantedY > centreOf(leader).y ? [1, -1] : [-1, 1];
  for (const side of sides) {
    if (passable(world, racer, leader, travel, passAltitude(racer, leader, side), wantedY)) return side;
  }
  return null;
}

/** Whether passing at `altitude` stays within PASS_DETOUR_PX of `wantedY` and its lane is open (`laneOpen`). */
function passable(
  world: World,
  racer: Racer,
  leader: Racer,
  travel: -1 | 1,
  altitude: number,
  wantedY: number,
): boolean {
  return Math.abs(altitude - wantedY) <= PASS_DETOUR_PX && laneOpen(world, racer, leader, travel, altitude);
}

/** The centre height that clears `leader`'s box by GAP_PX on `side` (-1 over, 1 under). */
function passAltitude(racer: Racer, leader: Racer, side: -1 | 1): number {
  return centreOf(leader).y + side * ((racer.body.h + leader.body.h) / 2 + GAP_PX);
}

/**
 * True when `racer` can move straight up or down to `altitude` and fly level there to LOOK_AHEAD_PX
 * past `leader` without touching a solid tile.
 */
function laneOpen(world: World, racer: Racer, leader: Racer, travel: -1 | 1, altitude: number): boolean {
  const { level, broken } = world;
  const centre = centreOf(racer);
  if (!hasClearSweep(level, broken, racer.body, { x: centre.x, y: altitude })) return false;
  const shifted = { ...racer.body, y: altitude - racer.body.h / 2 };
  return hasClearSweep(level, broken, shifted, { x: centreOf(leader).x + travel * LOOK_AHEAD_PX, y: altitude });
}

/**
 * The horizontal speed (px/s, signed) that settles `racer` just behind `leader`: the leader's speed,
 * plus FOLLOW_GAIN per px it is further back than touching plus FOLLOW_SLACK_PX, never backwards.
 */
function followSpeed(racer: Racer, leader: Racer, travel: -1 | 1): number {
  const along = (centreOf(leader).x - centreOf(racer).x) * travel;
  const speed = leader.body.vx * travel + (along - followGap(racer, leader)) * FOLLOW_GAIN;
  return travel * Math.max(0, speed);
}

/** Centre-to-centre px a follower keeps behind `leader`: touching plus FOLLOW_SLACK_PX. */
function followGap(racer: Racer, leader: Racer): number {
  return (racer.body.w + leader.body.w) / 2 + FOLLOW_SLACK_PX;
}

/**
 * What a racer ahead with no room to pass means: follow it when it is flying on, `oncoming` when it
 * flies back at FOLLOW_MIN_SPEED or more, and nothing (fly on) when it is hardly moving.
 */
function unpassable(racer: Racer, leader: Racer, travel: -1 | 1): Traffic {
  if (followable(leader, travel)) return { kind: 'follow', speed: followSpeed(racer, leader, travel) };
  return leader.body.vx * travel <= -FOLLOW_MIN_SPEED ? { kind: 'oncoming' } : { kind: 'clear' };
}

/** Whether `leader` is flying on along `travel` fast enough to follow (FOLLOW_MIN_SPEED). */
function followable(leader: Racer, travel: -1 | 1): boolean {
  return leader.body.vx * travel >= FOLLOW_MIN_SPEED;
}

/** Still in the race: not finished and not fallen out of the sky. */
function racing(racer: Racer): boolean {
  return racer.finished === null && racer.status.fallen === 0;
}
