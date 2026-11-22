/**
 * Homing Squids in flight: launching, locking on, steering round rock, dodging, and landing a hit.
 *
 * Each tick, for every squid in `world.squids` (in order):
 * 1. it ages (`ttl`), and ends (`squid.lost`) when out of time or when its centre is inside any ink cloud;
 * 2. it settles on a target (`settleTarget`): a vanished or finished target is replaced by the nearest
 *    valid one, a squid with none looks for one, and a decoy that is as near as its racer target takes over;
 * 3. it turns toward the target by at most SQUID.turnPerTick, aiming straight at it when the line is
 *    clear and down the steer field when rock is in the way, then flies SQUID.speed px/s;
 * 4. a wall under its centre ends it (`squid.lost`);
 * 5. when its racer target kicked this tick from within SQUID.dodgeTicks of contact (distance at squid
 *    speed), it misses: `squid.dodged`, no lock, flying on straight, never locking that racer again;
 * 6. a decoy it touches pops (`popDecoy`) and the squid is spent; the first racer it touches (not its
 *    owner or the one that dodged) is hit with cause 'squid': a held Bubble Shield absorbs it
 *    (`squid.lost`), a landed hit latches the racer (`squid.latched`, `status.latched`), and an
 *    invulnerable racer is flown through.
 *
 * Turning is vector math only (no trig at run time, see num.ts): the velocity rotates by the fixed
 * per-tick angle toward the target's side, or snaps onto it once it is within that angle.
 */
import { hasClearSweep, steerDirection } from '../ai/steer.ts';
import { isSolid } from '../level/query.ts';
import { cos, length, sin } from '../num.ts';
import { popDecoy } from '../powerups/decoys.ts';
import { INK, SQUID } from '../powerups/tuning.ts';
import { centreOf, hitbox } from '../racers.ts';
import {
  type Body,
  type Racer,
  type RacerId,
  type Squid,
  type SquidTarget,
  TILE,
  type Vec,
  type World,
} from '../types.ts';
import { overlaps, squareAt } from './boxes.ts';
import { applyHit } from './hits.ts';
import { shakeOffLatches } from './latch.ts';
import { pickSquidTarget } from './squid-target.ts';

/** Cosine and sine of the largest per-tick turn, computed once with engine-exact math. */
const TURN_COS = cos(SQUID.turnPerTick);
const TURN_SIN = sin(SQUID.turnPerTick);
/** Tiles down the steer field a squid aims at when rock is in the way. */
const LOOKAHEAD_TILES = 3;

/**
 * Fires a squid from `owner`'s centre. It heads for the target `pickSquidTarget` finds (emitting
 * `squid.spawned` with the racer it locked, or null, then `squid.locked` for any target), else along
 * `aim`. `inked` is the inkSquid combo: an ink cloud bursts on the racer it latches.
 *
 * @param aim Unit direction used when there is no target.
 */
export function launchSquid(world: World, owner: Racer, aim: Vec, inked: boolean): void {
  const from = centreOf(owner);
  const target = pickSquidTarget(world, owner.id, from, null);
  const point = target ? pointOf(world, target) : null;
  const heading = (point ? directionTo(world, from, point) : null) ?? aim;
  world.squids.push({
    x: from.x,
    y: from.y,
    vx: heading.x * SQUID.speed,
    vy: heading.y * SQUID.speed,
    ttl: SQUID.ttlTicks,
    owner: owner.id,
    target,
    ...(inked ? { inked } : {}),
  });
  world.events.emit({ type: 'squid.spawned', owner: owner.id, target: target?.kind === 'racer' ? target.id : null });
  if (target) world.events.emit({ type: 'squid.locked', owner: owner.id, target: lockedName(target) });
}

/**
 * The squids slot of `stepWorld`: first latched racers' kicks (`shakeOffLatches`), then every squid's
 * tick as in the module doc.
 *
 * @param racers The active racers.
 * @param dt Tick length in seconds.
 */
export function advanceSquids(world: World, racers: readonly Racer[], dt: number): void {
  shakeOffLatches(world, racers);
  world.squids = world.squids.filter((squid) => !stepSquid(world, racers, squid, dt));
}

/** One squid's tick; true when it is spent (ended or landed) and must be removed. */
function stepSquid(world: World, racers: readonly Racer[], squid: Squid, dt: number): boolean {
  squid.ttl -= 1;
  if (squid.ttl <= 0 || insideInk(world, squid)) return lose(world, squid);
  settleTarget(world, squid);
  steer(world, squid);
  squid.x += squid.vx * dt;
  squid.y += squid.vy * dt;
  if (isSolid(world.level, world.broken, Math.floor(squid.x / TILE), Math.floor(squid.y / TILE))) {
    return lose(world, squid);
  }
  dodgeIfKicked(world, racers, squid, dt);
  return touchSomething(world, racers, squid);
}

/** Emits `squid.lost` and returns true (spent), for `stepSquid` to hand back. */
function lose(world: World, squid: Squid): true {
  world.events.emit({ type: 'squid.lost', owner: squid.owner });
  return true;
}

function insideInk(world: World, squid: Squid): boolean {
  return world.inks.some((ink) => (squid.x - ink.x) ** 2 + (squid.y - ink.y) ** 2 <= ink.radius ** 2);
}

/** Where a target is, in world px; null when it is gone (finished racer, popped or expired decoy). */
function pointOf(world: World, target: SquidTarget): Vec | null {
  if (target.kind === 'decoy') return world.decoys.find((decoy) => decoy.owner === target.owner) ?? null;
  const racer = world.racers.find((candidate) => candidate.id === target.id);
  return racer && !racer.finished ? centreOf(racer) : null;
}

function lockedName(target: SquidTarget): RacerId | 'decoy' {
  return target.kind === 'decoy' ? 'decoy' : target.id;
}

function sameTarget(a: SquidTarget, b: SquidTarget | null): boolean {
  if (!b) return false;
  if (a.kind === 'racer') return b.kind === 'racer' && a.id === b.id;
  return b.kind === 'decoy' && a.owner === b.owner;
}

/** Keeps, replaces or finds the squid's target, emitting `squid.locked` for each new one. */
function settleTarget(world: World, squid: Squid): void {
  const held = squid.target && pointOf(world, squid.target) ? squid.target : null;
  const pick = pickSquidTarget(world, squid.owner, squid, squid.dodgedBy ?? null);
  const switchToDecoy = held?.kind === 'racer' && pick?.kind === 'decoy';
  const next = held && !switchToDecoy ? held : pick;
  if (next && !sameTarget(next, held)) {
    world.events.emit({ type: 'squid.locked', owner: squid.owner, target: lockedName(next) });
  }
  squid.target = next;
}

/** Turns the squid toward where it wants to go; a squid with no target flies straight on. */
function steer(world: World, squid: Squid): void {
  const point = squid.target ? pointOf(world, squid.target) : null;
  const want = point ? directionTo(world, squid, point) : null;
  if (want) rotateToward(squid, want);
}

/**
 * The unit direction a squid at `from` should fly to reach `point`: straight at it when the way is
 * clear, else down the steer field, which leads round the rock. Null when it has no direction (on
 * top of the point, or on the finish).
 */
function directionTo(world: World, from: Vec, point: Vec): Vec | null {
  const half = SQUID.size / 2;
  const body: Body = { x: from.x - half, y: from.y - half, w: SQUID.size, h: SQUID.size, vx: 0, vy: 0 };
  if (hasClearSweep(world.level, world.broken, body, point)) return unitFrom(from, point);
  const aim = steerDirection(world.fields.steer, world.fields, world.level, world.broken, body, LOOKAHEAD_TILES);
  return aim.x === 0 && aim.y === 0 ? null : aim;
}

/** The unit vector from `from` to `to`, or null when they coincide. */
function unitFrom(from: Vec, to: Vec): Vec | null {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? null : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}

/**
 * Turns the squid's velocity toward the unit vector `want` by at most the largest per-tick turn,
 * keeping its speed: straight onto `want` when within that angle, else rotated by it toward the
 * side `want` is on (anticlockwise when dead behind).
 */
function rotateToward(squid: Squid, want: Vec): void {
  const speed = length(squid.vx, squid.vy);
  if (speed === 0) return;
  const headX = squid.vx / speed;
  const headY = squid.vy / speed;
  if (headX * want.x + headY * want.y >= TURN_COS) {
    squid.vx = want.x * speed;
    squid.vy = want.y * speed;
    return;
  }
  const side = headX * want.y - headY * want.x >= 0 ? 1 : -1;
  squid.vx = (headX * TURN_COS - headY * TURN_SIN * side) * speed;
  squid.vy = (headX * TURN_SIN * side + headY * TURN_COS) * speed;
}

/** The dodge: the racer the squid is chasing kicked this tick, within the last SQUID.dodgeTicks of contact. */
function dodgeIfKicked(world: World, racers: readonly Racer[], squid: Squid, dt: number): void {
  if (squid.target?.kind !== 'racer') return;
  const { id } = squid.target;
  const target = racers.find((racer) => racer.id === id);
  if (!target) return;
  const kicked = world.recentEvents.some((event) => event.type === 'racer.kicked' && event.id === id);
  const near = SQUID.dodgeTicks * SQUID.speed * dt;
  const centre = centreOf(target);
  if (!kicked || (centre.x - squid.x) ** 2 + (centre.y - squid.y) ** 2 > near * near) return;
  squid.target = null;
  squid.dodgedBy = id;
  world.events.emit({ type: 'squid.dodged', id });
}

/** Resolves what the squid is touching; true when it is spent. */
function touchSomething(world: World, racers: readonly Racer[], squid: Squid): boolean {
  const box = squareAt(squid, SQUID.size);
  const decoy = world.decoys.find(
    (candidate) => candidate.owner !== squid.owner && overlaps(box, squareAt(candidate, SQUID.size)),
  );
  if (decoy) {
    popDecoy(world, decoy, squid.owner);
    return lose(world, squid);
  }
  const victim = racers.find(
    (racer) => racer.id !== squid.owner && racer.id !== squid.dodgedBy && overlaps(box, hitbox(racer)),
  );
  if (!victim) return false;
  const shielded = victim.stack.includes('bubbleShield');
  if (!applyHit(world, victim, 'squid', squid.owner, squid)) return false;
  if (shielded) return lose(world, squid);
  latch(world, victim, squid);
  return true;
}

/** The squid takes hold of `victim`: `status.latched`, the event, and the inkSquid cloud. */
function latch(world: World, victim: Racer, squid: Squid): void {
  victim.status.latched = SQUID.latchedTicks;
  world.events.emit({ type: 'squid.latched', id: victim.id, by: squid.owner });
  if (!squid.inked) return;
  const centre = centreOf(victim);
  world.inks.push({ x: centre.x, y: centre.y, radius: INK.bombRadius, ttl: INK.ttlTicks, owner: squid.owner });
  world.events.emit({ type: 'ink.spawned', owner: squid.owner });
}
