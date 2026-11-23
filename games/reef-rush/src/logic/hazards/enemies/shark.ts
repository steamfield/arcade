/**
 * Sharks: patrol a lane either side of home, wind up on a racer they see ahead, then charge at where
 * it was when the wind-up ended, turning after it mid-charge on levels that allow it. A bonk staggers
 * one (harmless, knocked back along the bonk).
 *
 * Modes: 'patrol' → 'windup' (SHARK.windupTicks, `enemy.telegraphed`) → 'charge' (up to
 * SHARK.chargeTicks, `enemy.charged`, cut short by rock) → 'recover' (the level's `recoverTicks`,
 * still) → 'patrol'. A wind-up whose target has finished goes straight back to 'patrol'. A bonk from
 * any of them goes to 'stagger' for SHARK.staggerTicks, then 'patrol'. How far it sees and patrols,
 * how long it recovers and how hard it turns mid-charge come from the level's `SharkTuning`
 * (`tuningOf(world).shark`). Deterministic: no randomness.
 */
import { TICK_DT } from '@arcade/core';
import { hasClearSweep } from '../../ai/steer.ts';
import { tuningOf } from '../../difficulty-level.ts';
import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { isDowned, isInvulnerable } from '../../status.ts';
import { type Enemy, type EnemyMode, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { enemyBox } from './contact.ts';
import { SHARK } from './tuning.ts';

const ORIGIN: Vec = { x: 0, y: 0 };

/**
 * One shark's tick, by mode. Emits `enemy.telegraphed` when a wind-up starts and `enemy.charged` when
 * the charge starts.
 *
 * @param index The shark's place in `world.enemies`, for events.
 * @param racers The racers in play, in tick order.
 */
export function stepShark(world: World, shark: Enemy, index: number, racers: readonly Racer[]): void {
  shark.modeTicks += 1;
  if (shark.mode === 'patrol') patrol(world, shark, index, racers);
  else if (shark.mode === 'windup') windUp(world, shark, index, racers);
  else if (shark.mode === 'charge') charge(world, shark, racers);
  else if (shark.mode === 'recover') recover(world, shark);
  else if (shark.mode === 'stagger') stagger(world, shark);
}

/** A bonk that didn't beat it: staggered, knocked straight away from `racer`, its charge called off. */
export function staggerShark(shark: Enemy, racer: Racer): void {
  const away = unitFrom(centreOf(racer), shark.at, { x: racer.facing, y: 0 });
  enter(shark, 'stagger');
  shark.target = null;
  shark.vel = { x: away.x * SHARK.staggerSpeed, y: away.y * SHARK.staggerSpeed };
}

/**
 * Swims along its facing at SHARK.patrolSpeed, drifting back to its home row, and turns at the end
 * of its lane or at rock. Within its lane (the level's `patrolTiles` of home) it starts a wind-up on the
 * racer it spots, if any; outside it, it only swims back.
 */
function patrol(world: World, shark: Enemy, index: number, racers: readonly Racer[]): void {
  const home = { x: (shark.home.x + 0.5) * TILE, y: (shark.home.y + 0.5) * TILE };
  const reach = tuningOf(world).shark.patrolTiles * TILE;
  // Away from its lane (after a charge) it swims home before it hunts again, so it guards one stretch.
  const inLane = Math.abs(shark.at.x - home.x) <= reach;
  const spotted = inLane ? spot(world, shark, racers) : null;
  if (spotted) {
    enter(shark, 'windup');
    shark.target = spotted.id;
    shark.vel = { x: 0, y: 0 };
    world.events.emit({ type: 'enemy.telegraphed', index, kind: 'shark' });
    return;
  }
  if ((shark.at.x - home.x) * shark.facing >= reach) shark.facing = shark.facing === 1 ? -1 : 1;
  const step = SHARK.patrolSpeed * TICK_DT;
  const dy = Math.max(-step, Math.min(step, home.y - shark.at.y));
  shark.vel = { x: shark.facing * SHARK.patrolSpeed, y: dy / TICK_DT };
  if (!move(world, shark)) {
    shark.facing = shark.facing === 1 ? -1 : 1;
    shark.vel = { x: 0, y: 0 };
  }
}

/**
 * Holds still for the tell, then charges at where its target is now. A target that has finished or
 * left the race by then calls the charge off: back to patrol, nothing emitted.
 */
function windUp(world: World, shark: Enemy, index: number, racers: readonly Racer[]): void {
  if (shark.modeTicks < SHARK.windupTicks) return;
  const target = racers.find((racer) => racer.id === shark.target && racer.finished === null);
  if (!target) {
    enter(shark, 'patrol');
    shark.target = null;
    return;
  }
  const aim = unitFrom(shark.at, centreOf(target), { x: shark.facing, y: 0 });
  enter(shark, 'charge');
  shark.vel = { x: aim.x * SHARK.chargeSpeed, y: aim.y * SHARK.chargeSpeed };
  if (aim.x !== 0) shark.facing = aim.x > 0 ? 1 : -1;
  world.events.emit({ type: 'enemy.charged', index, kind: 'shark', target: target.id });
}

/** Moves on, turning toward its target as the level allows, until the charge runs out or rock stops it, then recovers. */
function charge(world: World, shark: Enemy, racers: readonly Racer[]): void {
  if (shark.modeTicks <= SHARK.chargeTicks) {
    steerCharge(world, shark, racers);
    if (move(world, shark)) return;
  }
  enter(shark, 'recover');
  shark.vel = { x: 0, y: 0 };
}

/**
 * Blends the level's `chargeTurn` of the unit direction to its target into its heading, keeping
 * SHARK.chargeSpeed, while that target is still racing and neither downed nor invulnerable. With a
 * `chargeTurn` of 0 or no such target it keeps its heading.
 */
function steerCharge(world: World, shark: Enemy, racers: readonly Racer[]): void {
  const turn = tuningOf(world).shark.chargeTurn;
  if (turn <= 0) return;
  const target = racers.find((racer) => racer.id === shark.target && racer.finished === null);
  if (!target || isDowned(target) || isInvulnerable(target)) return;
  const heading = unitFrom(ORIGIN, shark.vel, { x: shark.facing, y: 0 });
  const toTarget = unitFrom(shark.at, centreOf(target), heading);
  const blended = { x: heading.x + turn * toTarget.x, y: heading.y + turn * toTarget.y };
  const dir = unitFrom(ORIGIN, blended, heading);
  shark.vel = { x: dir.x * SHARK.chargeSpeed, y: dir.y * SHARK.chargeSpeed };
  if (shark.vel.x !== 0) shark.facing = shark.vel.x > 0 ? 1 : -1;
}

/** Sits still for the level's `recoverTicks`, then patrols again. */
function recover(world: World, shark: Enemy): void {
  if (shark.modeTicks < tuningOf(world).shark.recoverTicks) return;
  enter(shark, 'patrol');
  shark.target = null;
}

/** Drifts back along the bonk, slowing, until the stagger wears off. */
function stagger(world: World, shark: Enemy): void {
  shark.vel = { x: shark.vel.x * SHARK.staggerDragPerTick, y: shark.vel.y * SHARK.staggerDragPerTick };
  if (!move(world, shark)) shark.vel = { x: 0, y: 0 };
  if (shark.modeTicks >= SHARK.staggerTicks) {
    enter(shark, 'patrol');
    shark.vel = { x: 0, y: 0 };
  }
}

/**
 * The nearest racer it can see: ahead in its facing within the level's `sightTiles`, no further off level
 * than ahead (45 degrees), with a clear sweep from its box, and neither downed nor invulnerable.
 * On Easy it never picks the player. Ties go to the earlier racer in tick order.
 */
function spot(world: World, shark: Enemy, racers: readonly Racer[]): Racer | null {
  const sight = tuningOf(world).shark.sightTiles * TILE;
  let best: Racer | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const racer of racers) {
    if (racer.id === 'player' && world.difficulty === 'easy') continue;
    if (isDowned(racer) || isInvulnerable(racer)) continue;
    const centre = centreOf(racer);
    const ahead = (centre.x - shark.at.x) * shark.facing;
    const side = Math.abs(centre.y - shark.at.y);
    const distance = length(ahead, side);
    if (ahead <= 0 || side > ahead || distance > sight || distance >= bestDistance) continue;
    if (!hasClearSweep(world.level, world.broken, enemyBox(shark), centre)) continue;
    best = racer;
    bestDistance = distance;
  }
  return best;
}

/** Moves the shark one tick along its velocity unless that sweeps it into rock; true when it moved. */
function move(world: World, shark: Enemy): boolean {
  const next = { x: shark.at.x + shark.vel.x * TICK_DT, y: shark.at.y + shark.vel.y * TICK_DT };
  if (!hasClearSweep(world.level, world.broken, enemyBox(shark), next)) return false;
  shark.at = next;
  return true;
}

function enter(shark: Enemy, mode: EnemyMode): void {
  shark.mode = mode;
  shark.modeTicks = 0;
}

/** The unit vector from `from` to `to`, or `fallback` when they coincide. */
function unitFrom(from: Vec, to: Vec, fallback: Vec): Vec {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? fallback : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}
